namespace SalesSystem.Api.Domain.Entities;

public sealed class ProductVersion
{
    public long Id { get; set; }

    public long ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public string Unit { get; set; } = string.Empty;

    public decimal StandardUnitPrice { get; set; }

    public string TaxCategory { get; set; } = string.Empty;

    public bool IsDiscontinued { get; set; }

    public DateTime ValidFrom { get; set; }
}
