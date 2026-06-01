namespace SalesSystem.Api.Domain.Entities;

public sealed class TaxRate
{
    public long Id { get; set; }

    public string TaxCategory { get; set; } = string.Empty;

    public decimal Rate { get; set; }

    public DateTime ValidFrom { get; set; }
}
