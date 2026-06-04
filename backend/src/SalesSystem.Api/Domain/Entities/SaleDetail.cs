namespace SalesSystem.Api.Domain.Entities;

public sealed class SaleDetail
{
    public long Id { get; set; }

    public long SaleId { get; set; }

    public Sale Sale { get; set; } = null!;

    public long ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public long ProductVersionId { get; set; }

    public ProductVersion ProductVersion { get; set; } = null!;

    public long TaxRateId { get; set; }

    public TaxRate TaxRateHistory { get; set; } = null!;

    public string TaxCategory { get; set; } = string.Empty;

    public string TaxCategoryName { get; set; } = string.Empty;

    public string AccountingCategory { get; set; } = string.Empty;

    public decimal Quantity { get; set; }

    public decimal UnitPrice { get; set; }

    public long? CustomerProductPriceId { get; set; }

    public CustomerProductPrice? CustomerProductPrice { get; set; }

    public bool IsManualUnitPrice { get; set; }

    public decimal AutoUnitPrice { get; set; }

    public string? ManualUnitPriceReason { get; set; }

    public decimal TaxRate { get; set; }

    public decimal TaxAmount { get; set; }

    public decimal Amount { get; set; }
}
