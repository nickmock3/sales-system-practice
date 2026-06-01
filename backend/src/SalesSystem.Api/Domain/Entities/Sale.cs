namespace SalesSystem.Api.Domain.Entities;

public sealed class Sale
{
    public long Id { get; set; }

    public DateTime SalesDate { get; set; }

    public long CustomerId { get; set; }

    public Customer Customer { get; set; } = null!;

    public long CustomerVersionId { get; set; }

    public CustomerVersion CustomerVersion { get; set; } = null!;

    public decimal TotalAmount { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<SaleDetail> Details { get; set; } = [];
}
