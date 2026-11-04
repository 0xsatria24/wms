using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Inventory;

public sealed partial class CommandProcessor(WmsDb db)
{
    internal Func<Task>? BeforeCommit
    {
        get; set;
    }
    private ActingPrincipal actor = null!;
    private CommandRequest command = null!;
    private List<StockPosition> positions = [];
    private List<Location> locations = [];
    private List<OperationalDocument> documents = [];
    private List<Allocation> allocations = [];
    private List<Item> items = [];
    private string transactionId = "";
    private DateTimeOffset now;
    private StockMovement? movement;
    private ApprovalSettings approvalSettings = new();

    public async Task<CommandResult> Handle(ActingPrincipal principal, CommandRequest input, string key, CancellationToken ct = default)
    {
        actor = principal;
        command = input;
        now = DateTimeOffset.UtcNow;
        Require(Guid.TryParse(key, out _), "idempotency-key", 400);
        var granted = await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct);
        Require(granted && (actor.Role is "admin" or "supervisor" or "operator"), "denied", 403);
        Require(input.PrincipalId is null || input.PrincipalId == actor.Id, "pending-owner", 403);
        Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct), "denied", 403);
        var scopeKey = $"demo:{actor.Id}:{input.Type}:{key}";
        var hash = Hash(Canonical(JsonSerializer.SerializeToElement(new
        {
            input.Type,
            Warehouse = actor.WarehouseId,
            input.ExpectedVersion,
            Payload = input.Payload,
            input.OccurredAt
        })));
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        await RecoveryState.RequireWritable(db, ct);
        // Serialize identical requests before taking location locks; different keys still meet at the stock locks.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({scopeKey}, 0))", ct);
        var prior = await db.Requests.SingleOrDefaultAsync(r => r.ScopeKey == scopeKey, ct);
        if (prior is not null)
        {
            Require(prior.PayloadHash == hash, "key-changed");
            Require(prior.WarehouseId == actor.WarehouseId, "scope", 403);
            return JsonSerializer.Deserialize<CommandResult>(prior.ResultJson)!;
        }
        var transitId = command.Type == "transfer-receive" ? $"transit|{command.Payload.Text("document")}" : "";
        locations = await db.Locations.FromSqlInterpolated($"SELECT * FROM \"Locations\" WHERE \"WarehouseId\" = {actor.WarehouseId} OR \"Id\" = {transitId} ORDER BY \"Id\" FOR UPDATE").ToListAsync(ct);
        var locationIds = locations.Select(l => l.Id).ToArray();
        positions = await db.Positions.Where(p => p.CompanyId == "demo" && locationIds.Contains(p.LocationId)).ToListAsync(ct);
        documents = await db.Documents.Where(d => d.CompanyId == "demo" && (d.WarehouseId == actor.WarehouseId || d.TargetWarehouseId == actor.WarehouseId)).ToListAsync(ct);
        var docIds = documents.Select(d => d.Id).ToArray();
        allocations = await db.Allocations.Where(a => docIds.Contains(a.OrderId)).ToListAsync(ct);
        var relatedItems = positions.Select(position => position.ItemId).Concat(documents.Select(document => document.ItemId)).Distinct().ToArray();
        var requestedSku = input.Payload.Text("sku");
        items = await db.Items.AsNoTracking().Where(i => i.CompanyId == "demo" && (relatedItems.Contains(i.Id) || i.Sku == requestedSku)).Select(i => new Item { Id = i.Id, Sku = i.Sku, Barcode = i.Barcode, Active = i.Active, Unit = i.Unit, ConversionFactor = i.ConversionFactor }).ToListAsync(ct);
        Require(await db.Principals.AnyAsync(u => u.Id == actor.Id && u.Status == "active", ct) && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
        approvalSettings = (await OperationalSettings.Read(db, "approvals", actor.WarehouseId, new ApprovalSettings(), ct)).Value;
        transactionId = ReferenceId.New();
        await Apply(ct);
        foreach (var p in positions)
            Require(p.OnHand >= 0 && p.Committed >= 0 && p.Committed <= p.OnHand, "invariant");
        db.ChangeTracker.DetectChanges();
        foreach (var entry in db.ChangeTracker.Entries<OperationalDocument>().Where(e => e.State == EntityState.Modified))
            entry.Entity.Version++;
        var exportDocuments = db.ChangeTracker.Entries<OperationalDocument>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified)
            .Select(e => e.Entity.Id).ToArray();
        if (exportDocuments.Length > 0)
            db.SupportingRecords.Add(new SupportingRecord
            {
                Id = ReferenceId.New(), WarehouseId = actor.WarehouseId, Kind = "export-evidence",
                PayloadJson = JsonSerializer.Serialize(new { transactionId, kind = input.Type, documentIds = exportDocuments, actor = actor.Id, postedAt = now })
            });
        foreach (var entry in db.ChangeTracker.Entries<StockPosition>().Where(e => e.State == EntityState.Modified))
            entry.Entity.Version++;
        var result = new CommandResult(transactionId, "recorded", input.Type, now);
        db.Audit.Add(new AuditRecord { TransactionId = transactionId, WarehouseId = actor.WarehouseId, PrincipalId = actor.Id, Action = input.Type, DetailJson = input.Payload.GetRawText(), PostedAt = now });
        db.Requests.Add(new IdempotencyRequest { ScopeKey = scopeKey, PrincipalId = actor.Id, WarehouseId = actor.WarehouseId, PayloadHash = hash, ResultJson = JsonSerializer.Serialize(result), CreatedAt = now });
        var aggregateId = input.Payload.Text("order");
        if (aggregateId.Length == 0)
            aggregateId = input.Payload.Text("document");
        if (aggregateId.Length == 0)
            aggregateId = input.Payload.Text("task");
        if (aggregateId.Length == 0)
            aggregateId = transactionId;
        if (input.Type is not "erp-retry" and not "count-submit" and not "freeze" and not "unfreeze" and not "recount")
            db.Outbox.Add(new OutboxEvent { WarehouseId = actor.WarehouseId, AggregateId = aggregateId, AggregateVersion = documents.FirstOrDefault(d => d.Id == aggregateId)?.Version ?? 0, Kind = input.Type, PayloadJson = JsonSerializer.Serialize(new { transactionId, input.Type, Warehouse = actor.WarehouseId, input.Payload, PostedAt = now, requestIdempotencyKey = key, requestPrincipalId = actor.Id, requestPayloadHash = hash, expectedVersion = input.ExpectedVersion, occurredAt = input.OccurredAt }), CreatedAt = now, NextAttemptAt = now });
        if (BeforeCommit is not null)
            await BeforeCommit();
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return result;
    }

    private OperationalDocument Doc(string id, string kind, bool expected = true)
    {
        var doc = documents.SingleOrDefault(d => d.Id == id && d.Kind == kind);
        Require(doc is not null, "source", 404);
        if (expected)
            Require(command.ExpectedVersion.HasValue && doc!.Version == command.ExpectedVersion.Value, "conflict");
        return doc!;
    }
    private Item Item(string sku)
    {
        var item = items.SingleOrDefault(i => i.Sku == sku);
        Require(item is not null && item.Active, "scan-item", 400);
        return item!;
    }
    private void Scan(string itemId)
    {
        var item = items.Single(i => i.Id == itemId);
        Require(item.Active && (command.Payload.Text("scan") == item.Sku || command.Payload.Text("scan") == item.Barcode), "scan-item", 400);
    }
    private StockPosition Position(string itemId, string location, string condition = "good", string hold = "", string? warehouse = null)
    {
        warehouse ??= actor.WarehouseId;
        var loc = locations.SingleOrDefault(l => l.WarehouseId == warehouse && l.Code == location);
        Require(loc is not null, "scan-location", 400);
        Require(!loc!.Frozen, "frozen");
        var p = positions.SingleOrDefault(p => p.ItemId == itemId && p.LocationId == loc.Id && p.Condition == condition && p.Hold == hold);
        if (p is null)
        {
            p = new StockPosition { Id = Guid.NewGuid().ToString("N"), ItemId = itemId, LocationId = loc.Id, Condition = condition, Hold = hold };
            db.Positions.Add(p);
            positions.Add(p);
        }
        return p;
    }
    private decimal Available(StockPosition p) => p.Condition == "good" && p.Hold == "" && locations.Single(l => l.Id == p.LocationId) is { Pickable: true, Frozen: false } ? p.OnHand - p.Committed : 0;
    private void Change(StockPosition p, decimal quantity, string source)
    {
        movement ??= new StockMovement { Id = transactionId, WarehouseId = actor.WarehouseId, Kind = command.Type, Source = source, Actor = actor.Id, Reason = command.Payload.Text("reason"), OccurredAt = command.OccurredAt ?? now, PostedAt = now };
        if (db.Entry(movement).State == EntityState.Detached)
            db.Movements.Add(movement);
        p.OnHand += quantity;
        db.Entries.Add(new StockEntry { MovementId = movement.Id, PositionId = p.Id, QuantityDelta = quantity });
    }
    private OperationalDocument AddDoc(string kind, string itemId, decimal qty, string source, string? id = null)
    {
        var doc = new OperationalDocument { Id = id ?? ReferenceId.New(), Kind = kind, ItemId = itemId, WarehouseId = actor.WarehouseId, Quantity = qty, Source = source, Creator = actor.Id };
        db.Documents.Add(doc);
        documents.Add(doc);
        return doc;
    }
    private Allocation Alloc(OperationalDocument order, StockPosition position)
    {
        var a = allocations.SingleOrDefault(a => a.OrderId == order.Id && a.PositionId == position.Id);
        if (a is null)
        {
            a = new Allocation { OrderId = order.Id, PositionId = position.Id };
            allocations.Add(a);
            db.Allocations.Add(a);
        }
        return a;
    }
    private void VerifyLocation(string value) => Require(command.Payload.Text("locationScan") == value, "scan-location", 400);
    private void Reviewer(string scope)
    {
        Supervisor(actor);
        Require(scope != "admin" || actor.Role == "admin", "denied", 403);
    }

    private async Task Apply(CancellationToken ct)
    {
        var p = command.Payload;
        switch (command.Type)
        {
            case "manual-receive":
            case "relocate":
            case "reserve-plan":
                await WorkspaceCommand(ct);
                break;
            case "receive":
                {
                    var doc = Doc(p.Text("document"), "po");
                    Scan(doc.ItemId);
                    var q = p.Quantity();
                    Require(q <= doc.Quantity - doc.Actual, "remainder");
                    var target = Position(doc.ItemId, "Receiving", "unassessed", "awaiting-qc");
                    Change(target, q, doc.Id);
                    doc.Actual += q;
                    doc.Status = doc.Actual == doc.Quantity ? "complete" : "partial";
                    AddDoc("inspection", doc.ItemId, q, transactionId).Status = "awaiting-qc";
                    break;
                }
            case "qc":
                {
                    Supervisor(actor);
                    var task = Doc(p.Text("task"), "inspection");
                    var good = p.Quantity("good", true);
                    var bad = p.Quantity("bad", true);
                    var remaining = task.Quantity - task.Actual;
                    Require(remaining > 0 && good + bad == remaining, "qc-total");
                    Require(bad == 0 || !string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                    var source = Position(task.ItemId, "Receiving", "unassessed", "awaiting-qc");
                    Require(source.OnHand >= remaining, "remainder");
                    Change(source, -remaining, task.Id);
                    if (good > 0)
                    {
                        Change(Position(task.ItemId, "Receiving"), good, task.Id);
                        AddDoc("putaway", task.ItemId, good, task.Id).Status = "ready";
                    }
                    if (bad > 0)
                        Change(Position(task.ItemId, "QC", "not-good", "quality-rejected"), bad, task.Id);
                    task.Actual = task.Quantity;
                    task.Status = "complete";
                    break;
                }
            case "putaway":
                {
                    var task = Doc(p.Text("task"), "putaway");
                    Scan(task.ItemId);
                    var q = p.Quantity();
                    var to = p.Text("destination");
                    VerifyLocation(to);
                    Require(locations.Any(l => l.WarehouseId == actor.WarehouseId && l.Code == to && l.Pickable), "scan-location", 400);
                    var source = Position(task.ItemId, "Receiving");
                    var target = Position(task.ItemId, to);
                    Require(q <= task.Quantity - task.Actual && q <= source.OnHand, "remainder");
                    Change(source, -q, task.Id);
                    Change(target, q, task.Id);
                    task.Actual += q;
                    task.Status = task.Actual == task.Quantity ? "complete" : "partial";
                    break;
                }
            case "approve-order":
            case "release-order":
            case "reject-order":
            case "reserve":
            case "pick":
            case "ship":
            case "cancel":
            case "return-stock":
                await Outbound(ct);
                break;
            case "transfer-send":
            case "transfer-receive":
            case "customer-return":
            case "supplier-return":
                await TransferOrReturn(ct);
                break;
            case "freeze":
            case "count-submit":
            case "recount":
            case "adjust-count":
            case "unfreeze":
                Count();
                break;
            case "opening":
                {
                    Supervisor(actor);
                    Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                    var item = Item(p.Text("sku"));
                    Scan(item.Id);
                    var q = p.Quantity();
                    Change(Position(item.Id, p.Text("location")), q, transactionId);
                    break;
                }
            case "erp-retry":
                {
                    Supervisor(actor);
                    Require(Guid.TryParse(p.Text("event"), out var eventId), "source", 400);
                    var e = await db.Outbox.SingleOrDefaultAsync(e => e.Id == eventId && e.WarehouseId == actor.WarehouseId, ct);
                    Require(e is not null && e.TransportStatus != "acknowledged", "task");
                    Require(e!.BusinessStatus != "accepted" && (e.LeaseUntil is null || e.LeaseUntil < now), "task");
                    e!.TransportStatus = "pending";
                    e.BusinessStatus = "unknown";
                    e.NextAttemptAt = now;
                    break;
                }
            default:
                throw new BusinessException("unsupported", 400);
        }
    }
}
