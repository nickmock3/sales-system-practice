using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.Taxes;

public static class TaxRateEndpoints
{
    public static IEndpointRouteBuilder MapTaxRateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/tax-rates");

        group.MapGet("/", GetTaxRates)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/", CreateTaxRate)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/preview", PreviewTaxRate)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        return endpoints;
    }

    private static async Task<IResult> GetTaxRates(
        AppDbContext dbContext,
        string? taxCategory,
        CancellationToken cancellationToken)
    {
        if (taxCategory is not null && taxCategory.Length > 30)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                [nameof(taxCategory)] = ["30文字以内で指定してください。"]
            });
        }

        var query = dbContext.TaxRates.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(taxCategory))
        {
            var category = taxCategory.Trim();
            query = query.Where(taxRate => taxRate.TaxCategory == category);
        }

        var taxRates = await query
            .OrderByDescending(taxRate => taxRate.ValidFrom)
            .ThenByDescending(taxRate => taxRate.Id)
            .Select(taxRate => ToTaxRateResponse(taxRate))
            .ToListAsync(cancellationToken);

        return Results.Ok(taxRates);
    }

    private static async Task<IResult> CreateTaxRate(
        AppDbContext dbContext,
        CreateTaxRateRequest request,
        CancellationToken cancellationToken)
    {
        var errors = TaxRateValidation.ValidateCreateTaxRate(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var taxCategory = request.TaxCategory!.Trim();
        var validFrom = request.ValidFrom.Date;

        var taxRateExists = await dbContext.TaxRates.AnyAsync(
            taxRate => taxRate.TaxCategory == taxCategory && taxRate.ValidFrom == validFrom,
            cancellationToken);

        if (taxRateExists)
        {
            return Results.Conflict(new { message = "同じ税区分と適用開始日の税率が既に存在します。" });
        }

        var taxRate = new TaxRate
        {
            TaxCategory = taxCategory,
            Rate = request.Rate,
            ValidFrom = validFrom
        };

        dbContext.TaxRates.Add(taxRate);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { message = "税率の一意制約に違反しました。" });
        }

        return Results.Created($"/api/tax-rates/{taxRate.Id}", ToTaxRateResponse(taxRate));
    }

    private static async Task<IResult> PreviewTaxRate(
        AppDbContext dbContext,
        string? taxCategory,
        DateTime targetDate,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(taxCategory))
        {
            errors[nameof(taxCategory)] = ["税区分は必須です。"];
        }
        else if (taxCategory.Length > 30)
        {
            errors[nameof(taxCategory)] = ["30文字以内で指定してください。"];
        }

        if (targetDate == default)
        {
            errors[nameof(targetDate)] = ["対象日は必須です。"];
        }

        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var category = taxCategory!.Trim();
        var date = targetDate.Date;
        var taxRate = await dbContext.TaxRates
            .AsNoTracking()
            .Where(taxRate => taxRate.TaxCategory == category && taxRate.ValidFrom <= date)
            .OrderByDescending(taxRate => taxRate.ValidFrom)
            .ThenByDescending(taxRate => taxRate.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (taxRate is null)
        {
            return Results.NotFound(new { message = "対象日に適用できる税率がありません。" });
        }

        return Results.Ok(ToTaxRateResponse(taxRate));
    }

    private static TaxRateResponse ToTaxRateResponse(TaxRate taxRate)
    {
        return new TaxRateResponse(
            taxRate.Id,
            taxRate.TaxCategory,
            taxRate.Rate,
            taxRate.ValidFrom);
    }
}
