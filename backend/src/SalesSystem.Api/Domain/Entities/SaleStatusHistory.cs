namespace SalesSystem.Api.Domain.Entities;

public sealed class SaleStatusHistory
{
    public long Id { get; set; }

    public long SaleId { get; set; }

    public Sale Sale { get; set; } = null!;

    public SaleStatus Status { get; set; }

    public string Reason { get; set; } = string.Empty;

    public DateTime ChangedAt { get; set; }

    public string ChangedBy { get; set; } = string.Empty;
}
