using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SalesSystem.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CUSTOMERS",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CUSTOMER_CODE = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CUSTOMERS", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "PRODUCTS",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PRODUCT_CODE = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PRODUCTS", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "TAX_RATES",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TAX_CATEGORY = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    RATE = table.Column<decimal>(type: "TEXT", precision: 5, scale: 4, nullable: false),
                    VALID_FROM = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TAX_RATES", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "CUSTOMER_VERSIONS",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CUSTOMER_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    NAME = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    ADDRESS = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false),
                    PHONE_NUMBER = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    VALID_FROM = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CUSTOMER_VERSIONS", x => x.ID);
                    table.UniqueConstraint("AK_CUSTOMER_VERSIONS_ID_CUSTOMER_ID", x => new { x.ID, x.CUSTOMER_ID });
                    table.ForeignKey(
                        name: "FK_CUSTOMER_VERSIONS_CUSTOMERS",
                        column: x => x.CUSTOMER_ID,
                        principalTable: "CUSTOMERS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PRODUCT_VERSIONS",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PRODUCT_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    NAME = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    UNIT = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    STANDARD_UNIT_PRICE = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    TAX_CATEGORY = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    IS_DISCONTINUED = table.Column<bool>(type: "INTEGER", nullable: false),
                    VALID_FROM = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PRODUCT_VERSIONS", x => x.ID);
                    table.UniqueConstraint("AK_PRODUCT_VERSIONS_ID_PRODUCT_ID", x => new { x.ID, x.PRODUCT_ID });
                    table.ForeignKey(
                        name: "FK_PRODUCT_VERSIONS_PRODUCTS",
                        column: x => x.PRODUCT_ID,
                        principalTable: "PRODUCTS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SALES",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SALES_DATE = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CUSTOMER_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    CUSTOMER_VERSION_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    TOTAL_AMOUNT = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SALES", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SALES_CUSTOMERS",
                        column: x => x.CUSTOMER_ID,
                        principalTable: "CUSTOMERS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SALES_CUSTOMER_VERSIONS",
                        columns: x => new { x.CUSTOMER_VERSION_ID, x.CUSTOMER_ID },
                        principalTable: "CUSTOMER_VERSIONS",
                        principalColumns: new[] { "ID", "CUSTOMER_ID" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SALE_DETAILS",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SALE_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    PRODUCT_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    PRODUCT_VERSION_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    QUANTITY = table.Column<decimal>(type: "TEXT", precision: 18, scale: 3, nullable: false),
                    UNIT_PRICE = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    TAX_RATE = table.Column<decimal>(type: "TEXT", precision: 5, scale: 4, nullable: false),
                    TAX_AMOUNT = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    AMOUNT = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SALE_DETAILS", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SALE_DETAILS_PRODUCTS",
                        column: x => x.PRODUCT_ID,
                        principalTable: "PRODUCTS",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SALE_DETAILS_PRODUCT_VERSIONS",
                        columns: x => new { x.PRODUCT_VERSION_ID, x.PRODUCT_ID },
                        principalTable: "PRODUCT_VERSIONS",
                        principalColumns: new[] { "ID", "PRODUCT_ID" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SALE_DETAILS_SALES",
                        column: x => x.SALE_ID,
                        principalTable: "SALES",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_CUSTOMER_VERSIONS_CUSTOMER_ID_VALID_FROM",
                table: "CUSTOMER_VERSIONS",
                columns: new[] { "CUSTOMER_ID", "VALID_FROM" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_CUSTOMERS_CUSTOMER_CODE",
                table: "CUSTOMERS",
                column: "CUSTOMER_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_PRODUCT_VERSIONS_PRODUCT_ID_VALID_FROM",
                table: "PRODUCT_VERSIONS",
                columns: new[] { "PRODUCT_ID", "VALID_FROM" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_PRODUCTS_PRODUCT_CODE",
                table: "PRODUCTS",
                column: "PRODUCT_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SALE_DETAILS_PRODUCT_ID",
                table: "SALE_DETAILS",
                column: "PRODUCT_ID");

            migrationBuilder.CreateIndex(
                name: "IX_SALE_DETAILS_PRODUCT_VERSION_ID",
                table: "SALE_DETAILS",
                column: "PRODUCT_VERSION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_SALE_DETAILS_PRODUCT_VERSION_ID_PRODUCT_ID",
                table: "SALE_DETAILS",
                columns: new[] { "PRODUCT_VERSION_ID", "PRODUCT_ID" });

            migrationBuilder.CreateIndex(
                name: "IX_SALE_DETAILS_SALE_ID",
                table: "SALE_DETAILS",
                column: "SALE_ID");

            migrationBuilder.CreateIndex(
                name: "IX_SALES_CUSTOMER_ID",
                table: "SALES",
                column: "CUSTOMER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_SALES_CUSTOMER_VERSION_ID",
                table: "SALES",
                column: "CUSTOMER_VERSION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_SALES_CUSTOMER_VERSION_ID_CUSTOMER_ID",
                table: "SALES",
                columns: new[] { "CUSTOMER_VERSION_ID", "CUSTOMER_ID" });

            migrationBuilder.CreateIndex(
                name: "IX_SALES_SALES_DATE",
                table: "SALES",
                column: "SALES_DATE");

            migrationBuilder.CreateIndex(
                name: "UX_TAX_RATES_TAX_CATEGORY_VALID_FROM",
                table: "TAX_RATES",
                columns: new[] { "TAX_CATEGORY", "VALID_FROM" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SALE_DETAILS");

            migrationBuilder.DropTable(
                name: "TAX_RATES");

            migrationBuilder.DropTable(
                name: "PRODUCT_VERSIONS");

            migrationBuilder.DropTable(
                name: "SALES");

            migrationBuilder.DropTable(
                name: "PRODUCTS");

            migrationBuilder.DropTable(
                name: "CUSTOMER_VERSIONS");

            migrationBuilder.DropTable(
                name: "CUSTOMERS");
        }
    }
}
