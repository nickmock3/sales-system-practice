using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Persistence;
using SalesSystem.Tests.Auth;

namespace SalesSystem.Tests.Products;

public sealed class ProductApiTests : IClassFixture<SalesSystemWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ProductApiTests(SalesSystemWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateProduct_WithMasterMaintainerRole_CreatesProductAndInitialVersion()
    {
        // MasterMaintainer ロールがあれば商品と初回履歴を同時に登録できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var productCode = NewProductCode();

        using var response = await client.PostAsJsonAsync("/api/products", new
        {
            productCode,
            name = "コピー用紙 A4",
            unit = "箱",
            standardUnitPrice = 1200m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ProductResponse>();
        Assert.NotNull(created);
        Assert.Equal(productCode, created.ProductCode);
        Assert.Equal("コピー用紙 A4", created.Name);
        Assert.Equal(new DateTime(2026, 1, 1), created.ValidFrom);
    }

    [Fact]
    public async Task CreateProduct_WithDuplicateProductCode_ReturnsConflict()
    {
        // 同じ商品コードで新規登録すると競合エラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var productCode = NewProductCode();
        var request = new
        {
            productCode,
            name = "ボールペン",
            unit = "本",
            standardUnitPrice = 100m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-01-01"
        };

        using var first = await client.PostAsJsonAsync("/api/products", request);
        using var second = await client.PostAsJsonAsync("/api/products", request);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task CreateProduct_WithInvalidInput_ReturnsValidationProblem()
    {
        // 必須項目や金額精度が不正な場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/products", new
        {
            productCode = "",
            name = "",
            unit = "箱",
            standardUnitPrice = 10.123m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateProductVersion_AddsHistoryWithoutUpdatingExistingVersion()
    {
        // 商品履歴追加時に既存履歴を更新せず新しい履歴として保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateProductAsync(client, NewProductCode(), "2026-01-01", "旧商品名", false);

        using var response = await client.PostAsJsonAsync($"/api/products/{created.ProductId}/versions", new
        {
            name = "新商品名",
            unit = "箱",
            standardUnitPrice = 1300m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-03-01"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var versionsResponse = await client.GetAsync($"/api/products/{created.ProductId}/versions");
        var versions = await versionsResponse.Content.ReadFromJsonAsync<List<ProductVersionResponse>>();

        Assert.Equal(HttpStatusCode.OK, versionsResponse.StatusCode);
        Assert.NotNull(versions);
        Assert.Equal(2, versions.Count);
        Assert.Equal("新商品名", versions[0].Name);
        Assert.Equal(new DateTime(2026, 3, 1), versions[0].ValidFrom);
        Assert.Equal("旧商品名", versions[1].Name);
        Assert.Equal(new DateTime(2026, 1, 1), versions[1].ValidFrom);
    }

    [Fact]
    public async Task CreateProductVersion_WithDuplicateValidFrom_ReturnsConflict()
    {
        // 同じ商品に同じ適用開始日の履歴を追加すると競合エラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateProductAsync(client, NewProductCode(), "2026-01-01", "コピー用紙", false);

        using var response = await client.PostAsJsonAsync($"/api/products/{created.ProductId}/versions", new
        {
            name = "コピー用紙 改定",
            unit = "箱",
            standardUnitPrice = 1300m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task GetProducts_ReturnsCurrentVersionAndAppliesFilters()
    {
        // 商品一覧で現在有効な履歴を返し、商品コード・商品名・販売状態で絞り込めることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var activeCode = NewProductCode();
        var discontinuedCode = NewProductCode();
        await CreateProductAsync(client, activeCode, "2026-01-01", "検索対象ノート", false);
        await CreateProductAsync(client, discontinuedCode, "2026-01-01", "販売停止ノート", true);

        using var response = await client.GetAsync($"/api/products?productCode={activeCode}&name=検索対象&isDiscontinued=false");
        var products = await response.Content.ReadFromJsonAsync<List<ProductListItemResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(products);
        var product = Assert.Single(products);
        Assert.Equal(activeCode, product.ProductCode);
        Assert.Equal("検索対象ノート", product.Name);
        Assert.False(product.IsDiscontinued);
    }

    [Fact]
    public async Task GetProducts_UsesJapanBusinessDateForCurrentVersion()
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
        var productCode = NewProductCode();
        var created = await CreateProductAsync(client, productCode, "2026-06-01", "旧商品名", false);
        using var versionResponse = await client.PostAsJsonAsync($"/api/products/{created.ProductId}/versions", new
        {
            name = "日本時間の当日商品名",
            unit = "箱",
            standardUnitPrice = 1300m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-06-02"
        });
        versionResponse.EnsureSuccessStatusCode();

        using var response = await client.GetAsync($"/api/products?productCode={productCode}");
        var products = await response.Content.ReadFromJsonAsync<List<ProductListItemResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(products);
        var product = Assert.Single(products);
        Assert.Equal("日本時間の当日商品名", product.Name);
        Assert.Equal(new DateTime(2026, 6, 2), product.ValidFrom);
    }

    [Fact]
    public async Task PreviewProduct_ReturnsLatestVersionOnOrBeforeTargetDate()
    {
        // 指定日以前で一番新しい商品履歴がプレビュー結果として返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateProductAsync(client, NewProductCode(), "2026-01-01", "旧商品名", false);
        using var _ = await client.PostAsJsonAsync($"/api/products/{created.ProductId}/versions", new
        {
            name = "新商品名",
            unit = "箱",
            standardUnitPrice = 1500m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-04-01"
        });

        using var response = await client.GetAsync($"/api/products/{created.ProductId}/preview?targetDate=2026-04-15T23:59:59");
        var preview = await response.Content.ReadFromJsonAsync<ProductVersionResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal("新商品名", preview.Name);
        Assert.Equal(new DateTime(2026, 4, 1), preview.ValidFrom);
    }

    [Fact]
    public async Task PreviewProduct_BeforeInitialValidFrom_ReturnsNotFound()
    {
        // 初回適用開始日より前の日付では適用できる履歴なしとして扱うことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var created = await CreateProductAsync(client, NewProductCode(), "2026-01-01", "コピー用紙", false);

        using var response = await client.GetAsync($"/api/products/{created.ProductId}/preview?targetDate=2025-12-31");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ProductReadApi_WithoutUserHeader_ReturnsUnauthorized()
    {
        // 認証ヘッダーなしでは商品マスタ参照 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProductWriteApi_WithoutMasterMaintainerRole_ReturnsForbidden()
    {
        // MasterMaintainer ロールなしでは商品マスタ登録 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1");

        using var response = await client.PostAsJsonAsync("/api/products", new
        {
            productCode = NewProductCode(),
            name = "コピー用紙",
            unit = "箱",
            standardUnitPrice = 1200m,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            validFrom = "2026-01-01"
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

    private async Task<ProductResponse> CreateProductAsync(
        HttpClient client,
        string productCode,
        string validFrom,
        string name,
        bool isDiscontinued)
    {
        using var response = await client.PostAsJsonAsync("/api/products", new
        {
            productCode,
            name,
            unit = "箱",
            standardUnitPrice = 1200m,
            taxCategory = "STANDARD",
            isDiscontinued,
            validFrom
        });

        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ProductResponse>())!;
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

    private static string NewProductCode()
    {
        return $"P{Guid.NewGuid():N}"[..30];
    }

    private sealed record ProductResponse(
        long ProductId,
        string ProductCode,
        long ProductVersionId,
        string Name,
        string Unit,
        decimal StandardUnitPrice,
        string TaxCategory,
        bool IsDiscontinued,
        DateTime ValidFrom);

    private sealed record ProductListItemResponse(
        long ProductId,
        string ProductCode,
        long ProductVersionId,
        string Name,
        string Unit,
        decimal StandardUnitPrice,
        string TaxCategory,
        bool IsDiscontinued,
        DateTime ValidFrom);

    private sealed record ProductVersionResponse(
        long ProductVersionId,
        long ProductId,
        string ProductCode,
        string Name,
        string Unit,
        decimal StandardUnitPrice,
        string TaxCategory,
        bool IsDiscontinued,
        DateTime ValidFrom);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow()
        {
            return utcNow;
        }
    }
}
