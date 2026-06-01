using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Tests.Persistence;

public sealed class SqliteInMemoryTests
{
    [Fact]
    public async Task AppDbContext_CanConnect_WithOpenSqliteInMemoryConnection()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;

        await using var dbContext = new AppDbContext(options);

        Assert.True(await dbContext.Database.CanConnectAsync());
    }
}
