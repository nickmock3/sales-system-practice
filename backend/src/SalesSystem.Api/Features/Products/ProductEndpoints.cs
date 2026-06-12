using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.Products;

public static class ProductEndpoints
{
    public static IEndpointRouteBuilder MapProductEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/products");

        group.MapGet("/", GetProducts)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/", CreateProduct)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/{productId:long}", GetProduct)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/{productId:long}/changes", GetProductChanges)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/{productId:long}/changes", ChangeProduct)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        return endpoints;
    }

    private static async Task<IResult> GetProducts(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        string? productCode,
        string? name,
        bool? isDiscontinued,
        CancellationToken cancellationToken)
    {
        var targetDate = businessClock.Today;

        var latestValidFromByProduct =
            from version in dbContext.ProductVersions.AsNoTracking()
            where version.ValidFrom <= targetDate
            group version by version.ProductId into grouped
            select new
            {
                ProductId = grouped.Key,
                ValidFrom = grouped.Max(version => version.ValidFrom)
            };

        var query =
            from product in dbContext.Products.AsNoTracking()
            join latest in latestValidFromByProduct
                on product.Id equals latest.ProductId
            join version in dbContext.ProductVersions.AsNoTracking()
                on new { latest.ProductId, latest.ValidFrom }
                equals new { version.ProductId, version.ValidFrom }
            select new { product, version };

        if (!string.IsNullOrWhiteSpace(productCode))
        {
            query = query.Where(item => item.product.ProductCode.Contains(productCode));
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(item => item.version.Name.Contains(name));
        }

        if (isDiscontinued is not null)
        {
            query = query.Where(item => item.version.IsDiscontinued == isDiscontinued.Value);
        }

        var products = await query
            .OrderBy(item => item.product.ProductCode)
            .Select(item => new ProductSummary(
                item.product.Id,
                item.product.ProductCode,
                item.version.Name,
                item.version.Unit,
                item.version.StandardUnitPrice,
                item.version.TaxCategory,
                item.version.IsDiscontinued,
                item.version.ValidFrom))
            .ToListAsync(cancellationToken);

        return Results.Ok(products);
    }

    private static async Task<IResult> CreateProduct(
        AppDbContext dbContext,
        CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var errors = ProductValidation.ValidateCreateProduct(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var productCode = request.ProductCode!.Trim();
        var effectiveFrom = request.EffectiveFrom.Date;

        var codeExists = await dbContext.Products
            .AnyAsync(product => product.ProductCode == productCode, cancellationToken);

        if (codeExists)
        {
            return Results.Conflict(new { message = "同じ商品コードの商品が既に存在します。" });
        }

        var product = new Product
        {
            ProductCode = productCode,
            CreatedAt = DateTime.UtcNow
        };

        product.Versions.Add(new ProductVersion
        {
            Name = request.Name!.Trim(),
            Unit = request.Unit!.Trim(),
            StandardUnitPrice = request.StandardUnitPrice,
            TaxCategory = request.TaxCategory!.Trim(),
            IsDiscontinued = request.IsDiscontinued,
            ValidFrom = effectiveFrom
        });

        dbContext.Products.Add(product);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { message = "商品コードまたは商品履歴の一意制約に違反しました。" });
        }

        var version = product.Versions[0];
        return Results.Created($"/api/products/{product.Id}", ToSummary(product, version));
    }

    private static async Task<IResult> GetProduct(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        long productId,
        DateTime? asOf,
        CancellationToken cancellationToken)
    {
        var product = await dbContext.Products
            .AsNoTracking()
            .Where(product => product.Id == productId)
            .Select(product => new ProductIdentity(product.Id, product.ProductCode))
            .FirstOrDefaultAsync(cancellationToken);

        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var date = (asOf ?? businessClock.Today).Date;
        var version = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => version.ProductId == productId && version.ValidFrom <= date)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (version is null)
        {
            return Results.NotFound(new { message = "指定日時点で利用できる商品情報がありません。" });
        }

        return Results.Ok(ToSummary(product, version));
    }

    private static async Task<IResult> GetProductChanges(
        AppDbContext dbContext,
        long productId,
        CancellationToken cancellationToken)
    {
        var productExists = await dbContext.Products
            .AsNoTracking()
            .AnyAsync(product => product.Id == productId, cancellationToken);

        if (!productExists)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var changes = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => version.ProductId == productId)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .Select(version => new ProductChange(
                version.ValidFrom,
                version.Name,
                version.Unit,
                version.StandardUnitPrice,
                version.TaxCategory,
                version.IsDiscontinued))
            .ToListAsync(cancellationToken);

        return Results.Ok(changes);
    }

    private static async Task<IResult> ChangeProduct(
        AppDbContext dbContext,
        long productId,
        ChangeProductRequest request,
        CancellationToken cancellationToken)
    {
        var errors = ProductValidation.ValidateChangeProduct(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var product = await dbContext.Products
            .AsNoTracking()
            .Where(product => product.Id == productId)
            .Select(product => new ProductIdentity(product.Id, product.ProductCode))
            .FirstOrDefaultAsync(cancellationToken);

        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var effectiveFrom = request.EffectiveFrom.Date;
        var versionExists = await dbContext.ProductVersions.AnyAsync(
            version => version.ProductId == productId && version.ValidFrom == effectiveFrom,
            cancellationToken);

        if (versionExists)
        {
            return Results.Conflict(new { message = "同じ適用開始日の商品情報は既に登録されています。" });
        }

        var version = new ProductVersion
        {
            ProductId = productId,
            Name = request.Name!.Trim(),
            Unit = request.Unit!.Trim(),
            StandardUnitPrice = request.StandardUnitPrice,
            TaxCategory = request.TaxCategory!.Trim(),
            IsDiscontinued = request.IsDiscontinued,
            ValidFrom = effectiveFrom
        };

        dbContext.ProductVersions.Add(version);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { message = "商品履歴の一意制約に違反しました。" });
        }

        return Results.Ok(ToSummary(product, version));
    }

    private static ProductSummary ToSummary(Product product, ProductVersion version)
    {
        return new ProductSummary(
            product.Id,
            product.ProductCode,
            version.Name,
            version.Unit,
            version.StandardUnitPrice,
            version.TaxCategory,
            version.IsDiscontinued,
            version.ValidFrom);
    }

    private static ProductSummary ToSummary(ProductIdentity product, ProductVersion version)
    {
        return new ProductSummary(
            product.Id,
            product.ProductCode,
            version.Name,
            version.Unit,
            version.StandardUnitPrice,
            version.TaxCategory,
            version.IsDiscontinued,
            version.ValidFrom);
    }

    private sealed record ProductIdentity(long Id, string ProductCode);
}
