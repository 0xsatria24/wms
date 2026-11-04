using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;
public sealed partial class HttpApiTests
{
    private const string ExportPath = "/api/workspaces/Main%20Warehouse/exports";
    [Fact]
    public async Task OperationalExportIncludesAllMatchingStockAndOnlyWritesSeparateAudit()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin");
        int businessAudit; int movements; int outbox;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>(); var location = await db.Locations.FirstAsync(l => l.WarehouseId == "main" && l.Code == "A-01");
            for (var n = 0; n < 137; n++) { var item = new Item { Id = $"EXPITEM{n}", Sku = $"EXPORT-{n:000}", Name = "Export test", Barcode = $"00000{n:000}" }; db.Items.Add(item); db.Positions.Add(new StockPosition { Id = $"EXPPOS{n}", ItemId = item.Id, LocationId = location.Id, OnHand = 100, Committed = 20 }); }
            await db.SaveChangesAsync(); businessAudit = await db.Audit.CountAsync(); movements = await db.Movements.CountAsync(); outbox = await db.Outbox.CountAsync();
        }
        var response = await admin.PostAsJsonAsync(ExportPath, new { type = "stock", format = "csv", scope = "all", query = "EXPORT-", locale = "en" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode); Assert.True(response.Headers.CacheControl!.NoStore);
        var csv = await response.Content.ReadAsStringAsync(); Assert.Equal(138, csv.Split("\r\n", StringSplitOptions.RemoveEmptyEntries).Length); Assert.Contains("EXPORT-136", csv); Assert.Contains("\"100\",\"20\",\"80\"", csv);
        var selected = await admin.PostAsJsonAsync(ExportPath, new { type = "stock", format = "csv", scope = "selected", ids = new[] { "EXPORT-001", "EXPORT-136" }, query = "EXPORT-" });
        Assert.Equal(HttpStatusCode.OK, selected.StatusCode); Assert.Equal(3, (await selected.Content.ReadAsStringAsync()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries).Length);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync(ExportPath, new { type = "stock", format = "csv", scope = "selected", ids = new[] { "EXPORT-MISSING" } })).StatusCode);
        using var check = factory.Services.CreateScope(); var after = check.ServiceProvider.GetRequiredService<WmsDb>(); Assert.Equal(businessAudit, await after.Audit.CountAsync()); Assert.Equal(movements, await after.Movements.CountAsync()); Assert.Equal(outbox, await after.Outbox.CountAsync()); Assert.Equal(3, await after.SupportingRecords.CountAsync(r => r.Kind == "export-audit"));
    }
    [Fact]
    public async Task OperationalExportBlocksBlindBalancesAndReviewerPolicyButAllowsBlankWorksheet()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin"); using var op = await Login(factory, "operator");
        await Read(await Command(admin, "admin", "freeze", 0, new { sku = "SKU-A", location = "A-01" }));
        string task; long version;
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<WmsDb>(); var count = await db.Documents.SingleAsync(d => d.Kind == "count"); task = count.Id; version = count.Version; }
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync(ExportPath, new { type = "stock", format = "csv", query = "SKU-A", location = "A-01" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync(ExportPath, new { type = "ledger", format = "xlsx", sku = "SKU-A" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync(ExportPath, new { type = "count-review", format = "xlsx", documentId = task, version })).StatusCode);
        var worksheet = await op.PostAsJsonAsync(ExportPath, new { type = "count-sheet", format = "pdf", documentId = task, version }); Assert.Equal(HttpStatusCode.OK, worksheet.StatusCode); Assert.Equal("application/pdf", worksheet.Content.Headers.ContentType!.MediaType); Assert.StartsWith("%PDF-", Encoding.ASCII.GetString(await worksheet.Content.ReadAsByteArrayAsync()));
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync("/api/workspaces/Secondary%20Warehouse/exports", new { type = "stock", format = "csv" })).StatusCode);
    }
    [Fact]
    public async Task OperationalExportUsesSeparatePartialEventsAndRejectsWrongDocumentAndVersion()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>(); var p = await db.Positions.SingleAsync(p => p.Id == "POS-A");
            db.Documents.Add(new OperationalDocument { Id = "EXPORT-ORDER", Kind = "order", WarehouseId = "main", ItemId = p.ItemId, Quantity = 10, Shipped = 10, Status = "released", Version = 4 });
            foreach (var (tx, qty) in new[] { ("EXPORT-SHIP8", -8m), ("EXPORT-SHIP2", -2m) }) { db.Movements.Add(new StockMovement { Id = tx, WarehouseId = "main", Kind = "ship", Source = "EXPORT-ORDER", Actor = "admin", OccurredAt = DateTimeOffset.UtcNow, PostedAt = DateTimeOffset.UtcNow }); db.Entries.Add(new StockEntry { MovementId = tx, PositionId = p.Id, QuantityDelta = qty }); }
            await db.SaveChangesAsync();
        }
        var events = await Read(await admin.GetAsync("/api/workspaces/Main%20Warehouse/export-events?documentId=EXPORT-ORDER")); Assert.Equal(2, events.GetArrayLength()); Assert.Contains(events.EnumerateArray(), e => e.GetProperty("quantity").GetString() == "8"); Assert.Contains(events.EnumerateArray(), e => e.GetProperty("quantity").GetString() == "2");
        var pdf = await admin.PostAsJsonAsync(ExportPath, new { type = "ship", format = "pdf", documentId = "EXPORT-ORDER", version = 4, transactionId = "EXPORT-SHIP8" }); Assert.Equal(HttpStatusCode.OK, pdf.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync(ExportPath, new { type = "ledger", format = "csv", sku = "SKU-A", query = "%" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync(ExportPath, new { type = "ship", format = "pdf", documentId = "EXPORT-ORDER", version = 3, transactionId = "EXPORT-SHIP8" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync(ExportPath, new { type = "ship", format = "pdf", documentId = "EXPORT-ORDER", version = 4, transactionId = "UNRELATED" })).StatusCode);
    }

    [Fact]
    public async Task OperationalExportProducesReceivingTransferReturnAndApprovedCountDocuments()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>(); var p = await db.Positions.SingleAsync(p => p.Id == "POS-A");
            db.Documents.AddRange(
                new OperationalDocument { Id = "EXP-PO", Kind = "po", WarehouseId = "main", ItemId = p.ItemId, Quantity = 100, Actual = 60, Status = "partial" },
                new OperationalDocument { Id = "EXP-TRANSFER", Kind = "transfer", WarehouseId = "main", TargetWarehouseId = "secondary", ItemId = p.ItemId, Quantity = 50, Actual = 48, Status = "in-transit" },
                new OperationalDocument { Id = "EXP-RETURN", Kind = "customer-return", WarehouseId = "main", ItemId = p.ItemId, Quantity = 3, Actual = 3, Source = "ORIGINAL-SHIP" },
                new OperationalDocument { Id = "EXP-COUNT", Kind = "count", WarehouseId = "main", ItemId = p.ItemId, LocationId = p.LocationId, Expected = 30, Counted = 28, Counter = "operator", Status = "adjusted", Reason = "Verified difference" });
            foreach (var (tx, kind, source, qty) in new[] { ("EXP-RECEIVE60", "receive", "EXP-PO", 60m), ("EXP-DISPATCH50", "transfer-send", "EXP-TRANSFER", -50m), ("EXP-RETURN3", "customer-return", "ORIGINAL-SHIP", 3m) })
            {
                db.Movements.Add(new StockMovement { Id = tx, WarehouseId = "main", Kind = kind, Source = source, Actor = "admin", OccurredAt = DateTimeOffset.UtcNow, PostedAt = DateTimeOffset.UtcNow });
                db.Entries.Add(new StockEntry { MovementId = tx, PositionId = p.Id, QuantityDelta = qty });
            }
            db.SupportingRecords.Add(new SupportingRecord { Id = "EXP-EVIDENCE", WarehouseId = "main", Kind = "export-evidence", PayloadJson = JsonSerializer.Serialize(new { transactionId = "EXP-RETURN3", kind = "customer-return", documentIds = new[] { "EXP-RETURN" } }) });
            db.Audit.Add(new AuditRecord { TransactionId = "EXP-APPROVAL", WarehouseId = "main", PrincipalId = "admin", Action = "adjust-count", DetailJson = "{\"task\":\"EXP-COUNT\"}", PostedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }
        foreach (var (type, documentId, transactionId) in new[] { ("receive", "EXP-PO", "EXP-RECEIVE60"), ("receive-summary", "EXP-PO", ""), ("transfer-send", "EXP-TRANSFER", "EXP-DISPATCH50"), ("transfer-summary", "EXP-TRANSFER", ""), ("customer-return", "EXP-RETURN", ""), ("count-report", "EXP-COUNT", "") })
        {
            var response = await admin.PostAsJsonAsync(ExportPath, new { type, format = "pdf", documentId, version = 0, transactionId, locale = "id" });
            Assert.True(response.IsSuccessStatusCode, type + ": " + await response.Content.ReadAsStringAsync());
            Assert.StartsWith("%PDF-", Encoding.ASCII.GetString(await response.Content.ReadAsByteArrayAsync()));
        }
    }
}
