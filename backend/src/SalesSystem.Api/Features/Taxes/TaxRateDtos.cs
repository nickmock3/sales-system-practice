namespace SalesSystem.Api.Features.Taxes;

public sealed record TaxRateSummary(
    string TaxCategory,
    string TaxCategoryName,
    string AccountingCategory,
    decimal Rate,
    DateTime EffectiveFrom);

public sealed record TaxRateChange(
    string TaxCategory,
    string TaxCategoryName,
    string AccountingCategory,
    decimal Rate,
    DateTime EffectiveFrom);

public sealed record ChangeTaxRateRequest(
    decimal Rate,
    DateTime EffectiveFrom);
