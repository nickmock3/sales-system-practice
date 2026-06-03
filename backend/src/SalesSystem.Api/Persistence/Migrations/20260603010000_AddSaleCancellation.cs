using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SalesSystem.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleCancellation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SALE_CORRECTIONS",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ORIGINAL_SALE_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    CORRECTION_SALE_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    CORRECTION_TYPE = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    REASON = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CREATED_BY = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SALE_CORRECTIONS", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SALE_CORRECTIONS_CORRECTION_SALES",
                        column: x => x.CORRECTION_SALE_ID,
                        principalTable: "SALES",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SALE_CORRECTIONS_ORIGINAL_SALES",
                        column: x => x.ORIGINAL_SALE_ID,
                        principalTable: "SALES",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SALE_STATUS_HISTORIES",
                columns: table => new
                {
                    ID = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SALE_ID = table.Column<long>(type: "INTEGER", nullable: false),
                    STATUS = table.Column<string>(type: "TEXT", maxLength: 30, nullable: false),
                    REASON = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false),
                    CHANGED_AT = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CHANGED_BY = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SALE_STATUS_HISTORIES", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SALE_STATUS_HISTORIES_SALES",
                        column: x => x.SALE_ID,
                        principalTable: "SALES",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SALE_CORRECTIONS_ORIGINAL_SALE_ID",
                table: "SALE_CORRECTIONS",
                column: "ORIGINAL_SALE_ID");

            migrationBuilder.CreateIndex(
                name: "UX_SALE_CORRECTIONS_ORIGINAL_TYPE",
                table: "SALE_CORRECTIONS",
                columns: new[] { "ORIGINAL_SALE_ID", "CORRECTION_TYPE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_SALE_CORRECTIONS_CORRECTION_SALE_ID",
                table: "SALE_CORRECTIONS",
                column: "CORRECTION_SALE_ID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SALE_STATUS_HISTORIES_SALE_CHANGED",
                table: "SALE_STATUS_HISTORIES",
                columns: new[] { "SALE_ID", "CHANGED_AT", "ID" });

            migrationBuilder.Sql("""
                INSERT INTO SALE_STATUS_HISTORIES (SALE_ID, STATUS, REASON, CHANGED_AT, CHANGED_BY)
                SELECT ID, 'Active', 'Migration initial status', CREATED_AT, 'migration'
                FROM SALES
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SALE_CORRECTIONS");

            migrationBuilder.DropTable(
                name: "SALE_STATUS_HISTORIES");
        }
    }
}
