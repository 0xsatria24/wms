using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Reporting;

public sealed class SnapshotQuery(WmsDb db, AccessService access)
{
    public async Task<object> Read(ActingPrincipal actor, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct) && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
        var warehouses = await db.Warehouses.ToDictionaryAsync(w => w.Id, w => w.Name, ct);
        var items = await db.Items.Where(i => i.CompanyId == "demo").ToListAsync(ct);
        var locations = await db.Locations.Where(l => l.WarehouseId == actor.WarehouseId).ToDictionaryAsync(l => l.Id, ct);
        var locationIds = locations.Keys.ToArray();
        var positions = await db.Positions.Where(p => p.CompanyId == "demo" && locationIds.Contains(p.LocationId)).ToListAsync(ct);
        var docs = await db.Documents.Where(d => d.CompanyId == "demo" && (d.WarehouseId == actor.WarehouseId || d.TargetWarehouseId == actor.WarehouseId)).OrderBy(d => d.Id).ToListAsync(ct);
        var docIds = docs.Select(d => d.Id).ToArray();
        var allocations = await db.Allocations.Where(a => docIds.Contains(a.OrderId)).ToListAsync(ct);
        var records = await db.SupportingRecords.Where(r => r.CompanyId == "demo" && r.WarehouseId == actor.WarehouseId).ToListAsync(ct);
        var users = await db.Principals.Where(p => p.Status != "deleted" && (actor.Role == "admin" || p.Id == actor.Id)).ToListAsync(ct);
        var userDtos = new List<object>();
        foreach (var user in users)
            userDtos.Add(await access.User(user, ct));
        var positionIds = positions.Select(p => p.Id).ToArray();
        var entries = await db.Entries.Where(e => positionIds.Contains(e.PositionId)).Join(db.Movements, e => e.MovementId, m => m.Id, (e, m) => new { e, m }).OrderBy(x => x.m.PostedAt).ThenBy(x => x.e.Id).ToListAsync(ct);
        var events = await db.Outbox.Where(e => e.WarehouseId == actor.WarehouseId).OrderByDescending(e => e.CreatedAt).Take(200).ToListAsync(ct);
        var audit = await db.Audit.Where(a => a.WarehouseId == actor.WarehouseId).OrderByDescending(a => a.PostedAt).Take(200).ToListAsync(ct);
        string Sku(string id) => items.Single(i => i.Id == id).Sku;
        string Wh(string id) => warehouses[id];
        object[] Supporting(string kind) => records.Where(r => r.Kind == kind).Select(r => (object)JsonSerializer.Deserialize<JsonElement>(r.PayloadJson)).ToArray();
        var output = new
        {
            products = items.Select(i => new { sku = i.Sku, name = i.Name, barcode = i.Barcode, category = i.Category, unit = i.Unit, factor = Number(i.ConversionFactor), active = i.Active, image = i.Image, dimensions = i.Dimensions, weight = i.Weight, version = i.Version }),
            positions = positions.Select(p => new { sku = Sku(p.ItemId), warehouse = Wh(actor.WarehouseId), location = locations[p.LocationId].Code, qty = Number(p.OnHand), reserved = Number(p.Committed), condition = p.Condition, hold = p.Hold, frozen = locations[p.LocationId].Frozen, version = p.Version }),
            receipts = docs.Where(d => d.Kind == "po").Select(d => new { id = d.Id, sku = Sku(d.ItemId), ordered = Number(d.Quantity), received = Number(d.Actual), warehouse = Wh(d.WarehouseId), version = d.Version }),
            orders = docs.Where(d => d.Kind == "order").Select(d => new { id = d.Id, sku = Sku(d.ItemId), qty = Number(d.Quantity), status = d.Status, creator = d.Creator, warehouse = Wh(d.WarehouseId), picked = Number(d.Picked), shipped = Number(d.Shipped), returned = Number(d.Returned), cancelled = d.Status == "cancelled", allocations = allocations.Where(a => a.OrderId == d.Id && positions.Any(p => p.Id == a.PositionId)).GroupBy(a => locations[positions.Single(p => p.Id == a.PositionId).LocationId].Code).ToDictionary(g => g.Key, g => Number(g.Sum(a => a.Quantity))), version = d.Version }),
            inspections = docs.Where(d => d.Kind == "inspection").Select(d => new { id = d.Id, source = d.Source, sku = Sku(d.ItemId), qty = Number(d.Quantity), remaining = Number(d.Quantity - d.Actual), warehouse = Wh(d.WarehouseId), version = d.Version }),
            putaways = docs.Where(d => d.Kind == "putaway").Select(d => new { id = d.Id, source = d.Source, sku = Sku(d.ItemId), remaining = Number(d.Quantity - d.Actual), warehouse = Wh(d.WarehouseId), version = d.Version }),
            returnTasks = docs.Where(d => d.Kind == "return-stock").Select(d => new { id = d.Id, order = d.Source, sku = Sku(d.ItemId), remaining = Number(d.Quantity - d.Actual), warehouse = Wh(d.WarehouseId), version = d.Version }),
            transfers = docs.Where(d => d.Kind == "transfer").Select(d => new { id = d.Id, sku = Sku(d.ItemId), from = Wh(d.WarehouseId), to = Wh(d.TargetWarehouseId!), sent = Number(d.Quantity), received = Number(d.Actual), version = d.Version }),
            returns = docs.Where(d => d.Kind is "customer-return" or "supplier-return").Select(d => new { id = d.Id, type = d.Kind, source = d.Source, sku = Sku(d.ItemId), qty = Number(d.Quantity), warehouse = Wh(d.WarehouseId), version = d.Version }),
            counts = docs.Where(d => d.Kind == "count").Select(d =>
            {
                var row = new Dictionary<string, object?> { { "id", d.Id }, { "sku", Sku(d.ItemId) }, { "location", locations[d.LocationId].Code }, { "warehouse", Wh(d.WarehouseId) }, { "actual", d.Counted.HasValue ? Number(d.Counted.Value) : null }, { "status", d.Status }, { "counter", d.Counter }, { "version", d.Version } };
                if (actor.Role is "admin" or "supervisor")
                    row["expected"] = d.Expected.HasValue ? Number(d.Expected.Value) : null;
                return row;
            }),
            ledger = entries.Select(x => { var position = positions.Single(p => p.Id == x.e.PositionId); return new { id = x.e.Id.ToString(), transaction = x.m.Id, sku = Sku(position.ItemId), warehouse = Wh(actor.WarehouseId), location = locations[position.LocationId].Code, qty = Number(x.e.QuantityDelta), kind = x.m.Kind, source = x.m.Source, user = x.m.Actor, occurred = x.m.OccurredAt, posted = x.m.PostedAt }; }),
            events = events.Select(e => new { id = e.Id.ToString(), source = e.AggregateId, type = e.Kind, warehouse = Wh(e.WarehouseId), wms = "confirmed", transport = e.TransportStatus, business = e.BusinessStatus, attempts = e.Attempts, payload = JsonSerializer.Deserialize<JsonElement>(e.PayloadJson) }),
            audit = audit.Select(a => new { id = a.TransactionId, type = a.Action, user = a.PrincipalId, warehouse = Wh(a.WarehouseId), payload = JsonSerializer.Deserialize<JsonElement>(a.DetailJson), stamp = a.PostedAt }),
            users = userDtos,
            currentRole = actor.Role,
            partialAllowed = await db.Settings.Select(s => s.PartialAllowed).SingleAsync(ct),
            packages = Supporting("packages"),
            labelHistory = Supporting("labelHistory"),
            followups = Supporting("followups"),
            locationMaster = locations.Values.Select(l => (object)new { name = l.Code, factor = "1" }).Concat(Supporting("locationMaster")),
            unitMaster = new object[] { new { name = "units", factor = "1" } }.Concat(Supporting("unitMaster")),
            pending = Array.Empty<object>(),
            results = new
            {
            },
            asOf = DateTimeOffset.UtcNow,
        };
        await transaction.CommitAsync(ct);
        return output;
    }
}
