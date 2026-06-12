using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Persistence;
using SalesSystem.Tests.Auth;

namespace SalesSystem.Tests.Taxes;

public sealed class TaxRateApiTests : IClassFixture<SalesSystemWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;

    public TaxRateApiTests(SalesSystemWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ChangeTaxRate_WithMasterMaintainerRole_ChangesTaxRate()
    {
        // MasterMaintainer ロールがあれば税率を登録できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", new
        {
            rate = 0.1m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var changed = await response.Content.ReadFromJsonAsync<TaxRateResponse>();
        Assert.NotNull(changed);
        Assert.Equal("STANDARD", changed.TaxCategory);
        Assert.Equal("標準税率", changed.TaxCategoryName);
        Assert.Equal("TAXABLE_STANDARD", changed.AccountingCategory);
        Assert.Equal(0.1m, changed.Rate);
        Assert.Equal(new DateTime(2026, 1, 1), changed.EffectiveFrom);
    }

    [Theory]
    [InlineData("STANDARD", "標準税率", "TAXABLE_STANDARD", "0.10")]
    [InlineData("REDUCED", "軽減税率", "TAXABLE_REDUCED", "0.08")]
    [InlineData("NON_TAXABLE", "非課税", "NON_TAXABLE", "0.00")]
    [InlineData("TAX_EXEMPT", "免税", "TAX_EXEMPT", "0.00")]
    [InlineData("OLD_STANDARD", "旧標準税率", "TAXABLE_OLD_STANDARD", "0.08")]
    public async Task ChangeTaxRate_WithDefinedTaxCategory_ChangesTaxRateWithCategoryMetadata(
        string taxCategory,
        string taxCategoryName,
        string accountingCategory,
        string rateText)
    {
        // 定義済み税区分を登録すると税区分名と会計分類が保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var rate = decimal.Parse(rateText);

        using var response = await client.PostAsJsonAsync($"/api/tax-rates/{taxCategory}/changes", new
        {
            rate,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var changed = await response.Content.ReadFromJsonAsync<TaxRateResponse>();
        Assert.NotNull(changed);
        Assert.Equal(taxCategory, changed.TaxCategory);
        Assert.Equal(taxCategoryName, changed.TaxCategoryName);
        Assert.Equal(accountingCategory, changed.AccountingCategory);
        Assert.Equal(rate, changed.Rate);
    }

    [Fact]
    public async Task ChangeTaxRate_WithSameRateAndDifferentTaxCategory_CreatesSeparateRates()
    {
        // 同じ税率値でも税区分が異なれば別レコードとして登録できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        await ChangeTaxRateAsync(client, "REDUCED", 0.08m, "2026-01-01");
        await ChangeTaxRateAsync(client, "OLD_STANDARD", 0.08m, "2026-01-01");

        using var response = await client.GetAsync("/api/tax-rates?asOf=2026-04-15");
        var taxRates = await response.Content.ReadFromJsonAsync<List<TaxRateResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(taxRates);
        Assert.Contains(taxRates, taxRate => taxRate.TaxCategory == "REDUCED" && taxRate.Rate == 0.08m);
        Assert.Contains(taxRates, taxRate => taxRate.TaxCategory == "OLD_STANDARD" && taxRate.Rate == 0.08m);
    }

    [Fact]
    public async Task ChangeTaxRate_WithDuplicateEffectiveFrom_ReturnsConflict()
    {
        // 同じ税区分と適用開始日の税率を登録すると競合エラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var request = new
        {
            rate = 0.1m,
            effectiveFrom = "2026-01-01"
        };

        using var first = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", request);
        using var second = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", request);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task ChangeTaxRate_WithInvalidInput_ReturnsValidationProblem()
    {
        // 必須項目や税率精度が不正な場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", new
        {
            rate = 0.12345m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeTaxRate_WithUnknownTaxCategory_ReturnsValidationProblem()
    {
        // 定義されていない税区分を指定するとバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/UNKNOWN/changes", new
        {
            rate = 0.1m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeTaxRate_WithNonTaxableNonZeroRate_ReturnsValidationProblem()
    {
        // 非課税と免税に0以外の税率を指定するとバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/NON_TAXABLE/changes", new
        {
            rate = 0.1m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeTaxRate_WithTaxableZeroRate_ReturnsValidationProblem()
    {
        // 課税対象の税区分に0税率を指定するとバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", new
        {
            rate = 0m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeTaxRate_WithRateOverDatabasePrecision_ReturnsValidationProblem()
    {
        // DB 精度を超える税率を指定した場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", new
        {
            rate = 10m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChangeTaxRate_ResponseDoesNotContainTaxRateId()
    {
        // 通常レスポンスに内部履歴 ID が含まれないことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", new
        {
            rate = 0.1m,
            effectiveFrom = "2026-01-01"
        });
        var json = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("taxRateId", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetTaxRates_ReturnsOneRatePerCategoryAtAsOf()
    {
        // 指定日時点で税区分ごとに1件ずつ適用税率が返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        await ChangeTaxRateAsync(client, "STANDARD", 0.08m, "2026-01-01");
        await ChangeTaxRateAsync(client, "REDUCED", 0.08m, "2026-01-01");
        await ChangeTaxRateAsync(client, "STANDARD", 0.1m, "2026-04-01");

        using var response = await client.GetAsync("/api/tax-rates?asOf=2026-04-15");
        var taxRates = await response.Content.ReadFromJsonAsync<List<TaxRateResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(taxRates);
        Assert.Equal(2, taxRates.Count);

        var standard = Assert.Single(taxRates, taxRate => taxRate.TaxCategory == "STANDARD");
        Assert.Equal(0.1m, standard.Rate);
        Assert.Equal(new DateTime(2026, 4, 1), standard.EffectiveFrom);

        var reduced = Assert.Single(taxRates, taxRate => taxRate.TaxCategory == "REDUCED");
        Assert.Equal(0.08m, reduced.Rate);
        Assert.Equal(new DateTime(2026, 1, 1), reduced.EffectiveFrom);
    }

    [Fact]
    public async Task GetTaxRate_ReturnsLatestRateOnOrBeforeAsOf()
    {
        // 指定日以前で一番新しい税率が詳細結果として返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        await ChangeTaxRateAsync(client, "STANDARD", 0.08m, "2026-01-01");
        await ChangeTaxRateAsync(client, "STANDARD", 0.1m, "2026-04-01");

        using var response = await client.GetAsync("/api/tax-rates/STANDARD?asOf=2026-04-15");
        var detail = await response.Content.ReadFromJsonAsync<TaxRateResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(detail);
        Assert.Equal(0.1m, detail.Rate);
        Assert.Equal(new DateTime(2026, 4, 1), detail.EffectiveFrom);
    }

    [Fact]
    public async Task GetTaxRate_BeforeInitialEffectiveFrom_ReturnsNotFound()
    {
        // 初回適用開始日より前の日付では適用できる税率なしとして扱うことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        await ChangeTaxRateAsync(client, "STANDARD", 0.1m, "2026-01-01");

        using var response = await client.GetAsync("/api/tax-rates/STANDARD?asOf=2025-12-31");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetTaxRate_WithUnknownTaxCategory_ReturnsValidationProblem()
    {
        // 定義されていない税区分を指定すると詳細取得でバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.GetAsync("/api/tax-rates/UNKNOWN?asOf=2026-04-15");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetTaxRateChanges_ReturnsAllChangesDescending()
    {
        // 税区分の変更履歴が適用開始日降順で返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        await ChangeTaxRateAsync(client, "STANDARD", 0.08m, "2026-01-01");
        await ChangeTaxRateAsync(client, "STANDARD", 0.1m, "2026-04-01");

        using var response = await client.GetAsync("/api/tax-rates/STANDARD/changes");
        var changes = await response.Content.ReadFromJsonAsync<List<TaxRateChangeResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(changes);
        Assert.Equal(2, changes.Count);
        Assert.All(changes, change => Assert.Equal("STANDARD", change.TaxCategory));
        Assert.Equal(0.1m, changes[0].Rate);
        Assert.Equal(new DateTime(2026, 4, 1), changes[0].EffectiveFrom);
        Assert.Equal(0.08m, changes[1].Rate);
        Assert.Equal(new DateTime(2026, 1, 1), changes[1].EffectiveFrom);
    }

    [Fact]
    public async Task TaxRateReadApi_WithoutUserHeader_ReturnsUnauthorized()
    {
        // 認証ヘッダーなしでは税率マスタ参照 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/tax-rates");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TaxRateWriteApi_WithoutMasterMaintainerRole_ReturnsForbidden()
    {
        // MasterMaintainer ロールなしでは税率マスタ登録 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1");

        using var response = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", new
        {
            rate = 0.1m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task TaxRateWriteApi_WithMasterMaintainerRole_CanPassAuthorization()
    {
        // MasterMaintainer ロールがあれば税率マスタ登録 API の認可を通過できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates/STANDARD/changes", new
        {
            rate = 0.1m,
            effectiveFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private HttpClient CreateMasterMaintainerClient()
    {
        var client = _factory.CreateClient();
        client.SetDummyUser("master1", Roles.MasterMaintainer);
        return client;
    }

    private static async Task ChangeTaxRateAsync(
        HttpClient client,
        string taxCategory,
        decimal rate,
        string effectiveFrom)
    {
        using var response = await client.PostAsJsonAsync($"/api/tax-rates/{taxCategory}/changes", new
        {
            rate,
            effectiveFrom
        });

        response.EnsureSuccessStatusCode();
    }

    private async Task ResetDatabaseAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();
    }

    private sealed record TaxRateResponse(
        string TaxCategory,
        string TaxCategoryName,
        string AccountingCategory,
        decimal Rate,
        DateTime EffectiveFrom);

    private sealed record TaxRateChangeResponse(
        string TaxCategory,
        string TaxCategoryName,
        string AccountingCategory,
        decimal Rate,
        DateTime EffectiveFrom);
}
