using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Features.Customers;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.Sales;

public static class SaleEndpoints
{
    public static IEndpointRouteBuilder MapSaleEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/sales");

        group.MapPost("/", CreateSale)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/", GetSales)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/{saleId:long}", GetSale)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/preview-customer", PreviewCustomer)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/preview-product", PreviewProduct)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        return endpoints;
    }

    private static async Task<IResult> CreateSale(
        AppDbContext dbContext,
        CreateSaleRequest request,
        CancellationToken cancellationToken)
    {
        var errors = SaleValidation.ValidateCreateSale(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var salesDate = request.SalesDate.Date;
        var lines = request.Lines!;

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var customer = await LoadCustomerAsync(dbContext, request.CustomerId, salesDate, cancellationToken);
        if (customer is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.NotFound(new { message = "対象日に適用できる得意先履歴がありません。" });
        }

        var productIds = lines.Select(line => line.ProductId).Distinct().ToList();
        var latestProductVersions = await LoadLatestProductVersionsAsync(dbContext, productIds, salesDate, cancellationToken);
        if (latestProductVersions.Count != productIds.Count)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.NotFound(new { message = "対象日に適用できる商品履歴がありません。" });
        }

        var discontinuedProduct = latestProductVersions.Values.FirstOrDefault(version => version.IsDiscontinued);
        if (discontinuedProduct is not null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { message = "販売停止中の商品は登録できません。" });
        }

        var taxCategories = latestProductVersions.Values
            .Select(version => version.TaxCategory)
            .Distinct()
            .ToList();

        var latestTaxRates = await LoadLatestTaxRatesAsync(dbContext, taxCategories, salesDate, cancellationToken);
        if (latestTaxRates.Count != taxCategories.Count)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.NotFound(new { message = "対象日に適用できる税率がありません。" });
        }

        var sale = new Sale
        {
            SalesDate = salesDate,
            CustomerId = customer.CustomerId,
            CustomerVersionId = customer.CustomerVersion.CustomerVersionId,
            CreatedAt = DateTime.UtcNow
        };

        decimal totalAmount = 0m;

        foreach (var line in lines)
        {
            var productVersion = latestProductVersions[line.ProductId];
            var taxRate = latestTaxRates[productVersion.TaxCategory];

            var amount = decimal.Round(line.Quantity * line.UnitPrice, 2, MidpointRounding.AwayFromZero);
            var taxAmount = decimal.Floor(amount * taxRate.Rate);

            sale.Details.Add(new SaleDetail
            {
                ProductId = productVersion.ProductId,
                ProductVersionId = productVersion.Id,
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                TaxRate = taxRate.Rate,
                TaxAmount = taxAmount,
                Amount = amount
            });

            totalAmount += amount + taxAmount;
        }

        sale.TotalAmount = totalAmount;
        dbContext.Sales.Add(sale);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { message = "売上の登録に失敗しました。" });
        }

        var response = await BuildSaleResponse(dbContext, sale.Id, cancellationToken);
        return Results.Created($"/api/sales/{sale.Id}", response);
    }

    private static async Task<IResult> GetSales(
        AppDbContext dbContext,
        DateTime? salesDateFrom,
        DateTime? salesDateTo,
        long? customerId,
        string? customerCode,
        CancellationToken cancellationToken)
    {
        var query =
            from sale in dbContext.Sales.AsNoTracking()
            join customer in dbContext.Customers.AsNoTracking()
                on sale.CustomerId equals customer.Id
            join customerVersion in dbContext.CustomerVersions.AsNoTracking()
                on new
                {
                    CustomerVersionId = sale.CustomerVersionId,
                    CustomerId = sale.CustomerId
                }
                equals new
                {
                    CustomerVersionId = customerVersion.Id,
                    CustomerId = customerVersion.CustomerId
                }
            select new { sale, customer, customerVersion };

        if (salesDateFrom is not null && salesDateFrom != default)
        {
            var from = salesDateFrom.Value.Date;
            query = query.Where(item => item.sale.SalesDate >= from);
        }

        if (salesDateTo is not null && salesDateTo != default)
        {
            var to = salesDateTo.Value.Date;
            query = query.Where(item => item.sale.SalesDate <= to);
        }

        if (customerId is not null && customerId > 0)
        {
            query = query.Where(item => item.sale.CustomerId == customerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(customerCode))
        {
            query = query.Where(item => item.customer.CustomerCode.Contains(customerCode));
        }

        var sales = await query
            .OrderByDescending(item => item.sale.SalesDate)
            .ThenByDescending(item => item.sale.Id)
            .Select(item => new SaleListItemResponse(
                item.sale.Id,
                item.sale.SalesDate,
                item.customer.Id,
                item.customer.CustomerCode,
                item.customerVersion.Id,
                item.customerVersion.Name,
                item.sale.TotalAmount,
                item.sale.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(sales);
    }

    private static async Task<IResult> GetSale(
        AppDbContext dbContext,
        long saleId,
        CancellationToken cancellationToken)
    {
        var response = await BuildSaleResponse(dbContext, saleId, cancellationToken);
        return response is null
            ? Results.NotFound(new { message = "売上が見つかりません。" })
            : Results.Ok(response);
    }

    private static async Task<IResult> PreviewCustomer(
        AppDbContext dbContext,
        long customerId,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        if (salesDate == default)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(salesDate)] = ["売上日は必須です。"]
            });
        }

        var customer = await dbContext.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => new { customer.Id, customer.CustomerCode })
            .FirstOrDefaultAsync(cancellationToken);

        if (customer is null)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var date = salesDate.Date;
        var version = await dbContext.CustomerVersions
            .AsNoTracking()
            .Where(version => version.CustomerId == customerId && version.ValidFrom <= date)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (version is null)
        {
            return Results.NotFound(new { message = "対象日に適用できる得意先履歴がありません。" });
        }

        return Results.Ok(new CustomerVersionResponse(
            version.Id,
            customer.Id,
            customer.CustomerCode,
            version.Name,
            version.Address,
            version.PhoneNumber,
            version.ValidFrom));
    }

    private static async Task<IResult> PreviewProduct(
        AppDbContext dbContext,
        long productId,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        if (salesDate == default)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(salesDate)] = ["売上日は必須です。"]
            });
        }

        var product = await dbContext.Products
            .AsNoTracking()
            .Where(product => product.Id == productId)
            .Select(product => new { product.Id, product.ProductCode })
            .FirstOrDefaultAsync(cancellationToken);

        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var date = salesDate.Date;
        var version = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => version.ProductId == productId && version.ValidFrom <= date)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (version is null)
        {
            return Results.NotFound(new { message = "対象日に適用できる商品履歴がありません。" });
        }

        var taxRate = await dbContext.TaxRates
            .AsNoTracking()
            .Where(rate => rate.TaxCategory == version.TaxCategory && rate.ValidFrom <= date)
            .OrderByDescending(rate => rate.ValidFrom)
            .ThenByDescending(rate => rate.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (taxRate is null)
        {
            return Results.NotFound(new { message = "対象日に適用できる税率がありません。" });
        }

        return Results.Ok(new SalesProductPreviewResponse(
            version.ProductId,
            product.ProductCode,
            version.Id,
            version.Name,
            version.Unit,
            version.StandardUnitPrice,
            version.TaxCategory,
            taxRate.Rate,
            version.IsDiscontinued,
            version.ValidFrom));
    }

    private static async Task<SaleResponse?> BuildSaleResponse(
        AppDbContext dbContext,
        long saleId,
        CancellationToken cancellationToken)
    {
        var header = await (
            from sale in dbContext.Sales.AsNoTracking()
            join customer in dbContext.Customers.AsNoTracking()
                on sale.CustomerId equals customer.Id
            join customerVersion in dbContext.CustomerVersions.AsNoTracking()
                on new
                {
                    CustomerVersionId = sale.CustomerVersionId,
                    CustomerId = sale.CustomerId
                }
                equals new
                {
                    CustomerVersionId = customerVersion.Id,
                    CustomerId = customerVersion.CustomerId
                }
            where sale.Id == saleId
            select new
            {
                sale.Id,
                sale.SalesDate,
                sale.CustomerId,
                customer.CustomerCode,
                sale.CustomerVersionId,
                CustomerName = customerVersion.Name,
                sale.TotalAmount,
                sale.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (header is null)
        {
            return null;
        }

        var details = await (
            from detail in dbContext.SaleDetails.AsNoTracking()
            join product in dbContext.Products.AsNoTracking()
                on detail.ProductId equals product.Id
            join productVersion in dbContext.ProductVersions.AsNoTracking()
                on new
                {
                    ProductVersionId = detail.ProductVersionId,
                    ProductId = detail.ProductId
                }
                equals new
                {
                    ProductVersionId = productVersion.Id,
                    ProductId = productVersion.ProductId
                }
            where detail.SaleId == saleId
            orderby detail.Id
            select new SaleDetailLineResponse(
                detail.Id,
                detail.ProductId,
                detail.ProductVersionId,
                product.ProductCode,
                productVersion.Name,
                productVersion.Unit,
                detail.Quantity,
                detail.UnitPrice,
                detail.TaxRate,
                detail.TaxAmount,
                detail.Amount))
            .ToListAsync(cancellationToken);

        return new SaleResponse(
            header.Id,
            header.SalesDate,
            header.CustomerId,
            header.CustomerCode,
            header.CustomerVersionId,
            header.CustomerName,
            header.TotalAmount,
            header.CreatedAt,
            details);
    }

    private sealed record CustomerVersionSnapshot(
        long CustomerVersionId,
        long CustomerId,
        string CustomerCode,
        string Name,
        string Address,
        string PhoneNumber,
        DateTime ValidFrom);

    private sealed record CustomerIdentity(long CustomerId, CustomerVersionSnapshot CustomerVersion);

    private static async Task<CustomerIdentity?> LoadCustomerAsync(
        AppDbContext dbContext,
        long customerId,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var customer = await dbContext.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => new { customer.Id, customer.CustomerCode })
            .FirstOrDefaultAsync(cancellationToken);

        if (customer is null)
        {
            return null;
        }

        var version = await dbContext.CustomerVersions
            .AsNoTracking()
            .Where(version => version.CustomerId == customerId && version.ValidFrom <= salesDate)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .Select(version => new CustomerVersionSnapshot(
                version.Id,
                version.CustomerId,
                customer.CustomerCode,
                version.Name,
                version.Address,
                version.PhoneNumber,
                version.ValidFrom))
            .FirstOrDefaultAsync(cancellationToken);

        return version is null ? null : new CustomerIdentity(customer.Id, version);
    }

    private static async Task<Dictionary<long, ProductVersion>> LoadLatestProductVersionsAsync(
        AppDbContext dbContext,
        List<long> productIds,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var versions = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => productIds.Contains(version.ProductId) && version.ValidFrom <= salesDate)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .ToListAsync(cancellationToken);

        return versions
            .GroupBy(version => version.ProductId)
            .ToDictionary(group => group.Key, group => group.First());
    }

    private static async Task<Dictionary<string, TaxRate>> LoadLatestTaxRatesAsync(
        AppDbContext dbContext,
        List<string> taxCategories,
        DateTime salesDate,
        CancellationToken cancellationToken)
    {
        var taxRates = await dbContext.TaxRates
            .AsNoTracking()
            .Where(rate => taxCategories.Contains(rate.TaxCategory) && rate.ValidFrom <= salesDate)
            .OrderByDescending(rate => rate.ValidFrom)
            .ThenByDescending(rate => rate.Id)
            .ToListAsync(cancellationToken);

        return taxRates
            .GroupBy(rate => rate.TaxCategory)
            .ToDictionary(group => group.Key, group => group.First());
    }
}
