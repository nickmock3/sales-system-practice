namespace SalesSystem.Api.Features.Taxes;

public sealed record TaxRateResponse(
    long TaxRateId,
    string TaxCategory,
    string TaxCategoryName,
    string AccountingCategory,
    decimal Rate,
    DateTime ValidFrom);

public sealed record CreateTaxRateRequest(
    string? TaxCategory,
    decimal Rate,
    DateTime ValidFrom);
