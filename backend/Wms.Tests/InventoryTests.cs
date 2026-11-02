using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Inventory;
using Wms.Modules.Reporting;
using Wms.Modules.Access;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class InventoryTests(PostgresFixture postgres)
{
    private static readonly ActingPrincipal Admin = new("admin", "main", "admin");
    private static CommandRequest Command(string type, object payload, long? version = 0) => new(type, "Main Warehouse", version, JsonSerializer.SerializeToElement(payload));
    private static string Key() => Guid.NewGuid().ToString();
    [Fact]
    public async Task Receipt60Leaves40AndRetryPostsOnce()
    {
        var options = await postgres.Database();
        var key = Key();
        var command = Command("receive", new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "60"
        });
        await using var first = new WmsDb(options);
        var a = await new CommandProcessor(first).Handle(Admin, command, key);
        await using var second = new WmsDb(options);
        var b = await new CommandProcessor(second).Handle(Admin, command, key);
        Assert.Equal(a.Id, b.Id);
        Assert.Equal(60m, (await second.Documents.SingleAsync(d => d.Id == "PO-SIM-100")).Actual);
        Assert.Single(await second.Movements.Where(m => m.Kind == "receive").ToListAsync());
        Assert.Single(await second.Outbox.Where(e => e.Kind == "receive").ToListAsync());
    }
    [Fact]
    public async Task SameKeyWithDifferentPayloadIsRejected()
    {
        var options = await postgres.Database();
        var key = Key();
        await using (var db = new WmsDb(options))
            await new CommandProcessor(db).Handle(Admin, Command("receive", new
            {
                document = "PO-SIM-100",
                scan = "SKU-A",
                qty = "60"
            }), key);
        await using var retry = new WmsDb(options);
        var error = await Assert.ThrowsAsync<BusinessException>(() => new CommandProcessor(retry).Handle(Admin, Command("receive", new { document = "PO-SIM-100", scan = "SKU-A", qty = "61" }), key));
        Assert.Equal("key-changed", error.Message);
    }
    [Fact]
    public async Task FailureBeforeCommitRollsBackBalanceAuditOutboxAndIdempotency()
    {
        var options = await postgres.Database();
        await using (var db = new WmsDb(options))
        {
            var processor = new CommandProcessor(db) { BeforeCommit = () => throw new IOException("Injected precommit failure") };
            await Assert.ThrowsAsync<IOException>(() => processor.Handle(Admin, Command("receive", new { document = "PO-SIM-100", scan = "SKU-A", qty = "60" }), Key()));
        }
        await using var verify = new WmsDb(options);
        Assert.Equal(0m, (await verify.Documents.SingleAsync(d => d.Id == "PO-SIM-100")).Actual);
        Assert.Empty(await verify.Audit.ToListAsync());
        Assert.Empty(await verify.Requests.ToListAsync());
        Assert.Empty(await verify.Outbox.Where(e => e.Kind == "receive").ToListAsync());
        Assert.Equal(100m, (await verify.Positions.SingleAsync(p => p.Id == "POS-A")).OnHand);
    }
    [Fact]
    public async Task ConcurrentReservationsCannotOversell76AvailableUnits()
    {
        var options = await postgres.Database();
        await using (var setup = new WmsDb(options))
        {
            setup.Settings.Single().PartialAllowed = true;
            setup.Documents.Add(new OperationalDocument { Id = "SO-OTHER", Kind = "order", WarehouseId = "main", ItemId = "demo|SKU-A", Quantity = 120, Status = "released", Creator = "operator" });
            await setup.SaveChangesAsync();
        }
        async Task<bool> Reserve(string order)
        {
            await using var db = new WmsDb(options);
            try
            {
                await new CommandProcessor(db).Handle(Admin, Command("reserve", new
                {
                    order,
                    location = "A-01",
                    qty = "60"
                }), Key());
                return true;
            }
            catch (BusinessException error) when (error.Message == "shortage") { return false; }
        }
        var results = await Task.WhenAll(Reserve("SO-SIM-1003"), Reserve("SO-OTHER"));
        Assert.Single(results, x => x);
        await using var verify = new WmsDb(options);
        var pos = await verify.Positions.SingleAsync(p => p.Id == "POS-A");
        Assert.Equal(84m, pos.Committed);
        Assert.Equal(100m, pos.OnHand);
    }
    [Fact]
    public async Task ConcurrentIdenticalRequestsReturnSameResult()
    {
        var options = await postgres.Database();
        var key = Key();
        var request = Command("receive", new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "60"
        });
        async Task<CommandResult> Send()
        {
            await using var db = new WmsDb(options);
            return await new CommandProcessor(db).Handle(Admin, request, key);
        }
        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Send()));
        Assert.Single(results.Select(r => r.Id).Distinct());
        await using var verify = new WmsDb(options);
        Assert.Equal(60m, (await verify.Documents.SingleAsync(d => d.Id == "PO-SIM-100")).Actual);
    }
    [Fact]
    public async Task PickMovesPhysicalAndCommitmentButDoesNotShip()
    {
        var options = await postgres.Database();
        await using var db = new WmsDb(options);
        await new CommandProcessor(db).Handle(Admin, Command("pick", new
        {
            order = "SO-SIM-1001",
            location = "A-01",
            locationScan = "A-01",
            scan = "SKU-A",
            qty = "20",
            reason = "Bin shortage"
        }), Key());
        Assert.Equal(80m, (await db.Positions.SingleAsync(p => p.Id == "POS-A")).OnHand);
        Assert.Equal(4m, (await db.Positions.SingleAsync(p => p.Id == "POS-A")).Committed);
        var staged = await db.Positions.SingleAsync(p => p.ItemId == "demo|SKU-A" && p.LocationId == "main|Staging");
        Assert.Equal(20m, staged.OnHand);
        Assert.Equal(20m, staged.Committed);
        Assert.Equal(0m, (await db.Documents.SingleAsync(d => d.Id == "SO-SIM-1001")).Shipped);
    }
    [Fact]
    public async Task Transfer50Receive48Keeps2InTransit()
    {
        var options = await postgres.Database();
        await using var db = new WmsDb(options);
        await new CommandProcessor(db).Handle(Admin, Command("transfer-receive", new
        {
            document = "TR-SIM-001",
            scan = "SKU-A",
            qty = "48"
        }), Key());
        Assert.Equal(2m, (await db.Positions.SingleAsync(p => p.Id == "POS-TRANSIT")).OnHand);
        Assert.Equal(48m, (await db.Documents.SingleAsync(d => d.Id == "TR-SIM-001")).Actual);
        Assert.Equal(48m, (await db.Positions.SingleAsync(p => p.LocationId == "main|Receiving")).OnHand);
    }
    [Fact]
    public async Task FrozenLocationBlocksPicking()
    {
        var options = await postgres.Database();
        await using (var db = new WmsDb(options))
            await new CommandProcessor(db).Handle(Admin, Command("freeze", new
            {
                sku = "SKU-A",
                location = "A-01"
            }, null), Key());
        await using var pick = new WmsDb(options);
        var error = await Assert.ThrowsAsync<BusinessException>(() => new CommandProcessor(pick).Handle(Admin, Command("pick", new { order = "SO-SIM-1001", location = "A-01", locationScan = "A-01", scan = "SKU-A", qty = "24" }), Key()));
        Assert.Equal("frozen", error.Message);
    }
    [Fact]
    public async Task DecimalQuantitiesAreExactInPostgres()
    {
        var options = await postgres.Database();
        await using (var db = new WmsDb(options))
            await new CommandProcessor(db).Handle(Admin, Command("receive", new
            {
                document = "PO-SIM-100",
                scan = "SKU-A",
                qty = "0.1"
            }), Key());
        await using (var db = new WmsDb(options))
            await new CommandProcessor(db).Handle(Admin, Command("receive", new
            {
                document = "PO-SIM-100",
                scan = "SKU-A",
                qty = "0.2"
            }, 1), Key());
        await using var verify = new WmsDb(options);
        Assert.Equal(.3m, (await verify.Documents.SingleAsync(d => d.Id == "PO-SIM-100")).Actual);
    }
    [Fact]
    public async Task RevokedAccessCannotRetrieveSuccessfulRetry()
    {
        var options = await postgres.Database();
        var key = Key();
        var command = Command("receive", new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "60"
        });
        await using (var db = new WmsDb(options))
            await new CommandProcessor(db).Handle(Admin, command, key);
        await using (var revoke = new WmsDb(options))
        {
            (await revoke.Principals.SingleAsync(p => p.Id == "admin")).Status = "revoked";
            await revoke.SaveChangesAsync();
        }
        await using var retry = new WmsDb(options);
        var error = await Assert.ThrowsAsync<BusinessException>(() => new CommandProcessor(retry).Handle(Admin, command, key));
        Assert.Equal(403, error.Status);
    }
    [Fact]
    public async Task OperatorSnapshotDoesNotContainExpectedCountBalance()
    {
        var options = await postgres.Database();
        await using (var db = new WmsDb(options))
            await new CommandProcessor(db).Handle(Admin, Command("freeze", new
            {
                sku = "SKU-A",
                location = "A-01"
            }, null), Key());
        await using var query = new WmsDb(options);
        var snapshot = await new SnapshotQuery(query).Read(new ActingPrincipal("operator", "main", "operator"), CancellationToken.None);
        var json = JsonSerializer.SerializeToElement(snapshot);
        var count = json.GetProperty("counts").EnumerateArray().Single();
        Assert.False(count.TryGetProperty("expected", out _));
        Assert.Equal("A-01", count.GetProperty("location").GetString());
        Assert.DoesNotContain(json.GetProperty("positions").EnumerateArray(), p => p.GetProperty("sku").GetString() == "SKU-A" && p.GetProperty("location").GetString() == "A-01");
        Assert.DoesNotContain(json.GetProperty("ledger").EnumerateArray(), p => p.GetProperty("sku").GetString() == "SKU-A" && p.GetProperty("location").GetString() == "A-01");
    }
}
