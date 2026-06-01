namespace SalesSystem.Api.Features.Products;

public sealed record ProductListItemResponse(
    long ProductId,
    string ProductCode,
    long ProductVersionId,
    string Name,
    string Unit,
    decimal StandardUnitPrice,
    string TaxCategory,
    bool IsDiscontinued,
    DateTime ValidFrom);

public sealed record ProductResponse(
    long ProductId,
    string ProductCode,
    long ProductVersionId,
    string Name,
    string Unit,
    decimal StandardUnitPrice,
    string TaxCategory,
    bool IsDiscontinued,
    DateTime ValidFrom);

public sealed record ProductVersionResponse(
    long ProductVersionId,
    long ProductId,
    string ProductCode,
    string Name,
    string Unit,
    decimal StandardUnitPrice,
    string TaxCategory,
    bool IsDiscontinued,
    DateTime ValidFrom);

public sealed record CreateProductRequest(
    string? ProductCode,
    string? Name,
    string? Unit,
    decimal StandardUnitPrice,
    string? TaxCategory,
    bool IsDiscontinued,
    DateTime ValidFrom);

public sealed record CreateProductVersionRequest(
    string? Name,
    string? Unit,
    decimal StandardUnitPrice,
    string? TaxCategory,
    bool IsDiscontinued,
    DateTime ValidFrom);
