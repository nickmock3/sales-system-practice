using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SalesSystem.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RedesignTaxRateMaster : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ACCOUNTING_CATEGORY",
                table: "TAX_RATES",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TAX_CATEGORY_NAME",
                table: "TAX_RATES",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE TAX_RATES
                SET
                    TAX_CATEGORY_NAME = CASE TAX_CATEGORY
                        WHEN 'STANDARD' THEN '標準税率'
                        WHEN 'REDUCED' THEN '軽減税率'
                        WHEN 'NON_TAXABLE' THEN '非課税'
                        WHEN 'TAX_EXEMPT' THEN '免税'
                        WHEN 'OLD_STANDARD' THEN '旧標準税率'
                        ELSE TAX_CATEGORY
                    END,
                    ACCOUNTING_CATEGORY = CASE TAX_CATEGORY
                        WHEN 'STANDARD' THEN 'TAXABLE_STANDARD'
                        WHEN 'REDUCED' THEN 'TAXABLE_REDUCED'
                        WHEN 'NON_TAXABLE' THEN 'NON_TAXABLE'
                        WHEN 'TAX_EXEMPT' THEN 'TAX_EXEMPT'
                        WHEN 'OLD_STANDARD' THEN 'TAXABLE_OLD_STANDARD'
                        ELSE TAX_CATEGORY
                    END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ACCOUNTING_CATEGORY",
                table: "TAX_RATES");

            migrationBuilder.DropColumn(
                name: "TAX_CATEGORY_NAME",
                table: "TAX_RATES");
        }
    }
}
