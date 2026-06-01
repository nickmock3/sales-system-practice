using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Domain.Entities;
using SalesSystem.Api.Persistence;

namespace SalesSystem.Tests.Persistence;

public sealed class MasterConstraintTests
{
    [Fact]
    public async Task Products_CannotHaveDuplicateProductCode()
    {
        // 同じ商品コードの商品を2件登録しようとすると、一意制約で保存に失敗することを確認する。
        await using var database = await CreateDatabaseAsync();
        var dbContext = database.DbContext;

        dbContext.Products.AddRange(
            new Product { ProductCode = "P001", CreatedAt = DateTime.UtcNow },
            new Product { ProductCode = "P001", CreatedAt = DateTime.UtcNow });

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task ProductVersions_CannotHaveDuplicateProductIdAndValidFrom()
    {
        // 同じ商品に同じ適用開始日の履歴を2件登録しようとすると、一意制約で保存に失敗することを確認する。
        await using var database = await CreateDatabaseAsync();
        var dbContext = database.DbContext;
        var validFrom = new DateTime(2026, 1, 1);
        var product = new Product { ProductCode = "P001", CreatedAt = DateTime.UtcNow };

        product.Versions.AddRange(
            new ProductVersion
            {
                Name = "コピー用紙",
                Unit = "箱",
                StandardUnitPrice = 1200m,
                TaxCategory = "STANDARD",
                ValidFrom = validFrom
            },
            new ProductVersion
            {
                Name = "コピー用紙 A4",
                Unit = "箱",
                StandardUnitPrice = 1300m,
                TaxCategory = "STANDARD",
                ValidFrom = validFrom
            });

        dbContext.Products.Add(product);

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task Customers_CannotHaveDuplicateCustomerCode()
    {
        // 同じ得意先コードの得意先を2件登録しようとすると、一意制約で保存に失敗することを確認する。
        await using var database = await CreateDatabaseAsync();
        var dbContext = database.DbContext;

        dbContext.Customers.AddRange(
            new Customer { CustomerCode = "C001", CreatedAt = DateTime.UtcNow },
            new Customer { CustomerCode = "C001", CreatedAt = DateTime.UtcNow });

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task CustomerVersions_CannotHaveDuplicateCustomerIdAndValidFrom()
    {
        // 同じ得意先に同じ適用開始日の履歴を2件登録しようとすると、一意制約で保存に失敗することを確認する。
        await using var database = await CreateDatabaseAsync();
        var dbContext = database.DbContext;
        var validFrom = new DateTime(2026, 1, 1);
        var customer = new Customer { CustomerCode = "C001", CreatedAt = DateTime.UtcNow };

        customer.Versions.AddRange(
            new CustomerVersion
            {
                Name = "東京商事",
                Address = "東京都千代田区",
                PhoneNumber = "03-0000-0000",
                ValidFrom = validFrom
            },
            new CustomerVersion
            {
                Name = "東京商事株式会社",
                Address = "東京都中央区",
                PhoneNumber = "03-1111-1111",
                ValidFrom = validFrom
            });

        dbContext.Customers.Add(customer);

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task TaxRates_CannotHaveDuplicateTaxCategoryAndValidFrom()
    {
        // 同じ税区分に同じ適用開始日の税率を2件登録しようとすると、一意制約で保存に失敗することを確認する。
        await using var database = await CreateDatabaseAsync();
        var dbContext = database.DbContext;
        var validFrom = new DateTime(2026, 1, 1);

        dbContext.TaxRates.AddRange(
            new TaxRate { TaxCategory = "STANDARD", Rate = 0.1m, ValidFrom = validFrom },
            new TaxRate { TaxCategory = "STANDARD", Rate = 0.08m, ValidFrom = validFrom });

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task Sales_CannotReferenceCustomerVersionOfDifferentCustomer()
    {
        // 売上の得意先IDと得意先履歴IDが別の得意先を指す場合、複合外部キーで保存に失敗することを確認する。
        await using var database = await CreateDatabaseAsync();
        var dbContext = database.DbContext;
        await EnableForeignKeysAsync(database.DbContext);

        var customer = new Customer { CustomerCode = "C001", CreatedAt = DateTime.UtcNow };
        var otherCustomer = new Customer { CustomerCode = "C002", CreatedAt = DateTime.UtcNow };
        otherCustomer.Versions.Add(new CustomerVersion
        {
            Name = "大阪商事",
            Address = "大阪府大阪市",
            PhoneNumber = "06-0000-0000",
            ValidFrom = new DateTime(2026, 1, 1)
        });

        dbContext.Customers.AddRange(customer, otherCustomer);
        await dbContext.SaveChangesAsync();

        dbContext.Sales.Add(new Sale
        {
            SalesDate = new DateTime(2026, 1, 2),
            CustomerId = customer.Id,
            CustomerVersionId = otherCustomer.Versions[0].Id,
            TotalAmount = 1000m,
            CreatedAt = DateTime.UtcNow
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task SaleDetails_CannotReferenceProductVersionOfDifferentProduct()
    {
        // 売上明細の商品IDと商品履歴IDが別の商品を指す場合、複合外部キーで保存に失敗することを確認する。
        await using var database = await CreateDatabaseAsync();
        var dbContext = database.DbContext;
        await EnableForeignKeysAsync(database.DbContext);

        var customer = new Customer { CustomerCode = "C001", CreatedAt = DateTime.UtcNow };
        customer.Versions.Add(new CustomerVersion
        {
            Name = "東京商事",
            Address = "東京都千代田区",
            PhoneNumber = "03-0000-0000",
            ValidFrom = new DateTime(2026, 1, 1)
        });

        var product = new Product { ProductCode = "P001", CreatedAt = DateTime.UtcNow };
        var otherProduct = new Product { ProductCode = "P002", CreatedAt = DateTime.UtcNow };
        otherProduct.Versions.Add(new ProductVersion
        {
            Name = "ボールペン",
            Unit = "本",
            StandardUnitPrice = 100m,
            TaxCategory = "STANDARD",
            ValidFrom = new DateTime(2026, 1, 1)
        });

        dbContext.Customers.Add(customer);
        dbContext.Products.AddRange(product, otherProduct);
        await dbContext.SaveChangesAsync();

        var sale = new Sale
        {
            SalesDate = new DateTime(2026, 1, 2),
            CustomerId = customer.Id,
            CustomerVersionId = customer.Versions[0].Id,
            TotalAmount = 110m,
            CreatedAt = DateTime.UtcNow
        };

        sale.Details.Add(new SaleDetail
        {
            ProductId = product.Id,
            ProductVersionId = otherProduct.Versions[0].Id,
            Quantity = 1m,
            UnitPrice = 100m,
            TaxRate = 0.1m,
            TaxAmount = 10m,
            Amount = 100m
        });

        dbContext.Sales.Add(sale);

        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    private static async Task<TestDatabase> CreateDatabaseAsync()
    {
        // SQLite in-memory は接続を開いている間だけDBが残るため、テストごとに新しい接続を作る。
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;

        var dbContext = new AppDbContext(options);
        await dbContext.Database.EnsureCreatedAsync();

        return new TestDatabase(connection, dbContext);
    }

    private static Task EnableForeignKeysAsync(AppDbContext dbContext)
    {
        return dbContext.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = ON;");
    }

    private sealed class TestDatabase(SqliteConnection connection, AppDbContext dbContext) : IAsyncDisposable
    {
        public AppDbContext DbContext { get; } = dbContext;

        public async ValueTask DisposeAsync()
        {
            await DbContext.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
