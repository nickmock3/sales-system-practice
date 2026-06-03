namespace SalesSystem.Api.Domain.Entities;

public sealed class SaleCorrection
{
    public long Id { get; set; }

    public long OriginalSaleId { get; set; }

    public Sale OriginalSale { get; set; } = null!;

    public long CorrectionSaleId { get; set; }

    public Sale CorrectionSale { get; set; } = null!;

    public SaleCorrectionType CorrectionType { get; set; }

    public string Reason { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;
}
