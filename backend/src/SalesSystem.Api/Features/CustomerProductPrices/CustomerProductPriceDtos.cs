namespace SalesSystem.Api.Features.CustomerProductPrices;

public sealed record CustomerProductPriceSummary(
    long CustomerId,
    string CustomerCode,
    string CustomerName,
    long ProductId,
    string ProductCode,
    string ProductName,
    decimal UnitPrice,
    DateTime EffectiveFrom,
    DateTime CreatedAt);

public sealed record CustomerProductPriceChange(
    decimal UnitPrice,
    DateTime EffectiveFrom,
    DateTime CreatedAt);

public sealed record CustomerProductPricePreviewResponse(
    long CustomerId,
    string CustomerCode,
    string CustomerName,
    long ProductId,
    string ProductCode,
    string ProductName,
    string Unit,
    decimal AutoUnitPrice,
    string UnitPriceSource,
    decimal StandardUnitPrice,
    DateTime AsOf);

public sealed record CreateCustomerProductPriceRequest(
    long CustomerId,
    long ProductId,
    decimal UnitPrice,
    DateTime EffectiveFrom);

public sealed record ChangeCustomerProductPriceRequest(
    decimal UnitPrice,
    DateTime EffectiveFrom);
