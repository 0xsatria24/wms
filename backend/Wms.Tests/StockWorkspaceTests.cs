using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Inventory;
using Wms.Modules.Catalog;
using Microsoft.Extensions.Hosting;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class StockWorkspaceTests(PostgresFixture postgres)
{
    private static readonly ActingPrincipal Admin = new("admin", "main", "admin");
    private static JsonElement Json(object value) => JsonSerializer.SerializeToElement(value);
    private static async Task<CommandResult> Run(DbContextOptions<WmsDb> options, string type, object payload, long? version = null, string? key = null)
    {
        await using var db = new WmsDb(options);
        return await new CommandProcessor(db).Handle(Admin, new(type, "Main Warehouse", version, Json(payload)), key ?? Guid.NewGuid().ToString());
    }
    private static async Task<object> Line(DbContextOptions<WmsDb> options, string sku, string qty, string? id = null)
    {
        await using var db = new WmsDb(options);
        var item = await db.Items.SingleAsync(i => i.Sku == sku);
        return new { id = id ?? ReferenceId.New(), sku, scan = sku, qty, unit = item.Unit, version = item.Version };
    }
    [Fact]
    public async Task ManualMultiLineReceiptPostsHeldStockAndDistinctLinkedTasksOnce()
    {
        var options = await postgres.Database();
        var id = ReferenceId.New();
        var payload = new { document = id, sourceType = "manual", origin = "Test delivery", reason = "No PO", lines = new[] { await Line(options, "SKU-A", "0.5"), await Line(options, "SKU-B", "2") } };
        var key = Guid.NewGuid().ToString();
        var first = await Run(options, "manual-receive", payload, key: key);
        var replay = await Run(options, "manual-receive", payload, key: key);
        Assert.Equal(first, replay);
        await using var verify = new WmsDb(options);
        var lines = await verify.Documents.Where(d => d.Kind == "receipt-line" && d.Source == id).ToListAsync();
        Assert.Equal(2, lines.Count);
        Assert.Equal(2.5m, lines.Sum(d => d.Actual));
        Assert.Equal(2, await verify.Documents.CountAsync(d => d.Kind == "inspection" && lines.Select(l => l.Id).Contains(d.Source)));
        Assert.Equal(2.5m, await verify.Positions.Where(p => p.Hold == "awaiting-qc").SumAsync(p => p.OnHand));
        Assert.Single(await verify.Movements.Where(m => m.Source == id).ToListAsync());
        Assert.Single(await verify.SupportingRecords.Where(r => r.Kind == "receipt-header" && r.Id == id).ToListAsync());
        Assert.Single(await verify.Outbox.Where(e => e.AggregateId == id && e.Kind == "manual-receive").ToListAsync());
    }
    [Fact]
    public async Task InvalidReceiptLineRollsBackEntirePostingAndHeader()
    {
        var options = await postgres.Database();
        var id = ReferenceId.New();
        var payload = new { document = id, origin = "Delivery", reason = "No PO", lines = new[] { await Line(options, "SKU-A", "3"), new { id = ReferenceId.New(), sku = "MISSING", scan = "MISSING", qty = "2", unit = "units", version = 0L } } };
        var error = await Assert.ThrowsAsync<BusinessException>(() => Run(options, "manual-receive", payload));
        Assert.Equal("scan-item", error.Message);
        await using var verify = new WmsDb(options);
        Assert.False(await verify.SupportingRecords.AnyAsync(r => r.Id == id));
        Assert.False(await verify.Documents.AnyAsync(d => d.Source == id));
        Assert.False(await verify.Movements.AnyAsync(m => m.Source == id));
    }
    [Fact]
    public async Task ASecondRequestCannotReceiveTheSameManualDocumentAgain()
    {
        var options = await postgres.Database();
        var payload = new { document = ReferenceId.New(), origin = "Delivery", reason = "No PO", lines = new[] { await Line(options, "SKU-A", "3") } };
        await Run(options, "manual-receive", payload);
        var error = await Assert.ThrowsAsync<BusinessException>(() => Run(options, "manual-receive", payload));
        Assert.Equal("duplicate", error.Message);
    }
    [Fact]
    public async Task RelocateOnlyUnreservedStorageStockAndConservePhysical()
    {
        var options = await postgres.Database();
        long version;
        await using (var db = new WmsDb(options)) version = (await db.Positions.SingleAsync(p => p.Id == "POS-A")).Version;
        await Run(options, "relocate", new { sku = "SKU-A", scan = "SKU-A", position = "POS-A", positionVersion = version, sourceScan = "A-01", destination = "A-02", locationScan = "A-02", qty = "5" });
        await using var verify = new WmsDb(options);
        Assert.Equal(95m, (await verify.Positions.SingleAsync(p => p.Id == "POS-A")).OnHand);
        Assert.Equal(100m, await verify.Positions.Where(p => p.ItemId == "demo|SKU-A" && verify.Locations.Any(l => l.Id == p.LocationId && l.WarehouseId == "main")).SumAsync(p => p.OnHand));
        Assert.Equal(0m, await verify.Entries.Where(e => verify.Movements.Any(m => m.Id == e.MovementId && m.Kind == "relocate")).SumAsync(e => e.QuantityDelta));
        await Assert.ThrowsAsync<BusinessException>(() => Run(options, "relocate", new { sku = "SKU-A", scan = "SKU-A", position = "POS-A", positionVersion = version, sourceScan = "A-01", destination = "QC", locationScan = "QC", qty = "1" }));
    }
    [Fact]
    public async Task FullOrderAllocationCanUseSixPlusFourAcrossBinsWithoutPartialPolicy()
    {
        var options = await postgres.Database();
        await using (var setup = new WmsDb(options))
        {
            var original = await setup.Positions.SingleAsync(p => p.Id == "POS-A");
            original.OnHand = 6; original.Committed = 0;
            setup.Allocations.RemoveRange(await setup.Allocations.ToListAsync());
            setup.Positions.Add(new() { Id = "SECOND-BIN", ItemId = original.ItemId, LocationId = "main|A-02", OnHand = 4 });
            setup.Documents.Add(new() { Id = "TEST-ORDER", WarehouseId = "main", ItemId = original.ItemId, Kind = "order", Status = "released", Quantity = 10, Creator = "operator" });
            await setup.SaveChangesAsync();
        }
        await Run(options, "reserve-plan", new { order = "TEST-ORDER", allocations = new[] { new { position = "POS-A", version = 0, qty = "6" }, new { position = "SECOND-BIN", version = 0, qty = "4" } } }, 0);
        await using var verify = new WmsDb(options);
        Assert.Equal(10m, await verify.Allocations.Where(a => a.OrderId == "TEST-ORDER").SumAsync(a => a.Quantity));
        Assert.Equal(10m, await verify.Positions.Where(p => p.ItemId == "demo|SKU-A").SumAsync(p => p.Committed));
    }
    [Fact]
    public async Task RejectedOrderCanBeRevisedAndResubmittedWithoutLosingReviewHistory()
    {
        var options = await postgres.Database();
        await Run(options, "reject-order", new { order = "SO-SIM-1002", reason = "Correct quantity" }, 0);
        await using var db = new WmsDb(options);
        var edits = new EditService(db, new TestEnvironment());
        await edits.Apply(new("operator", "main", "operator"), new("revise-order", "main", Json(new { id = "SO-SIM-1002", version = 1, qty = "12", reason = "Corrected quantity" })), CancellationToken.None);
        db.ChangeTracker.Clear();
        var draft = await db.Documents.SingleAsync(d => d.Id == "SO-SIM-1002");
        Assert.Equal("draft", draft.Status);
        Assert.Equal(12m, draft.Quantity);
        await edits.Apply(new("operator", "main", "operator"), new("submit-order", "main", Json(new { id = draft.Id, version = draft.Version })), CancellationToken.None);
        Assert.True(await db.Audit.AnyAsync(a => a.Action == "reject-order"));
        Assert.Equal("pending-approval", (await db.Documents.SingleAsync(d => d.Id == draft.Id)).Status);
    }
    [Fact]
    public async Task DeactivationCannotStrandStockOrOpenTasks()
    {
        var options = await postgres.Database();
        await using var db = new WmsDb(options);
        var error = await Assert.ThrowsAsync<BusinessException>(() => new EditService(db, new TestEnvironment()).Apply(Admin, new("master-status", "main", Json(new { sku = "SKU-A", version = 0, active = false, reason = "Retire item" })), CancellationToken.None));
        Assert.Equal("item-open-work", error.Message);
        db.ChangeTracker.Clear();
        Assert.True((await db.Items.SingleAsync(i => i.Sku == "SKU-A")).Active);
    }
    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = ".";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
