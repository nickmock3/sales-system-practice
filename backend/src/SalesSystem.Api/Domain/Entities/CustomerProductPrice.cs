namespace SalesSystem.Api.Domain.Entities;

public sealed class CustomerProductPrice
{
    public long Id { get; set; }

    public long CustomerId { get; set; }

    public Customer Customer { get; set; } = null!;

    public long ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public decimal UnitPrice { get; set; }

    public DateTime ValidFrom { get; set; }

    public DateTime CreatedAt { get; set; }
}
