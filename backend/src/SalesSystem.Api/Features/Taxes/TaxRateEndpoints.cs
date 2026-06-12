using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Features.Products;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.Taxes;

public static class TaxRateEndpoints
{
    public static IEndpointRouteBuilder MapTaxRateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/tax-rates");

        group.MapGet("/", GetTaxRates)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/{taxCategory}", GetTaxRate)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/{taxCategory}/changes", GetTaxRateChanges)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/{taxCategory}/changes", ChangeTaxRate)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        return endpoints;
    }

    private static async Task<IResult> GetTaxRates(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        DateTime? asOf,
        CancellationToken cancellationToken)
    {
        var date = (asOf ?? businessClock.Today).Date;

        var latestValidFromByCategory =
            from rate in dbContext.TaxRates.AsNoTracking()
            where rate.ValidFrom <= date
            group rate by rate.TaxCategory into grouped
            select new
            {
                TaxCategory = grouped.Key,
                ValidFrom = grouped.Max(rate => rate.ValidFrom)
            };

        var taxRates = await (
            from latest in latestValidFromByCategory
            join rate in dbContext.TaxRates.AsNoTracking()
                on new { latest.TaxCategory, latest.ValidFrom }
                equals new { rate.TaxCategory, rate.ValidFrom }
            orderby rate.TaxCategory
            select new TaxRateSummary(
                rate.TaxCategory,
                rate.TaxCategoryName,
                rate.AccountingCategory,
                rate.Rate,
                rate.ValidFrom))
            .ToListAsync(cancellationToken);

        return Results.Ok(taxRates);
    }

    private static async Task<IResult> GetTaxRate(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        string taxCategory,
        DateTime? asOf,
        CancellationToken cancellationToken)
    {
        var categoryError = ValidateTaxCategoryRoute(taxCategory);
        if (categoryError is not null)
        {
            return categoryError;
        }

        var category = taxCategory.Trim();
        var date = (asOf ?? businessClock.Today).Date;
        var taxRate = await dbContext.TaxRates
            .AsNoTracking()
            .Where(rate => rate.TaxCategory == category && rate.ValidFrom <= date)
            .OrderByDescending(rate => rate.ValidFrom)
            .ThenByDescending(rate => rate.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (taxRate is null)
        {
            return Results.NotFound(new { message = "指定日時点で利用できる税率情報がありません。" });
        }

        return Results.Ok(ToSummary(taxRate));
    }

    private static async Task<IResult> GetTaxRateChanges(
        AppDbContext dbContext,
        string taxCategory,
        CancellationToken cancellationToken)
    {
        var categoryError = ValidateTaxCategoryRoute(taxCategory);
        if (categoryError is not null)
        {
            return categoryError;
        }

        var category = taxCategory.Trim();
        var changes = await dbContext.TaxRates
            .AsNoTracking()
            .Where(rate => rate.TaxCategory == category)
            .OrderByDescending(rate => rate.ValidFrom)
            .ThenByDescending(rate => rate.Id)
            .Select(rate => new TaxRateChange(
                rate.TaxCategory,
                rate.TaxCategoryName,
                rate.AccountingCategory,
                rate.Rate,
                rate.ValidFrom))
            .ToListAsync(cancellationToken);

        return Results.Ok(changes);
    }

    private static async Task<IResult> ChangeTaxRate(
        AppDbContext dbContext,
        string taxCategory,
        ChangeTaxRateRequest request,
        CancellationToken cancellationToken)
    {
        var category = taxCategory?.Trim() ?? string.Empty;
        var errors = TaxRateValidation.ValidateChangeTaxRate(category, request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var effectiveFrom = request.EffectiveFrom.Date;
        var taxRateExists = await dbContext.TaxRates.AnyAsync(
            rate => rate.TaxCategory == category && rate.ValidFrom == effectiveFrom,
            cancellationToken);

        if (taxRateExists)
        {
            return Results.Conflict(new { message = "同じ適用開始日の税率情報は既に登録されています。" });
        }

        TaxCategories.TryGet(category, out var taxCategoryDefinition);
        var taxRate = new TaxRate
        {
            TaxCategory = category,
            TaxCategoryName = taxCategoryDefinition!.Name,
            AccountingCategory = taxCategoryDefinition.AccountingCategory,
            Rate = request.Rate,
            ValidFrom = effectiveFrom
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

        return Results.Ok(ToSummary(taxRate));
    }

    private static IResult? ValidateTaxCategoryRoute(string? taxCategory)
    {
        if (string.IsNullOrWhiteSpace(taxCategory))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["taxCategory"] = ["税区分は必須です。"]
            });
        }

        if (taxCategory.Length > 30)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["taxCategory"] = ["30文字以内で指定してください。"]
            });
        }

        if (!TaxCategories.TryGet(taxCategory.Trim(), out _))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["taxCategory"] = ["未知の税区分です。"]
            });
        }

        return null;
    }

    private static TaxRateSummary ToSummary(TaxRate taxRate)
    {
        return new TaxRateSummary(
            taxRate.TaxCategory,
            taxRate.TaxCategoryName,
            taxRate.AccountingCategory,
            taxRate.Rate,
            taxRate.ValidFrom);
    }
}
