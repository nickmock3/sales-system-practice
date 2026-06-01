using Microsoft.EntityFrameworkCore;
using SalesSystem.Api.Domain.Entities;

namespace SalesSystem.Api.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();

    public DbSet<ProductVersion> ProductVersions => Set<ProductVersion>();

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<CustomerVersion> CustomerVersions => Set<CustomerVersion>();

    public DbSet<TaxRate> TaxRates => Set<TaxRate>();

    public DbSet<Sale> Sales => Set<Sale>();

    public DbSet<SaleDetail> SaleDetails => Set<SaleDetail>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("PRODUCTS");
            entity.HasKey(product => product.Id).HasName("PK_PRODUCTS");
            entity.Property(product => product.Id).HasColumnName("ID");
            entity.Property(product => product.ProductCode).HasColumnName("PRODUCT_CODE").HasMaxLength(30).IsRequired();
            entity.Property(product => product.CreatedAt).HasColumnName("CREATED_AT").IsRequired();
            entity.HasIndex(product => product.ProductCode).IsUnique().HasDatabaseName("UX_PRODUCTS_PRODUCT_CODE");
        });

        modelBuilder.Entity<ProductVersion>(entity =>
        {
            entity.ToTable("PRODUCT_VERSIONS");
            entity.HasKey(version => version.Id).HasName("PK_PRODUCT_VERSIONS");
            entity.HasAlternateKey(version => new { version.Id, version.ProductId })
                .HasName("AK_PRODUCT_VERSIONS_ID_PRODUCT_ID");
            entity.Property(version => version.Id).HasColumnName("ID");
            entity.Property(version => version.ProductId).HasColumnName("PRODUCT_ID");
            entity.Property(version => version.Name).HasColumnName("NAME").HasMaxLength(100).IsRequired();
            entity.Property(version => version.Unit).HasColumnName("UNIT").HasMaxLength(20).IsRequired();
            entity.Property(version => version.StandardUnitPrice).HasColumnName("STANDARD_UNIT_PRICE").HasPrecision(18, 2);
            entity.Property(version => version.TaxCategory).HasColumnName("TAX_CATEGORY").HasMaxLength(30).IsRequired();
            entity.Property(version => version.IsDiscontinued).HasColumnName("IS_DISCONTINUED").IsRequired();
            entity.Property(version => version.ValidFrom).HasColumnName("VALID_FROM").IsRequired();
            entity.HasIndex(version => new { version.ProductId, version.ValidFrom })
                .IsUnique()
                .HasDatabaseName("UX_PRODUCT_VERSIONS_PRODUCT_ID_VALID_FROM");
            entity.HasOne(version => version.Product)
                .WithMany(product => product.Versions)
                .HasForeignKey(version => version.ProductId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_PRODUCT_VERSIONS_PRODUCTS");
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("CUSTOMERS");
            entity.HasKey(customer => customer.Id).HasName("PK_CUSTOMERS");
            entity.Property(customer => customer.Id).HasColumnName("ID");
            entity.Property(customer => customer.CustomerCode).HasColumnName("CUSTOMER_CODE").HasMaxLength(30).IsRequired();
            entity.Property(customer => customer.CreatedAt).HasColumnName("CREATED_AT").IsRequired();
            entity.HasIndex(customer => customer.CustomerCode).IsUnique().HasDatabaseName("UX_CUSTOMERS_CUSTOMER_CODE");
        });

        modelBuilder.Entity<CustomerVersion>(entity =>
        {
            entity.ToTable("CUSTOMER_VERSIONS");
            entity.HasKey(version => version.Id).HasName("PK_CUSTOMER_VERSIONS");
            entity.HasAlternateKey(version => new { version.Id, version.CustomerId })
                .HasName("AK_CUSTOMER_VERSIONS_ID_CUSTOMER_ID");
            entity.Property(version => version.Id).HasColumnName("ID");
            entity.Property(version => version.CustomerId).HasColumnName("CUSTOMER_ID");
            entity.Property(version => version.Name).HasColumnName("NAME").HasMaxLength(100).IsRequired();
            entity.Property(version => version.Address).HasColumnName("ADDRESS").HasMaxLength(300).IsRequired();
            entity.Property(version => version.PhoneNumber).HasColumnName("PHONE_NUMBER").HasMaxLength(30).IsRequired();
            entity.Property(version => version.ValidFrom).HasColumnName("VALID_FROM").IsRequired();
            entity.HasIndex(version => new { version.CustomerId, version.ValidFrom })
                .IsUnique()
                .HasDatabaseName("UX_CUSTOMER_VERSIONS_CUSTOMER_ID_VALID_FROM");
            entity.HasOne(version => version.Customer)
                .WithMany(customer => customer.Versions)
                .HasForeignKey(version => version.CustomerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_CUSTOMER_VERSIONS_CUSTOMERS");
        });

        modelBuilder.Entity<TaxRate>(entity =>
        {
            entity.ToTable("TAX_RATES");
            entity.HasKey(taxRate => taxRate.Id).HasName("PK_TAX_RATES");
            entity.Property(taxRate => taxRate.Id).HasColumnName("ID");
            entity.Property(taxRate => taxRate.TaxCategory).HasColumnName("TAX_CATEGORY").HasMaxLength(30).IsRequired();
            entity.Property(taxRate => taxRate.Rate).HasColumnName("RATE").HasPrecision(5, 4);
            entity.Property(taxRate => taxRate.ValidFrom).HasColumnName("VALID_FROM").IsRequired();
            entity.HasIndex(taxRate => new { taxRate.TaxCategory, taxRate.ValidFrom })
                .IsUnique()
                .HasDatabaseName("UX_TAX_RATES_TAX_CATEGORY_VALID_FROM");
        });

        modelBuilder.Entity<Sale>(entity =>
        {
            entity.ToTable("SALES");
            entity.HasKey(sale => sale.Id).HasName("PK_SALES");
            entity.Property(sale => sale.Id).HasColumnName("ID");
            entity.Property(sale => sale.SalesDate).HasColumnName("SALES_DATE").IsRequired();
            entity.Property(sale => sale.CustomerId).HasColumnName("CUSTOMER_ID");
            entity.Property(sale => sale.CustomerVersionId).HasColumnName("CUSTOMER_VERSION_ID");
            entity.Property(sale => sale.TotalAmount).HasColumnName("TOTAL_AMOUNT").HasPrecision(18, 2);
            entity.Property(sale => sale.CreatedAt).HasColumnName("CREATED_AT").IsRequired();
            entity.HasIndex(sale => sale.SalesDate).HasDatabaseName("IX_SALES_SALES_DATE");
            entity.HasIndex(sale => sale.CustomerId).HasDatabaseName("IX_SALES_CUSTOMER_ID");
            entity.HasIndex(sale => sale.CustomerVersionId).HasDatabaseName("IX_SALES_CUSTOMER_VERSION_ID");
            entity.HasOne(sale => sale.Customer)
                .WithMany()
                .HasForeignKey(sale => sale.CustomerId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_SALES_CUSTOMERS");
            entity.HasOne(sale => sale.CustomerVersion)
                .WithMany()
                .HasForeignKey(sale => new { sale.CustomerVersionId, sale.CustomerId })
                .HasPrincipalKey(version => new { version.Id, version.CustomerId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_SALES_CUSTOMER_VERSIONS");
        });

        modelBuilder.Entity<SaleDetail>(entity =>
        {
            entity.ToTable("SALE_DETAILS");
            entity.HasKey(detail => detail.Id).HasName("PK_SALE_DETAILS");
            entity.Property(detail => detail.Id).HasColumnName("ID");
            entity.Property(detail => detail.SaleId).HasColumnName("SALE_ID");
            entity.Property(detail => detail.ProductId).HasColumnName("PRODUCT_ID");
            entity.Property(detail => detail.ProductVersionId).HasColumnName("PRODUCT_VERSION_ID");
            entity.Property(detail => detail.Quantity).HasColumnName("QUANTITY").HasPrecision(18, 3);
            entity.Property(detail => detail.UnitPrice).HasColumnName("UNIT_PRICE").HasPrecision(18, 2);
            entity.Property(detail => detail.TaxRate).HasColumnName("TAX_RATE").HasPrecision(5, 4);
            entity.Property(detail => detail.TaxAmount).HasColumnName("TAX_AMOUNT").HasPrecision(18, 2);
            entity.Property(detail => detail.Amount).HasColumnName("AMOUNT").HasPrecision(18, 2);
            entity.HasIndex(detail => detail.SaleId).HasDatabaseName("IX_SALE_DETAILS_SALE_ID");
            entity.HasIndex(detail => detail.ProductId).HasDatabaseName("IX_SALE_DETAILS_PRODUCT_ID");
            entity.HasIndex(detail => detail.ProductVersionId).HasDatabaseName("IX_SALE_DETAILS_PRODUCT_VERSION_ID");
            entity.HasOne(detail => detail.Sale)
                .WithMany(sale => sale.Details)
                .HasForeignKey(detail => detail.SaleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_SALE_DETAILS_SALES");
            entity.HasOne(detail => detail.Product)
                .WithMany()
                .HasForeignKey(detail => detail.ProductId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_SALE_DETAILS_PRODUCTS");
            entity.HasOne(detail => detail.ProductVersion)
                .WithMany()
                .HasForeignKey(detail => new { detail.ProductVersionId, detail.ProductId })
                .HasPrincipalKey(version => new { version.Id, version.ProductId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_SALE_DETAILS_PRODUCT_VERSIONS");
        });
    }
}
