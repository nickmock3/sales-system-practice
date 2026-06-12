using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Features.Products;
using SalesSystem.Api.Features.Shared;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.CustomerProductPrices;

public static class CustomerProductPriceEndpoints
{
    public static IEndpointRouteBuilder MapCustomerProductPriceEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/customer-product-prices");

        group.MapGet("/preview", PreviewCustomerProductPrice)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/", GetCustomerProductPrices)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/", CreateCustomerProductPrice)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/{customerId:long}/{productId:long}/changes", GetCustomerProductPriceChanges)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/{customerId:long}/{productId:long}/changes", ChangeCustomerProductPrice)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/{customerId:long}/{productId:long}", GetCustomerProductPrice)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        return endpoints;
    }

    private static async Task<IResult> GetCustomerProductPrices(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        long? customerId,
        long? productId,
        string? customerCode,
        string? productCode,
        DateTime? asOf,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidateListFilters(customerId, productId);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var date = (asOf ?? businessClock.Today).Date;

        var latestValidFromByCombination =
            from price in dbContext.CustomerProductPrices.AsNoTracking()
            where price.ValidFrom <= date
            group price by new { price.CustomerId, price.ProductId } into grouped
            select new
            {
                grouped.Key.CustomerId,
                grouped.Key.ProductId,
                ValidFrom = grouped.Max(price => price.ValidFrom)
            };

        var query =
            from latest in latestValidFromByCombination
            join price in dbContext.CustomerProductPrices.AsNoTracking()
                on new { latest.CustomerId, latest.ProductId, latest.ValidFrom }
                equals new { price.CustomerId, price.ProductId, price.ValidFrom }
            select price;

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
            .Select(price => new CustomerProductPriceSummary(
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

        var customer = await LoadCustomerIdentity(dbContext, request.CustomerId, cancellationToken);
        if (customer is null)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var product = await LoadProductIdentity(dbContext, request.ProductId, cancellationToken);
        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var combinationExists = await dbContext.CustomerProductPrices.AnyAsync(
            price => price.CustomerId == request.CustomerId && price.ProductId == request.ProductId,
            cancellationToken);

        if (combinationExists)
        {
            return Results.Conflict(new { message = "同じ得意先と商品の組み合わせの単価情報は既に登録されています。" });
        }

        return await CreatePriceRecord(
            dbContext,
            request.CustomerId,
            request.ProductId,
            request.UnitPrice,
            request.EffectiveFrom,
            cancellationToken);
    }

    private static async Task<IResult> GetCustomerProductPrice(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        long customerId,
        long productId,
        DateTime? asOf,
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

        var date = (asOf ?? businessClock.Today).Date;
        var price = await dbContext.CustomerProductPrices
            .AsNoTracking()
            .Where(item => item.CustomerId == customerId
                && item.ProductId == productId
                && item.ValidFrom <= date)
            .OrderByDescending(item => item.ValidFrom)
            .ThenByDescending(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (price is null)
        {
            return Results.NotFound(new { message = "指定日時点で利用できる単価情報がありません。" });
        }

        var response = await BuildSummaryResponse(dbContext, price.Id, cancellationToken);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetCustomerProductPriceChanges(
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

        var changes = await dbContext.CustomerProductPrices
            .AsNoTracking()
            .Where(price => price.CustomerId == customerId && price.ProductId == productId)
            .OrderByDescending(price => price.ValidFrom)
            .ThenByDescending(price => price.Id)
            .Select(price => new CustomerProductPriceChange(
                price.UnitPrice,
                price.ValidFrom,
                price.CreatedAt))
            .ToListAsync(cancellationToken);

        return Results.Ok(changes);
    }

    private static async Task<IResult> ChangeCustomerProductPrice(
        AppDbContext dbContext,
        long customerId,
        long productId,
        ChangeCustomerProductPriceRequest request,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidateChangeCustomerProductPrice(
            customerId,
            productId,
            request);
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

        var combinationExists = await dbContext.CustomerProductPrices.AnyAsync(
            price => price.CustomerId == customerId && price.ProductId == productId,
            cancellationToken);

        if (!combinationExists)
        {
            return Results.NotFound(new { message = "単価設定が見つかりません。" });
        }

        var effectiveFrom = request.EffectiveFrom.Date;
        var priceExists = await dbContext.CustomerProductPrices.AnyAsync(
            price => price.CustomerId == customerId
                && price.ProductId == productId
                && price.ValidFrom == effectiveFrom,
            cancellationToken);

        if (priceExists)
        {
            return Results.Conflict(new { message = "同じ適用開始日の単価情報は既に登録されています。" });
        }

        return await CreatePriceRecord(
            dbContext,
            customerId,
            productId,
            request.UnitPrice,
            request.EffectiveFrom,
            cancellationToken,
            returnOk: true);
    }

    private static async Task<IResult> PreviewCustomerProductPrice(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        long customerId,
        long productId,
        DateTime? asOf,
        CancellationToken cancellationToken)
    {
        var errors = CustomerProductPriceValidation.ValidatePreview(customerId, productId, asOf);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var date = (asOf ?? businessClock.Today).Date;
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
            return Results.NotFound(new { message = "指定日時点で利用できる得意先情報がありません。" });
        }

        var productVersion = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => version.ProductId == productId && version.ValidFrom <= date)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (productVersion is null)
        {
            return Results.NotFound(new { message = "指定日時点で利用できる商品情報がありません。" });
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
        var unitPriceSource = customerProductPrice is null
            ? UnitPriceSources.ProductStandard
            : UnitPriceSources.CustomerProductPrice;

        return Results.Ok(new CustomerProductPricePreviewResponse(
            customer.Id,
            customer.CustomerCode,
            customerVersion.Name,
            product.Id,
            product.ProductCode,
            productVersion.Name,
            productVersion.Unit,
            unitPrice,
            unitPriceSource,
            productVersion.StandardUnitPrice,
            date));
    }

    private static async Task<IResult> CreatePriceRecord(
        AppDbContext dbContext,
        long customerId,
        long productId,
        decimal unitPrice,
        DateTime effectiveFrom,
        CancellationToken cancellationToken,
        bool returnOk = false)
    {
        var date = effectiveFrom.Date;
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

        var response = await BuildSummaryResponse(dbContext, price.Id, cancellationToken);
        if (response is null)
        {
            return Results.Conflict(new { message = "得意先別商品単価の一意制約または外部キー制約に違反しました。" });
        }

        if (returnOk)
        {
            return Results.Ok(response);
        }

        return Results.Created($"/api/customer-product-prices/{customerId}/{productId}", response);
    }

    private static async Task<CustomerProductPriceSummary?> BuildSummaryResponse(
        AppDbContext dbContext,
        long priceId,
        CancellationToken cancellationToken)
    {
        return await dbContext.CustomerProductPrices
            .AsNoTracking()
            .Where(price => price.Id == priceId)
            .Select(price => new CustomerProductPriceSummary(
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
