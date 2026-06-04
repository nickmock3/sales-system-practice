using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.CustomerProductPrices;

public static class CustomerProductPriceEndpoints
{
    public static IEndpointRouteBuilder MapCustomerProductPriceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/customer-product-prices");

        group.MapGet("/", GetCustomerProductPrices)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/", CreateCustomerProductPrice)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/{customerId:long}/{productId:long}/history", GetCustomerProductPriceHistory)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/{customerId:long}/{productId:long}/history", CreateCustomerProductPriceHistory)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/{customerId:long}/{productId:long}/versions", GetCustomerProductPriceHistory)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/{customerId:long}/{productId:long}/versions", CreateCustomerProductPriceHistory)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/preview", PreviewCustomerProductPrice)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        return endpoints;
    }

    private static async Task<IResult> GetCustomerProductPrices(
        AppDbContext dbContext,
        long? customerId,
        long? productId,
        string? customerCode,
        string? productCode,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidateListFilters(customerId, productId);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var query = dbContext.CustomerProductPrices.AsNoTracking();

        if (customerId is not null)
        {
            query = query.Where(price => price.CustomerId == customerId.Value);
        }

        if (productId is not null)
        {
            query = query.Where(price => price.ProductId == productId.Value);
        }

        if (!string.IsNullOrWhiteSpace(customerCode))
        {
            query = query.Where(price => price.Customer.CustomerCode.Contains(customerCode));
        }

        if (!string.IsNullOrWhiteSpace(productCode))
        {
            query = query.Where(price => price.Product.ProductCode.Contains(productCode));
        }

        var prices = await query
            .OrderBy(price => price.CustomerId)
            .ThenBy(price => price.ProductId)
            .ThenByDescending(price => price.ValidFrom)
            .ThenByDescending(price => price.Id)
            .Select(price => new CustomerProductPriceListItemResponse(
                price.Id,
                price.CustomerId,
                price.Customer.CustomerCode,
                dbContext.CustomerVersions
                    .Where(version => version.CustomerId == price.CustomerId && version.ValidFrom <= price.ValidFrom)
                    .OrderByDescending(version => version.ValidFrom)
                    .ThenByDescending(version => version.Id)
                    .Select(version => version.Name)
                    .FirstOrDefault() ?? string.Empty,
                price.ProductId,
                price.Product.ProductCode,
                dbContext.ProductVersions
                    .Where(version => version.ProductId == price.ProductId && version.ValidFrom <= price.ValidFrom)
                    .OrderByDescending(version => version.ValidFrom)
                    .ThenByDescending(version => version.Id)
                    .Select(version => version.Name)
                    .FirstOrDefault() ?? string.Empty,
                price.UnitPrice,
                price.ValidFrom,
                price.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(prices);
    }

    private static async Task<IResult> CreateCustomerProductPrice(
        AppDbContext dbContext,
        CreateCustomerProductPriceRequest request,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidateCreateCustomerProductPrice(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        return await CreatePriceRecord(
            dbContext,
            request.CustomerId,
            request.ProductId,
            request.UnitPrice,
            request.ValidFrom,
            cancellationToken);
    }

    private static async Task<IResult> GetCustomerProductPriceHistory(
        AppDbContext dbContext,
        long customerId,
        long productId,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidateListFilters(customerId, productId);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var customer = await LoadCustomerIdentity(dbContext, customerId, cancellationToken);
        if (customer is null)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var product = await LoadProductIdentity(dbContext, productId, cancellationToken);
        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var prices = await dbContext.CustomerProductPrices
            .AsNoTracking()
            .Where(price => price.CustomerId == customerId && price.ProductId == productId)
            .OrderByDescending(price => price.ValidFrom)
            .ThenByDescending(price => price.Id)
            .Select(price => new CustomerProductPriceResponse(
                price.Id,
                price.CustomerId,
                customer.CustomerCode,
                dbContext.CustomerVersions
                    .Where(version => version.CustomerId == price.CustomerId && version.ValidFrom <= price.ValidFrom)
                    .OrderByDescending(version => version.ValidFrom)
                    .ThenByDescending(version => version.Id)
                    .Select(version => version.Name)
                    .FirstOrDefault() ?? string.Empty,
                price.ProductId,
                product.ProductCode,
                dbContext.ProductVersions
                    .Where(version => version.ProductId == price.ProductId && version.ValidFrom <= price.ValidFrom)
                    .OrderByDescending(version => version.ValidFrom)
                    .ThenByDescending(version => version.Id)
                    .Select(version => version.Name)
                    .FirstOrDefault() ?? string.Empty,
                price.UnitPrice,
                price.ValidFrom,
                price.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(prices);
    }

    private static async Task<IResult> CreateCustomerProductPriceHistory(
        AppDbContext dbContext,
        long customerId,
        long productId,
        CreateCustomerProductPriceHistoryRequest request,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidateCreateCustomerProductPriceHistory(
            customerId,
            productId,
            request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        return await CreatePriceRecord(
            dbContext,
            customerId,
            productId,
            request.UnitPrice,
            request.ValidFrom,
            cancellationToken);
    }

    private static async Task<IResult> PreviewCustomerProductPrice(
        AppDbContext dbContext,
        long customerId,
        long productId,
        DateTime targetDate,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidatePreview(customerId, productId, targetDate);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var date = targetDate.Date;
        var customer = await LoadCustomerIdentity(dbContext, customerId, cancellationToken);
        if (customer is null)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var product = await LoadProductIdentity(dbContext, productId, cancellationToken);
        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var customerVersion = await dbContext.CustomerVersions
            .AsNoTracking()
            .Where(version => version.CustomerId == customerId && version.ValidFrom <= date)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (customerVersion is null)
        {
            return Results.NotFound(new { message = "対象日に適用できる得意先履歴がありません。" });
        }

        var productVersion = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => version.ProductId == productId && version.ValidFrom <= date)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (productVersion is null)
        {
            return Results.NotFound(new { message = "対象日に適用できる商品履歴がありません。" });
        }

        var customerProductPrice = await dbContext.CustomerProductPrices
            .AsNoTracking()
            .Where(price => price.CustomerId == customerId
                && price.ProductId == productId
                && price.ValidFrom <= date)
            .OrderByDescending(price => price.ValidFrom)
            .ThenByDescending(price => price.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var unitPrice = customerProductPrice?.UnitPrice ?? productVersion.StandardUnitPrice;
        var unitPriceSource = customerProductPrice is null ? "ProductStandard" : "CustomerProductPrice";

        return Results.Ok(new CustomerProductPricePreviewResponse(
            customer.Id,
            customer.CustomerCode,
            customerVersion.Id,
            customerVersion.Name,
            product.Id,
            product.ProductCode,
            productVersion.Id,
            productVersion.Name,
            productVersion.Unit,
            unitPrice,
            unitPriceSource,
            customerProductPrice?.Id,
            customerProductPrice?.ValidFrom,
            productVersion.StandardUnitPrice,
            productVersion.ValidFrom,
            date));
    }

    private static async Task<IResult> CreatePriceRecord(
        AppDbContext dbContext,
        long customerId,
        long productId,
        decimal unitPrice,
        DateTime validFrom,
        CancellationToken cancellationToken)
    {
        var customer = await LoadCustomerIdentity(dbContext, customerId, cancellationToken);
        if (customer is null)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var product = await LoadProductIdentity(dbContext, productId, cancellationToken);
        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var date = validFrom.Date;
        var priceExists = await dbContext.CustomerProductPrices.AnyAsync(
            price => price.CustomerId == customerId && price.ProductId == productId && price.ValidFrom == date,
            cancellationToken);

        if (priceExists)
        {
            return Results.Conflict(new { message = "同じ得意先、商品、適用開始日の得意先別商品単価が既に存在します。" });
        }

        var price = new CustomerProductPrice
        {
            CustomerId = customerId,
            ProductId = productId,
            UnitPrice = unitPrice,
            ValidFrom = date,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.CustomerProductPrices.Add(price);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { message = "得意先別商品単価の一意制約または外部キー制約に違反しました。" });
        }

        var response = await BuildPriceResponse(dbContext, price.Id, cancellationToken);
        return Results.Created($"/api/customer-product-prices/{price.Id}", response);
    }

    private static async Task<CustomerProductPriceResponse?> BuildPriceResponse(
        AppDbContext dbContext,
        long priceId,
        CancellationToken cancellationToken)
    {
        return await dbContext.CustomerProductPrices
            .AsNoTracking()
            .Where(price => price.Id == priceId)
            .Select(price => new CustomerProductPriceResponse(
                price.Id,
                price.CustomerId,
                price.Customer.CustomerCode,
                dbContext.CustomerVersions
                    .Where(version => version.CustomerId == price.CustomerId && version.ValidFrom <= price.ValidFrom)
                    .OrderByDescending(version => version.ValidFrom)
                    .ThenByDescending(version => version.Id)
                    .Select(version => version.Name)
                    .FirstOrDefault() ?? string.Empty,
                price.ProductId,
                price.Product.ProductCode,
                dbContext.ProductVersions
                    .Where(version => version.ProductId == price.ProductId && version.ValidFrom <= price.ValidFrom)
                    .OrderByDescending(version => version.ValidFrom)
                    .ThenByDescending(version => version.Id)
                    .Select(version => version.Name)
                    .FirstOrDefault() ?? string.Empty,
                price.UnitPrice,
                price.ValidFrom,
                price.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<CustomerIdentity?> LoadCustomerIdentity(
        AppDbContext dbContext,
        long customerId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => new CustomerIdentity(customer.Id, customer.CustomerCode))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<ProductIdentity?> LoadProductIdentity(
        AppDbContext dbContext,
        long productId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Products
            .AsNoTracking()
            .Where(product => product.Id == productId)
            .Select(product => new ProductIdentity(product.Id, product.ProductCode))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private sealed record CustomerIdentity(long Id, string CustomerCode);

    private sealed record ProductIdentity(long Id, string ProductCode);
}
