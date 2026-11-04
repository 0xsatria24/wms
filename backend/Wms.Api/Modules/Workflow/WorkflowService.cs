using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Catalog;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Workflow;

public sealed record WorkflowEdit(long Version, JsonElement Data);
public sealed record WorkflowQuery(string View = "stock", string Sku = "", string Document = "", string Query = "", int Page = 1, string Status = "", int HistoryPage = 1, string SelectedItems = "", int ProposalPage = 1, string Proposal = "");

public sealed partial class WorkflowService(WmsDb db)
{
    private static void Identity(string id) => Require(Regex.IsMatch(id, "^[A-Za-z0-9_-]{16}$"), "required", 400);
    private async Task Authorize(ActingPrincipal actor, bool write, CancellationToken ct)
    {
        Require(!write || actor.Role is "operator" or "supervisor" or "admin", "denied", 403);
        Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct)
            && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
    }
    private async Task Lock(string key, CancellationToken ct) => await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);
    private static JsonElement Parse(string json) => JsonSerializer.Deserialize<JsonElement>(json);
    private static void Object(JsonElement data) { Require(data.ValueKind == JsonValueKind.Object, "required", 400); SupportingPayload.RequireBounded(data.GetRawText()); }
    private static string DraftKey(ActingPrincipal actor, string id) => $"workflow-draft|{actor.WarehouseId}|{actor.Id}|{id}";
    private static object DraftDto(SupportingRecord row) { var p = Parse(row.PayloadJson); return new { id = p.Text("id"), version = row.Version, data = p.GetProperty("data"), status = p.Text("status") == "confirmed" ? "confirmed" : "draft", result = p.TryGetProperty("result",out var result) ? result : (JsonElement?)null, owner = p.Text("owner"), warehouse = row.WarehouseId, updatedAt = p.Text("updatedAt") }; }
    private static object ProposalDto(SupportingRecord row) => new { version = row.Version, proposal = Parse(row.PayloadJson) };
    public async Task<object> ReadDraft(ActingPrincipal actor, string id, CancellationToken ct)
    {
        Identity(id); await Authorize(actor, false, ct);
        var key = DraftKey(actor, id);
        var row = await db.SupportingRecords.AsNoTracking().SingleOrDefaultAsync(r => r.Id == key && r.Kind == "workflow-draft" && r.WarehouseId == actor.WarehouseId, ct);
        Require(row is not null, "source", 404); return DraftDto(row!);
    }
    public async Task<object> Drafts(ActingPrincipal actor, int page, CancellationToken ct)
    {
        await Authorize(actor, false, ct); page = Math.Max(1, page);
        var prefix = DraftKey(actor, "");
        var query = db.SupportingRecords.AsNoTracking().Where(r => r.WarehouseId == actor.WarehouseId && r.Kind == "workflow-draft" && r.Id.StartsWith(prefix));
        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(r => r.Id).Skip((page - 1) * 25).Take(25).ToListAsync(ct);
        return new { rows = rows.Select(DraftDto), page, total, pages = Math.Max(1, (total + 24) / 25) };
    }
    public async Task<object> SaveDraft(ActingPrincipal actor, string id, WorkflowEdit input, CancellationToken ct)
    {
        Identity(id); Object(input.Data);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await RecoveryState.RequireWritable(db, ct);
        var key = DraftKey(actor, id); await Lock(key, ct); await Authorize(actor, true, ct);
        var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == key, ct);
        Require(row is null || Parse(row.PayloadJson).Text("status") != "confirmed", "draft-complete");
        if (row is not null && Canonical(Parse(row.PayloadJson).GetProperty("data")) == Canonical(input.Data)) { await tx.CommitAsync(ct); return DraftDto(row); }
        Require((row?.Version ?? 0) == input.Version, "conflict");
        if (row is null) { row = new() { Id = key, Kind = "workflow-draft", WarehouseId = actor.WarehouseId }; db.SupportingRecords.Add(row); }
        row.PayloadJson = JsonSerializer.Serialize(new { id, owner = actor.Id, data = input.Data, updatedAt = DateTimeOffset.UtcNow }); row.Version++;
        await SupportingPayload.RequireStoredBound(db, row.PayloadJson, ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return DraftDto(row);
    }
    public async Task<object> Propose(ActingPrincipal actor, string id, JsonElement data, CancellationToken ct)
    {
        Identity(id); Object(data);
        Require(data.Text("name").Trim().Length is > 0 and <= 200 && data.Text("sku").Trim().Length is > 0 and <= 200 && data.Text("unit").Trim().Length is > 0 and <= 40 && data.Text("barcode").Length <= 200, "required", 400);
        await using var tx = await db.Database.BeginTransactionAsync(ct); await RecoveryState.RequireWritable(db, ct);
        var key = $"item-proposal|{actor.WarehouseId}|{id}"; await Lock(key, ct); await Authorize(actor, true, ct);
        var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == key, ct);
        if (row is not null)
        {
            var old = Parse(row.PayloadJson); Require(old.Text("owner") == actor.Id, "denied", 403);
            if (Canonical(old.GetProperty("data")) == Canonical(data)) { await tx.CommitAsync(ct); return ProposalDto(row); }
            Require(old.Text("status") == "needs-revision" && data.TryGetProperty("version", out var v) && v.GetInt64() == row.Version, "conflict");
        }
        else { row = new() { Id = key, Kind = "item-proposal", WarehouseId = actor.WarehouseId }; db.SupportingRecords.Add(row); }
        row.PayloadJson = JsonSerializer.Serialize(new { id, owner = actor.Id, status = "pending", data, updatedAt = DateTimeOffset.UtcNow }); row.Version++;
        await SupportingPayload.RequireStoredBound(db, row.PayloadJson, ct); Audit(actor, "item-proposal", row.PayloadJson);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return ProposalDto(row);
    }
    public async Task<object> ReviewProposal(ActingPrincipal actor, string id, WorkflowEdit input, CancellationToken ct)
    {
        Supervisor(actor); Identity(id); Object(input.Data);
        await using var tx = await db.Database.BeginTransactionAsync(ct); await RecoveryState.RequireWritable(db, ct);
        var key = $"item-proposal|{actor.WarehouseId}|{id}"; await Lock(key, ct); await Lock("edit:demo:catalog", ct); await Authorize(actor, true, ct);
        var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == key && r.WarehouseId == actor.WarehouseId && r.Kind == "item-proposal", ct);
        Require(row is not null, "source", 404); Require(row!.Version == input.Version, "conflict");
        var old = Parse(row.PayloadJson); Require(old.Text("status") == "pending", "state");
        var data = old.GetProperty("data"); var action = input.Data.Text("action"); Require(action is "approve" or "revise", "required", 400);
        var sku = input.Data.Text("sku").Trim(); if (sku.Length == 0) sku = data.Text("sku").Trim();
        if (action == "approve")
        {
            Require(sku.Length is > 0 and <= 200, "required", 400);
            var item = await db.Items.SingleOrDefaultAsync(i => i.CompanyId == "demo" && i.Sku == sku, ct);
            if (item is null)
            {
                var barcode = data.Text("barcode").Trim();
                if (barcode.Length == 0 && input.Data.TryGetProperty("generateBarcode", out var generate) && generate.ValueKind == JsonValueKind.True) barcode = "IW-" + ReferenceId.New();
                Require(barcode.Length is > 0 and <= 200, "required", 400);
                Require(!await db.Items.AnyAsync(i => i.CompanyId == "demo" && i.Barcode == barcode, ct), "duplicate-barcode");
                Require(!await db.Items.AnyAsync(i => i.CompanyId == "demo" && i.Active && (i.Sku == barcode || i.Barcode == sku), ct), "ambiguous-item");
                item = new() { Id = "demo|" + sku, Sku = sku, Name = data.Text("name").Trim(), Unit = data.Text("unit").Trim(), Barcode = barcode, Active = true, Version = 1 }; db.Items.Add(item);
            }
            Require(item.Active && item.Unit == data.Text("unit").Trim(), "item-mapping");
        }
        else Require(input.Data.Text("reason").Trim().Length is > 0 and <= 2000, "reason", 400);
        row.PayloadJson = JsonSerializer.Serialize(new { id, owner = old.Text("owner"), status = action == "approve" ? "approved" : "needs-revision", data, sku, reviewer = actor.Id, reason = input.Data.Text("reason"), updatedAt = DateTimeOffset.UtcNow }); row.Version++;
        await SupportingPayload.RequireStoredBound(db, row.PayloadJson, ct); Audit(actor, "item-proposal-review", row.PayloadJson);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return ProposalDto(row);
    }
    private void Audit(ActingPrincipal actor, string action, string json) => db.Audit.Add(new() { TransactionId = ReferenceId.New(), WarehouseId = actor.WarehouseId, PrincipalId = actor.Id, Action = action, DetailJson = json, PostedAt = DateTimeOffset.UtcNow });
}
