using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wms.Core.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProductionQueryIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OperationalDocuments_WarehouseId",
                table: "OperationalDocuments");

            migrationBuilder.CreateIndex(
                name: "IX_Outbox_BusinessStatus_CreatedAt",
                table: "Outbox",
                columns: new[] { "BusinessStatus", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OperationalDocuments_WarehouseId_Kind_Status",
                table: "OperationalDocuments",
                columns: new[] { "WarehouseId", "Kind", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Movements_WarehouseId_PostedAt",
                table: "Movements",
                columns: new[] { "WarehouseId", "PostedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Items_CompanyId_Name_Sku",
                table: "Items",
                columns: new[] { "CompanyId", "Name", "Sku" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Outbox_BusinessStatus_CreatedAt",
                table: "Outbox");

            migrationBuilder.DropIndex(
                name: "IX_OperationalDocuments_WarehouseId_Kind_Status",
                table: "OperationalDocuments");

            migrationBuilder.DropIndex(
                name: "IX_Movements_WarehouseId_PostedAt",
                table: "Movements");

            migrationBuilder.DropIndex(
                name: "IX_Items_CompanyId_Name_Sku",
                table: "Items");

            migrationBuilder.CreateIndex(
                name: "IX_OperationalDocuments_WarehouseId",
                table: "OperationalDocuments",
                column: "WarehouseId");
        }
    }
}
