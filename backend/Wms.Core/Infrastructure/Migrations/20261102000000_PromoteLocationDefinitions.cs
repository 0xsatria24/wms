using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Wms.Infrastructure;

namespace Wms.Api.Infrastructure.Migrations;

[DbContext(typeof(WmsDb))]
[Migration("20261102000000_PromoteLocationDefinitions")]
public sealed class PromoteLocationDefinitions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        INSERT INTO "Locations" ("Id", "WarehouseId", "Code", "Pickable", "Frozen", "Version")
        SELECT DISTINCT ON (r."WarehouseId", btrim(r."PayloadJson"->>'name'))
            r."WarehouseId" || '|' || btrim(r."PayloadJson"->>'name'), r."WarehouseId",
            btrim(r."PayloadJson"->>'name'), true, false, 0
        FROM "SupportingRecords" r JOIN "Warehouses" w ON w."Id" = r."WarehouseId"
        WHERE r."Kind" = 'locationMaster'
          AND length(btrim(r."PayloadJson"->>'name')) BETWEEN 1 AND 100
          AND position('|' in r."PayloadJson"->>'name') = 0
        ORDER BY r."WarehouseId", btrim(r."PayloadJson"->>'name'), r."Id"
        ON CONFLICT DO NOTHING;
        """);

    // Preserve operational locations and their stock references during a rollback.
    protected override void Down(MigrationBuilder migrationBuilder) { }
}
