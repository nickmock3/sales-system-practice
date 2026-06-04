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
    public async Task CreateTaxRate_WithMasterMaintainerRole_CreatesTaxRate()
    {
        // MasterMaintainer ロールがあれば税率を登録できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "STANDARD",
            rate = 0.1m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<TaxRateResponse>();
        Assert.NotNull(created);
        Assert.Equal("STANDARD", created.TaxCategory);
        Assert.Equal("標準税率", created.TaxCategoryName);
        Assert.Equal("TAXABLE_STANDARD", created.AccountingCategory);
        Assert.Equal(0.1m, created.Rate);
        Assert.Equal(new DateTime(2026, 1, 1), created.ValidFrom);
    }

    [Theory]
    [InlineData("STANDARD", "標準税率", "TAXABLE_STANDARD", "0.10")]
    [InlineData("REDUCED", "軽減税率", "TAXABLE_REDUCED", "0.08")]
    [InlineData("NON_TAXABLE", "非課税", "NON_TAXABLE", "0.00")]
    [InlineData("TAX_EXEMPT", "免税", "TAX_EXEMPT", "0.00")]
    [InlineData("OLD_STANDARD", "旧標準税率", "TAXABLE_OLD_STANDARD", "0.08")]
    public async Task CreateTaxRate_WithDefinedTaxCategory_CreatesTaxRateWithCategoryMetadata(
        string taxCategory,
        string taxCategoryName,
        string accountingCategory,
        string rateText)
    {
        // 定義済み税区分を登録すると税区分名と会計分類が保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var rate = decimal.Parse(rateText);

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory,
            rate,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<TaxRateResponse>();
        Assert.NotNull(created);
        Assert.Equal(taxCategory, created.TaxCategory);
        Assert.Equal(taxCategoryName, created.TaxCategoryName);
        Assert.Equal(accountingCategory, created.AccountingCategory);
        Assert.Equal(rate, created.Rate);
    }

    [Fact]
    public async Task CreateTaxRate_WithSameRateAndDifferentTaxCategory_CreatesSeparateRates()
    {
        // 同じ税率値でも税区分が異なれば別レコードとして登録できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        await CreateTaxRateAsync(client, "REDUCED", 0.08m, "2026-01-01");
        await CreateTaxRateAsync(client, "OLD_STANDARD", 0.08m, "2026-01-01");

        using var response = await client.GetAsync("/api/tax-rates");
        var taxRates = await response.Content.ReadFromJsonAsync<List<TaxRateResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(taxRates);
        Assert.Contains(taxRates, taxRate => taxRate.TaxCategory == "REDUCED" && taxRate.Rate == 0.08m);
        Assert.Contains(taxRates, taxRate => taxRate.TaxCategory == "OLD_STANDARD" && taxRate.Rate == 0.08m);
    }

    [Fact]
    public async Task CreateTaxRate_WithDuplicateTaxCategoryAndValidFrom_ReturnsConflict()
    {
        // 同じ税区分と適用開始日の税率を登録すると競合エラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var request = new
        {
            taxCategory = "STANDARD",
            rate = 0.1m,
            validFrom = "2026-01-01"
        };

        using var first = await client.PostAsJsonAsync("/api/tax-rates", request);
        using var second = await client.PostAsJsonAsync("/api/tax-rates", request);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task CreateTaxRate_WithInvalidInput_ReturnsValidationProblem()
    {
        // 必須項目や税率精度が不正な場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "",
            rate = 0.12345m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateTaxRate_WithUnknownTaxCategory_ReturnsValidationProblem()
    {
        // 定義されていない税区分を指定するとバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "UNKNOWN",
            rate = 0.1m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateTaxRate_WithNonTaxableNonZeroRate_ReturnsValidationProblem()
    {
        // 非課税と免税に0以外の税率を指定するとバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "NON_TAXABLE",
            rate = 0.1m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateTaxRate_WithTaxableZeroRate_ReturnsValidationProblem()
    {
        // 課税対象の税区分に0税率を指定するとバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "STANDARD",
            rate = 0m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateTaxRate_WithRateOverDatabasePrecision_ReturnsValidationProblem()
    {
        // DB 精度を超える税率を指定した場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "STANDARD",
            rate = 10m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetTaxRates_ReturnsRatesFilteredByCategoryInValidFromDescendingOrder()
    {
        // 税率一覧で税区分絞り込みと適用開始日降順の並びになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        await CreateTaxRateAsync(client, "STANDARD", 0.08m, "2026-01-01");
        await CreateTaxRateAsync(client, "REDUCED", 0.08m, "2026-01-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.1m, "2026-04-01");

        using var response = await client.GetAsync("/api/tax-rates?taxCategory=STANDARD");
        var taxRates = await response.Content.ReadFromJsonAsync<List<TaxRateResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(taxRates);
        Assert.Equal(2, taxRates.Count);
        Assert.All(taxRates, taxRate => Assert.Equal("STANDARD", taxRate.TaxCategory));
        Assert.Equal(new DateTime(2026, 4, 1), taxRates[0].ValidFrom);
        Assert.Equal(new DateTime(2026, 1, 1), taxRates[1].ValidFrom);
    }

    [Fact]
    public async Task GetTaxRates_WithTooLongTaxCategory_ReturnsValidationProblem()
    {
        // 税率一覧の税区分検索値が長すぎる場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.GetAsync($"/api/tax-rates?taxCategory={new string('A', 31)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PreviewTaxRate_ReturnsLatestRateOnOrBeforeTargetDate()
    {
        // 指定日以前で一番新しい税率がプレビュー結果として返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        await CreateTaxRateAsync(client, "STANDARD", 0.08m, "2026-01-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.1m, "2026-04-01");

        using var response = await client.GetAsync(
            "/api/tax-rates/preview?taxCategory=STANDARD&targetDate=2026-04-15T23:59:59");
        var preview = await response.Content.ReadFromJsonAsync<TaxRateResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(0.1m, preview.Rate);
        Assert.Equal(new DateTime(2026, 4, 1), preview.ValidFrom);
    }

    [Fact]
    public async Task PreviewTaxRate_BeforeInitialValidFrom_ReturnsNotFound()
    {
        // 初回適用開始日より前の日付では適用できる税率なしとして扱うことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        await CreateTaxRateAsync(client, "STANDARD", 0.1m, "2026-01-01");

        using var response = await client.GetAsync(
            "/api/tax-rates/preview?taxCategory=STANDARD&targetDate=2025-12-31");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "STANDARD",
            rate = 0.1m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task TaxRateWriteApi_WithMasterMaintainerRole_CanPassAuthorization()
    {
        // MasterMaintainer ロールがあれば税率マスタ登録 API の認可を通過できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory = "STANDARD",
            rate = 0.1m,
            validFrom = "2026-01-01"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private HttpClient CreateMasterMaintainerClient()
    {
        var client = _factory.CreateClient();
        client.SetDummyUser("master1", Roles.MasterMaintainer);
        return client;
    }

    private static async Task CreateTaxRateAsync(
        HttpClient client,
        string taxCategory,
        decimal rate,
        string validFrom)
    {
        using var response = await client.PostAsJsonAsync("/api/tax-rates", new
        {
            taxCategory,
            rate,
            validFrom
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
        long TaxRateId,
        string TaxCategory,
        string TaxCategoryName,
        string AccountingCategory,
        decimal Rate,
        DateTime ValidFrom);
}
