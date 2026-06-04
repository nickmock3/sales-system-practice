namespace SalesSystem.Api.Features.CustomerProductPrices;

public sealed record CustomerProductPriceListItemResponse(
    long CustomerProductPriceId,
    long CustomerId,
    string CustomerCode,
    string CustomerName,
    long ProductId,
    string ProductCode,
    string ProductName,
    decimal UnitPrice,
    DateTime ValidFrom,
    DateTime CreatedAt);

public sealed record CustomerProductPriceResponse(
    long CustomerProductPriceId,
    long CustomerId,
    string CustomerCode,
    string CustomerName,
    long ProductId,
    string ProductCode,
    string ProductName,
    decimal UnitPrice,
    DateTime ValidFrom,
    DateTime CreatedAt);

public sealed record CustomerProductPricePreviewResponse(
    long CustomerId,
    string CustomerCode,
    long CustomerVersionId,
    string CustomerName,
    long ProductId,
    string ProductCode,
    long ProductVersionId,
    string ProductName,
    string Unit,
    decimal AutoUnitPrice,
    string UnitPriceSource,
    long? CustomerProductPriceId,
    DateTime? CustomerProductPriceValidFrom,
    decimal StandardUnitPrice,
    DateTime ProductVersionValidFrom,
    DateTime TargetDate);

public sealed record CreateCustomerProductPriceRequest(
    long CustomerId,
    long ProductId,
    decimal UnitPrice,
    DateTime ValidFrom);

public sealed record CreateCustomerProductPriceHistoryRequest(
    decimal UnitPrice,
    DateTime ValidFrom);
