using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Persistence;
using SalesSystem.Tests.Auth;

namespace SalesSystem.Tests.Customers;

public sealed class CustomerApiTests : IClassFixture<SalesSystemWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CustomerApiTests(SalesSystemWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateCustomer_WithMasterMaintainerRole_CreatesCustomerAndInitialVersion()
    {
        // MasterMaintainer ロールがあれば得意先と初回履歴を同時に登録できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerCode = NewCustomerCode();

        using var response = await client.PostAsJsonAsync("/api/customers", new
        {
            customerCode,
            name = "株式会社サンプル",
            address = "東京都千代田区1-1-1",
            phoneNumber = "03-1234-5678",
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CustomerSummary>();
        Assert.NotNull(created);
        Assert.Equal(customerCode, created.CustomerCode);
        Assert.Equal("株式会社サンプル", created.Name);
        Assert.Equal(new DateTime(2026, 1, 1), created.EffectiveFrom);
    }

    [Fact]
    public async Task CreateCustomer_WithDuplicateCustomerCode_ReturnsConflict()
    {
        // 同じ得意先コードで新規登録すると競合エラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerCode = NewCustomerCode();
        var request = new
        {
            customerCode,
            name = "株式会社サンプル",
            address = "東京都千代田区1-1-1",
            phoneNumber = "03-1234-5678",
            effectiveFrom = "2026-01-01"
        };

        using var first = await client.PostAsJsonAsync("/api/customers", request);
        using var second = await client.PostAsJsonAsync("/api/customers", request);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task CreateCustomer_WithInvalidInput_ReturnsValidationProblem()
    {
        // 必須項目が不正な場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/customers", new
        {
            customerCode = "",
            name = "",
            address = "",
            phoneNumber = "",
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomer_ResponseDoesNotExposeInternalHistoryId()
    {
        // 得意先詳細レスポンスに内部履歴 ID が含まれないことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateCustomerAsync(client, NewCustomerCode(), "2026-01-01", "株式会社サンプル");

        using var response = await client.GetAsync($"/api/customers/{created.CustomerId}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("customerVersionId", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ChangeCustomer_AddsHistoryWithoutUpdatingExistingVersion()
    {
        // 得意先変更時に既存履歴を更新せず新しい履歴として保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateCustomerAsync(client, NewCustomerCode(), "2026-01-01", "旧得意先名");

        using var response = await client.PostAsJsonAsync($"/api/customers/{created.CustomerId}/changes", new
        {
            name = "新得意先名",
            address = "東京都中央区2-2-2",
            phoneNumber = "03-2345-6789",
            effectiveFrom = "2026-03-01"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var versions = await dbContext.CustomerVersions
            .Where(version => version.CustomerId == created.CustomerId)
            .OrderBy(version => version.ValidFrom)
            .ToListAsync();

        Assert.Equal(2, versions.Count);
        Assert.Equal("旧得意先名", versions[0].Name);
        Assert.Equal(new DateTime(2026, 1, 1), versions[0].ValidFrom);
        Assert.Equal("新得意先名", versions[1].Name);
        Assert.Equal(new DateTime(2026, 3, 1), versions[1].ValidFrom);
    }

    [Fact]
    public async Task ChangeCustomer_WithDuplicateEffectiveFrom_ReturnsConflict()
    {
        // 同じ得意先に同じ適用開始日の情報を追加すると競合エラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateCustomerAsync(client, NewCustomerCode(), "2026-01-01", "株式会社サンプル");

        using var response = await client.PostAsJsonAsync($"/api/customers/{created.CustomerId}/changes", new
        {
            name = "株式会社サンプル 改定",
            address = "東京都中央区2-2-2",
            phoneNumber = "03-2345-6789",
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomers_ReturnsCurrentVersionAndAppliesFilters()
    {
        // 得意先一覧で現在有効な履歴を返し、得意先コード・得意先名で絞り込めることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var targetCode = NewCustomerCode();
        await CreateCustomerAsync(client, targetCode, "2026-01-01", "検索対象株式会社");
        await CreateCustomerAsync(client, NewCustomerCode(), "2026-01-01", "別会社");

        using var response = await client.GetAsync($"/api/customers?customerCode={targetCode}&name=検索対象");
        var customers = await response.Content.ReadFromJsonAsync<List<CustomerSummary>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(customers);
        var customer = Assert.Single(customers);
        Assert.Equal(targetCode, customer.CustomerCode);
        Assert.Equal("検索対象株式会社", customer.Name);
    }

    [Fact]
    public async Task GetCustomers_UsesJapanBusinessDateForCurrentVersion()
    {
        // UTC では前日でも日本時間では当日になる場合に、日本時間の業務日付で現在履歴を判定することを確認する。
        using var fixedTimeFactory = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<TimeProvider>(
                    new FixedTimeProvider(new DateTimeOffset(2026, 6, 1, 15, 30, 0, TimeSpan.Zero)));
            });
        });
        await ResetDatabaseAsync(fixedTimeFactory);
        using var client = CreateMasterMaintainerClient(fixedTimeFactory);
        var customerCode = NewCustomerCode();
        var created = await CreateCustomerAsync(client, customerCode, "2026-06-01", "旧得意先名");
        using var changeResponse = await client.PostAsJsonAsync($"/api/customers/{created.CustomerId}/changes", new
        {
            name = "日本時間の当日得意先名",
            address = "東京都中央区2-2-2",
            phoneNumber = "03-2345-6789",
            effectiveFrom = "2026-06-02"
        });
        changeResponse.EnsureSuccessStatusCode();

        using var response = await client.GetAsync($"/api/customers?customerCode={customerCode}");
        var customers = await response.Content.ReadFromJsonAsync<List<CustomerSummary>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(customers);
        var customer = Assert.Single(customers);
        Assert.Equal("日本時間の当日得意先名", customer.Name);
        Assert.Equal(new DateTime(2026, 6, 2), customer.EffectiveFrom);
    }

    [Fact]
    public async Task GetCustomer_WithAsOf_ReturnsLatestChangeOnOrBeforeAsOfDate()
    {
        // 指定日以前で一番新しい得意先情報が asOf 指定の詳細結果として返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateCustomerAsync(client, NewCustomerCode(), "2026-01-01", "旧得意先名");
        using var _ = await client.PostAsJsonAsync($"/api/customers/{created.CustomerId}/changes", new
        {
            name = "新得意先名",
            address = "東京都中央区2-2-2",
            phoneNumber = "03-2345-6789",
            effectiveFrom = "2026-04-01"
        });

        using var response = await client.GetAsync($"/api/customers/{created.CustomerId}?asOf=2026-04-15T23:59:59");
        var customer = await response.Content.ReadFromJsonAsync<CustomerSummary>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(customer);
        Assert.Equal("新得意先名", customer.Name);
        Assert.Equal(new DateTime(2026, 4, 1), customer.EffectiveFrom);
    }

    [Fact]
    public async Task GetCustomer_BeforeInitialEffectiveFrom_ReturnsNotFound()
    {
        // 初回適用開始日より前の日付では適用できる履歴なしとして扱うことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateCustomerAsync(client, NewCustomerCode(), "2026-01-01", "株式会社サンプル");

        using var response = await client.GetAsync($"/api/customers/{created.CustomerId}?asOf=2025-12-31");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CustomerReadApi_WithoutUserHeader_ReturnsUnauthorized()
    {
        // 認証ヘッダーなしでは得意先マスタ参照 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/customers");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CustomerWriteApi_WithoutMasterMaintainerRole_ReturnsForbidden()
    {
        // MasterMaintainer ロールなしでは得意先マスタ登録 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1");

        using var response = await client.PostAsJsonAsync("/api/customers", new
        {
            customerCode = NewCustomerCode(),
            name = "株式会社サンプル",
            address = "東京都千代田区1-1-1",
            phoneNumber = "03-1234-5678",
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private HttpClient CreateMasterMaintainerClient()
    {
        return CreateMasterMaintainerClient(_factory);
    }

    private static HttpClient CreateMasterMaintainerClient(WebApplicationFactory<Program> factory)
    {
        var client = factory.CreateClient();
        client.SetDummyUser("master1", Roles.MasterMaintainer);
        return client;
    }

    private static async Task<CustomerSummary> CreateCustomerAsync(
        HttpClient client,
        string customerCode,
        string effectiveFrom,
        string name)
    {
        using var response = await client.PostAsJsonAsync("/api/customers", new
        {
            customerCode,
            name,
            address = "東京都千代田区1-1-1",
            phoneNumber = "03-1234-5678",
            effectiveFrom
        });

        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CustomerSummary>())!;
    }

    private async Task ResetDatabaseAsync()
    {
        await ResetDatabaseAsync(_factory);
    }

    private static async Task ResetDatabaseAsync(WebApplicationFactory<Program> factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();
    }

    private static string NewCustomerCode()
    {
        return $"C{Guid.NewGuid():N}"[..30];
    }

    private sealed record CustomerSummary(
        long CustomerId,
        string CustomerCode,
        string Name,
        string Address,
        string PhoneNumber,
        DateTime EffectiveFrom);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return utcNow;
        }
    }
}
