using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Integration;

public sealed record PurchaseOrderMessage(string Document, string Sku, string Qty, string Unit, long SourceVersion);

public sealed class PurchaseOrderImport(WmsDb db)
{
    public async Task<CommandResult> Apply(ActingPrincipal actor, PurchaseOrderMessage input, string key, CancellationToken ct)
    {
        Supervisor(actor);
        Require(Guid.TryParse(key, out _), "idempotency-key", 400);
        Require(!string.IsNullOrWhiteSpace(input.Document) && input.Document.Length <= 100 && !input.Document.Contains('|') && input.SourceVersion > 0, "required", 400);
        var payload = JsonSerializer.SerializeToElement(input, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var quantity = payload.Quantity();
        var hash = Hash(Canonical(payload));
        var scope = $"demo:{actor.Id}:erp-po:{key}";
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await RecoveryState.RequireWritable(db, ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({scope}, 0))", ct);
        Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct) && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
        var previous = await db.Requests.SingleOrDefaultAsync(r => r.ScopeKey == scope, ct);
        if (previous is not null)
        {
            Require(previous.PayloadHash == hash && previous.WarehouseId == actor.WarehouseId, "key-changed");
            return JsonSerializer.Deserialize<CommandResult>(previous.ResultJson)!;
        }
        await db.Locations.FromSqlInterpolated($"SELECT * FROM \"Locations\" WHERE \"WarehouseId\" = {actor.WarehouseId} ORDER BY \"Id\" FOR UPDATE").ToListAsync(ct);
        var item = await db.Items.SingleOrDefaultAsync(i => i.CompanyId == "demo" && i.Sku == input.Sku && i.Active, ct);
        Require(item is not null && input.Unit == item.Unit, "scan-item", 400);
        var source = $"erp:{input.Document}";
        var recordId = $"erp-po|{actor.WarehouseId}|{input.Document}";
        var journal = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == recordId, ct);
        Require(journal is null || input.SourceVersion > journal.Version, "conflict");
        var document = await db.Documents.SingleOrDefaultAsync(d => d.WarehouseId == actor.WarehouseId && d.Kind == "po" && d.Source == source, ct);
        if (document is null)
        {
            document = new OperationalDocument { Id = $"PO-{actor.WarehouseId}-{input.Document}", Kind = "po", ItemId = item!.Id, WarehouseId = actor.WarehouseId, Source = source, Creator = actor.Id };
            db.Documents.Add(document);
        }
        Require(document.ItemId == item!.Id && quantity >= document.Actual, "remainder");
        document.Quantity = quantity;
        document.Version++;
        if (journal is null)
        {
            journal = new SupportingRecord { Id = recordId, WarehouseId = actor.WarehouseId, Kind = "erp-po" };
            db.SupportingRecords.Add(journal);
        }
        journal.Version = input.SourceVersion;
        journal.PayloadJson = payload.GetRawText();
        var result = new CommandResult($"IMPORT-{Guid.NewGuid():N}", "imported", "erp-po", DateTimeOffset.UtcNow);
        db.Requests.Add(new IdempotencyRequest { ScopeKey = scope, PrincipalId = actor.Id, WarehouseId = actor.WarehouseId, PayloadHash = hash, ResultJson = JsonSerializer.Serialize(result), CreatedAt = result.Stamp });
        db.Audit.Add(new AuditRecord { TransactionId = result.Id, WarehouseId = actor.WarehouseId, PrincipalId = actor.Id, Action = "erp-po", DetailJson = payload.GetRawText(), PostedAt = result.Stamp });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return result;
    }
}
