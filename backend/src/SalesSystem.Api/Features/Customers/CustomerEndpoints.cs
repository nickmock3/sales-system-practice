using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Features.Products;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Api.Features.Customers;

public static class CustomerEndpoints
{
    public static IEndpointRouteBuilder MapCustomerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/customers");

        group.MapGet("/", GetCustomers)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/", CreateCustomer)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        group.MapGet("/{customerId:long}", GetCustomer)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapGet("/{customerId:long}/changes", GetCustomerChanges)
            .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

        group.MapPost("/{customerId:long}/changes", ChangeCustomer)
            .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);

        return endpoints;
    }

    private static async Task<IResult> GetCustomers(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        string? customerCode,
        string? name,
        CancellationToken cancellationToken)
    {
        var targetDate = businessClock.Today;

        var latestValidFromByCustomer =
            from version in dbContext.CustomerVersions.AsNoTracking()
            where version.ValidFrom <= targetDate
            group version by version.CustomerId into grouped
            select new
            {
                CustomerId = grouped.Key,
                ValidFrom = grouped.Max(version => version.ValidFrom)
            };

        var query =
            from customer in dbContext.Customers.AsNoTracking()
            join latest in latestValidFromByCustomer
                on customer.Id equals latest.CustomerId
            join version in dbContext.CustomerVersions.AsNoTracking()
                on new { latest.CustomerId, latest.ValidFrom }
                equals new { version.CustomerId, version.ValidFrom }
            select new { customer, version };

        if (!string.IsNullOrWhiteSpace(customerCode))
        {
            query = query.Where(item => item.customer.CustomerCode.Contains(customerCode));
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(item => item.version.Name.Contains(name));
        }

        var customers = await query
            .OrderBy(item => item.customer.CustomerCode)
            .Select(item => new CustomerSummary(
                item.customer.Id,
                item.customer.CustomerCode,
                item.version.Name,
                item.version.Address,
                item.version.PhoneNumber,
                item.version.ValidFrom))
            .ToListAsync(cancellationToken);

        return Results.Ok(customers);
    }

    private static async Task<IResult> CreateCustomer(
        AppDbContext dbContext,
        CreateCustomerRequest request,
        CancellationToken cancellationToken)
    {
        var errors = CustomerValidation.ValidateCreateCustomer(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var customerCode = request.CustomerCode!.Trim();
        var effectiveFrom = request.EffectiveFrom.Date;

        var codeExists = await dbContext.Customers
            .AnyAsync(customer => customer.CustomerCode == customerCode, cancellationToken);

        if (codeExists)
        {
            return Results.Conflict(new { message = "同じ得意先コードの得意先が既に存在します。" });
        }

        var customer = new Customer
        {
            CustomerCode = customerCode,
            CreatedAt = DateTime.UtcNow
        };

        customer.Versions.Add(new CustomerVersion
        {
            Name = request.Name!.Trim(),
            Address = request.Address!.Trim(),
            PhoneNumber = request.PhoneNumber!.Trim(),
            ValidFrom = effectiveFrom
        });

        dbContext.Customers.Add(customer);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { message = "得意先コードまたは得意先履歴の一意制約に違反しました。" });
        }

        var version = customer.Versions[0];
        return Results.Created($"/api/customers/{customer.Id}", ToSummary(customer, version));
    }

    private static async Task<IResult> GetCustomer(
        AppDbContext dbContext,
        IBusinessClock businessClock,
        long customerId,
        DateTime? asOf,
        CancellationToken cancellationToken)
    {
        var customer = await dbContext.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => new CustomerIdentity(customer.Id, customer.CustomerCode))
            .FirstOrDefaultAsync(cancellationToken);

        if (customer is null)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var date = (asOf ?? businessClock.Today).Date;
        var version = await dbContext.CustomerVersions
            .AsNoTracking()
            .Where(version => version.CustomerId == customerId && version.ValidFrom <= date)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (version is null)
        {
            return Results.NotFound(new { message = "指定日時点で利用できる得意先情報がありません。" });
        }

        return Results.Ok(ToSummary(customer, version));
    }

    private static async Task<IResult> GetCustomerChanges(
        AppDbContext dbContext,
        long customerId,
        CancellationToken cancellationToken)
    {
        var customerExists = await dbContext.Customers
            .AsNoTracking()
            .AnyAsync(customer => customer.Id == customerId, cancellationToken);

        if (!customerExists)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var changes = await dbContext.CustomerVersions
            .AsNoTracking()
            .Where(version => version.CustomerId == customerId)
            .OrderByDescending(version => version.ValidFrom)
            .ThenByDescending(version => version.Id)
            .Select(version => new CustomerChange(
                version.ValidFrom,
                version.Name,
                version.Address,
                version.PhoneNumber))
            .ToListAsync(cancellationToken);

        return Results.Ok(changes);
    }

    private static async Task<IResult> ChangeCustomer(
        AppDbContext dbContext,
        long customerId,
        ChangeCustomerRequest request,
        CancellationToken cancellationToken)
    {
        var errors = CustomerValidation.ValidateChangeCustomer(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var customer = await dbContext.Customers
            .AsNoTracking()
            .Where(customer => customer.Id == customerId)
            .Select(customer => new CustomerIdentity(customer.Id, customer.CustomerCode))
            .FirstOrDefaultAsync(cancellationToken);

        if (customer is null)
        {
            return Results.NotFound(new { message = "得意先が見つかりません。" });
        }

        var effectiveFrom = request.EffectiveFrom.Date;
        var versionExists = await dbContext.CustomerVersions.AnyAsync(
            version => version.CustomerId == customerId && version.ValidFrom == effectiveFrom,
            cancellationToken);

        if (versionExists)
        {
            return Results.Conflict(new { message = "同じ適用開始日の得意先情報は既に登録されています。" });
        }

        var version = new CustomerVersion
        {
            CustomerId = customerId,
            Name = request.Name!.Trim(),
            Address = request.Address!.Trim(),
            PhoneNumber = request.PhoneNumber!.Trim(),
            ValidFrom = effectiveFrom
        };

        dbContext.CustomerVersions.Add(version);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return Results.Conflict(new { message = "得意先履歴の一意制約に違反しました。" });
        }

        return Results.Ok(ToSummary(customer, version));
    }

    private static CustomerSummary ToSummary(Customer customer, CustomerVersion version)
    {
        return new CustomerSummary(
            customer.Id,
            customer.CustomerCode,
            version.Name,
            version.Address,
            version.PhoneNumber,
            version.ValidFrom);
    }

    private static CustomerSummary ToSummary(CustomerIdentity customer, CustomerVersion version)
    {
        return new CustomerSummary(
            customer.Id,
            customer.CustomerCode,
            version.Name,
            version.Address,
            version.PhoneNumber,
            version.ValidFrom);
    }

    private sealed record CustomerIdentity(long Id, string CustomerCode);
}
