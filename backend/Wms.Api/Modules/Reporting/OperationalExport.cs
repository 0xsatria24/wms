using System.Collections.Concurrent;
using System.Data;
using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Modules.Settings;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Reporting;

public sealed record ExportRequest(string Type, string Format = "pdf", string Scope = "all", string[]? Ids = null,
    string? DocumentId = null, long? Version = null, string? TransactionId = null, string? Sku = null,
    string? Location = null, string? Condition = null, string? Status = null, string? Query = null,
    string? From = null, string? To = null, string? Sort = null, bool Descending = false, string Locale = "en");
public sealed record ExportResult(byte[] Bytes, string ContentType, string Filename);
public sealed record ExportEvent(string Id, string Kind, DateTimeOffset Posted, string Quantity);

public sealed class OperationalExport(WmsDb db)
{
    private static readonly ConcurrentDictionary<string, byte> Active = new();
    private sealed class Line { public StockEntry Entry { get; set; } = null!; public StockMovement Movement { get; set; } = null!; public StockPosition Position { get; set; } = null!; public Location Location { get; set; } = null!; public Item Item { get; set; } = null!; }
    private sealed class PositionRow { public StockPosition Position { get; set; } = null!; public Location Location { get; set; } = null!; public Item Item { get; set; } = null!; }
    private string[] headers = [];
    private List<string[]> rows = [];
    private Dictionary<string, string> meta = [];
    private string title = "";
    private bool id;
    private string T(string en, string ind) => id ? ind : en;
    private static string N(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
    private static string D(DateTimeOffset? value) => value?.ToString("O") ?? "";
    private void Table(string[] names, IEnumerable<string[]> values) { headers = names; rows = values.ToList(); }
    private async Task Authorize(ActingPrincipal actor, CancellationToken ct) => Require(
        await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct) &&
        await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
    private IQueryable<Line> Lines() => from e in db.Entries.AsNoTracking()
        join m in db.Movements.AsNoTracking() on e.MovementId equals m.Id
        join p in db.Positions.AsNoTracking() on e.PositionId equals p.Id
        join l in db.Locations.AsNoTracking() on p.LocationId equals l.Id
        join i in db.Items.AsNoTracking() on p.ItemId equals i.Id
        where m.CompanyId == "demo" && p.CompanyId == "demo" && i.CompanyId == "demo"
        select new Line { Entry = e, Movement = m, Position = p, Location = l, Item = i };
    private async Task Blind(ActingPrincipal actor, IEnumerable<(string Item, string Location)> positions, CancellationToken ct)
    {
        if (actor.Role != "operator") return;
        var blocked = await db.Documents.AsNoTracking().Where(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId).Select(d => new { d.ItemId, d.LocationId }).ToListAsync(ct);
        Require(!positions.Any(p => blocked.Any(b => b.ItemId == p.Item && b.LocationId == p.Location)), "blind-count", 403);
    }
    private static bool Match(string? query, params string[] values) => string.IsNullOrWhiteSpace(query) || string.Join(" ", values).Contains(query.Trim(), StringComparison.OrdinalIgnoreCase);
    private (DateTimeOffset? Start, DateTimeOffset? End) Period(ExportRequest r, string zone)
    {
        var from = WarehouseDates.Date(r.From); var to = WarehouseDates.Date(r.To);
        Require(!from.HasValue || !to.HasValue || from <= to, "required", 400);
        return (from.HasValue ? WarehouseDates.Start(from.Value, zone) : null, to.HasValue ? WarehouseDates.Start(to.Value.AddDays(1), zone) : null);
    }
    public async Task<ExportResult> Create(ActingPrincipal actor, ExportRequest r, CancellationToken cancellationToken)
    {
        Require(r.Type is "stock" or "ledger" or "count-sheet" or "count-review" or "count-report" or "packing" or "ship" or "receive" or "manual-receive" or "receive-summary" or "transfer-send" or "transfer-receive" or "transfer-summary" or "customer-return" or "supplier-return", "required", 400);
        Require(r.Locale is "en" or "id" && r.Scope is "all" or "selected", "required", 400);
        Require(r.Type is "stock" or "ledger" ? r.Format is "csv" or "xlsx" : r.Type == "count-review" ? r.Format == "xlsx" : r.Format == "pdf", "required", 400);
        Require(Active.TryAdd(actor.Id, 0), "export-busy", 409);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(60)); var ct = timeout.Token;
        var exportId = ReferenceId.New(); var result = "failed";
        try
        {
            await Authorize(actor, ct); id = r.Locale == "id";
            await using (var tx = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct))
            {
                var now = DateTimeOffset.UtcNow;
                var wh = await db.Warehouses.AsNoTracking().SingleAsync(w => w.Id == actor.WarehouseId, ct);
                var zone = (await OperationalSettings.Read(db, "warehouse", actor.WarehouseId, new WarehouseDetails(), ct)).Value.TimeZone;
                var company = (await OperationalSettings.Read(db, "company", "demo", new OrganizationProfile(), ct)).Value.Name;
                var principal = await db.Principals.AsNoTracking().SingleAsync(p => p.Id == actor.Id, ct);
                meta = new() { ["ExportId"] = exportId, ["ReportType"] = r.Type, ["TemplateVersion"] = "2", ["Company"] = company,
                    ["WarehouseId"] = wh.Id, ["WarehouseName"] = wh.Name, ["SnapshotAtUTC"] = now.ToString("O"), ["GeneratedAtUTC"] = now.ToString("O"),
                    ["WarehouseTimeZone"] = zone, ["Locale"] = r.Locale, ["Scope"] = r.Scope, ["GeneratedBy"] = principal.Name, ["ActorId"] = actor.Id,
                    ["Query"] = r.Query ?? "", ["Location"] = r.Location ?? "", ["Condition"] = r.Condition ?? "", ["Status"] = r.Status ?? "",
                    ["PeriodFrom"] = r.From ?? "", ["PeriodTo"] = r.To ?? "", ["Sort"] = r.Sort ?? "", ["Descending"] = r.Descending.ToString() };
                var period = Period(r, zone);
                if (r.Type == "stock") await Stock(actor, r, ct);
                else if (r.Type == "ledger") await Ledger(actor, r, period, ct);
                else if (r.Type.StartsWith("count-")) await Count(actor, r, period, ct);
                else await Document(actor, r, ct);
                Require(rows.Count > 0, "export-empty", 409);
                Require(rows.Count <= (r.Format == "pdf" ? 500 : 50000), "export-limit", 413);
                meta["RowCount"] = rows.Count.ToString(CultureInfo.InvariantCulture);
                await tx.CommitAsync(ct);
            }
            ct.ThrowIfCancellationRequested();
            var bytes = r.Format switch { "csv" => ExportFileWriter.Csv(headers, rows, meta), "xlsx" => ExportFileWriter.Xlsx(headers, rows, meta), _ => ExportFileWriter.Pdf(title, headers, rows, meta) };
            ct.ThrowIfCancellationRequested(); await Authorize(actor, ct);
            result = "generated";
            return new(bytes, r.Format == "csv" ? "text/csv; charset=utf-8" : r.Format == "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf", $"{r.Type}_{exportId}.{r.Format}");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested) { result = "failed"; throw new BusinessException("export-timeout", 408); }
        catch (OperationCanceledException) { result = "cancelled"; throw; }
        catch (BusinessException ex) when (ex.Status == 403) { result = "denied"; throw; }
        finally
        {
            try
            {
                db.ChangeTracker.Clear();
                db.SupportingRecords.Add(new SupportingRecord { Id = exportId, WarehouseId = actor.WarehouseId, Kind = "export-audit", PayloadJson = JsonSerializer.Serialize(new { exportId, actor = actor.Id, type = r.Type, format = r.Format, scope = r.Scope, documentId = r.DocumentId, sourceVersion = r.Version, transactionId = r.TransactionId, filters = new { r.Sku, r.Location, r.Condition, r.Status, r.Query, r.From, r.To, r.Sort, r.Descending }, snapshotAtUTC = meta.GetValueOrDefault("SnapshotAtUTC"), at = DateTimeOffset.UtcNow, result, rowCount = result == "generated" ? rows.Count : (int?)null, templateVersion = "2" }) });
                using var logTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(5)); await db.SaveChangesAsync(logTimeout.Token);
            }
            finally { Active.TryRemove(actor.Id, out _); }
        }
    }
    private async Task Stock(ActingPrincipal actor, ExportRequest r, CancellationToken ct)
    {
        var source = from p in db.Positions.AsNoTracking() join l in db.Locations on p.LocationId equals l.Id join i in db.Items on p.ItemId equals i.Id
            where p.CompanyId == "demo" && l.WarehouseId == actor.WarehouseId && p.OnHand > 0
            select new PositionRow { Position = p, Location = l, Item = i };
        if (!string.IsNullOrEmpty(r.Location)) source = source.Where(x => x.Location.Code == r.Location);
        if (!string.IsNullOrEmpty(r.Condition)) source = source.Where(x => x.Position.Condition == r.Condition);
        if (!string.IsNullOrEmpty(r.Status)) source = r.Status == "frozen" ? source.Where(x => x.Location.Frozen) : r.Status == "hold" ? source.Where(x => x.Position.Hold != "") : source.Where(x => !x.Location.Frozen && x.Position.Hold == "");
        if (r.Scope == "selected") { var selected = r.Ids ?? []; source = source.Where(x => selected.Contains(x.Item.Sku)); }
        if (!string.IsNullOrWhiteSpace(r.Query)) { var search = r.Query.Trim().ToLowerInvariant(); source = source.Where(x => (x.Item.Sku + " " + x.Item.Name + " " + x.Item.Barcode + " " + x.Location.Code + " " + x.Position.Condition + " " + x.Position.Hold + " " + x.Position.Hold.Replace("-", " ") + " " + (x.Position.Hold == "awaiting-qc" ? "menunggu qc" : "") + " " + (x.Location.Frozen ? "frozen dibekukan" : "") + " " + (x.Position.Hold != "" ? "on hold ditahan" : "") + " " + (x.Position.Condition == "good" ? "bagus" : x.Position.Condition == "not-good" ? "not good tidak bagus" : "not assessed belum dicek")).ToLower().Contains(search)); }
        var data = await source.Take(50001).ToListAsync(ct);
        Require(data.Count <= 50000, "export-limit", 413);
        var matching = data.Where(x => (string.IsNullOrEmpty(r.Location) || x.Location.Code == r.Location) && (string.IsNullOrEmpty(r.Condition) || x.Position.Condition == r.Condition)
            && (string.IsNullOrEmpty(r.Status) || (r.Status == "frozen" ? x.Location.Frozen : r.Status == "hold" ? x.Position.Hold != "" : !x.Location.Frozen && x.Position.Hold == ""))
            && Match(r.Query, x.Item.Sku, x.Item.Name, x.Item.Barcode, x.Location.Code, x.Position.Condition, x.Position.Hold, x.Position.Hold.Replace('-', ' '), x.Position.Hold == "awaiting-qc" ? "menunggu qc" : "", x.Location.Frozen ? "frozen dibekukan" : "", x.Position.Hold != "" ? "on hold ditahan" : "", x.Position.Condition == "good" ? "bagus" : x.Position.Condition == "not-good" ? "not good tidak bagus" : "not assessed belum dicek")).ToList();
        if (r.Scope == "selected") { var ids = r.Ids ?? []; Require(ids.Length > 0 && ids.Distinct().Count() == ids.Length && ids.All(s => matching.Any(x => x.Item.Sku == s)), "conflict", 409); matching = matching.Where(x => ids.Contains(x.Item.Sku)).ToList(); }
        Require(matching.Count <= 50000, "export-limit", 413);
        await Blind(actor, matching.Select(x => (x.Item.Id, x.Location.Id)), ct);
        var groups = matching.GroupBy(x => x.Item.Sku).Select(g => new {
            Sku = g.Key, Name = g.First().Item.Name, Unit = g.First().Item.Unit,
            Location = g.Select(x => x.Location.Code).Order().First(),
            Available = g.Where(x => x.Position.Condition == "good" && x.Position.Hold == "" && !x.Location.Frozen && x.Location.Pickable).Sum(x => x.Position.OnHand - x.Position.Committed),
            Rows = g.OrderBy(x => x.Location.Code).ThenBy(x => x.Position.Condition).ThenBy(x => x.Position.Hold).ThenBy(x => x.Position.Id)
        });
        var ranked = r.Sort switch {
            "available" => r.Descending ? groups.OrderBy(g => g.Unit).ThenByDescending(g => g.Available).ThenBy(g => g.Sku) : groups.OrderBy(g => g.Unit).ThenBy(g => g.Available).ThenBy(g => g.Sku),
            "location" => r.Descending ? groups.OrderByDescending(g => g.Location).ThenBy(g => g.Sku) : groups.OrderBy(g => g.Location).ThenBy(g => g.Sku),
            "sku" => groups.OrderBy(g => g.Sku),
            _ => r.Descending || r.Sort == "name-desc" ? groups.OrderByDescending(g => g.Name).ThenBy(g => g.Sku) : groups.OrderBy(g => g.Name).ThenBy(g => g.Sku)
        };
        var ordered = ranked.SelectMany(g => g.Rows).ToList();
        var positionIds = ordered.Select(x => x.Position.Id).ToArray();
        var last = await db.Entries.Where(e => positionIds.Contains(e.PositionId)).Join(db.Movements, e => e.MovementId, m => m.Id, (e, m) => new { e.PositionId, m.PostedAt }).GroupBy(x => x.PositionId).Select(g => new { Id = g.Key, At = g.Max(x => x.PostedAt) }).ToDictionaryAsync(x => x.Id, x => x.At, ct);
        meta["SKUCount"] = ordered.Select(x => x.Item.Sku).Distinct().Count().ToString(); title = T("Stock position", "Posisi stok");
        Table(["WarehouseId", "WarehouseName", "PositionId", "SKU", "ItemName", "Location", "Condition", "Hold", "Frozen", "Pickable", "OnHand", "Reserved", "Available", "Unit", "LastPostedMovementAt"], ordered.Select(x => new[] { actor.WarehouseId, meta["WarehouseName"], x.Position.Id, x.Item.Sku, x.Item.Name, x.Location.Code, x.Position.Condition, x.Position.Hold, x.Location.Frozen.ToString(), x.Location.Pickable.ToString(), N(x.Position.OnHand), N(x.Position.Committed), N(x.Position.Condition == "good" && x.Position.Hold == "" && !x.Location.Frozen && x.Location.Pickable ? x.Position.OnHand - x.Position.Committed : 0), x.Item.Unit, last.TryGetValue(x.Position.Id, out var at) ? D(at) : "" }));
    }
    private async Task Ledger(ActingPrincipal actor, ExportRequest r, (DateTimeOffset? Start, DateTimeOffset? End) period, CancellationToken ct)
    {
        Require(!string.IsNullOrWhiteSpace(r.Sku), "required", 400);
        var query = Lines().Where(x => x.Location.WarehouseId == actor.WarehouseId && x.Item.Sku == r.Sku && (r.Location == null || r.Location == "" || x.Location.Code == r.Location));
        // Protect an active blind scope even if a date/search filter would hide all its entries.
        var positions = await db.Positions.Where(p => db.Items.Any(i => i.Id == p.ItemId && i.Sku == r.Sku) && db.Locations.Any(l => l.Id == p.LocationId && l.WarehouseId == actor.WarehouseId && (r.Location == null || r.Location == "" || l.Code == r.Location))).Select(p => new { p.ItemId, p.LocationId }).ToListAsync(ct);
        await Blind(actor, positions.Select(p => (p.ItemId, p.LocationId)), ct);
        if (period.Start.HasValue) query = query.Where(x => x.Movement.PostedAt >= period.Start);
        if (period.End.HasValue) query = query.Where(x => x.Movement.PostedAt < period.End);
        if (!string.IsNullOrEmpty(r.Query)) { var search = r.Query.ToLowerInvariant(); query = query.Where(x => x.Movement.Id.ToLower().Contains(search) || x.Movement.Source.ToLower().Contains(search) || x.Movement.Kind.ToLower().Contains(search) || x.Entry.Id.ToString().ToLower().Contains(search)); }
        var data = await query.OrderBy(x => x.Movement.PostedAt).ThenBy(x => x.Entry.Id).Take(50001).ToListAsync(ct);
        title = T("Stock movements", "Kartu stok");
        Table(["WarehouseId", "WarehouseName", "SKU", "ItemName", "EntryId", "TransactionId", "SourceReference", "MovementType", "Location", "QuantityDelta", "Unit", "ConversionFactor", "OccurredAt", "PostedAt", "ActorId", "Reason"], data.Select(x => new[] { actor.WarehouseId, meta["WarehouseName"], x.Item.Sku, x.Item.Name, x.Entry.Id.ToString(), x.Movement.Id, x.Movement.Source, x.Movement.Kind, x.Location.Code, N(x.Entry.QuantityDelta), x.Entry.Unit, N(x.Entry.ConversionFactor), D(x.Movement.OccurredAt), D(x.Movement.PostedAt), x.Movement.Actor, x.Movement.Reason }));
    }
    private async Task<OperationalDocument> Source(ActingPrincipal actor, ExportRequest r, CancellationToken ct)
    {
        var doc = await db.Documents.AsNoTracking().SingleOrDefaultAsync(d => d.Id == r.DocumentId && d.CompanyId == "demo" && (d.WarehouseId == actor.WarehouseId || d.Kind == "transfer" && d.TargetWarehouseId == actor.WarehouseId), ct);
        Require(doc != null, "source", 404); Require(r.Version.HasValue && doc!.Version == r.Version.Value, "conflict", 409);
        meta["SourceReference"] = doc!.Id; meta["SourceVersion"] = doc.Version.ToString(); meta["SourceStatus"] = doc.Status; meta["DocumentDate"] = doc.DocumentDate?.ToString("yyyy-MM-dd") ?? "";
        return doc;
    }
    private async Task Count(ActingPrincipal actor, ExportRequest r, (DateTimeOffset? Start, DateTimeOffset? End) period, CancellationToken ct)
    {
        if (r.Type != "count-sheet") { var settings = (await OperationalSettings.Read(db, "approvals", actor.WarehouseId, new ApprovalSettings(), ct)).Value; Require(actor.Role == "admin" || actor.Role == "supervisor" && settings.CountReview != "admin", "denied", 403); }
        else Require(actor.Role is "admin" or "supervisor" or "operator", "denied", 403);
        List<OperationalDocument> docs;
        if (!string.IsNullOrEmpty(r.DocumentId)) docs = [await Source(actor, r, ct)];
        else
        {
            Require(r.Type == "count-review", "required", 400);
            var query = db.Documents.AsNoTracking().Where(d => d.CompanyId == "demo" && d.WarehouseId == actor.WarehouseId && d.Kind == "count" && (d.Status == "review" || d.Status == "adjusted" || d.Status == "closed"));
            if (period.Start.HasValue) query = query.Where(d => d.SubmittedAt >= period.Start);
            if (period.End.HasValue) query = query.Where(d => d.SubmittedAt < period.End);
            if (!string.IsNullOrEmpty(r.Sku)) query = query.Where(d => db.Items.Any(i => i.Id == d.ItemId && i.Sku == r.Sku));
            if (!string.IsNullOrEmpty(r.Location)) query = query.Where(d => db.Locations.Any(l => l.Id == d.LocationId && l.Code == r.Location));
            if (!string.IsNullOrEmpty(r.Status)) query = query.Where(d => d.Status == r.Status);
            if (!string.IsNullOrWhiteSpace(r.Query)) { var search = r.Query.Trim().ToLowerInvariant(); query = query.Where(d => (d.Id + " " + db.Items.Where(i => i.Id == d.ItemId).Select(i => i.Sku + " " + i.Name).First() + " " + db.Locations.Where(l => l.Id == d.LocationId).Select(l => l.Code).First()).ToLower().Contains(search)); }
            if (r.Scope == "selected") { var selected = r.Ids ?? []; query = query.Where(d => selected.Contains(d.Id)); }
            docs = await query.OrderBy(d => d.Id).Take(50001).ToListAsync(ct);
            Require(docs.Count <= 50000, "export-limit", 413);
        }
        Require(docs.All(d => d.Kind == "count"), "source", 400);
        var items = await db.Items.AsNoTracking().ToDictionaryAsync(x => x.Id, ct); var locations = await db.Locations.AsNoTracking().Where(l => l.WarehouseId == actor.WarehouseId).ToDictionaryAsync(l => l.Id, ct);
        docs = docs.Where(d => (string.IsNullOrEmpty(r.Sku) || items[d.ItemId].Sku == r.Sku) && (string.IsNullOrEmpty(r.Location) || locations[d.LocationId].Code == r.Location) && (string.IsNullOrEmpty(r.Status) || d.Status == r.Status) && Match(r.Query, d.Id, items[d.ItemId].Sku, items[d.ItemId].Name, locations[d.LocationId].Code)).ToList();
        if (r.Scope == "selected") { var selected = r.Ids ?? []; Require(selected.Length > 0 && selected.All(s => docs.Any(d => d.Id == s)), "conflict", 409); docs = docs.Where(d => selected.Contains(d.Id)).ToList(); }
        if (r.Type == "count-sheet") { Require(docs.Count == 1 && docs[0].Status == "counting", "task", 409); title = T("Blind count worksheet", "Lembar hitung tanpa saldo"); Table(["Task", "SKU", "ItemName", "Location", "Condition", "Unit", "Count", "Counter", "Date"], docs.Select(d => new[] { d.Id, items[d.ItemId].Sku, items[d.ItemId].Name, locations[d.LocationId].Code, "good / no hold", items[d.ItemId].Unit, "", "", "" })); return; }
        Require(docs.All(d => d.Status is "review" or "adjusted" or "closed"), "task", 409);
        if (r.Type == "count-report") Require(docs.Count == 1 && docs[0].Status is "adjusted" or "closed", "task", 409);
        var values = new List<string[]>();
        foreach (var d in docs) { Require(d.Expected.HasValue && d.Counted.HasValue, "export-source", 409); var approval = d.Status == "review" ? null : await db.Audit.AsNoTracking().Where(a => a.WarehouseId == actor.WarehouseId && a.Action == "adjust-count" && EF.Functions.JsonContains(a.DetailJson, JsonSerializer.Serialize(new { task = d.Id }))).OrderByDescending(a => a.PostedAt).FirstOrDefaultAsync(ct); if (r.Type == "count-report") Require(approval != null && approval.PrincipalId != d.Counter, "export-source", 409); values.Add([d.Id, items[d.ItemId].Sku, items[d.ItemId].Name, locations[d.LocationId].Code, "good / no hold", N(d.Expected!.Value), N(d.Counted!.Value), N(d.Counted.Value - d.Expected.Value), items[d.ItemId].Unit, d.Counter, d.Status == "review" ? T("Not approved", "Belum disetujui") : d.Status == "closed" ? T("Closed", "Ditutup") : T("Approved; location still frozen", "Disetujui; lokasi masih dibekukan"), d.Reason, D(d.SubmittedAt), approval?.PrincipalId ?? "", approval?.TransactionId ?? "", D(approval?.PostedAt)]); }
        title = r.Type == "count-report" ? T("Stock count record", "Berita acara opname") : T("Count review", "Tinjauan opname");
        if (r.Type == "count-report") meta["Signatures"] = T("Counter: __________  Approver: __________  Date: __________", "Penghitung: __________  Penyetuju: __________  Tanggal: __________");
        Table(["Task", "SKU", "ItemName", "Location", "Condition", "Expected", "Counted", "Difference", "Unit", "Counter", "Status", "Reason", "SubmittedAt", "Approver", "TransactionId", "ApprovedAt"], values);
    }
    public async Task<List<ExportEvent>> Events(ActingPrincipal actor, string documentId, CancellationToken ct)
    {
        await Authorize(actor, ct);
        var d = await db.Documents.AsNoTracking().SingleOrDefaultAsync(d => d.Id == documentId && d.CompanyId == "demo" && (d.WarehouseId == actor.WarehouseId || d.Kind == "transfer" && d.TargetWarehouseId == actor.WarehouseId), ct);
        Require(d != null, "source", 404);
        var lines = await Lines().Where(x => x.Movement.Source == documentId && (x.Movement.WarehouseId == d!.WarehouseId || x.Movement.WarehouseId == d.TargetWarehouseId)).OrderBy(x => x.Movement.PostedAt).Take(1001).ToListAsync(ct);
        Require(lines.Count <= 1000, "export-limit", 413); await Blind(actor, lines.Select(x => (x.Item.Id, x.Location.Id)), ct);
        return lines.Where(x => x.Movement.Kind is "ship" or "receive" or "transfer-send" or "transfer-receive").GroupBy(x => x.Movement.Id).Select(g => new ExportEvent(g.Key, g.First().Movement.Kind, g.First().Movement.PostedAt, N(g.Sum(x => x.Entry.QuantityDelta > 0 ? x.Entry.QuantityDelta : 0) is var positive && positive > 0 ? positive : -g.Sum(x => x.Entry.QuantityDelta)))).ToList();
    }
    private async Task Document(ActingPrincipal actor, ExportRequest r, CancellationToken ct)
    {
        var d = await Source(actor, r, ct); var item = await db.Items.AsNoTracking().SingleAsync(i => i.Id == d.ItemId, ct);
        var type = r.Type;
        Require(type switch { "packing" or "ship" => d.Kind == "order", "receive" or "receive-summary" => d.Kind == "po", "manual-receive" => d.Kind == "receipt-line", "transfer-send" or "transfer-receive" or "transfer-summary" => d.Kind == "transfer", _ => d.Kind == type }, "source", 400);
        if (d.Kind == "transfer") { var names = await db.Warehouses.Where(w => w.Id == d.WarehouseId || w.Id == d.TargetWarehouseId).ToDictionaryAsync(w => w.Id, w => w.Name, ct); meta["FromWarehouse"] = names[d.WarehouseId]; meta["ToWarehouse"] = names[d.TargetWarehouseId!]; }
        var positions = await db.Positions.Join(db.Locations, p => p.LocationId, l => l.Id, (p, l) => new { p.ItemId, p.LocationId, l.WarehouseId }).Where(x => x.ItemId == d.ItemId && x.WarehouseId == actor.WarehouseId).ToListAsync(ct);
        await Blind(actor, positions.Select(p => (p.ItemId, p.LocationId)), ct);
        if (type == "packing") { Require(d.Status == "released", "task", 409); var qty = await db.Allocations.Where(a => a.OrderId == d.Id && a.Status == "active" && db.Positions.Any(p => p.Id == a.PositionId && db.Locations.Any(l => l.Id == p.LocationId && l.Code == "Staging" && l.WarehouseId == actor.WarehouseId))).SumAsync(a => a.Quantity, ct); Require(qty > 0, "export-empty", 409); title = T("Packing plan - not proof of shipment", "Rencana packing - bukan bukti pengiriman"); Table(["Order", "SKU", "ItemName", "Ordered", "Prepared", "Shipped", "Remaining", "Unit"], [new[] { d.Id, item.Sku, item.Name, N(d.Quantity), N(qty), N(d.Shipped), N(d.Quantity - d.Shipped), item.Unit }]); return; }
        if (type.EndsWith("-summary")) { title = T("Operational summary", "Rekap operasional"); meta["CumulativeAtSnapshot"] = "true"; var actual = d.Actual; Table(["Document", "SKU", "ItemName", "OrderedOrSent", "Received", "Remaining", "Unit", "Status"], [new[] { d.Id, item.Sku, item.Name, N(d.Quantity), N(actual), N(d.Quantity - actual), item.Unit, d.Status }]); var events = await Events(actor, d.Id, ct); meta["TransactionIds"] = string.Join(", ", events.Select(e => e.Id)); return; }
        var movementKind = type == "transfer-send" ? "transfer-send" : type == "transfer-receive" ? "transfer-receive" : type;
        var txId = r.TransactionId;
        if (type is "customer-return" or "supplier-return" or "manual-receive")
        {
            var evidence = await db.SupportingRecords.AsNoTracking().Where(s => s.Kind == "export-evidence" && s.WarehouseId == actor.WarehouseId && EF.Functions.JsonContains(s.PayloadJson, JsonSerializer.Serialize(new { documentIds = new[] { d.Id } }))).ToListAsync(ct);
            var transactions = evidence.Select(e => JsonDocument.Parse(e.PayloadJson).RootElement).Where(e => e.GetProperty("kind").GetString() == type).Select(e => e.GetProperty("transactionId").GetString()!).Distinct().ToArray();
            Require(transactions.Length == 1, "export-source", 409); txId = transactions[0];
        }
        Require(!string.IsNullOrEmpty(txId), "required", 400);
        var entries = await Lines().Where(x => x.Movement.Id == txId && x.Movement.Kind == movementKind && x.Item.Id == d.ItemId && (x.Movement.WarehouseId == d.WarehouseId || d.Kind == "transfer" && x.Movement.WarehouseId == d.TargetWarehouseId)).ToListAsync(ct);
        Require(entries.Count > 0 && entries.All(x => x.Movement.Source == (type is "customer-return" or "supplier-return" or "manual-receive" ? d.Source : d.Id)), "export-source", 409);
        if (type == "manual-receive")
        {
            // Same-SKU lines can share a physical ledger entry; export this line's immutable document actual.
            title = T("Manual goods receipt", "Bukti penerimaan manual");
            meta["ReceiptHeader"] = d.Source;
            Table(["Receipt", "Line", "TransactionId", "SKU", "ItemName", "Quantity", "Unit", "Condition", "Hold", "PostedAt", "ActorId"], [new[] { d.Source, d.Id, txId!, item.Sku, item.Name, N(d.Actual), item.Unit, "unassessed", "awaiting-qc", D(entries[0].Movement.PostedAt), entries[0].Movement.Actor }]); return;
        }
        var actualEntries = type is "ship" or "supplier-return" or "transfer-send" ? entries.Where(x => x.Entry.QuantityDelta < 0 && x.Location.WarehouseId == d.WarehouseId).ToList() : entries.Where(x => x.Entry.QuantityDelta > 0 && x.Location.WarehouseId == (type == "transfer-receive" ? d.TargetWarehouseId : d.WarehouseId)).ToList();
        Require(actualEntries.Count > 0, "export-source", 409);
        title = type switch { "ship" => T("WMS shipment receipt", "Bukti pengiriman WMS"), "receive" => T("WMS goods receipt", "Bukti penerimaan WMS"), "transfer-send" => T("Transfer dispatch", "Bukti kirim transfer"), "transfer-receive" => T("Transfer receipt", "Bukti terima transfer"), "customer-return" => T("Customer return", "Bukti retur pelanggan"), _ => T("Supplier return", "Bukti retur supplier") };
        meta["TransactionId"] = txId!; meta["CumulativeAtSnapshot"] = type == "ship" ? N(d.Shipped) : N(d.Actual); meta["RemainingAtSnapshot"] = N(d.Quantity - (type == "ship" ? d.Shipped : d.Actual)); meta["Signatures"] = T("Prepared: __________  Received: __________  Date: __________", "Disiapkan: __________  Diterima: __________  Tanggal: __________");
        Table(["Document", "SourceReference", "TransactionId", "SKU", "ItemName", "Location", "Quantity", "Unit", "Condition", "Hold", "OccurredAt", "PostedAt", "ActorId", "Reason"], actualEntries.Select(x => new[] { d.Id, d.Source, x.Movement.Id, item.Sku, item.Name, x.Location.Code, N(Math.Abs(x.Entry.QuantityDelta)), x.Entry.Unit, x.Position.Condition, x.Position.Hold, D(x.Movement.OccurredAt), D(x.Movement.PostedAt), x.Movement.Actor, x.Movement.Reason }));
    }
}

public static class OperationalExportEndpoints
{
    public static void MapOperationalExports(this WebApplication app)
    {
        app.MapPost("/api/workspaces/{warehouse}/exports", async (string warehouse, ExportRequest input, HttpContext http, AccessService access, OperationalExport export, CancellationToken ct) =>
        {
            var actor = await access.Resolve(http.User, warehouse, ct);
            var file = await export.Create(actor, input, ct);
            await access.Resolve(http.User, warehouse, ct);
            http.Response.Headers.CacheControl = "no-store, private";
            http.Response.Headers.Pragma = "no-cache";
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.File(file.Bytes, file.ContentType, file.Filename);
        }).RequireAuthorization();
        app.MapGet("/api/workspaces/{warehouse}/export-events", async (string warehouse, string documentId, HttpContext http, AccessService access, OperationalExport export, CancellationToken ct) =>
        {
            var actor = await access.Resolve(http.User, warehouse, ct); http.Response.Headers.CacheControl = "no-store, private";
            return Results.Ok(await export.Events(actor, documentId, ct));
        }).RequireAuthorization();
    }
}
