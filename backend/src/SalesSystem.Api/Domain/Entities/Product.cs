namespace SalesSystem.Api.Domain.Entities;

public sealed class Product
{
    public long Id { get; set; }

    public string ProductCode { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public List<ProductVersion> Versions { get; set; } = [];
}
