using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Features.Customers;
using SalesSystem.Api.Features.Products;
using SalesSystem.Api.Features.Sales;
using SalesSystem.Api.Persistence;
using SalesSystem.Tests.Auth;

namespace SalesSystem.Tests.Sales;

public sealed class SaleApiTests : IClassFixture<SalesSystemWebApplicationFactory>
{
    private readonly WebApplicationFactory<Program> _factory;

    public SaleApiTests(SalesSystemWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateSale_WithLatestHistories_SavesAmountsAndVersionIds()
    {
        // 売上登録時に売上日以前の最新履歴と金額計算結果が保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerHistoryAsync(client, "CUST001", "旧得意先", "2026-01-01");
        await CreateCustomerVersionAsync(client, customerId, "最新得意先", "2026-03-01");

        var product1Id = await CreateProductHistoryAsync(client, "P001", "商品A 旧", 90.00m, "STANDARD", false, "2026-01-01");
        await CreateProductVersionAsync(client, product1Id, "商品A 最新", 100.01m, "STANDARD", false, "2026-04-01");
        var product2Id = await CreateProductHistoryAsync(client, "P002", "商品B 旧", 40.00m, "STANDARD", false, "2026-01-01");
        await CreateProductVersionAsync(client, product2Id, "商品B 最新", 50.00m, "STANDARD", false, "2026-04-01");

        await CreateTaxRateAsync(client, "STANDARD", 0.08m, "2026-01-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.10m, "2026-04-01");

        using var response = await client.PostAsJsonAsync("/api/sales", new
        {
            salesDate = "2026-04-15",
            customerId,
            lines = new[]
            {
                new
                {
                    productId = product1Id,
                    quantity = 1.005m,
                    unitPrice = 100.01m
                },
                new
                {
                    productId = product2Id,
                    quantity = 2.333m,
                    unitPrice = 50.00m
                }
            }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var created = await response.Content.ReadFromJsonAsync<SaleResponse>();
        Assert.NotNull(created);
        Assert.Equal(customerId, created.CustomerId);
        Assert.Equal("最新得意先", created.CustomerName);
        Assert.Equal(238.16m, created.TotalAmount);
        Assert.Equal(2, created.Details.Count);
        Assert.Equal(100.51m, created.Details[0].Amount);
        Assert.Equal(10.00m, created.Details[0].TaxAmount);
        Assert.Equal(116.65m, created.Details[1].Amount);
        Assert.Equal(11.00m, created.Details[1].TaxAmount);

        using var detailResponse = await client.GetAsync($"/api/sales/{created.SaleId}");
        var detail = await detailResponse.Content.ReadFromJsonAsync<SaleResponse>();

        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        Assert.NotNull(detail);
        Assert.Equal(created.SaleId, detail.SaleId);
        Assert.Equal("最新得意先", detail.CustomerName);
        Assert.Equal(2, detail.Details.Count);
        Assert.Equal("商品A 最新", detail.Details[0].ProductName);
        Assert.Equal(100.01m, detail.Details[0].UnitPrice);
        Assert.Equal(0.10m, detail.Details[0].TaxRate);
        Assert.Equal(10.00m, detail.Details[0].TaxAmount);
        Assert.Equal(100.51m, detail.Details[0].Amount);

        using var listResponse = await client.GetAsync($"/api/sales?salesDateFrom=2026-04-01&salesDateTo=2026-04-30&customerId={customerId}&customerCode=CUST001");
        var list = await listResponse.Content.ReadFromJsonAsync<List<SaleListItemResponse>>();

        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.NotNull(list);
        var item = Assert.Single(list);
        Assert.Equal("CUST001", item.CustomerCode);
        Assert.Equal("最新得意先", item.CustomerName);
        Assert.Equal(238.16m, item.TotalAmount);
        Assert.Equal(nameof(SaleStatus.Active), item.Status);
    }

    [Fact]
    public async Task CreateSale_AddsActiveStatusHistory()
    {
        // 売上登録時に Active の状態履歴が追加されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var sale = await CreateBasicSaleAsync(client);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var history = Assert.Single(dbContext.SaleStatusHistories.Where(history => history.SaleId == sale.SaleId));

        Assert.Equal(SaleStatus.Active, history.Status);
        Assert.Equal("売上登録", history.Reason);
        Assert.Equal("master1", history.ChangedBy);
    }

    [Fact]
    public async Task CancelSale_WithActiveSale_CreatesCancellationTransaction()
    {
        // 登録済み売上を取り消すと元売上の状態履歴と逆符号の取消売上が保存されることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var sale = await CreateBasicSaleAsync(client);

        using var response = await client.PostAsJsonAsync($"/api/sales/{sale.SaleId}/cancel", new
        {
            reason = "数量を誤って登録したため"
        });
        var canceled = await response.Content.ReadFromJsonAsync<SaleResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(canceled);
        Assert.Equal(nameof(SaleStatus.Canceled), canceled.Status);
        Assert.Equal(2, canceled.StatusHistories.Count);
        Assert.Contains(canceled.StatusHistories, history => history.Status == nameof(SaleStatus.Canceled)
            && history.Reason == "数量を誤って登録したため"
            && history.ChangedBy == "master1");

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var correction = Assert.Single(dbContext.SaleCorrections);
        var cancellationSale = await dbContext.Sales
            .Include(item => item.Details)
            .SingleAsync(item => item.Id == correction.CorrectionSaleId);
        var originalDetail = await dbContext.SaleDetails.SingleAsync(detail => detail.SaleId == sale.SaleId);
        var cancellationDetail = Assert.Single(cancellationSale.Details);

        Assert.Equal(sale.SaleId, correction.OriginalSaleId);
        Assert.Equal(SaleCorrectionType.Cancellation, correction.CorrectionType);
        Assert.Equal("数量を誤って登録したため", correction.Reason);
        Assert.Equal("master1", correction.CreatedBy);
        Assert.Equal(-sale.TotalAmount, cancellationSale.TotalAmount);
        Assert.Equal(-originalDetail.Quantity, cancellationDetail.Quantity);
        Assert.Equal(originalDetail.UnitPrice, cancellationDetail.UnitPrice);
        Assert.Equal(originalDetail.TaxRate, cancellationDetail.TaxRate);
        Assert.Equal(-originalDetail.TaxAmount, cancellationDetail.TaxAmount);
        Assert.Equal(-originalDetail.Amount, cancellationDetail.Amount);

        using var detailResponse = await client.GetAsync($"/api/sales/{sale.SaleId}");
        var originalDetailResponse = await detailResponse.Content.ReadFromJsonAsync<SaleResponse>();

        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        Assert.NotNull(originalDetailResponse);
        Assert.Equal(nameof(SaleCorrectionType.Cancellation), originalDetailResponse.CorrectionType);
        Assert.Null(originalDetailResponse.OriginalSaleId);
        Assert.Equal(correction.CorrectionSaleId, originalDetailResponse.CorrectionSaleId);
        Assert.Equal("数量を誤って登録したため", originalDetailResponse.CorrectionReason);
    }

    [Fact]
    public async Task CancelSale_WithAlreadyCanceledOrCancellationSale_ReturnsConflict()
    {
        // 取消済み売上と取消売上自体は再度取り消せないことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var sale = await CreateBasicSaleAsync(client);
        using var cancelResponse = await client.PostAsJsonAsync($"/api/sales/{sale.SaleId}/cancel", new
        {
            reason = "取消理由"
        });
        cancelResponse.EnsureSuccessStatusCode();

        using var secondCancelResponse = await client.PostAsJsonAsync($"/api/sales/{sale.SaleId}/cancel", new
        {
            reason = "再取消"
        });

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var correctionSaleId = dbContext.SaleCorrections.Single().CorrectionSaleId;

        using var cancelCorrectionResponse = await client.PostAsJsonAsync($"/api/sales/{correctionSaleId}/cancel", new
        {
            reason = "取消売上を取消"
        });

        Assert.Equal(HttpStatusCode.Conflict, secondCancelResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, cancelCorrectionResponse.StatusCode);
    }

    [Fact]
    public async Task SaleCorrections_WithSameOriginalAndType_IsRejected()
    {
        // 同じ元売上に同じ訂正種別を二重登録できないことを DB 制約で確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var sale = await CreateBasicSaleAsync(client);
        using var cancelResponse = await client.PostAsJsonAsync($"/api/sales/{sale.SaleId}/cancel", new
        {
            reason = "取消理由"
        });
        cancelResponse.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var originalSale = await dbContext.Sales.AsNoTracking().SingleAsync(item => item.Id == sale.SaleId);
        var duplicateCancellationSale = new Sale
        {
            SalesDate = originalSale.SalesDate,
            CustomerId = originalSale.CustomerId,
            CustomerVersionId = originalSale.CustomerVersionId,
            TotalAmount = -originalSale.TotalAmount,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.Sales.Add(duplicateCancellationSale);
        dbContext.SaleCorrections.Add(new SaleCorrection
        {
            OriginalSaleId = sale.SaleId,
            CorrectionSale = duplicateCancellationSale,
            CorrectionType = SaleCorrectionType.Cancellation,
            Reason = "重複取消",
            CreatedAt = DateTime.UtcNow,
            CreatedBy = "test"
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task CancelSale_WithBlankReason_ReturnsValidationProblem()
    {
        // 取消理由が空白だけの場合はバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var sale = await CreateBasicSaleAsync(client);

        using var response = await client.PostAsJsonAsync($"/api/sales/{sale.SaleId}/cancel", new
        {
            reason = "   "
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetSales_DefaultExcludesCanceledAndCorrectionSales()
    {
        // 売上一覧の初期表示では有効な通常売上だけが返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var canceledSale = await CreateBasicSaleAsync(client, "CUST001", "P001");
        var activeSale = await CreateBasicSaleAsync(client, "CUST002", "P002");
        using var cancelResponse = await client.PostAsJsonAsync($"/api/sales/{canceledSale.SaleId}/cancel", new
        {
            reason = "一覧確認用"
        });
        cancelResponse.EnsureSuccessStatusCode();

        using var defaultResponse = await client.GetAsync("/api/sales");
        var defaultList = await defaultResponse.Content.ReadFromJsonAsync<List<SaleListItemResponse>>();

        using var auditResponse = await client.GetAsync("/api/sales?includeCanceled=true&includeCorrections=true");
        var auditList = await auditResponse.Content.ReadFromJsonAsync<List<SaleListItemResponse>>();

        Assert.Equal(HttpStatusCode.OK, defaultResponse.StatusCode);
        var item = Assert.Single(defaultList!);
        Assert.Equal(activeSale.SaleId, item.SaleId);
        Assert.Equal(nameof(SaleStatus.Active), item.Status);

        Assert.Equal(HttpStatusCode.OK, auditResponse.StatusCode);
        Assert.NotNull(auditList);
        Assert.Equal(3, auditList.Count);
        Assert.Contains(auditList, item => item.SaleId == canceledSale.SaleId
            && item.Status == nameof(SaleStatus.Canceled)
            && item.CorrectionType == nameof(SaleCorrectionType.Cancellation)
            && item.CorrectionSaleId is not null);
        Assert.Contains(auditList, item => item.OriginalSaleId == canceledSale.SaleId && item.CorrectionType == nameof(SaleCorrectionType.Cancellation));
    }

    [Fact]
    public async Task CancelSaleAuthorization_RequiresMasterMaintainer()
    {
        // 売上取消 API は認証済みかつ MasterMaintainer ロールが必要であることを確認する。
        await ResetDatabaseAsync();
        using var anonymousClient = _factory.CreateClient();
        using var unauthorizedResponse = await anonymousClient.PostAsJsonAsync("/api/sales/1/cancel", new
        {
            reason = "取消理由"
        });

        using var userClient = _factory.CreateClient();
        userClient.SetDummyUser("user1");
        using var forbiddenResponse = await userClient.PostAsJsonAsync("/api/sales/1/cancel", new
        {
            reason = "取消理由"
        });

        using var masterClient = CreateMasterMaintainerClient();
        using var notFoundResponse = await masterClient.PostAsJsonAsync("/api/sales/999/cancel", new
        {
            reason = "取消理由"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, unauthorizedResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, forbiddenResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, notFoundResponse.StatusCode);
    }

    [Fact]
    public async Task PreviewCustomerAndProduct_ReturnLatestHistoriesBeforeSalesDate()
    {
        // 売上日を指定したプレビューで最新の得意先履歴と商品履歴・税率が返ることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerHistoryAsync(client, "CUST001", "旧得意先", "2026-01-01");
        await CreateCustomerVersionAsync(client, customerId, "最新得意先", "2026-03-01");

        var productId = await CreateProductHistoryAsync(client, "P001", "商品A 旧", 90.00m, "STANDARD", false, "2026-01-01");
        await CreateProductVersionAsync(client, productId, "商品A 最新", 100.01m, "STANDARD", false, "2026-04-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.08m, "2026-01-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.10m, "2026-04-01");

        using var customerResponse = await client.GetAsync($"/api/sales/preview-customer?customerId={customerId}&salesDate=2026-04-15");
        var customer = await customerResponse.Content.ReadFromJsonAsync<CustomerVersionResponse>();

        using var productResponse = await client.GetAsync($"/api/sales/preview-product?productId={productId}&salesDate=2026-04-15");
        var product = await productResponse.Content.ReadFromJsonAsync<SalesProductPreviewResponse>();

        Assert.Equal(HttpStatusCode.OK, customerResponse.StatusCode);
        Assert.NotNull(customer);
        Assert.Equal("最新得意先", customer.Name);

        Assert.Equal(HttpStatusCode.OK, productResponse.StatusCode);
        Assert.NotNull(product);
        Assert.Equal("商品A 最新", product.Name);
        Assert.Equal(100.01m, product.StandardUnitPrice);
        Assert.Equal(0.10m, product.TaxRate);
        Assert.False(product.IsDiscontinued);
    }

    [Fact]
    public async Task CreateSale_WithInvalidLinePrecision_ReturnsValidationProblem()
    {
        // 数量 3 桁超過や単価 2 桁超過はバリデーションエラーになることを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerHistoryAsync(client, "CUST001", "得意先", "2026-01-01");
        var productId = await CreateProductHistoryAsync(client, "P001", "商品A", 100.00m, "STANDARD", false, "2026-01-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.10m, "2026-01-01");

        using var response = await client.PostAsJsonAsync("/api/sales", new
        {
            salesDate = "2026-04-15",
            customerId,
            lines = new[]
            {
                new
                {
                    productId,
                    quantity = 1.0004m,
                    unitPrice = 100.001m
                }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateSale_WithDiscontinuedProduct_ReturnsConflict()
    {
        // 販売停止中の商品は売上登録できないことを確認する。
        await ResetDatabaseAsync();
        using var client = CreateMasterMaintainerClient();
        var customerId = await CreateCustomerHistoryAsync(client, "CUST001", "得意先", "2026-01-01");
        var productId = await CreateProductHistoryAsync(client, "P001", "商品A", 100.00m, "STANDARD", false, "2026-01-01");
        await CreateProductVersionAsync(client, productId, "商品A 販売停止", 100.00m, "STANDARD", true, "2026-04-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.10m, "2026-01-01");
        await CreateTaxRateAsync(client, "STANDARD", 0.10m, "2026-04-01");

        using var response = await client.PostAsJsonAsync("/api/sales", new
        {
            salesDate = "2026-04-15",
            customerId,
            lines = new[]
            {
                new
                {
                    productId,
                    quantity = 1m,
                    unitPrice = 100.00m
                }
            }
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task SalesReadApi_WithoutUserHeader_ReturnsUnauthorized()
    {
        // 認証ヘッダーなしでは売上参照 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/api/sales");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SalesReadApi_WithAuthenticatedUser_ReturnsOk()
    {
        // 認証済みユーザーであれば売上一覧 API にアクセスできることを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1");

        using var response = await client.GetAsync("/api/sales");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SalesWriteApi_WithoutMasterMaintainerRole_ReturnsForbidden()
    {
        // MasterMaintainer ロールなしでは売上登録 API にアクセスできないことを確認する。
        await ResetDatabaseAsync();
        using var client = _factory.CreateClient();
        client.SetDummyUser("user1");

        using var response = await client.PostAsJsonAsync("/api/sales", new
        {
            salesDate = "2026-04-15",
            customerId = 1,
            lines = new[]
            {
                new
                {
                    productId = 1,
                    quantity = 1m,
                    unitPrice = 100.00m
                }
            }
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private HttpClient CreateMasterMaintainerClient()
    {
        var client = _factory.CreateClient();
        client.SetDummyUser("master1", Roles.MasterMaintainer);
        return client;
    }

    private static async Task<long> CreateCustomerHistoryAsync(
        HttpClient client,
        string customerCode,
        string name,
        string validFrom)
    {
        using var response = await client.PostAsJsonAsync("/api/customers", new
        {
            customerCode,
            name,
            address = "東京都千代田区1-1-1",
            phoneNumber = "03-1234-5678",
            validFrom
        });

        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<CustomerResponse>();
        return created!.CustomerId;
    }

    private static async Task CreateCustomerVersionAsync(
        HttpClient client,
        long customerId,
        string name,
        string validFrom)
    {
        using var response = await client.PostAsJsonAsync($"/api/customers/{customerId}/versions", new
        {
            name,
            address = "東京都中央区2-2-2",
            phoneNumber = "03-2345-6789",
            validFrom
        });

        response.EnsureSuccessStatusCode();
    }

    private static async Task<long> CreateProductHistoryAsync(
        HttpClient client,
        string productCode,
        string name,
        decimal standardUnitPrice,
        string taxCategory,
        bool isDiscontinued,
        string validFrom)
    {
        using var response = await client.PostAsJsonAsync("/api/products", new
        {
            productCode,
            name,
            unit = "箱",
            standardUnitPrice,
            taxCategory,
            isDiscontinued,
            validFrom
        });

        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<ProductResponse>();
        return created!.ProductId;
    }

    private static async Task CreateProductVersionAsync(
        HttpClient client,
        long productId,
        string name,
        decimal standardUnitPrice,
        string taxCategory,
        bool isDiscontinued,
        string validFrom)
    {
        using var response = await client.PostAsJsonAsync($"/api/products/{productId}/versions", new
        {
            name,
            unit = "箱",
            standardUnitPrice,
            taxCategory,
            isDiscontinued,
            validFrom
        });

        response.EnsureSuccessStatusCode();
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

    private async Task<SaleResponse> CreateBasicSaleAsync(
        HttpClient client,
        string customerCode = "CUST001",
        string productCode = "P001")
    {
        var customerId = await CreateCustomerHistoryAsync(client, customerCode, $"得意先{customerCode}", "2026-01-01");
        var taxCategory = $"STANDARD-{productCode}";
        var productId = await CreateProductHistoryAsync(client, productCode, $"商品{productCode}", 100.00m, taxCategory, false, "2026-01-01");
        await CreateTaxRateAsync(client, taxCategory, 0.10m, "2026-01-01");

        using var response = await client.PostAsJsonAsync("/api/sales", new
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

        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SaleResponse>())!;
    }

    private async Task ResetDatabaseAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();
    }
}
