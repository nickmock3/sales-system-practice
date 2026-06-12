namespace SalesSystem.Api.Features.Sales;

public sealed record CreateSaleRequest(
    DateTime SalesDate,
    long CustomerId,
    List<CreateSaleLineRequest>? Lines);

public sealed record CreateSaleLineRequest(
    long ProductId,
    decimal Quantity,
    decimal UnitPrice,
    string? ManualUnitPriceReason);

public sealed record SaleListItemResponse(
    long SaleId,
    DateTime SalesDate,
    long CustomerId,
    string CustomerCode,
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
    string ProductCode,
    string ProductName,
    string Unit,
    string TaxCategory,
    string TaxCategoryName,
    string AccountingCategory,
    decimal Quantity,
    decimal UnitPrice,
    string UnitPriceSource,
    bool IsManualUnitPrice,
    decimal AutoUnitPrice,
    string? ManualUnitPriceReason,
    decimal TaxRate,
    decimal TaxAmount,
    decimal Amount);

public sealed record SaleResponse(
    long SaleId,
    DateTime SalesDate,
    long CustomerId,
    string CustomerCode,
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
    string Status,
    string Reason,
    DateTime ChangedAt,
    string ChangedBy);

public sealed record CancelSaleRequest(string? Reason);

public sealed record SalesLinePreviewResponse(
    long ProductId,
    string ProductCode,
    string ProductName,
    string Unit,
    decimal AutoUnitPrice,
    string UnitPriceSource,
    string TaxCategory,
    string TaxCategoryName,
    string AccountingCategory,
    decimal TaxRate,
    bool IsDiscontinued);
