using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Persistence;
using SalesSystem.Tests.Auth;

namespace SalesSystem.Tests.CustomerProductPrices;

public sealed class CustomerProductPriceApiTests : IClassFixture<SalesSystemWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CustomerProductPriceApiTests(SalesSystemWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateCustomerProductPrice_WithMasterMaintainerRole_CreatesPriceHistory()
    {
        // MasterMaintainer ロールがあれば得意先別商品単価履歴を登録できることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");

        using var response = await client.PostAsJsonAsync("/api/customer-product-prices", new
        {
            customerId,
            productId,
            unitPrice = 100.00m,
            effectiveFrom = "2026-04-01"
        });
        var created = await response.Content.ReadFromJsonAsync<CustomerProductPriceResponse>();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(created);
        Assert.Equal(customerId, created.CustomerId);
        Assert.Equal(productId, created.ProductId);
        Assert.Equal(100.00m, created.UnitPrice);
        Assert.Equal(new DateTime(2026, 4, 1), created.EffectiveFrom);
    }

    [Fact]
    public async Task CreateCustomerProductPrice_WithExistingCombination_ReturnsConflict()
    {
        // 同じ得意先と商品の組み合わせを再登録すると競合エラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");
        var request = new
        {
            customerId,
            productId,
            unitPrice = 100.00m,
            effectiveFrom = "2026-04-01"
        };

        using var first = await client.PostAsJsonAsync("/api/customer-product-prices", request);
        using var second = await client.PostAsJsonAsync("/api/customer-product-prices", new
        {
            customerId,
            productId,
            unitPrice = 90.00m,
            effectiveFrom = "2026-05-01"
        });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task CreateCustomerProductPrice_WithDuplicateEffectiveFrom_ReturnsConflict()
    {
        // 同じ得意先、商品、適用開始日の単価履歴は重複登録できないことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");
        await CreateCustomerProductPriceAsync(client, customerId, productId, 100.00m, "2026-04-01");
        var request = new
        {
            unitPrice = 90.00m,
            effectiveFrom = "2026-04-01"
        };

        using var response = await client.PostAsJsonAsync(
            $"/api/customer-product-prices/{customerId}/{productId}/changes",
            request);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task ChangeCustomerProductPrice_WithoutExistingCombination_ReturnsNotFound()
    {
        // 未登録の得意先と商品の組み合わせは変更 API では初回登録できないことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");

        using var response = await client.PostAsJsonAsync(
            $"/api/customer-product-prices/{customerId}/{productId}/changes",
            new
            {
                unitPrice = 90.00m,
                effectiveFrom = "2026-05-01"
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateCustomerProductPrice_WithInvalidInput_ReturnsValidationProblem()
    {
        // 得意先ID、商品ID、単価精度、適用開始日が不正な場合にバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();

        using var response = await client.PostAsJsonAsync("/api/customer-product-prices", new
        {
            customerId = 0,
            productId = 0,
            unitPrice = 10.123m,
            effectiveFrom = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateCustomerProductPrice_ResponseDoesNotContainCustomerProductPriceId()
    {
        // 通常レスポンスに内部履歴 ID が含まれないことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");

        using var response = await client.PostAsJsonAsync("/api/customer-product-prices", new
        {
            customerId,
            productId,
            unitPrice = 100.00m,
            effectiveFrom = "2026-04-01"
        });
        var json = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.DoesNotContain("customerProductPriceId", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ChangeCustomerProductPrice_AddsHistoryWithoutUpdatingExistingPrice()
    {
        // 得意先別商品単価の履歴追加時に既存履歴を更新せず新しい履歴として保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");
        await CreateCustomerProductPriceAsync(client, customerId, productId, 100.00m, "2026-04-01");

        using var response = await client.PostAsJsonAsync(
            $"/api/customer-product-prices/{customerId}/{productId}/changes",
            new
            {
                unitPrice = 90.00m,
                effectiveFrom = "2026-05-01"
            });

        using var changesResponse = await client.GetAsync(
            $"/api/customer-product-prices/{customerId}/{productId}/changes");
        var changes = await changesResponse.Content.ReadFromJsonAsync<List<CustomerProductPriceChangeResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, changesResponse.StatusCode);
        Assert.NotNull(changes);
        Assert.Equal(2, changes.Count);
        Assert.Equal(90.00m, changes[0].UnitPrice);
        Assert.Equal(new DateTime(2026, 5, 1), changes[0].EffectiveFrom);
        Assert.Equal(100.00m, changes[1].UnitPrice);
        Assert.Equal(new DateTime(2026, 4, 1), changes[1].EffectiveFrom);
    }

    [Fact]
    public async Task GetCustomerProductPrices_AppliesCustomerAndProductFilters()
    {
        // 得意先別商品単価一覧で得意先と商品を絞り込めることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var targetCustomerCode = NewCustomerCode();
        var targetProductCode = NewProductCode();
        var targetCustomerId = await CreateCustomerAsync(client, targetCustomerCode, "検索対象得意先", "2026-01-01");
        var otherCustomerId = await CreateCustomerAsync(client, NewCustomerCode(), "別得意先", "2026-01-01");
        var targetProductId = await CreateProductAsync(client, targetProductCode, "検索対象商品", 120.00m, "2026-01-01");
        var otherProductId = await CreateProductAsync(client, NewProductCode(), "別商品", 120.00m, "2026-01-01");
        await CreateCustomerProductPriceAsync(client, targetCustomerId, targetProductId, 100.00m, "2026-04-01");
        await CreateCustomerProductPriceAsync(client, otherCustomerId, otherProductId, 80.00m, "2026-04-01");

        using var response = await client.GetAsync(
            $"/api/customer-product-prices?customerId={targetCustomerId}&productId={targetProductId}&customerCode={targetCustomerCode}&productCode={targetProductCode}&asOf=2026-04-15");
        var prices = await response.Content.ReadFromJsonAsync<List<CustomerProductPriceListItemResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(prices);
        var price = Assert.Single(prices);
        Assert.Equal(targetCustomerId, price.CustomerId);
        Assert.Equal(targetProductId, price.ProductId);
        Assert.Equal(100.00m, price.UnitPrice);
    }

    [Fact]
    public async Task GetCustomerProductPrices_ReturnsOnePricePerCombinationAtAsOf()
    {
        // 指定日時点で得意先と商品の組み合わせごとに1件ずつ適用単価が返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");
        await CreateCustomerProductPriceAsync(client, customerId, productId, 100.00m, "2026-04-01");
        await ChangeCustomerProductPriceAsync(client, customerId, productId, 90.00m, "2026-05-01");

        using var response = await client.GetAsync("/api/customer-product-prices?asOf=2026-04-15");
        var prices = await response.Content.ReadFromJsonAsync<List<CustomerProductPriceListItemResponse>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(prices);
        var price = Assert.Single(prices);
        Assert.Equal(100.00m, price.UnitPrice);
        Assert.Equal(new DateTime(2026, 4, 1), price.EffectiveFrom);
    }

    [Fact]
    public async Task GetCustomerProductPrice_ReturnsLatestPriceOnOrBeforeAsOf()
    {
        // 指定日以前で一番新しい得意先別商品単価が詳細結果として返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");
        await CreateCustomerProductPriceAsync(client, customerId, productId, 100.00m, "2026-04-01");
        await ChangeCustomerProductPriceAsync(client, customerId, productId, 90.00m, "2026-05-01");

        using var response = await client.GetAsync(
            $"/api/customer-product-prices/{customerId}/{productId}?asOf=2026-04-15");
        var detail = await response.Content.ReadFromJsonAsync<CustomerProductPriceResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(detail);
        Assert.Equal(100.00m, detail.UnitPrice);
        Assert.Equal(new DateTime(2026, 4, 1), detail.EffectiveFrom);
    }

    [Fact]
    public async Task PreviewCustomerProductPrice_WithCustomerPrice_ReturnsLatestCustomerPrice()
    {
        // 指定日以前で一番新しい得意先別商品単価がプレビュー結果として返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");
        await CreateCustomerProductPriceAsync(client, customerId, productId, 100.00m, "2026-04-01");
        await ChangeCustomerProductPriceAsync(client, customerId, productId, 90.00m, "2026-05-01");

        using var response = await client.GetAsync(
            $"/api/customer-product-prices/preview?customerId={customerId}&productId={productId}&asOf=2026-05-15");
        var preview = await response.Content.ReadFromJsonAsync<CustomerProductPricePreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(90.00m, preview.AutoUnitPrice);
        Assert.Equal("CUSTOMER_PRODUCT_PRICE", preview.UnitPriceSource);
        Assert.Equal(new DateTime(2026, 5, 15), preview.AsOf);
    }

    [Fact]
    public async Task PreviewCustomerProductPrice_WithoutCustomerPrice_ReturnsStandardUnitPrice()
    {
        // 得意先別商品単価がない場合、プレビュー API が商品標準単価へフォールバックすることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");

        using var response = await client.GetAsync(
            $"/api/customer-product-prices/preview?customerId={customerId}&productId={productId}&asOf=2026-04-15");
        var preview = await response.Content.ReadFromJsonAsync<CustomerProductPricePreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(preview);
        Assert.Equal(120.00m, preview.AutoUnitPrice);
        Assert.Equal("PRODUCT_STANDARD", preview.UnitPriceSource);
        Assert.Equal(120.00m, preview.StandardUnitPrice);
    }

    [Fact]
    public async Task CreateSale_WithCustomerProductPriceApi_SavesUnitPriceSourceSnapshot()
    {
        // 得意先別商品単価 API で登録した単価が売上登録で採用され、単価根拠が売上明細に保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerAsync(client, NewCustomerCode(), "得意先A", "2026-01-01");
        var productId = await CreateProductAsync(client, NewProductCode(), "商品A", 120.00m, "2026-01-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.10m, "2026-01-01");
        await CreateCustomerProductPriceAsync(client, customerId, productId, 100.00m, "2026-04-01");

        using var saleResponse = await client.PostAsJsonAsync("/api/sales", new
        {
            salesDate = "2026-04-15",
            customerId,
            lines = new[]
            {
                new
                {
                    productId,
                    quantity = 2m,
                    unitPrice = 100.00m
                }
            }
        });
        var sale = await saleResponse.Content.ReadFromJsonAsync<SaleResponse>();
        await ChangeCustomerProductPriceAsync(client, customerId, productId, 80.00m, "2026-05-01");

        using var detailResponse = await client.GetAsync($"/api/sales/{sale!.SaleId}");
        var detailSale = await detailResponse.Content.ReadFromJsonAsync<SaleResponse>();

        Assert.Equal(HttpStatusCode.Created, saleResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        Assert.NotNull(detailSale);
        var detail = Assert.Single(detailSale.Details);
        Assert.Equal(100.00m, detail.UnitPrice);
        Assert.Equal(100.00m, detail.AutoUnitPrice);
        Assert.NotNull(detail.CustomerProductPriceId);
        Assert.False(detail.IsManualUnitPrice);
    }

    [Fact]
    public async Task CustomerProductPriceAuthorization_RequiresAuthenticatedAndMasterMaintainerRoles()
    {
        // 得意先別商品単価 API は参照に認証、登録に MasterMaintainer ロールが必要であることを確認する。
        await ResetDatabaseAsync();
        using var anonymousClient = _factory.CreateClient();
        using var unauthorizedResponse = await anonymousClient.GetAsync("/api/customer-product-prices");

        using var userClient = _factory.CreateClient();
        userClient.SetDummyUser("user1");
        using var forbiddenResponse = await userClient.PostAsJsonAsync("/api/customer-product-prices", new
        {
            customerId = 1,
            productId = 1,
            unitPrice = 100.00m,
            effectiveFrom = "2026-04-01"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, unauthorizedResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);
    }

    private HttpClient CreateMasterMaintainerClient()
    {
        var client = _factory.CreateClient();
        client.SetDummyUser("master1", Roles.MasterMaintainer);
        return client;
    }

    private static async Task<long> CreateCustomerAsync(
        HttpClient client,
        string customerCode,
        string name,
        string effectiveFrom)
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
        var created = await response.Content.ReadFromJsonAsync<CustomerResponse>();
        return created!.CustomerId;
    }

    private static async Task<long> CreateProductAsync(
        HttpClient client,
        string productCode,
        string name,
        decimal standardUnitPrice,
        string effectiveFrom)
    {
        using var response = await client.PostAsJsonAsync("/api/products", new
        {
            productCode,
            name,
            unit = "箱",
            standardUnitPrice,
            taxCategory = "STANDARD",
            isDiscontinued = false,
            effectiveFrom
        });

        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<ProductResponse>();
        return created!.ProductId;
    }

    private static async Task<CustomerProductPriceResponse> CreateCustomerProductPriceAsync(
        HttpClient client,
        long customerId,
        long productId,
        decimal unitPrice,
        string effectiveFrom)
    {
        using var response = await client.PostAsJsonAsync("/api/customer-product-prices", new
        {
            customerId,
            productId,
            unitPrice,
            effectiveFrom
        });

        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CustomerProductPriceResponse>())!;
    }

    private static async Task ChangeCustomerProductPriceAsync(
        HttpClient client,
        long customerId,
        long productId,
        decimal unitPrice,
        string effectiveFrom)
    {
        using var response = await client.PostAsJsonAsync(
            $"/api/customer-product-prices/{customerId}/{productId}/changes",
            new
            {
                unitPrice,
                effectiveFrom
            });

        response.EnsureSuccessStatusCode();
    }

    private static async Task CreateTaxRateAsync(
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

        if (response.StatusCode != HttpStatusCode.Conflict)
        {
            response.EnsureSuccessStatusCode();
        }
    }

    private async Task ResetDatabaseAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();
    }

    private static string NewCustomerCode()
    {
        return $"C{Guid.NewGuid():N}"[..30];
    }

    private static string NewProductCode()
    {
        return $"P{Guid.NewGuid():N}"[..30];
    }

    private sealed record CustomerResponse(long CustomerId);

    private sealed record ProductResponse(long ProductId);

    private sealed record CustomerProductPriceListItemResponse(
        long CustomerId,
        string CustomerCode,
        string CustomerName,
        long ProductId,
        string ProductCode,
        string ProductName,
        decimal UnitPrice,
        DateTime EffectiveFrom,
        DateTime CreatedAt);

    private sealed record CustomerProductPriceResponse(
        long CustomerId,
        string CustomerCode,
        string CustomerName,
        long ProductId,
        string ProductCode,
        string ProductName,
        decimal UnitPrice,
        DateTime EffectiveFrom,
        DateTime CreatedAt);

    private sealed record CustomerProductPriceChangeResponse(
        decimal UnitPrice,
        DateTime EffectiveFrom,
        DateTime CreatedAt);

    private sealed record CustomerProductPricePreviewResponse(
        long CustomerId,
        string CustomerCode,
        string CustomerName,
        long ProductId,
        string ProductCode,
        string ProductName,
        string Unit,
        decimal AutoUnitPrice,
        string UnitPriceSource,
        decimal StandardUnitPrice,
        DateTime AsOf);

    private sealed record SaleResponse(
        long SaleId,
        decimal TotalAmount,
        List<SaleDetailLineResponse> Details);

    private sealed record SaleDetailLineResponse(
        long SaleDetailId,
        long ProductId,
        long ProductVersionId,
        string ProductCode,
        string ProductName,
        string Unit,
        long TaxRateId,
        string TaxCategory,
        string TaxCategoryName,
        string AccountingCategory,
        decimal Quantity,
        decimal UnitPrice,
        long? CustomerProductPriceId,
        bool IsManualUnitPrice,
        decimal AutoUnitPrice,
        string? ManualUnitPriceReason,
        decimal TaxRate,
        decimal TaxAmount,
        decimal Amount);
}
