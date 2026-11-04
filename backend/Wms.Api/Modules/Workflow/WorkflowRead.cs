using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Workflow;

public sealed partial class WorkflowService
{
    public async Task<object> Read(ActingPrincipal actor, WorkflowQuery input, CancellationToken ct)
    {
        Require(input.Query.Length <= 200 && input.Sku.Length <= 200 && input.Document.Length <= 200 && input.Status.Length <= 80, "required", 400);
        Require(input.SelectedItems.Length <= 12000, "required", 400);
        string[] selectedSkus = [];
        if (input.SelectedItems.Length > 0) { try { selectedSkus = JsonSerializer.Deserialize<string[]>(input.SelectedItems) ?? []; } catch (JsonException) { throw new BusinessException("required", 400); } Require(selectedSkus.Length <= 50 && selectedSkus.All(s => s is not null && s.Length <= 200), "required", 400); }
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        await Authorize(actor, false, ct);
        var locations = await db.Locations.AsNoTracking().Where(l => l.WarehouseId == actor.WarehouseId).ToDictionaryAsync(l => l.Id, ct);
        var hiddenItems = actor.Role == "operator" ? await db.Documents.Where(d => d.WarehouseId == actor.WarehouseId && d.Kind == "count" && d.Status != "closed").Select(d => d.ItemId).Distinct().ToArrayAsync(ct) : [];
        var itemQuery = db.Items.AsNoTracking().Where(i => i.CompanyId == "demo");
        if (input.Sku.Length > 0) itemQuery = itemQuery.Where(i => i.Sku == input.Sku);
        if (input.Query.Length > 0 && (input.View is "stock" or "items" or "history")) itemQuery = itemQuery.Where(i => i.Sku.Contains(input.Query) || i.Name.Contains(input.Query) || i.Barcode.Contains(input.Query));
        var itemTotal = await itemQuery.CountAsync(ct); var page = Math.Clamp(input.Page, 1, 1000000);
        var items = await itemQuery.OrderBy(i => i.Sku).Skip((page - 1) * 25).Take(25).ToListAsync(ct);
        if (input.View == "items" && input.Query.Length > 0) items = items.Concat(await db.Items.AsNoTracking().Where(i => i.CompanyId == "demo" && (i.Sku == input.Query || i.Barcode == input.Query)).ToListAsync(ct)).DistinctBy(i => i.Id).ToList();
        items = items.Concat(await db.Items.AsNoTracking().Where(i => i.CompanyId == "demo" && selectedSkus.Contains(i.Sku)).ToListAsync(ct)).DistinctBy(i => i.Id).ToList();
        var identityCodes=selectedSkus.Append(input.Sku).Where(s=>s.Length>0).Distinct().ToArray();
        items=items.Concat(await db.Items.AsNoTracking().Where(i=>i.CompanyId=="demo"&&(identityCodes.Contains(i.Sku)||identityCodes.Contains(i.Barcode))).ToListAsync(ct)).DistinctBy(i=>i.Id).ToList();
        var docQuery = db.Documents.AsNoTracking().Where(d => d.WarehouseId == actor.WarehouseId && !hiddenItems.Contains(d.ItemId) && d.Kind != "count");
        if (input.Sku.Length > 0) docQuery = docQuery.Where(d => db.Items.Any(i => i.Id == d.ItemId && i.Sku == input.Sku));
        if (input.View == "receiving") docQuery = docQuery.Where(d => d.Kind == "po" || d.Kind == "receipt-line");
        if (input.View == "quality") docQuery = docQuery.Where(d => d.Kind == "inspection");
        if (input.View == "putaway") docQuery = docQuery.Where(d => d.Kind == "putaway");
        if (input.View is "orders" or "reservation" or "pick" or "ship") docQuery = docQuery.Where(d => d.Kind == "order");
        if (input.Status.Length > 0) docQuery = docQuery.Where(d => d.Status == input.Status);
        if (input.Query.Length > 0 && input.View is not ("stock" or "items" or "history")) docQuery = docQuery.Where(d => d.Id.Contains(input.Query) || d.Source.Contains(input.Query) || db.Items.Any(i => i.Id == d.ItemId && (i.Name.Contains(input.Query) || i.Sku.Contains(input.Query) || i.Barcode.Contains(input.Query))));
        var documentTotal = await docQuery.CountAsync(ct);
        var documents = await docQuery.OrderByDescending(d => d.CreatedAt).ThenBy(d => d.Id).Skip((page - 1) * 25).Take(25).ToListAsync(ct);
        string[] lineageIds = [];
        if (input.Document.Length > 0)
        {
            var receiptTransactions = await db.Audit.Where(a => a.WarehouseId == actor.WarehouseId && a.Action == "receive" && EF.Functions.JsonContains(a.DetailJson, JsonSerializer.Serialize(new { document = input.Document }))).Select(a => a.TransactionId).ToArrayAsync(ct);
            // Exact lineage remains reachable even when an older document falls outside a catalogue page.
            var related = await db.Documents.AsNoTracking().Where(d => d.WarehouseId == actor.WarehouseId && !hiddenItems.Contains(d.ItemId) && d.Kind != "count" && (d.Id == input.Document || d.Source == input.Document || receiptTransactions.Contains(d.Source))).ToListAsync(ct);
            var ids = related.Select(d => d.Id).ToArray();
            var children = await db.Documents.AsNoTracking().Where(d => d.WarehouseId == actor.WarehouseId && !hiddenItems.Contains(d.ItemId) && d.Kind != "count" && ids.Contains(d.Source)).ToListAsync(ct);
            var childIds = children.Select(d => d.Id).ToArray();
            var grandchildren = await db.Documents.AsNoTracking().Where(d => d.WarehouseId == actor.WarehouseId && !hiddenItems.Contains(d.ItemId) && d.Kind != "count" && childIds.Contains(d.Source)).ToListAsync(ct);
            lineageIds = related.Concat(children).Concat(grandchildren).Select(d => d.Id).Distinct().ToArray();
            documents = documents.Concat(related).Concat(children).Concat(grandchildren).DistinctBy(d => d.Id).ToList();
        }
        var docItems = documents.Select(d => d.ItemId).ToArray();
        items = items.Concat(await db.Items.AsNoTracking().Where(i => i.CompanyId == "demo" && docItems.Contains(i.Id)).ToListAsync(ct)).DistinctBy(i => i.Id).ToList();
        var itemIds = items.Select(i => i.Id).ToArray(); var itemMap = items.ToDictionary(i => i.Id);
        var positions = await db.Positions.AsNoTracking().Where(p => itemIds.Contains(p.ItemId) && !hiddenItems.Contains(p.ItemId) && db.Locations.Any(l => l.Id == p.LocationId && l.WarehouseId == actor.WarehouseId)).ToListAsync(ct);
        var docIds = documents.Select(d => d.Id).ToArray();
        var qcTotals = await (from entry in db.Entries join movement in db.Movements on entry.MovementId equals movement.Id join position in db.Positions on entry.PositionId equals position.Id
            where movement.WarehouseId == actor.WarehouseId && movement.Kind == "qc" && docIds.Contains(movement.Source)
            group new { entry, position } by movement.Source into task
            select new { Id = task.Key, Good = task.Sum(x => x.entry.QuantityDelta > 0 && x.position.Condition == "good" ? x.entry.QuantityDelta : 0), Bad = task.Sum(x => x.entry.QuantityDelta > 0 && x.position.Condition == "not-good" ? x.entry.QuantityDelta : 0) }).ToDictionaryAsync(x => x.Id, ct);
        var allocations = await db.Allocations.AsNoTracking().Where(a => docIds.Contains(a.OrderId) && a.Status == "active").ToListAsync(ct);
        var allocationIds = allocations.Select(a => a.PositionId).ToArray();
        var allocationPositions = await db.Positions.AsNoTracking().Where(p => allocationIds.Contains(p.Id) && db.Locations.Any(l => l.Id == p.LocationId && l.WarehouseId == actor.WarehouseId)).ToDictionaryAsync(p => p.Id, ct);
        var headerIds = documents.Where(d => d.Kind == "receipt-line").Select(d => d.Source).Append(input.Document).ToArray();
        var headers = await db.SupportingRecords.AsNoTracking().Where(r => r.WarehouseId == actor.WarehouseId && r.Kind == "receipt-header" && headerIds.Contains(r.Id)).Select(r => r.PayloadJson).ToListAsync(ct);
        var hiddenSkus = await db.Items.Where(i => hiddenItems.Contains(i.Id)).Select(i => i.Sku).ToArrayAsync(ct);
        var historyQuery = from e in db.Entries.AsNoTracking() join m in db.Movements.AsNoTracking() on e.MovementId equals m.Id join p in db.Positions.AsNoTracking() on e.PositionId equals p.Id join l in db.Locations.AsNoTracking() on p.LocationId equals l.Id join i in db.Items.AsNoTracking() on p.ItemId equals i.Id
            where l.WarehouseId == actor.WarehouseId && !hiddenItems.Contains(i.Id) && (input.Sku == "" || i.Sku == input.Sku) && (input.Query == "" || i.Name.Contains(input.Query) || i.Sku.Contains(input.Query) || m.Source.Contains(input.Query))
            select new { e.Id, transaction = m.Id, source = m.Source, type = m.Kind, sku = i.Sku, location = l.Code, qty = e.QuantityDelta, unit = e.Unit, actor = m.Actor, postedAt = m.PostedAt };
        var historyTotal = await historyQuery.CountAsync(ct); var historyPage = Math.Clamp(input.HistoryPage, 1, 1000000);
        var history = await historyQuery.OrderByDescending(h => h.postedAt).ThenBy(h => h.Id).Skip((historyPage - 1) * 25).Take(25).ToListAsync(ct);
        var proposalQuery = db.SupportingRecords.AsNoTracking().Where(r => r.WarehouseId == actor.WarehouseId && r.Kind == "item-proposal");
        if (actor.Role is not ("admin" or "supervisor")) { var owner = JsonSerializer.Serialize(new { owner = actor.Id }); proposalQuery = proposalQuery.Where(r => EF.Functions.JsonContains(r.PayloadJson, owner)); }
        var proposalTotal = await proposalQuery.CountAsync(ct);
        var proposalPage = Math.Clamp(input.ProposalPage,1,Math.Max(1,(proposalTotal+24)/25));
        var proposals = await proposalQuery.OrderBy(r => r.Id).Skip((proposalPage - 1) * 25).Take(25).ToListAsync(ct);
        if (input.Proposal.Length > 0) { Identity(input.Proposal); var exact = await proposalQuery.Where(r => r.Id == "item-proposal|" + actor.WarehouseId + "|" + input.Proposal).ToListAsync(ct); proposals = proposals.Concat(exact).DistinctBy(r=>r.Id).ToList(); }
        var approvals = (await OperationalSettings.Read(db, "approvals", actor.WarehouseId, new ApprovalSettings(), ct)).Value;
        var result = new
        {
            role = actor.Role, warehouse = actor.WarehouseId, lineageIds,
            capabilities = new { operate = actor.Role is "operator" or "supervisor" or "admin", master = actor.Role is "supervisor" or "admin", qc = actor.Role is "supervisor" or "admin", orderReview = actor.Role == "admin" || actor.Role == "supervisor" && approvals.OrderReview != "admin", administer = actor.Role == "admin" },
            items = items.Select(i => new { id = i.Id, sku = i.Sku, name = i.Name, barcode = i.Barcode, unit = i.Unit, category = i.Category, active = i.Active, version = i.Version, restricted = hiddenItems.Contains(i.Id) }),
            positions = positions.Select(p => new { id = p.Id, sku = itemMap[p.ItemId].Sku, location = locations[p.LocationId].Code, condition = p.Condition, hold = p.Hold, frozen = locations[p.LocationId].Frozen, pickable = locations[p.LocationId].Pickable, qty = Number(p.OnHand), reserved = Number(p.Committed), available = Number(p.Condition == "good" && p.Hold == "" && locations[p.LocationId].Pickable && !locations[p.LocationId].Frozen ? p.OnHand - p.Committed : 0), unit = itemMap[p.ItemId].Unit, version = p.Version }),
            locations = locations.Values.Select(l => new { id = l.Id, code = l.Code, pickable = l.Pickable, frozen = l.Frozen, version = l.Version }),
            documents = documents.Select(d => new { id = d.Id, kind = d.Kind, source = d.Source, sku = itemMap.GetValueOrDefault(d.ItemId)?.Sku ?? "", name = itemMap.GetValueOrDefault(d.ItemId)?.Name ?? "", unit = itemMap.GetValueOrDefault(d.ItemId)?.Unit ?? "", qty = Number(d.Quantity), actual = Number(d.Actual), qcGood = Number(qcTotals.GetValueOrDefault(d.Id)?.Good ?? 0), qcBad = Number(qcTotals.GetValueOrDefault(d.Id)?.Bad ?? 0), picked = Number(d.Picked), shipped = Number(d.Shipped), returned = Number(d.Returned), status = d.Status, creator = d.Creator, reason = d.Reason, version = d.Version, createdAt = d.CreatedAt, updatedAt = d.UpdatedAt, completedAt = d.CompletedAt, allocations = allocations.Where(a => a.OrderId == d.Id && allocationPositions.ContainsKey(a.PositionId)).Select(a => new { position = a.PositionId, location = locations[allocationPositions[a.PositionId].LocationId].Code, qty = Number(a.Quantity) }) }),
            headers = headers.Select(Parse).Where(h => !h.GetProperty("lines").EnumerateArray().Any(l => hiddenSkus.Contains(l.Text("sku")))),
            history = history.Select(h => new { id = h.Id, h.transaction, h.source, h.type, h.sku, h.location, qty = Number(h.qty), h.unit, h.actor, h.postedAt }),
            itemPage = new { page, total = itemTotal, pages = Math.Max(1, (itemTotal + 24) / 25) }, documentPage = new { page, total = documentTotal, pages = Math.Max(1, (documentTotal + 24) / 25) }, historyPage = new { page = historyPage, total = historyTotal, pages = Math.Max(1, (historyTotal + 24) / 25) },
            proposals = proposals.Select(ProposalDto), proposalPage = new { page = proposalPage, total = proposalTotal, pages = Math.Max(1, (proposalTotal + 24) / 25) },
            partialAllowed = await db.Settings.Where(s => s.CompanyId == "demo").Select(s => s.PartialAllowed).SingleAsync(ct)
        };
        // Materialize JSON before disposing the repeatable-read transaction.
        var materialized = JsonSerializer.SerializeToElement(result); await tx.CommitAsync(ct); return materialized;
    }
}
