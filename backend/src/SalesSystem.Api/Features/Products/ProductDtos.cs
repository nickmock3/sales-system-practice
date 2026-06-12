namespace SalesSystem.Api.Features.Products;

public sealed record ProductSummary(
    long ProductId,
    string ProductCode,
    string Name,
    string Unit,
    decimal StandardUnitPrice,
    string TaxCategory,
    bool IsDiscontinued,
    DateTime EffectiveFrom);

public sealed record ProductChange(
    DateTime EffectiveFrom,
    string Name,
    string Unit,
    decimal StandardUnitPrice,
    string TaxCategory,
    bool IsDiscontinued);

public sealed record CreateProductRequest(
    string? ProductCode,
    string? Name,
    string? Unit,
    decimal StandardUnitPrice,
    string? TaxCategory,
    bool IsDiscontinued,
    DateTime EffectiveFrom);

public sealed record ChangeProductRequest(
    string? Name,
    string? Unit,
    decimal StandardUnitPrice,
    string? TaxCategory,
    bool IsDiscontinued,
    DateTime EffectiveFrom);
