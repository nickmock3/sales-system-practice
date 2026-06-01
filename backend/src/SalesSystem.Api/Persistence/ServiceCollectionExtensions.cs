using Microsoft.EntityFrameworkCore;

namespace SalesSystem.Api.Persistence;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSalesSystemPersistence(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Data Source=sales-system-dev.db";

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlite(connectionString);
        });

        return services;
    }
}
