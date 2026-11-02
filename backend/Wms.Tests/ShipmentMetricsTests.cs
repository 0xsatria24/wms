using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Reporting;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class ShipmentMetricsTests(PostgresFixture postgres)
{
    [Theory]
    [InlineData("customer-return", "HIST-SIM-020")]
    [InlineData("supplier-return", "OPEN-SIM-001")]
    public async Task FixtureReferencesCannotAuthorizeReturns(string type, string source)
    {
        await using var db = new WmsDb(await postgres.Database());
        await Assert.ThrowsAsync<Wms.Shared.BusinessException>(() => new Wms.Modules.Inventory.CommandProcessor(db).Handle(new("admin", "main", "admin"), new(type, "main", null, JsonSerializer.SerializeToElement(new { sku = "SKU-A", scan = "SKU-A", source, qty = "1", reason = "Source validation regression" })), Guid.NewGuid().ToString(), CancellationToken.None));
    }

    [Fact]
    public async Task ShipmentMetricsUseOnlyConfirmedLedgerForTheSkuAndWarehouse()
    {
        await using var db = new WmsDb(await postgres.Database());
        void Shipment(string id, DateTimeOffset at, decimal qty, string position = "POS-A", string warehouse = "main")
        {
            db.Movements.Add(new StockMovement { Id = id, WarehouseId = warehouse, Kind = "ship", Source = id, Actor = "admin", PostedAt = at, OccurredAt = at });
            db.Entries.Add(new StockEntry { MovementId = id, PositionId = position, QuantityDelta = -qty, Unit = "units" });
        }
        Shipment("metric-oct", new(2026, 10, 10, 0, 0, 0, TimeSpan.Zero), 3);
        Shipment("metric-nov", new(2026, 11, 1, 0, 0, 0, TimeSpan.Zero), 2);
        Shipment("metric-prior", new(2025, 10, 10, 0, 0, 0, TimeSpan.Zero), 4);
        Shipment("metric-other", new(2026, 10, 10, 0, 0, 0, TimeSpan.Zero), 90, "POS-TRANSIT", "secondary");
        await db.SaveChangesAsync();
        var result = JsonSerializer.SerializeToElement(await new ShipmentQuery(db).Read(new("admin", "main", "admin"), "SKU-A", CancellationToken.None, new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero)));
        var unit = result.GetProperty("units")[0];
        Assert.Equal("5", unit.GetProperty("ytd").GetString());
        Assert.Equal("4", unit.GetProperty("priorYtd").GetString());
        Assert.Equal("3", unit.GetProperty("months")[9].GetProperty("qty").GetString());
        Assert.Equal(-25m, unit.GetProperty("yoy").GetDecimal());
        var empty = JsonSerializer.SerializeToElement(await new ShipmentQuery(db).Read(new("admin", "main", "admin"), "SKU-B", CancellationToken.None));
        Assert.Empty(empty.GetProperty("units").EnumerateArray());
    }
}
