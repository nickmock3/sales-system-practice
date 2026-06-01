namespace SalesSystem.Api.Domain.Entities;

public sealed class Customer
{
    public long Id { get; set; }

    public string CustomerCode { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public List<CustomerVersion> Versions { get; set; } = [];
}
