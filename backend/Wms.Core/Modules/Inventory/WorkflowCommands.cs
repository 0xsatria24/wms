using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Inventory;

public sealed partial class CommandProcessor
{
    private static bool BusinessId(string value) => Regex.IsMatch(value, "^[A-Za-z0-9_-]{16}$", RegexOptions.CultureInvariant);

    private async Task WorkspaceCommand(CancellationToken ct)
    {
        var p = command.Payload;
        if (command.Type == "manual-receive")
        {
            var id = p.Text("document");
            Require(BusinessId(id), "required", 400);
            Require(p.Text("origin").Length is > 0 and <= 300 && p.Text("reason").Length is > 0 and <= 2000 && p.Text("reference").Length <= 200, "required", 400);
            Require(p.Text("sourceType") is "" or "manual", "source", 400);
            Require(p.TryGetProperty("lines", out var inputLines) && inputLines.ValueKind == JsonValueKind.Array && inputLines.GetArrayLength() is > 0 and <= 50, "required", 400);
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"manual-receipt:" + id}, 0))", ct);
            Require(!await db.SupportingRecords.AnyAsync(r => r.Id == id, ct) && !await db.Documents.AnyAsync(d => d.Id == id, ct), "duplicate");
            var usedIds = new HashSet<string>(StringComparer.Ordinal) { id };
            var lineRecords = new List<object>();
            foreach (var line in inputLines.EnumerateArray())
            {
                Require(line.ValueKind == JsonValueKind.Object, "required", 400);
                var lineId = line.Text("id");
                Require(BusinessId(lineId) && usedIds.Add(lineId), "duplicate", 400);
                Require(!await db.Documents.AnyAsync(d => d.Id == lineId, ct), "duplicate");
                var sku = line.Text("sku");
                // Keep the item active while this receipt posts; deactivation takes the matching row lock before checking dependencies.
                var lockedItems = await db.Items.FromSqlInterpolated($"SELECT * FROM \"Items\" WHERE \"CompanyId\" = 'demo' AND \"Sku\" = {sku} FOR SHARE").AsNoTracking().ToListAsync(ct);
                var item = lockedItems.SingleOrDefault();
                Require(item is not null && item.Active, "scan-item", 400);
                Require(line.TryGetProperty("version", out var version) && version.TryGetInt64(out var expected) && expected == item.Version, "conflict");
                Require(line.Text("scan") == item.Sku || line.Text("scan") == item.Barcode, "scan-item", 400);
                Require(line.Text("unit") == item.Unit, "base-unit-history", 400);
                var quantity = line.Quantity();
                if (!items.Any(i => i.Id == item.Id)) items.Add(item);
                var receiptLine = AddDoc("receipt-line", item.Id, quantity, id, lineId);
                receiptLine.Actual = quantity;
                receiptLine.Status = "complete";
                receiptLine.CompletedAt = now;
                Change(Position(item.Id, "Receiving", "unassessed", "awaiting-qc"), quantity, id);
                var inspection = AddDoc("inspection", item.Id, quantity, lineId);
                inspection.Status = "awaiting-qc";
                lineRecords.Add(new { id = lineId, sku = item.Sku, unit = item.Unit, qty = Number(quantity), inspection = inspection.Id });
            }
            var headerJson = JsonSerializer.Serialize(new { id, sourceType = "manual", origin = p.Text("origin"), reference = p.Text("reference"), reason = p.Text("reason"), owner = actor.Id, status = "confirmed", transaction = transactionId, createdAt = now, occurredAt = command.OccurredAt ?? now, lines = lineRecords });
            Require(System.Text.Encoding.UTF8.GetByteCount(headerJson) <= 16384 && await db.Database.SqlQuery<int>($"SELECT octet_length({headerJson}::jsonb::text) AS \"Value\"").SingleAsync(ct) <= 16384, "supporting-payload-size", 400);
            db.SupportingRecords.Add(new SupportingRecord
            {
                Id = id, WarehouseId = actor.WarehouseId, Kind = "receipt-header", Version = 1,
                PayloadJson = headerJson
            });
            return;
        }
        if (command.Type == "relocate")
        {
            var item = Item(p.Text("sku"));
            Scan(item.Id);
            var source = positions.SingleOrDefault(row => row.Id == p.Text("position") && row.ItemId == item.Id);
            Require(source is not null, "source", 404);
            Require(p.TryGetProperty("positionVersion", out var version) && version.TryGetInt64(out var expected) && source.Version == expected, "conflict");
            var sourceLocation = locations.Single(l => l.Id == source.LocationId);
            Require(sourceLocation.WarehouseId == actor.WarehouseId && sourceLocation.Pickable && !sourceLocation.Frozen && sourceLocation.Code is not ("Receiving" or "QC" or "Staging"), "frozen");
            Require(p.Text("sourceScan") == sourceLocation.Code, "scan-location", 400);
            var destination = p.Text("destination");
            Require(destination != sourceLocation.Code && destination is not ("Receiving" or "QC" or "Staging"), "scan-location", 400);
            VerifyLocation(destination);
            Require(locations.Any(l => l.Code == destination && l.WarehouseId == actor.WarehouseId && l.Pickable && !l.Frozen), "scan-location", 400);
            var quantity = p.Quantity();
            Require(quantity <= Available(source), "shortage");
            var target = Position(item.Id, destination);
            var reference = p.Text("document");
            if (reference.Length == 0) reference = transactionId;
            Change(source, -quantity, reference);
            Change(target, quantity, reference);
            return;
        }
        var order = Doc(p.Text("order"), "order");
        Require(order.Status == "released", "approval");
        Require(p.TryGetProperty("allocations", out var planned) && planned.ValueKind == JsonValueKind.Array && planned.GetArrayLength() is > 0 and <= 100, "required", 400);
        var allocationsToMake = new List<(StockPosition Position, decimal Quantity)>();
        var unique = new HashSet<string>(StringComparer.Ordinal);
        foreach (var line in planned.EnumerateArray())
        {
            Require(line.ValueKind == JsonValueKind.Object && unique.Add(line.Text("position")), "required", 400);
            var source = positions.SingleOrDefault(row => row.Id == line.Text("position") && row.ItemId == order.ItemId);
            Require(source is not null, "source", 404);
            Require(line.TryGetProperty("version", out var version) && version.TryGetInt64(out var expected) && source.Version == expected, "conflict");
            var quantity = line.Quantity();
            Require(quantity <= Available(source), "shortage");
            allocationsToMake.Add((source, quantity));
        }
        var total = allocationsToMake.Sum(row => row.Quantity);
        var outstanding = order.Quantity - order.Shipped - allocations.Where(a => a.OrderId == order.Id).Sum(a => a.Quantity);
        Require(total <= outstanding, "remainder");
        Require(total == outstanding || await db.Settings.Where(s => s.CompanyId == "demo").Select(s => s.PartialAllowed).SingleAsync(ct), "partial-policy");
        foreach (var (position, quantity) in allocationsToMake)
        {
            position.Committed += quantity;
            Alloc(order, position).Quantity += quantity;
        }
        db.Entry(order).Property(o => o.Version).IsModified = true;
    }
}
