using Microsoft.EntityFrameworkCore;

namespace SalesSystem.Api.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
}
