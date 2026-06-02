namespace SalesSystem.Api.Features.Customers;

public sealed record CustomerListItemResponse(
    long CustomerId,
    string CustomerCode,
    long CustomerVersionId,
    string Name,
    string Address,
    string PhoneNumber,
    DateTime ValidFrom);

public sealed record CustomerResponse(
    long CustomerId,
    string CustomerCode,
    long CustomerVersionId,
    string Name,
    string Address,
    string PhoneNumber,
    DateTime ValidFrom);

public sealed record CustomerVersionResponse(
    long CustomerVersionId,
    long CustomerId,
    string CustomerCode,
    string Name,
    string Address,
    string PhoneNumber,
    DateTime ValidFrom);

public sealed record CreateCustomerRequest(
    string? CustomerCode,
    string? Name,
    string? Address,
    string? PhoneNumber,
    DateTime ValidFrom);

public sealed record CreateCustomerVersionRequest(
    string? Name,
    string? Address,
    string? PhoneNumber,
    DateTime ValidFrom);
