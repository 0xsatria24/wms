using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Inventory;
using Wms.Shared;
using Wms.Gateway;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class WorkflowTests(PostgresFixture postgres)
{
    private static readonly ActingPrincipal Admin = new("admin", "main", "admin");
    private static async Task<CommandResult> Run(DbContextOptions<WmsDb> options, string type, object input, ActingPrincipal? principal = null)
    {
        var payload = JsonSerializer.SerializeToElement(input);
        var id = payload.Text("document");
        if (id.Length == 0)
            id = payload.Text("order");
        if (id.Length == 0)
            id = payload.Text("task");
        await using var db = new WmsDb(options);
        var version = await db.Documents.Where(d => d.Id == id).Select(d => (long?)d.Version).SingleOrDefaultAsync();
        return await new CommandProcessor(db).Handle(principal ?? Admin, new CommandRequest(type, "Main Warehouse", version, payload), Guid.NewGuid().ToString());
    }
    [Fact]
    public async Task InboundQcAndPutawayPreserveLedgerAndHoldRejectedItems()
    {
        var options = await postgres.Database();
        await Run(options, "receive", new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "60"
        });
        string inspection;
        await using (var db = new WmsDb(options))
            inspection = await db.Documents.Where(d => d.Kind == "inspection").Select(d => d.Id).SingleAsync();
        await Run(options, "qc", new
        {
            task = inspection,
            good = "50",
            bad = "10",
            reason = "Label damage"
        });
        string putaway;
        await using (var db = new WmsDb(options))
            putaway = await db.Documents.Where(d => d.Kind == "putaway").Select(d => d.Id).SingleAsync();
        await Run(options, "putaway", new
        {
            task = putaway,
            scan = "SKU-A",
            destination = "A-01",
            locationScan = "A-01",
            qty = "50"
        });
        await using var verify = new WmsDb(options);
        Assert.Equal(150m, (await verify.Positions.SingleAsync(p => p.Id == "POS-A")).OnHand);
        Assert.Equal(10m, (await verify.Positions.SingleAsync(p => p.ItemId == "demo|SKU-A" && p.Hold == "quality-rejected")).OnHand);
        foreach (var position in await verify.Positions.ToListAsync())
            Assert.Equal(position.OnHand, await verify.Entries.Where(e => e.PositionId == position.Id).SumAsync(e => e.QuantityDelta));
    }
    [Fact]
    public async Task FullPickThenShipmentReducesPhysicalOnlyOnShipment()
    {
        var options = await postgres.Database();
        await Run(options, "pick", new
        {
            order = "SO-SIM-1001",
            location = "A-01",
            locationScan = "A-01",
            scan = "SKU-A",
            qty = "24"
        });
        await using (var db = new WmsDb(options))
            Assert.Equal(128m, await db.Positions.Where(p => p.LocationId.StartsWith("main|")).SumAsync(p => p.OnHand));
        await Run(options, "ship", new
        {
            order = "SO-SIM-1001",
            scan = "SKU-A",
            qty = "24",
            packingVerified = true
        });
        await using var verify = new WmsDb(options);
        Assert.Equal(104m, await verify.Positions.Where(p => p.LocationId.StartsWith("main|")).SumAsync(p => p.OnHand));
        Assert.Equal(24m, (await verify.Documents.SingleAsync(d => d.Id == "SO-SIM-1001")).Shipped);
        Assert.Equal(0m, await verify.Allocations.Where(a => a.OrderId == "SO-SIM-1001").SumAsync(a => a.Quantity));
    }
    [Fact]
    public async Task CancellationKeepsStagingReservedUntilPhysicalReturn()
    {
        var options = await postgres.Database();
        await Run(options, "pick", new
        {
            order = "SO-SIM-1001",
            location = "A-01",
            locationScan = "A-01",
            scan = "SKU-A",
            qty = "20",
            reason = "Short pick"
        });
        await Run(options, "cancel", new
        {
            order = "SO-SIM-1001",
            reason = "Customer cancelled"
        });
        string task;
        await using (var db = new WmsDb(options))
        {
            var staged = await db.Positions.SingleAsync(p => p.ItemId == "demo|SKU-A" && p.LocationId == "main|Staging");
            Assert.Equal(20m, staged.Committed);
            Assert.Equal(0m, (await db.Positions.SingleAsync(p => p.Id == "POS-A")).Committed);
            task = await db.Documents.Where(d => d.Kind == "return-stock").Select(d => d.Id).SingleAsync();
        }
        await Run(options, "return-stock", new
        {
            task,
            scan = "SKU-A",
            destination = "A-01",
            locationScan = "A-01",
            qty = "20"
        });
        await using var verify = new WmsDb(options);
        Assert.Equal(100m, (await verify.Positions.SingleAsync(p => p.Id == "POS-A")).OnHand);
        Assert.Equal(0m, await verify.Allocations.Where(a => a.OrderId == "SO-SIM-1001").SumAsync(a => a.Quantity));
    }
    [Fact]
    public async Task CountNeedsDifferentReviewerAndExplicitUnfreeze()
    {
        var options = await postgres.Database();
        await Run(options, "freeze", new
        {
            sku = "SKU-A",
            location = "A-01"
        });
        string task;
        await using (var db = new WmsDb(options))
            task = await db.Documents.Where(d => d.Kind == "count").Select(d => d.Id).SingleAsync();
        await Run(options, "count-submit", new
        {
            task,
            qty = "98"
        }, new ActingPrincipal("operator", "main", "operator"));
        await using (var db = new WmsDb(options))
            Assert.Equal(100m, (await db.Positions.SingleAsync(p => p.Id == "POS-A")).OnHand);
        await Run(options, "adjust-count", new
        {
            task,
            reason = "Approved count variance"
        });
        await using (var db = new WmsDb(options))
        {
            Assert.True((await db.Locations.SingleAsync(l => l.Id == "main|A-01")).Frozen);
            Assert.Equal(98m, (await db.Positions.SingleAsync(p => p.Id == "POS-A")).OnHand);
        }
        await Run(options, "unfreeze", new
        {
            task
        });
        await using var verify = new WmsDb(options);
        Assert.False((await verify.Locations.SingleAsync(l => l.Id == "main|A-01")).Frozen);
        Assert.Equal(-2m, await verify.Entries.Join(verify.Movements, e => e.MovementId, m => m.Id, (e, m) => new { e, m }).Where(x => x.m.Kind == "adjust-count").SumAsync(x => x.e.QuantityDelta));
    }
    [Fact]
    public async Task CanonicalRetryAcceptsReorderedPropertiesAndEquivalentDecimalText()
    {
        var options = await postgres.Database();
        var key = Guid.NewGuid().ToString();
        await using var first = new WmsDb(options);
        var a = await new CommandProcessor(first).Handle(Admin, new CommandRequest("receive", "Main Warehouse", 0, JsonSerializer.SerializeToElement(new
        {
            document = "PO-SIM-100",
            qty = "60.0",
            scan = "SKU-A"
        })), key);
        await using var retry = new WmsDb(options);
        var b = await new CommandProcessor(retry).Handle(Admin, new CommandRequest("receive", "Main Warehouse", 0, JsonSerializer.SerializeToElement(new
        {
            scan = "SKU-A",
            qty = "60",
            document = "PO-SIM-100"
        })), key);
        Assert.Equal(a.Id, b.Id);
    }
    [Fact]
    public async Task PendingCommandCannotMoveToADifferentPrincipal()
    {
        var options = await postgres.Database();
        await using var db = new WmsDb(options);
        var request = new CommandRequest("receive", "Main Warehouse", 0, JsonSerializer.SerializeToElement(new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "60"
        }), PrincipalId: "operator");
        var error = await Assert.ThrowsAsync<BusinessException>(() => new CommandProcessor(db).Handle(Admin, request, Guid.NewGuid().ToString()));
        Assert.Equal("pending-owner", error.Message);
    }
    [Fact]
    public async Task GatewaySpoolSurvivesReopenAndPreservesObservationIdentity()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"wms-gateway-test-{Guid.NewGuid():N}");
        var file = Path.Combine(directory, "spool.sqlite");
        var spool = new ObservationSpool(file);
        await spool.Initialize(CancellationToken.None);
        var observation = new ReaderObservation(Guid.NewGuid(), "Main Warehouse", "READER-TEST", "SESSION-TEST", "00001234", DateTimeOffset.UtcNow);
        await spool.Capture(observation, CancellationToken.None);
        await spool.Capture(observation, CancellationToken.None);
        var reopened = new ObservationSpool(file);
        var pending = await reopened.Pending(CancellationToken.None);
        Assert.Single(pending);
        Assert.Contains("00001234", pending[0].Payload);
        await Assert.ThrowsAsync<InvalidOperationException>(() => reopened.Capture(observation with { TagCode = "different" }, CancellationToken.None));
        await reopened.Acknowledge(observation.Id.ToString(), false, CancellationToken.None);
        Assert.Empty(await reopened.Pending(CancellationToken.None));
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (!Path.GetFullPath(directory).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(directory).StartsWith("wms-gateway-test-", StringComparison.Ordinal))
            throw new InvalidOperationException("Unexpected test cleanup path.");
        Directory.Delete(directory, true);
    }
    [Fact]
    public async Task LedgerExportRechecksCurrentAccess()
    {
        var options = await postgres.Database();
        await using (var db = new WmsDb(options))
        {
            var csv = System.Text.Encoding.UTF8.GetString(await new Wms.Modules.Reporting.LedgerExport(db).Csv(Admin, "SKU-A", "A-01", null, CancellationToken.None));
            Assert.Contains("SKU-A", csv);
            Assert.DoesNotContain("SKU-B", csv);
            (await db.Principals.SingleAsync(p => p.Id == "admin")).Status = "revoked";
            await db.SaveChangesAsync();
        }
        await using var denied = new WmsDb(options);
        var error = await Assert.ThrowsAsync<BusinessException>(() => new Wms.Modules.Reporting.LedgerExport(denied).Csv(Admin, "SKU-A", "A-01", null, CancellationToken.None));
        Assert.Equal(403, error.Status);
    }
}
