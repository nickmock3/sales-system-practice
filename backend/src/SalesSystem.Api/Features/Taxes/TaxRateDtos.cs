namespace SalesSystem.Api.Features.Taxes;

public sealed record TaxRateResponse(
    long TaxRateId,
    string TaxCategory,
    decimal Rate,
    DateTime ValidFrom);

public sealed record CreateTaxRateRequest(
    string? TaxCategory,
    decimal Rate,
    DateTime ValidFrom);
