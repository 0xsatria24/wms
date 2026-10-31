using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Wms.Infrastructure;

public static class Seed
{
    public static async Task Demo(WmsDb db)
    {
        if (await db.Warehouses.AnyAsync())
            return;
        db.Warehouses.AddRange(new Warehouse { Id = "main", Name = "Main Warehouse" }, new Warehouse { Id = "secondary", Name = "Secondary Warehouse" }, new Warehouse { Id = "transit", Name = "Transfer transit" });
        foreach (var wh in new[] { "main", "secondary" })
            foreach (var code in new[] { "A-01", "A-02", "Receiving", "QC", "Staging" })
                db.Locations.Add(new Location { Id = $"{wh}|{code}", WarehouseId = wh, Code = code, Pickable = code.StartsWith("A-", StringComparison.Ordinal) });
        db.Locations.Add(new Location { Id = "transit|TR-SIM-001", WarehouseId = "transit", Code = "TR-SIM-001" });
        foreach (var name in new[] { "admin", "operator", "supervisor" })
        {
            db.Principals.Add(new Principal { Id = name, Subject = $"demo:{name}", Issuer = "wms-local-demo", Name = $"Demo {name}", Email = $"{name}@demo.company", Verified = true, Status = "active" });
            db.AccessGrants.Add(new AccessGrant { PrincipalId = name, WarehouseId = "main", Role = name });
            if (name == "admin")
                db.AccessGrants.Add(new AccessGrant { PrincipalId = name, WarehouseId = "secondary", Role = "admin" });
        }
        db.Principals.Add(new Principal { Id = "request-1", Subject = "demo:request-1", Issuer = "wms-local-demo", Name = "Demo Applicant", Email = "applicant@example.com", Verified = true });
        db.AccessGrants.Add(new AccessGrant { PrincipalId = "request-1", WarehouseId = "main", Role = "operator" });
        foreach (var (letter, index) in new[] { ("A", 1), ("B", 2), ("C", 3) })
            db.Items.Add(new Item { Id = $"demo|SKU-{letter}", Sku = $"SKU-{letter}", Name = $"Product {letter}", Barcode = $"00010000000{index}" });
        var a = new StockPosition { Id = "POS-A", ItemId = "demo|SKU-A", LocationId = "main|A-01", OnHand = 100m, Committed = 24m };
        var b = new StockPosition { Id = "POS-B", ItemId = "demo|SKU-B", LocationId = "main|QC", OnHand = 20m, Committed = 8m, Condition = "not-good", Hold = "quality-rejected" };
        var c = new StockPosition { Id = "POS-C", ItemId = "demo|SKU-C", LocationId = "main|Staging", OnHand = 8m, Committed = 8m };
        var transit = new StockPosition { Id = "POS-TRANSIT", ItemId = "demo|SKU-A", LocationId = "transit|TR-SIM-001", OnHand = 50m };
        db.Positions.AddRange(a, b, c, transit);
        db.Documents.Add(new OperationalDocument { Id = "PO-SIM-100", Kind = "po", WarehouseId = "main", ItemId = a.ItemId, Quantity = 100, Status = "open", Creator = "operator" });
        foreach (var (id, q, status, sku) in new[] { ("SO-SIM-1001", 24m, "released", a.ItemId), ("SO-SIM-1002", 10m, "pending-approval", a.ItemId), ("SO-SIM-1003", 120m, "released", a.ItemId), ("SO-SIM-HELD", 8m, "released", b.ItemId), ("SO-SIM-STAGED", 8m, "released", c.ItemId) })
            db.Documents.Add(new OperationalDocument { Id = id, Kind = "order", WarehouseId = "main", ItemId = sku, Quantity = q, Status = status, Creator = "operator", Picked = id == "SO-SIM-STAGED" ? 8 : 0 });
        db.Documents.Add(new OperationalDocument { Id = "TR-SIM-001", Kind = "transfer", WarehouseId = "secondary", TargetWarehouseId = "main", ItemId = a.ItemId, Quantity = 50, Status = "in-transit", Creator = "operator" });
        db.Allocations.AddRange(new Allocation { OrderId = "SO-SIM-1001", PositionId = a.Id, Quantity = 24 }, new Allocation { OrderId = "SO-SIM-HELD", PositionId = b.Id, Quantity = 8, Status = "held" }, new Allocation { OrderId = "SO-SIM-STAGED", PositionId = c.Id, Quantity = 8 });
        var stamp = new DateTimeOffset(2026, 10, 29, 2, 0, 0, TimeSpan.Zero);
        foreach (var position in new[] { a, b, c, transit })
        {
            var movementId = $"OPEN-{position.Id}";
            db.Movements.Add(new StockMovement { Id = movementId, WarehouseId = position == transit ? "transit" : "main", Kind = "opening", Source = "OPEN-SIM-001", Actor = "Fixture", OccurredAt = stamp, PostedAt = stamp });
            db.Entries.Add(new StockEntry { MovementId = movementId, PositionId = position.Id, QuantityDelta = position.OnHand });
        }
        db.Outbox.Add(new OutboxEvent { WarehouseId = "main", AggregateId = "HIST-SIM-020", Kind = "historical-demo-reference", TransportStatus = "awaiting-configuration", CreatedAt = stamp, NextAttemptAt = stamp });
        db.Settings.Add(new CompanySettings());
        db.SupportingRecords.Add(new SupportingRecord { Id = "package|CTN-SIM-001", WarehouseId = "main", Kind = "packages", PayloadJson = JsonSerializer.Serialize(new { id = "CTN-SIM-001", version = 1, items = new[] { new { sku = "SKU-A", qty = 10 }, new { sku = "SKU-B", qty = 5 } } }) });
        await db.SaveChangesAsync();
    }
}
