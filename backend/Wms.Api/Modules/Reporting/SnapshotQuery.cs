using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using Wms.Modules.Catalog;
using Wms.Modules.Access;
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
        var zone = (await OperationalSettings.Read(db, "warehouse", actor.WarehouseId, new WarehouseDetails(), ct)).Value.TimeZone;
        var fromDate = WarehouseDates.Date(input.From);
        var toDate = WarehouseDates.Date(input.To);
        var start = fromDate.HasValue ? WarehouseDates.Start(fromDate.Value, zone) : (DateTimeOffset?)null;
        var end = toDate.HasValue ? WarehouseDates.Start(toDate.Value.AddDays(1), zone) : (DateTimeOffset?)null;
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
        var boundedRecords = db.SupportingRecords.FromSqlInterpolated($"SELECT * FROM \"SupportingRecords\" WHERE octet_length(\"PayloadJson\"::text) <= {SupportingPayload.MaxBytes}")
            .Where(r => r.CompanyId == "demo" && r.WarehouseId == actor.WarehouseId && r.Kind != "erp-po");
        var supportingRecordsWarning = await db.SupportingRecords.AnyAsync(r => r.CompanyId == "demo" && r.WarehouseId == actor.WarehouseId && r.Kind != "erp-po" && !boundedRecords.Any(s => s.Id == r.Id), ct);
        const int supportingSize = 25;
        var supportingTotal = await boundedRecords.CountAsync(r => r.Kind == "followups", ct);
        var supportingPages = Math.Max(1, (int)Math.Ceiling(supportingTotal / (double)supportingSize));
        var supportingPage = Math.Clamp(input.SupportingPage, 1, supportingPages);
        var records = new List<SupportingRecord>();
        var packageSearch = input.PackagesQuery.Trim().ToLowerInvariant();
        var packageQuery = db.SupportingRecords.FromSqlInterpolated($"SELECT * FROM \"SupportingRecords\" WHERE octet_length(\"PayloadJson\"::text) <= {SupportingPayload.MaxBytes} AND (strpos(lower(\"Id\"), {packageSearch}) > 0 OR strpos(lower(\"PayloadJson\"::text), {packageSearch}) > 0)")
            .Where(r => r.CompanyId == "demo" && r.WarehouseId == actor.WarehouseId && r.Kind == "packages");
        var packageTotal = await packageQuery.CountAsync(ct);
        var packagePages = Math.Max(1, (int)Math.Ceiling(packageTotal / (double)supportingSize));
        var packagePage = Math.Clamp(input.PackagesPage, 1, packagePages);
        records.AddRange(await packageQuery.OrderBy(r => r.Id).Skip((packagePage - 1) * supportingSize).Take(supportingSize).ToListAsync(ct));
        foreach (var kind in new[] { "unitMaster", "locationMaster" })
        {
            var operational = await boundedRecords.Where(r => r.Kind == kind).OrderBy(r => r.Id).Take(101).ToListAsync(ct);
            supportingRecordsWarning |= operational.Count > 100;
            records.AddRange(operational.Take(100));
        }
        records.AddRange(await boundedRecords.Where(r => r.Kind == "followups").OrderByDescending(r => r.Id).Skip((supportingPage - 1) * supportingSize).Take(supportingSize).ToListAsync(ct));
        records.AddRange(await boundedRecords.Where(r => r.Kind == "labelHistory").OrderByDescending(r => r.Id).Take(supportingSize).ToListAsync(ct));
        var usersQuery = db.Principals.Where(p => p.Status != "deleted" && (actor.Role == "admin" || p.Id == actor.Id));
        var pendingTotal = await usersQuery.CountAsync(p => p.Status == "pending", ct);
        if (input.View == "access" && input.Status is "pending" or "users")
            usersQuery = input.Status == "pending" ? usersQuery.Where(p => p.Status == "pending") : usersQuery.Where(p => p.Status != "pending");
        var userTotal = await usersQuery.CountAsync(ct);
        var userPages = Math.Max(1, (int)Math.Ceiling(userTotal / 25d));
        var userPage = Math.Clamp(input.UsersPage, 1, userPages);
        var users = await usersQuery.OrderBy(p => p.Id).Skip((userPage - 1) * 25).Take(25).ToListAsync(ct);
        var userIds = users.Select(u => u.Id).ToArray();
        var grants = await db.AccessGrants.Where(g => userIds.Contains(g.PrincipalId)).ToListAsync(ct);
        var invitationKeys = userIds.Select(id => AccountInvitations.Kind + "|" + id).ToArray();
        var invitations = (await db.SupportingRecords.Where(r => r.Kind == AccountInvitations.Kind && invitationKeys.Contains(r.Id)).ToListAsync(ct))
            .Select(AccountInvitations.Read).ToDictionary(i => i.PrincipalId);
        var userDtos = users.Select(user =>
        {
            var userGrants = grants.Where(g => g.PrincipalId == user.Id).ToArray();
            return (object)new { id = user.Id, name = user.Name, email = user.Email, verified = user.Verified, status = user.Status, role = userGrants.FirstOrDefault(g => g.WarehouseId == actor.WarehouseId)?.Role ?? userGrants.FirstOrDefault()?.Role ?? "viewer", warehouses = userGrants.Select(g => warehouses[g.WarehouseId]).ToArray(), warehouseRoles = userGrants.ToDictionary(g => warehouses[g.WarehouseId], g => g.Role), invitationId = invitations.GetValueOrDefault(user.Id)?.Id.ToString() };
        }).ToArray();
        var positionIds = positions.Select(p => p.Id).ToArray();
        var lastMovements = await (from entry in db.Entries
            join movement in db.Movements on entry.MovementId equals movement.Id
            where positionIds.Contains(entry.PositionId) && movement.WarehouseId == actor.WarehouseId
            group movement by entry.PositionId into history
            select new { PositionId = history.Key, PostedAt = history.Max(m => m.PostedAt) }).ToDictionaryAsync(x => x.PositionId, x => (DateTimeOffset?)x.PostedAt, ct);
        var ledgerQuery = from e in db.Entries
            join m in db.Movements on e.MovementId equals m.Id
            join p in db.Positions on e.PositionId equals p.Id
            join l in db.Locations on p.LocationId equals l.Id
            join i in db.Items on p.ItemId equals i.Id
            where m.CompanyId == "demo" && p.CompanyId == "demo" && i.CompanyId == "demo" && m.WarehouseId == actor.WarehouseId && l.WarehouseId == actor.WarehouseId
                && (actor.Role != "operator" || !db.Documents.Any(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId && d.ItemId == p.ItemId && d.LocationId == p.LocationId))
            select new { e, m, p, l, i };
        if (input.Sku != "") ledgerQuery = ledgerQuery.Where(x => x.i.Sku == input.Sku);
        if (input.Location != "") ledgerQuery = ledgerQuery.Where(x => x.l.Code == input.Location);
        var ledgerSearch = input.Query.Trim().ToLowerInvariant();
        if (ledgerSearch != "") ledgerQuery = ledgerQuery.Where(x => (x.m.Source + " " + x.m.Kind + " " + x.m.Id + " " + x.e.Id.ToString()).ToLower().Contains(ledgerSearch));
        if (start.HasValue) ledgerQuery = ledgerQuery.Where(x => x.m.PostedAt >= start.Value);
        if (end.HasValue) ledgerQuery = ledgerQuery.Where(x => x.m.PostedAt < end.Value);
        var includeLedger = input.View is "movements" or "tracking" or "overview";
        var ledgerTotal = includeLedger ? await ledgerQuery.CountAsync(ct) : 0;
        var ledgerQuantities = await ledgerQuery.Where(x => includeLedger).GroupBy(x => x.e.Unit).Select(g => new { unit = g.Key, qty = g.Sum(x => x.e.QuantityDelta) }).OrderBy(x => x.unit).ToListAsync(ct);
        var ledgerPageSize = Math.Clamp(input.PageSize, 1, 50);
        var ledgerPage = Math.Clamp(input.Page, 1, Math.Max(1, (int)Math.Ceiling(ledgerTotal / (double)ledgerPageSize)));
        var entries = await ledgerQuery.OrderByDescending(x => x.m.PostedAt).ThenBy(x => x.e.Id).Skip((ledgerPage - 1) * ledgerPageSize).Take(includeLedger ? ledgerPageSize : 0).ToListAsync(ct);
        var boundedEvents = db.Outbox.FromSqlInterpolated($"SELECT * FROM \"Outbox\" WHERE octet_length(\"PayloadJson\"::text) <= {SupportingPayload.MaxBytes}");
        var boundedAudit = db.Audit.FromSqlInterpolated($"SELECT * FROM \"Audit\" WHERE octet_length(\"DetailJson\"::text) <= {SupportingPayload.MaxBytes}");
        supportingRecordsWarning |= await db.Outbox.AnyAsync(e => e.WarehouseId == actor.WarehouseId && !boundedEvents.Any(s => s.Id == e.Id), ct)
            || await db.Audit.AnyAsync(a => a.WarehouseId == actor.WarehouseId && !boundedAudit.Any(s => s.Id == a.Id), ct);
        var eventQuery = boundedEvents.Where(e => e.CompanyId == "demo" && e.WarehouseId == actor.WarehouseId);
        var eventScopeTotal = await eventQuery.CountAsync(ct);
        if (input.View == "integration")
        {
            var eventSearch = input.Query.Trim().ToLowerInvariant();
            if (eventSearch != "") eventQuery = eventQuery.Where(e => (e.Id.ToString() + " " + e.AggregateId + " " + e.Kind + " " + e.TransportStatus + " " + e.BusinessStatus).ToLower().Contains(eventSearch));
            if (input.Status == "needs-attention") eventQuery = eventQuery.Where(e => e.BusinessStatus != "accepted");
            else if (input.Status != "") eventQuery = eventQuery.Where(e => e.TransportStatus == input.Status || e.BusinessStatus == input.Status);
            if (start.HasValue) eventQuery = eventQuery.Where(e => e.CreatedAt >= start.Value);
            if (end.HasValue) eventQuery = eventQuery.Where(e => e.CreatedAt < end.Value);
        }
        var eventTotal = await eventQuery.CountAsync(ct);
        var eventPageSize = Math.Clamp(input.PageSize, 1, 50);
        var eventPages = Math.Max(1, (int)Math.Ceiling(eventTotal / (double)eventPageSize));
        var eventPage = Math.Clamp(input.Page, 1, eventPages);
        var events = await eventQuery.OrderByDescending(e => e.CreatedAt).ThenBy(e => e.Id).Skip(input.View == "integration" ? (eventPage - 1) * eventPageSize : 0).Take(input.View == "integration" ? eventPageSize : 200).ToListAsync(ct);
        var audit = await boundedAudit.Where(a => a.WarehouseId == actor.WarehouseId).OrderByDescending(a => a.PostedAt).Take(200).ToListAsync(ct);
        var sourceSearch = input.ReturnSourcesQuery.Trim().ToLowerInvariant();
        var returnSourceGroups = from entry in db.Entries
            join movement in db.Movements on entry.MovementId equals movement.Id
            join position in db.Positions on entry.PositionId equals position.Id
            join location in db.Locations on position.LocationId equals location.Id
            join item in db.Items on position.ItemId equals item.Id
            where input.View == "returns" && movement.CompanyId == "demo" && position.CompanyId == "demo" && item.CompanyId == "demo" && item.Active
                && movement.WarehouseId == actor.WarehouseId && location.WarehouseId == actor.WarehouseId
                && (input.Sku == "" || item.Sku == input.Sku)
                && (sourceSearch == "" || (movement.Id + " " + movement.Source + " " + item.Sku + " " + item.Name).ToLower().Contains(sourceSearch))
                && (movement.Kind == "ship" && entry.QuantityDelta < 0
                    || (actor.Role == "admin" || actor.Role == "supervisor") && (movement.Kind == "qc" || movement.Kind == "opening") && entry.QuantityDelta > 0 && location.Code == "QC" && position.Condition == "not-good" && position.Hold == "quality-rejected")
                && (actor.Role != "operator" || !db.Documents.Any(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId && d.ItemId == position.ItemId && d.LocationId == position.LocationId))
            group entry by new { movement.Id, movement.Kind, movement.PostedAt, ItemId = item.Id, item.Sku, item.Unit } into source
            select new { source.Key, Quantity = source.Sum(e => e.QuantityDelta) };
        var sourceRemainders = from source in returnSourceGroups
            let type = source.Key.Kind == "ship" ? "customer-return" : "supplier-return"
            let returned = db.Documents.Where(d => d.CompanyId == "demo" && d.Kind == type && d.WarehouseId == actor.WarehouseId && d.ItemId == source.Key.ItemId && d.Source == source.Key.Id).Sum(d => d.Quantity)
            let remaining = (source.Key.Kind == "ship" ? -source.Quantity : source.Quantity) - returned
            let available = db.Positions.Where(p => p.CompanyId == "demo" && p.ItemId == source.Key.ItemId && p.Condition == "not-good" && p.Hold == "quality-rejected" && db.Locations.Any(l => l.Id == p.LocationId && l.WarehouseId == actor.WarehouseId && l.Code == "QC")).Sum(p => p.OnHand - p.Committed)
            select new { source.Key, Remaining = source.Key.Kind == "ship" ? remaining : Math.Min(remaining, available) };
        var returnSourceQuery = sourceRemainders.Where(s => s.Remaining > 0);
        var returnSourcesTotal = await returnSourceQuery.CountAsync(ct);
        var returnSourcesPages = Math.Max(1, (int)Math.Ceiling(returnSourcesTotal / (double)supportingSize));
        var returnSourcesPage = Math.Clamp(input.ReturnSourcesPage, 1, returnSourcesPages);
        var returnSources = await returnSourceQuery.OrderByDescending(s => s.Key.PostedAt).ThenBy(s => s.Key.Id).ThenBy(s => s.Key.Sku).Skip((returnSourcesPage - 1) * supportingSize).Take(supportingSize).ToListAsync(ct);
        var itemById = items.ToDictionary(i => i.Id);
        var positionById = positions.ToDictionary(p => p.Id);
        string Sku(string id) => itemById[id].Sku;
        string Wh(string id) => warehouses[id];
        object[] Supporting(string kind) => records.Where(r => r.Kind == kind).Select(r => (object)JsonSerializer.Deserialize<JsonElement>(r.PayloadJson)).ToArray();
        var backupEvidence = await db.SupportingRecords.Where(r => r.Id == "ops-backup" && r.CompanyId == "demo" && r.Kind == "ops-status").Select(r => r.PayloadJson).SingleOrDefaultAsync(ct);
        var output = new
        {
            products = items.Select(i => new { sku = i.Sku, name = i.Name, barcode = i.Barcode, category = i.Category, unit = i.Unit, factor = Number(i.ConversionFactor), active = i.Active, image = i.hasImage ? $"/api/items/{Uri.EscapeDataString(i.Sku)}/image?warehouse={Uri.EscapeDataString(actor.WarehouseId)}" : null, dimensions = i.Dimensions, weight = i.Weight, version = i.Version }),
            positions = positions.Where(p => !blindScopes.Contains((p.ItemId, p.LocationId))).Select(p => new { sku = Sku(p.ItemId), warehouse = Wh(actor.WarehouseId), location = locations[p.LocationId].Code, qty = Number(p.OnHand), reserved = Number(p.Committed), condition = p.Condition, hold = p.Hold, frozen = locations[p.LocationId].Frozen, pickable = locations[p.LocationId].Pickable, version = p.Version, lastMovementAt = lastMovements.GetValueOrDefault(p.Id) }),
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
            ledger = entries.Select(x => new { id = x.e.Id.ToString(), transaction = x.m.Id, sku = x.i.Sku, warehouse = Wh(actor.WarehouseId), location = x.l.Code, qty = Number(x.e.QuantityDelta), unit = x.e.Unit, kind = x.m.Kind, source = x.m.Source, user = x.m.Actor, occurred = x.m.OccurredAt, posted = x.m.PostedAt }),
            ledgerSummary = new { total = ledgerTotal, quantities = ledgerQuantities.Select(x => new { x.unit, qty = Number(x.qty) }) },
            events = events.Select(e => new { id = e.Id.ToString(), source = e.AggregateId, type = e.Kind, warehouse = Wh(e.WarehouseId), wms = "confirmed", transport = e.TransportStatus, business = e.BusinessStatus, attempts = e.Attempts, createdAt = e.CreatedAt, nextAttemptAt = e.NextAttemptAt, payload = JsonSerializer.Deserialize<JsonElement>(e.PayloadJson) }),
            audit = audit.Select(a => new { id = a.TransactionId, type = a.Action, user = a.PrincipalId, warehouse = Wh(a.WarehouseId), payload = JsonSerializer.Deserialize<JsonElement>(a.DetailJson), stamp = a.PostedAt }),
            users = userDtos,
            userPage = new { page = userPage, pages = userPages, total = userTotal, pendingTotal, pageSize = 25 },
            supportingPage = new { page = supportingPage, pages = supportingPages, total = supportingTotal, pageSize = supportingSize },
            packagePage = new { page = packagePage, pages = packagePages, total = packageTotal, pageSize = supportingSize },
            eventPage = new { page = eventPage, pages = eventPages, total = eventTotal, pageSize = eventPageSize, scopeTotal = eventScopeTotal },
            supportingRecordsWarning,
            activity = new { from = input.From, to = input.To, timeZone = zone, confirmedActions = await db.Audit.CountAsync(a => a.WarehouseId == actor.WarehouseId && (!start.HasValue || a.PostedAt >= start.Value) && (!end.HasValue || a.PostedAt < end.Value), ct) },
            currentRole = actor.Role,
            workflowEnabled = configuration?.GetValue<bool>("Workflow:Enabled") ?? true,
            operationalTotals = new { erp = await db.Outbox.CountAsync(e => e.WarehouseId == actor.WarehouseId && e.BusinessStatus != "accepted", ct), freezes = await db.Documents.CountAsync(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId, ct) },
            backupEvidence = backupEvidence is null ? (JsonElement?)null : JsonSerializer.Deserialize<JsonElement>(backupEvidence),
            erpDelivery = new { enabled = configuration?.GetValue<bool>("Erp:Enabled") ?? false, paused = configuration?.GetValue<bool>("Erp:DispatchPaused") == true || await db.SupportingRecords.AnyAsync(r => r.Kind == "outbox-pause", ct), maintenance = await db.SupportingRecords.AnyAsync(r => r.Id == "outbox-recovery-hold" && r.Kind == "outbox-pause", ct) },
            warehouseMaster = warehouses.Where(w => w.Key != "transit").Select(w => new { id = w.Key, name = w.Value }),
            returnSources = returnSources.Select(s => new { id = s.Key.Id, sku = s.Key.Sku, type = s.Key.Kind == "ship" ? "customer" : "supplier", unit = s.Key.Unit, remaining = Number(s.Remaining) }),
            returnSourcesPage = new { total = returnSourcesTotal, page = returnSourcesPage, pages = returnSourcesPages, pageSize = supportingSize },
            catalogue = window.Metadata,
            shipments = input.View == "stock" ? await new ShipmentQuery(db).Read(actor, input.FocusSku, ct) : null,
            ledgerPage = new { total = ledgerTotal, page = ledgerPage, pages = Math.Max(1, (int)Math.Ceiling(ledgerTotal / (double)ledgerPageSize)) },
            warehouseTimeZone = (await OperationalSettings.Read(db, "warehouse", actor.WarehouseId, new WarehouseDetails(), ct)).Value.TimeZone,
            approvalPolicy = (await OperationalSettings.Read(db, "approvals", actor.WarehouseId, new ApprovalSettings(), ct)).Value,
            partialAllowed = await db.Settings.Select(s => s.PartialAllowed).SingleAsync(ct),
            packages = Supporting("packages"),
            labelHistory = Supporting("labelHistory"),
            followups = Supporting("followups"),
            locationMaster = locations.Values.Select(l => new { name = l.Code, factor = "1", pickable = l.Pickable, frozen = l.Frozen, version = l.Version }),
            unitMaster = new object[] { new { name = "units", factor = "1" } }.Concat(Supporting("unitMaster")),
            documentDates = docs.ToDictionary(d => d.Id, d => new { d.DocumentDate, d.ScheduledDate, d.CreatedAt, d.UpdatedAt, d.StartedAt, d.SubmittedAt, d.ApprovedAt, d.CompletedAt, d.Creator }),
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
