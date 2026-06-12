namespace SalesSystem.Api.Features.Customers;

public sealed record CustomerSummary(
    long CustomerId,
    string CustomerCode,
    string Name,
    string Address,
    string PhoneNumber,
    DateTime EffectiveFrom);

public sealed record CustomerChange(
    DateTime EffectiveFrom,
    string Name,
    string Address,
    string PhoneNumber);

public sealed record CreateCustomerRequest(
    string? CustomerCode,
    string? Name,
    string? Address,
    string? PhoneNumber,
    DateTime EffectiveFrom);

public sealed record ChangeCustomerRequest(
    string? Name,
    string? Address,
    string? PhoneNumber,
    DateTime EffectiveFrom);
