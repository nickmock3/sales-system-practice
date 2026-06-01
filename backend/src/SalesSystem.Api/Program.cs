using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddSalesSystemPersistence(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapGet("/health", async (AppDbContext dbContext, CancellationToken cancellationToken) =>
{
    var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);

    return canConnect
        ? Results.Ok(new { status = "ok", database = dbContext.Database.ProviderName })
        : Results.Problem("Database connection failed", statusCode: StatusCodes.Status503ServiceUnavailable);
})
.WithName("GetHealth");

app.Run();

public partial class Program;
