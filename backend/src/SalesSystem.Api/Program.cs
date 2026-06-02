using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Auth;
using SalesSystem.Api.Features.Customers;
using SalesSystem.Api.Features.Products;
using SalesSystem.Api.Features.Sales;
using SalesSystem.Api.Features.Taxes;
using SalesSystem.Api.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IBusinessClock, BusinessClock>();
builder.Services.AddSalesSystemPersistence(builder.Configuration);
builder.Services.AddSalesSystemAuth();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    app.MapGet("/_auth-test/authenticated", () => Results.Ok(new { status = "authenticated" }))
        .RequireAuthorization(AuthorizationPolicies.AuthenticatedUser);

    app.MapGet("/_auth-test/master-maintainer", () => Results.Ok(new { status = "master-maintainer" }))
        .RequireAuthorization(AuthorizationPolicies.MasterMaintainer);
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);

    return canConnect
        ? Results.Ok(new { status = "ok", database = dbContext.Database.ProviderName })
        : Results.Problem("Database connection failed", statusCode: StatusCodes.Status503ServiceUnavailable);
})
.WithName("GetHealth");

app.MapProductEndpoints();
app.MapCustomerEndpoints();
app.MapTaxRateEndpoints();
app.MapSaleEndpoints();

app.Run();

public partial class Program;
