namespace SalesSystem.Api.Features.Sales;

public sealed record CreateSaleRequest(
    DateTime SalesDate,
    long CustomerId,
    List<CreateSaleLineRequest>? Lines);

public sealed record CreateSaleLineRequest(
    long ProductId,
    decimal Quantity,
    decimal UnitPrice);

public sealed record SaleListItemResponse(
    long SaleId,
    DateTime SalesDate,
    long CustomerId,
    string CustomerCode,
    long CustomerVersionId,
    string CustomerName,
    decimal TotalAmount,
    DateTime CreatedAt,
    string Status,
    DateTime StatusChangedAt,
    string? CorrectionType,
    long? OriginalSaleId,
    long? CorrectionSaleId,
    string? CorrectionReason);

public sealed record SaleDetailLineResponse(
    long SaleDetailId,
    long ProductId,
    long ProductVersionId,
    string ProductCode,
    string ProductName,
    string Unit,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    decimal TaxAmount,
    decimal Amount);

public sealed record SaleResponse(
    long SaleId,
    DateTime SalesDate,
    long CustomerId,
    string CustomerCode,
    long CustomerVersionId,
    string CustomerName,
    decimal TotalAmount,
    DateTime CreatedAt,
    string Status,
    DateTime StatusChangedAt,
    string? CorrectionType,
    long? OriginalSaleId,
    long? CorrectionSaleId,
    string? CorrectionReason,
    string? CorrectionCreatedBy,
    List<SaleStatusHistoryResponse> StatusHistories,
    List<SaleDetailLineResponse> Details);

public sealed record SaleStatusHistoryResponse(
    long SaleStatusHistoryId,
    string Status,
    string Reason,
    DateTime ChangedAt,
    string ChangedBy);

public sealed record CancelSaleRequest(string? Reason);

public sealed record SalesProductPreviewResponse(
    long ProductId,
    string ProductCode,
    long ProductVersionId,
    string Name,
    string Unit,
    decimal StandardUnitPrice,
    string TaxCategory,
    decimal TaxRate,
    bool IsDiscontinued,
    DateTime ValidFrom);
