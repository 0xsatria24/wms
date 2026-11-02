using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Reporting;

public sealed class SnapshotQuery(WmsDb db, IConfiguration? configuration = null)
{
    public async Task<object> Read(ActingPrincipal actor, CancellationToken ct, WorkspaceQuery? input = null)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct) && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
        var warehouses = await db.Warehouses.ToDictionaryAsync(w => w.Id, w => w.Name, ct);
        input ??= new WorkspaceQuery();
        var window = await WorkspaceWindow.Read(db, actor, input, ct);
        var items = await db.Items.Where(i => i.CompanyId == "demo" && window.ItemIds.Contains(i.Id)).OrderBy(i => i.Sku).Select(i => new { i.Id, i.Sku, i.Name, i.Barcode, i.Category, i.Unit, i.ConversionFactor, i.Active, hasImage = i.Image != null, i.Dimensions, i.Weight, i.Version }).ToListAsync(ct);
        var locations = await db.Locations.Where(l => l.WarehouseId == actor.WarehouseId).ToDictionaryAsync(l => l.Id, ct);
        var locationIds = locations.Keys.ToArray();
        var positions = await db.Positions.Where(p => p.CompanyId == "demo" && locationIds.Contains(p.LocationId) && window.ItemIds.Contains(p.ItemId)).ToListAsync(ct);
        var docs = await db.Documents.Where(d => d.CompanyId == "demo" && window.DocumentIds.Contains(d.Id)).OrderBy(d => d.Id).ToListAsync(ct);
        var blindScopes = actor.Role == "operator"
            ? (await db.Documents.Where(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId).ToListAsync(ct)).Select(d => (d.ItemId, d.LocationId)).ToHashSet()
            : [];
        var docIds = docs.Select(d => d.Id).ToArray();
        var allocations = await db.Allocations.Where(a => docIds.Contains(a.OrderId)).ToListAsync(ct);
        var records = await db.SupportingRecords.Where(r => r.CompanyId == "demo" && r.WarehouseId == actor.WarehouseId && r.Kind != "erp-po").OrderByDescending(r => r.Id).Take(200).ToListAsync(ct);
        var users = await db.Principals.Where(p => p.Status != "deleted" && (actor.Role == "admin" || p.Id == actor.Id)).ToListAsync(ct);
        var userIds = users.Select(u => u.Id).ToArray();
        var grants = await db.AccessGrants.Where(g => userIds.Contains(g.PrincipalId)).ToListAsync(ct);
        var userDtos = users.Select(user =>
        {
            var userGrants = grants.Where(g => g.PrincipalId == user.Id).ToArray();
            return (object)new { id = user.Id, name = user.Name, email = user.Email, verified = user.Verified, status = user.Status, role = userGrants.FirstOrDefault()?.Role ?? "viewer", warehouses = userGrants.Select(g => warehouses[g.WarehouseId]).ToArray() };
        }).ToArray();
        var positionIds = positions.Select(p => p.Id).ToArray();
        var ledgerQuery = db.Entries.Where(e => positionIds.Contains(e.PositionId)).Join(db.Movements, e => e.MovementId, m => m.Id, (e, m) => new { e, m });
        if (input.Sku != "") ledgerQuery = ledgerQuery.Where(x => db.Positions.Any(p => p.Id == x.e.PositionId && db.Items.Any(i => i.Id == p.ItemId && i.Sku == input.Sku)));
        if (input.Location != "") ledgerQuery = ledgerQuery.Where(x => db.Positions.Any(p => p.Id == x.e.PositionId && db.Locations.Any(l => l.Id == p.LocationId && l.Code == input.Location)));
        if (input.Query != "") ledgerQuery = ledgerQuery.Where(x => (x.m.Source + " " + x.m.Kind + " " + x.m.Id).ToLower().Contains(input.Query.ToLower()));
        if (DateOnly.TryParse(input.From, out var from)) ledgerQuery = ledgerQuery.Where(x => x.m.PostedAt >= new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7)).ToUniversalTime());
        if (DateOnly.TryParse(input.To, out var to)) ledgerQuery = ledgerQuery.Where(x => x.m.PostedAt < new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7)).ToUniversalTime());
        var includeLedger = input.View is "movements" or "tracking" or "overview";
        var ledgerTotal = includeLedger ? await ledgerQuery.CountAsync(ct) : 0;
        var ledgerPageSize = Math.Clamp(input.PageSize, 1, 50);
        var ledgerPage = Math.Clamp(input.Page, 1, Math.Max(1, (int)Math.Ceiling(ledgerTotal / (double)ledgerPageSize)));
        var entries = await ledgerQuery.OrderByDescending(x => x.m.PostedAt).ThenBy(x => x.e.Id).Skip((ledgerPage - 1) * ledgerPageSize).Take(includeLedger ? ledgerPageSize : 0).ToListAsync(ct);
        var events = await db.Outbox.Where(e => e.WarehouseId == actor.WarehouseId).OrderByDescending(e => e.CreatedAt).Take(200).ToListAsync(ct);
        var audit = await db.Audit.Where(a => a.WarehouseId == actor.WarehouseId).OrderByDescending(a => a.PostedAt).Take(200).ToListAsync(ct);
        var itemById = items.ToDictionary(i => i.Id);
        var positionById = positions.ToDictionary(p => p.Id);
        string Sku(string id) => itemById[id].Sku;
        string Wh(string id) => warehouses[id];
        object[] Supporting(string kind) => records.Where(r => r.Kind == kind).Select(r => (object)JsonSerializer.Deserialize<JsonElement>(r.PayloadJson)).ToArray();
        var backupEvidence = await db.SupportingRecords.Where(r => r.Id == "ops-backup" && r.CompanyId == "demo" && r.Kind == "ops-status").Select(r => r.PayloadJson).SingleOrDefaultAsync(ct);
        var output = new
        {
            products = items.Select(i => new { sku = i.Sku, name = i.Name, barcode = i.Barcode, category = i.Category, unit = i.Unit, factor = Number(i.ConversionFactor), active = i.Active, image = i.hasImage ? $"/api/items/{Uri.EscapeDataString(i.Sku)}/image?warehouse={Uri.EscapeDataString(actor.WarehouseId)}" : null, dimensions = i.Dimensions, weight = i.Weight, version = i.Version }),
            positions = positions.Where(p => !blindScopes.Contains((p.ItemId, p.LocationId))).Select(p => new { sku = Sku(p.ItemId), warehouse = Wh(actor.WarehouseId), location = locations[p.LocationId].Code, qty = Number(p.OnHand), reserved = Number(p.Committed), condition = p.Condition, hold = p.Hold, frozen = locations[p.LocationId].Frozen, pickable = locations[p.LocationId].Pickable, version = p.Version }),
            receipts = docs.Where(d => d.Kind == "po").Select(d => new { id = d.Id, sku = Sku(d.ItemId), ordered = Number(d.Quantity), received = Number(d.Actual), warehouse = Wh(d.WarehouseId), version = d.Version }),
            orders = docs.Where(d => d.Kind == "order").Select(d => new { id = d.Id, sku = Sku(d.ItemId), qty = Number(d.Quantity), status = d.Status, creator = d.Creator, warehouse = Wh(d.WarehouseId), picked = Number(d.Picked), shipped = Number(d.Shipped), returned = Number(d.Returned), cancelled = d.Status == "cancelled", allocations = allocations.Where(a => a.OrderId == d.Id && positionById.ContainsKey(a.PositionId)).GroupBy(a => locations[positionById[a.PositionId].LocationId].Code).ToDictionary(g => g.Key, g => Number(g.Sum(a => a.Quantity))), version = d.Version }),
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
            ledger = entries.Where(x => !blindScopes.Contains((positionById[x.e.PositionId].ItemId, positionById[x.e.PositionId].LocationId))).Select(x => { var position = positionById[x.e.PositionId]; return new { id = x.e.Id.ToString(), transaction = x.m.Id, sku = Sku(position.ItemId), warehouse = Wh(actor.WarehouseId), location = locations[position.LocationId].Code, qty = Number(x.e.QuantityDelta), kind = x.m.Kind, source = x.m.Source, user = x.m.Actor, occurred = x.m.OccurredAt, posted = x.m.PostedAt }; }),
            events = events.Select(e => new { id = e.Id.ToString(), source = e.AggregateId, type = e.Kind, warehouse = Wh(e.WarehouseId), wms = "confirmed", transport = e.TransportStatus, business = e.BusinessStatus, attempts = e.Attempts, payload = JsonSerializer.Deserialize<JsonElement>(e.PayloadJson) }),
            audit = audit.Select(a => new { id = a.TransactionId, type = a.Action, user = a.PrincipalId, warehouse = Wh(a.WarehouseId), payload = JsonSerializer.Deserialize<JsonElement>(a.DetailJson), stamp = a.PostedAt }),
            users = userDtos,
            currentRole = actor.Role,
            operationalTotals = new { erp = await db.Outbox.CountAsync(e => e.WarehouseId == actor.WarehouseId && e.BusinessStatus != "accepted", ct), freezes = await db.Documents.CountAsync(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId, ct) },
            backupEvidence = backupEvidence is null ? (JsonElement?)null : JsonSerializer.Deserialize<JsonElement>(backupEvidence),
            erpDelivery = new { enabled = configuration?.GetValue<bool>("Erp:Enabled") ?? false, paused = configuration?.GetValue<bool>("Erp:DispatchPaused") == true || await db.SupportingRecords.AnyAsync(r => r.Kind == "outbox-pause", ct), maintenance = await db.SupportingRecords.AnyAsync(r => r.Id == "outbox-recovery-hold" && r.Kind == "outbox-pause", ct) },
            warehouseMaster = warehouses.Where(w => w.Key != "transit").Select(w => new { id = w.Key, name = w.Value }),
            returnSources = input.View == "returns" ? await (from entry in db.Entries join movement in db.Movements on entry.MovementId equals movement.Id join position in db.Positions on entry.PositionId equals position.Id join item in db.Items on position.ItemId equals item.Id
                where movement.WarehouseId == actor.WarehouseId && window.ItemIds.Contains(item.Id) && (movement.Kind == "ship" && entry.QuantityDelta < 0 || (movement.Kind == "qc" || movement.Kind == "opening") && entry.QuantityDelta > 0 && position.Condition == "not-good" && position.Hold == "quality-rejected")
                orderby movement.PostedAt descending
                select new { id = movement.Id, sku = item.Sku, type = movement.Kind == "ship" ? "customer" : "supplier" }).Distinct().Take(50).ToListAsync(ct) : null,
            catalogue = window.Metadata,
            shipments = input.View == "stock" ? await new ShipmentQuery(db).Read(actor, input.FocusSku, ct) : null,
            ledgerPage = new { total = ledgerTotal, page = ledgerPage, pages = Math.Max(1, (int)Math.Ceiling(ledgerTotal / (double)ledgerPageSize)) },
            partialAllowed = await db.Settings.Select(s => s.PartialAllowed).SingleAsync(ct),
            packages = Supporting("packages"),
            labelHistory = Supporting("labelHistory"),
            followups = Supporting("followups"),
            locationMaster = locations.Values.Select(l => new { name = l.Code, factor = "1", pickable = l.Pickable, frozen = l.Frozen }),
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
