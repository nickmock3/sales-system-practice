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

        group.MapGet("/{productId:long}/versions", GetProductVersions)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/{productId:long}/versions", CreateProductVersion)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/{productId:long}/preview", PreviewProduct)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

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
            .Select(item => new ProductListItemResponse(
                item.product.Id,
                item.product.ProductCode,
                item.version.Id,
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
        var validFrom = request.ValidFrom.Date;

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
            ValidFrom = validFrom
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
        return Results.Created($"/api/products/{product.Id}", ToProductResponse(product, version));
    }

    private static async Task<IResult> GetProductVersions(
        AppDbContext dbContext,
        long productId,
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

        var versions = await dbContext.ProductVersions
            .AsNoTracking()
            .Where(version => version.ProductId == productId)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .Select(version => new ProductVersionResponse(
                version.Id,
                version.ProductId,
                product.ProductCode,
                version.Name,
                version.Unit,
                version.StandardUnitPrice,
                version.TaxCategory,
                version.IsDiscontinued,
                version.ValidFrom))
            .ToListAsync(cancellationToken);

        return Results.Ok(versions);
    }

    private static async Task<IResult> CreateProductVersion(
        AppDbContext dbContext,
        long productId,
        CreateProductVersionRequest request,
        CancellationToken cancellationToken)
    {
        var errors = ProductValidation.ValidateCreateProductVersion(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var product = await dbContext.Products
            .FirstOrDefaultAsync(product => product.Id == productId, cancellationToken);

        if (product is null)
        {
            return Results.NotFound(new { message = "商品が見つかりません。" });
        }

        var validFrom = request.ValidFrom.Date;
        var versionExists = await dbContext.ProductVersions.AnyAsync(
            version => version.ProductId == productId && version.ValidFrom == validFrom,
            cancellationToken);

        if (versionExists)
        {
            return Results.Conflict(new { message = "同じ適用開始日の商品履歴が既に存在します。" });
        }

        var version = new ProductVersion
        {
            ProductId = productId,
            Name = request.Name!.Trim(),
            Unit = request.Unit!.Trim(),
            StandardUnitPrice = request.StandardUnitPrice,
            TaxCategory = request.TaxCategory!.Trim(),
            IsDiscontinued = request.IsDiscontinued,
            ValidFrom = validFrom
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

        return Results.Created($"/api/products/{productId}/versions/{version.Id}", ToProductVersionResponse(product, version));
    }

    private static async Task<IResult> PreviewProduct(
        AppDbContext dbContext,
        long productId,
        DateTime targetDate,
        CancellationToken cancellationToken)
    {
        if (targetDate == default)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(targetDate)] = ["対象日は必須です。"]
            });
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

        var date = targetDate.Date;
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

        return Results.Ok(ToProductVersionResponse(product, version));
    }

    private static ProductResponse ToProductResponse(Product product, ProductVersion version)
    {
        return new ProductResponse(
            product.Id,
            product.ProductCode,
            version.Id,
            version.Name,
            version.Unit,
            version.StandardUnitPrice,
            version.TaxCategory,
            version.IsDiscontinued,
            version.ValidFrom);
    }

    private static ProductVersionResponse ToProductVersionResponse(Product product, ProductVersion version)
    {
        return new ProductVersionResponse(
            version.Id,
            product.Id,
            product.ProductCode,
            version.Name,
            version.Unit,
            version.StandardUnitPrice,
            version.TaxCategory,
            version.IsDiscontinued,
            version.ValidFrom);
    }

    private static ProductVersionResponse ToProductVersionResponse(
        ProductIdentity product,
        ProductVersion version)
    {
        return new ProductVersionResponse(
            version.Id,
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
