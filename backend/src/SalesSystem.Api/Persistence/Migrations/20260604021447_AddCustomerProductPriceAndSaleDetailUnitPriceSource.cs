using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SalesSystem.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerProductPriceAndSaleDetailUnitPriceSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AUTO_UNIT_PRICE",
                table: "SALE_DETAILS",
                type: "TEXT",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<long>(
                name: "CUSTOMER_PRODUCT_PRICE_ID",
                table: "SALE_DETAILS",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IS_MANUAL_UNIT_PRICE",
                table: "SALE_DETAILS",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MANUAL_UNIT_PRICE_REASON",
                table: "SALE_DETAILS",
                type: "TEXT",
                maxLength: 300,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE SALE_DETAILS
                SET AUTO_UNIT_PRICE = UNIT_PRICE
                """);

            migrationBuilder.CreateTable(
                name: "CUSTOMER_PRODUCT_PRICES",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CUSTOMER_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    PRODUCT_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    UNIT_PRICE = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    VALID_FROM = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CUSTOMER_PRODUCT_PRICES", x => x.ID);
                    table.ForeignKey(
                        name: "FK_CUSTOMER_PRODUCT_PRICES_CUSTOMERS",
                        column: x => x.CUSTOMER_ID,
                        principalTable: "CUSTOMERS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CUSTOMER_PRODUCT_PRICES_PRODUCTS",
                        column: x => x.PRODUCT_ID,
                        principalTable: "PRODUCTS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SALE_DETAILS_CUSTOMER_PRODUCT_PRICE_ID",
                table: "SALE_DETAILS",
                column: "CUSTOMER_PRODUCT_PRICE_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CUSTOMER_PRODUCT_PRICES_PRODUCT_ID",
                table: "CUSTOMER_PRODUCT_PRICES",
                column: "PRODUCT_ID");

            migrationBuilder.CreateIndex(
                name: "UX_CUSTOMER_PRODUCT_PRICES_CUSTOMER_PRODUCT_VALID_FROM",
                table: "CUSTOMER_PRODUCT_PRICES",
                columns: new[] { "CUSTOMER_ID", "PRODUCT_ID", "VALID_FROM" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SALE_DETAILS_CUSTOMER_PRODUCT_PRICES",
                table: "SALE_DETAILS",
                column: "CUSTOMER_PRODUCT_PRICE_ID",
                principalTable: "CUSTOMER_PRODUCT_PRICES",
                principalColumn: "ID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SALE_DETAILS_CUSTOMER_PRODUCT_PRICES",
                table: "SALE_DETAILS");

            migrationBuilder.DropTable(
                name: "CUSTOMER_PRODUCT_PRICES");

            migrationBuilder.DropIndex(
                name: "IX_SALE_DETAILS_CUSTOMER_PRODUCT_PRICE_ID",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "AUTO_UNIT_PRICE",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "CUSTOMER_PRODUCT_PRICE_ID",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "IS_MANUAL_UNIT_PRICE",
                table: "SALE_DETAILS");

            migrationBuilder.DropColumn(
                name: "MANUAL_UNIT_PRICE_REASON",
                table: "SALE_DETAILS");
        }
    }
}
