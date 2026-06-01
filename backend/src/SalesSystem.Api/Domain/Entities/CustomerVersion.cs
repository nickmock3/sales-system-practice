namespace SalesSystem.Api.Domain.Entities;

public sealed class CustomerVersion
{
    public long Id { get; set; }

    public long CustomerId { get; set; }

    public Customer Customer { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public string Address { get; set; } = string.Empty;

    public string PhoneNumber { get; set; } = string.Empty;

    public DateTime ValidFrom { get; set; }
}
