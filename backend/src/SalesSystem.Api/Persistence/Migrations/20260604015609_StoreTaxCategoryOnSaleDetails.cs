using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SalesSystem.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StoreTaxCategoryOnSaleDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ACCOUNTING_CATEGORY",
                table: "SALE_DETAILS",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TAX_CATEGORY",
                table: "SALE_DETAILS",
                type: "TEXT",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TAX_CATEGORY_NAME",
                table: "SALE_DETAILS",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "TAX_RATE_ID",
                table: "SALE_DETAILS",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.Sql("""
                UPDATE SALE_DETAILS
                SET
                    TAX_RATE_ID = COALESCE((
                        SELECT TAX_RATES.ID
                        FROM TAX_RATES
                        INNER JOIN PRODUCT_VERSIONS
                            ON PRODUCT_VERSIONS.ID = SALE_DETAILS.PRODUCT_VERSION_ID
                            AND PRODUCT_VERSIONS.PRODUCT_ID = SALE_DETAILS.PRODUCT_ID
                        INNER JOIN SALES
                            ON SALES.ID = SALE_DETAILS.SALE_ID
                        WHERE TAX_RATES.TAX_CATEGORY = PRODUCT_VERSIONS.TAX_CATEGORY
                            AND TAX_RATES.VALID_FROM <= SALES.SALES_DATE
                        ORDER BY TAX_RATES.VALID_FROM DESC, TAX_RATES.ID DESC
                        LIMIT 1
                    ), TAX_RATE_ID),
                    TAX_CATEGORY = COALESCE((
                        SELECT TAX_RATES.TAX_CATEGORY
                        FROM TAX_RATES
                        INNER JOIN PRODUCT_VERSIONS
                            ON PRODUCT_VERSIONS.ID = SALE_DETAILS.PRODUCT_VERSION_ID
                            AND PRODUCT_VERSIONS.PRODUCT_ID = SALE_DETAILS.PRODUCT_ID
                        INNER JOIN SALES
                            ON SALES.ID = SALE_DETAILS.SALE_ID
                        WHERE TAX_RATES.TAX_CATEGORY = PRODUCT_VERSIONS.TAX_CATEGORY
                            AND TAX_RATES.VALID_FROM <= SALES.SALES_DATE
                        ORDER BY TAX_RATES.VALID_FROM DESC, TAX_RATES.ID DESC
                        LIMIT 1
                    ), TAX_CATEGORY),
                    TAX_CATEGORY_NAME = COALESCE((
                        SELECT TAX_RATES.TAX_CATEGORY_NAME
                        FROM TAX_RATES
                        INNER JOIN PRODUCT_VERSIONS
                            ON PRODUCT_VERSIONS.ID = SALE_DETAILS.PRODUCT_VERSION_ID
                            AND PRODUCT_VERSIONS.PRODUCT_ID = SALE_DETAILS.PRODUCT_ID
                        INNER JOIN SALES
                            ON SALES.ID = SALE_DETAILS.SALE_ID
                        WHERE TAX_RATES.TAX_CATEGORY = PRODUCT_VERSIONS.TAX_CATEGORY
                            AND TAX_RATES.VALID_FROM <= SALES.SALES_DATE
                        ORDER BY TAX_RATES.VALID_FROM DESC, TAX_RATES.ID DESC
                        LIMIT 1
                    ), TAX_CATEGORY_NAME),
                    ACCOUNTING_CATEGORY = COALESCE((
                        SELECT TAX_RATES.ACCOUNTING_CATEGORY
                        FROM TAX_RATES
                        INNER JOIN PRODUCT_VERSIONS
                            ON PRODUCT_VERSIONS.ID = SALE_DETAILS.PRODUCT_VERSION_ID
                            AND PRODUCT_VERSIONS.PRODUCT_ID = SALE_DETAILS.PRODUCT_ID
                        INNER JOIN SALES
                            ON SALES.ID = SALE_DETAILS.SALE_ID
                        WHERE TAX_RATES.TAX_CATEGORY = PRODUCT_VERSIONS.TAX_CATEGORY
                            AND TAX_RATES.VALID_FROM <= SALES.SALES_DATE
                        ORDER BY TAX_RATES.VALID_FROM DESC, TAX_RATES.ID DESC
                        LIMIT 1
                    ), ACCOUNTING_CATEGORY)
                """);

            migrationBuilder.CreateIndex(
                name: "IX_SALE_DETAILS_TAX_RATE_ID",
                table: "SALE_DETAILS",
                column: "TAX_RATE_ID");

            migrationBuilder.AddForeignKey(
                name: "FK_SALE_DETAILS_TAX_RATES",
                table: "SALE_DETAILS",
                column: "TAX_RATE_ID",
                principalTable: "TAX_RATES",
                principalColumn: "ID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SALE_DETAILS_TAX_RATES",
                table: "SALE_DETAILS");

            migrationBuilder.DropIndex(
                name: "IX_SALE_DETAILS_TAX_RATE_ID",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "ACCOUNTING_CATEGORY",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "TAX_CATEGORY",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "TAX_CATEGORY_NAME",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "TAX_RATE_ID",
                table: "SALE_DETAILS");
        }
    }
}
