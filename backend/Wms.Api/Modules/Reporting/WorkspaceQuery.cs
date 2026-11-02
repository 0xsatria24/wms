using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;

namespace Wms.Modules.Reporting;

public sealed record WorkspaceQuery(string View = "overview", int Page = 1, int PageSize = 25, string Query = "", string Status = "", string Category = "", string Sku = "", string Location = "", string Condition = "", string Sort = "", bool Descending = false, string FocusSku = "", string FocusDocument = "", string From = "", string To = "", string RequestKey = "", int UsersPage = 1, int SupportingPage = 1);

public sealed class WorkspaceWindow
{
    public string[] ItemIds { get; private set; } = [];
    public string[] DocumentIds { get; private set; } = [];
    public object Metadata { get; private set; } = new { };

    public static async Task<WorkspaceWindow> Read(WmsDb db, ActingPrincipal actor, WorkspaceQuery input, CancellationToken ct)
    {
        Rules.Require(input.Query.Length <= 200 && input.RequestKey.Length <= 3000 && input.FocusSku.Length <= 200 && input.FocusDocument.Length <= 200, "required", 400);
        var size = Math.Clamp(input.PageSize, 1, 50);
        var search = input.Query.Trim().ToLowerInvariant();
        var from = WarehouseDates.Date(input.From);
        var to = WarehouseDates.Date(input.To);
        Rules.Require(!from.HasValue || !to.HasValue || from <= to, "required", 400);
        var items = db.Items.Where(i => i.CompanyId == "demo");
        var positions = db.Positions.Where(p => p.CompanyId == "demo" && p.OnHand > 0 && db.Locations.Any(l => l.Id == p.LocationId && l.WarehouseId == actor.WarehouseId));
        if (actor.Role == "operator")
            positions = positions.Where(p => !db.Documents.Any(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId && d.ItemId == p.ItemId && d.LocationId == p.LocationId));
        var scopedPositions = input.View == "stock" ? await positions.CountAsync(ct) : 0;
        var scopedItems = input.View == "stock" ? await positions.Select(p => p.ItemId).Distinct().CountAsync(ct) : 0;
        var rankedPositions = positions;
        var docs = db.Documents.Where(d => d.CompanyId == "demo" && (d.WarehouseId == actor.WarehouseId || d.TargetWarehouseId == actor.WarehouseId));
        var window = new WorkspaceWindow();
        string[] ids;
        int total;
        var totalPositions = scopedPositions;
        var scopeTotal = 0;
        var selectedInFilter = true;
        string[] statuses = [];
        string[] categories = [];
        if (input.View is "stock" or "master")
        {
            var filtered = items;
            if (input.View == "stock")
            {
                var matching = from p in positions join l in db.Locations on p.LocationId equals l.Id join i in items on p.ItemId equals i.Id
                    where (input.Location == "" || l.Code == input.Location) && (input.Condition == "" || p.Condition == input.Condition)
                        && (input.Status == "" || (input.Status == "frozen" ? l.Frozen : input.Status == "hold" ? p.Hold != "" : !l.Frozen && p.Hold == ""))
                        && (search == "" || (i.Sku + " " + i.Name + " " + i.Barcode + " " + l.Code + " " + p.Condition + " " + p.Hold + " " + p.Hold.Replace("-", " ") + (l.Frozen ? " frozen dibekukan" : "") + (p.Hold != "" ? " on hold ditahan" : "") + (p.Hold == "awaiting-qc" ? " menunggu qc" : "") + (p.Condition == "good" ? " bagus" : p.Condition == "not-good" ? " not good tidak bagus" : " not assessed belum dicek")).ToLower().Contains(search))
                    select p;
                totalPositions = await matching.CountAsync(ct);
                rankedPositions = matching;
                filtered = items.Where(i => matching.Any(p => p.ItemId == i.Id));
                scopeTotal = scopedItems;
            }
            else
            {
                scopeTotal = await items.CountAsync(ct);
                categories = await items.Select(i => i.Category).Distinct().OrderBy(c => c).Take(1000).ToArrayAsync(ct);
                filtered = filtered.Where(i => (search == "" || i.Sku.ToLower().Contains(search) || i.Name.ToLower().Contains(search) || i.Barcode.ToLower().Contains(search)) && (input.Status == "" || i.Active == (input.Status == "active")) && (input.Category == "" || i.Category == input.Category));
            }
            total = await filtered.CountAsync(ct);
            var page = Math.Clamp(input.Page, 1, Math.Max(1, (int)Math.Ceiling(total / (double)size)));
            var sorted = filtered.OrderBy(i => i.Name).ThenBy(i => i.Sku);
            if (input.Sort == "sku") sorted = filtered.OrderBy(i => i.Sku);
            if (input.Sort == "name-desc" || input.Descending && input.Sort == "item") sorted = filtered.OrderByDescending(i => i.Name).ThenBy(i => i.Sku);
            if (input.View == "stock" && input.Sort == "location")
                sorted = input.Descending ? filtered.OrderByDescending(i => rankedPositions.Where(p => p.ItemId == i.Id).Join(db.Locations, p => p.LocationId, l => l.Id, (p, l) => l.Code).Min()).ThenBy(i => i.Sku) : filtered.OrderBy(i => rankedPositions.Where(p => p.ItemId == i.Id).Join(db.Locations, p => p.LocationId, l => l.Id, (p, l) => l.Code).Min()).ThenBy(i => i.Sku);
            if (input.View == "stock" && input.Sort == "available")
            {
                var quantities = from i in filtered select new { Item = i, Available = rankedPositions.Where(p => p.ItemId == i.Id && p.Condition == "good" && p.Hold == "" && db.Locations.Any(l => l.Id == p.LocationId && l.Pickable && !l.Frozen)).Sum(p => p.OnHand - p.Committed) };
                var ranked = input.Descending ? quantities.OrderBy(x => x.Item.Unit).ThenByDescending(x => x.Available).ThenBy(x => x.Item.Sku) : quantities.OrderBy(x => x.Item.Unit).ThenBy(x => x.Available).ThenBy(x => x.Item.Sku);
                window.ItemIds = await ranked.Skip((page - 1) * size).Take(size).Select(x => x.Item.Id).ToArrayAsync(ct);
            }
            else window.ItemIds = await sorted.Skip((page - 1) * size).Take(size).Select(i => i.Id).ToArrayAsync(ct);
            ids = await items.Where(i => window.ItemIds.Contains(i.Id)).Select(i => i.Sku).ToArrayAsync(ct);
        }
        else
        {
            var kind = input.View switch { "receiving" => "po", "quality" => "inspection", "putaway" => "putaway", "orders" or "reservations" or "picking" or "shipping" => "order", "count" => "count", "transfers" or "transfer" => "transfer", _ => "" };
            if (kind != "") docs = docs.Where(d => d.Kind == kind);
            if (input.View == "returns") docs = docs.Where(d => d.Kind == "customer-return" || d.Kind == "supplier-return");
            if (input.View is "reservations" or "picking" or "shipping") docs = docs.Where(d => d.Status == "released");
            if (input.View is "quality" or "putaway") docs = docs.Where(d => d.Actual < d.Quantity);
            var projections = from d in docs join i in items on d.ItemId equals i.Id
                let allocated = db.Allocations.Where(a => a.OrderId == d.Id).Sum(a => a.Quantity)
                let staged = db.Allocations.Where(a => a.OrderId == d.Id && db.Positions.Any(p => p.Id == a.PositionId && db.Locations.Any(l => l.Id == p.LocationId && l.Code == "Staging"))).Sum(a => a.Quantity)
                let remaining = input.View == "receiving" || input.View == "quality" || input.View == "putaway" ? d.Quantity - d.Actual : input.View == "reservations" ? Math.Max(0, d.Quantity - d.Shipped - allocated) : input.View == "picking" ? allocated - staged : input.View == "shipping" ? staged : Math.Max(0, d.Quantity - d.Shipped)
                let ready = remaining > 0 && (input.View != "reservations" || positions.Any(p => p.ItemId == d.ItemId && p.Condition == "good" && p.Hold == "" && p.OnHand > p.Committed && db.Locations.Any(l => l.Id == p.LocationId && l.Pickable && !l.Frozen)))
                let status = input.View == "receiving" ? d.Actual == d.Quantity ? "received" : d.Actual > 0 ? "partially-received" : "not-received" : input.View == "quality" ? "awaiting-qc" : input.View == "putaway" ? "ready" : input.View == "reservations" || input.View == "picking" || input.View == "shipping" ? ready ? "ready" : "waiting" : d.Status
                select new { Document = d, Item = i, Remaining = remaining, Status = status };
            scopeTotal = await projections.CountAsync(ct);
            statuses = await projections.Select(x => x.Status).Distinct().OrderBy(s => s).ToArrayAsync(ct);
            var filtered = projections.Where(x => (search == "" || (x.Document.Id + " " + x.Document.Source + " " + x.Item.Sku + " " + x.Item.Name).ToLower().Contains(search)) && (input.Sku == "" || x.Item.Sku == input.Sku) && (input.Status == "" || x.Status == input.Status));
            if (from.HasValue) filtered = filtered.Where(x => x.Document.DocumentDate >= from.Value);
            if (to.HasValue) filtered = filtered.Where(x => x.Document.DocumentDate <= to.Value);
            total = await filtered.CountAsync(ct);
            var page = Math.Clamp(input.Page, 1, Math.Max(1, (int)Math.Ceiling(total / (double)size)));
            var sorted = filtered.OrderBy(x => x.Document.Id);
            if (input.Sort == "document-desc") sorted = filtered.OrderByDescending(x => x.Document.Id);
            if (input.Sort == "item") sorted = filtered.OrderBy(x => x.Item.Name).ThenBy(x => x.Document.Id);
            if (input.Sort == "remaining-desc") sorted = filtered.OrderByDescending(x => x.Remaining).ThenBy(x => x.Document.Id);
            ids = await sorted.Skip((page - 1) * size).Take(size).Select(x => x.Document.Id).ToArrayAsync(ct);
            window.DocumentIds = ids;
            window.ItemIds = await docs.Where(d => ids.Contains(d.Id)).Select(d => d.ItemId).Distinct().ToArrayAsync(ct);
            selectedInFilter = input.FocusDocument == "" || await filtered.AnyAsync(x => x.Document.Id == input.FocusDocument, ct);
            if (input.FocusDocument != "")
                window.DocumentIds = window.DocumentIds.Concat(await docs.Where(d => d.Id == input.FocusDocument).Select(d => d.Id).ToArrayAsync(ct)).Distinct().ToArray();
        }
        var finalPage = Math.Clamp(input.Page, 1, Math.Max(1, (int)Math.Ceiling(total / (double)size)));
        var relatedItems = await db.Documents.Where(d => window.DocumentIds.Contains(d.Id)).Select(d => d.ItemId).ToArrayAsync(ct);
        var lookup = input.FocusSku.Trim().ToLowerInvariant();
        var lookupItems = lookup == "" ? Array.Empty<string>() : await items.Where(i => i.Sku.ToLower().Contains(lookup) || i.Barcode.ToLower().Contains(lookup) || i.Name.ToLower().Contains(lookup)).OrderBy(i => i.Sku).Take(50).Select(i => i.Id).ToArrayAsync(ct);
        if ((window.ItemIds.Length == 0 || input.View == "overview") && lookup == "" && input.View is not "stock" and not "master")
            lookupItems = await items.OrderBy(i => i.Sku).Take(25).Select(i => i.Id).ToArrayAsync(ct);
        window.ItemIds = window.ItemIds.Concat(relatedItems).Concat(lookupItems).Distinct().ToArray();
        window.Metadata = new { view = input.View, requestKey = input.RequestKey, ids, total, scopeTotal, page = finalPage, pages = Math.Max(1, (int)Math.Ceiling(total / (double)size)), from = total == 0 ? 0 : (finalPage - 1) * size + 1, to = Math.Min(finalPage * size, total), totalItems = total, totalPositions, scopedItems, scopedPositions, statuses, categories, selectedInFilter };
        return window;
    }
}
