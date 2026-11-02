using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Inventory;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

public sealed class ReferenceIdFormatTests
{
    [Fact]
    public void NewReferenceIsTheCompleteBase64UrlEncodingOfTwelveBytes()
    {
        var id = ReferenceId.New();
        Assert.Matches("^[A-Za-z0-9_-]{16}$", id);
        var bytes = Convert.FromBase64String(id.Replace('-', '+').Replace('_', '/'));
        Assert.Equal(12, bytes.Length);
        Assert.Equal(id, Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_'));
    }
}

[Collection("PostgreSQL")]
public sealed class ReferenceWorkflowTests(PostgresFixture postgres)
{
    [Fact]
    public async Task NewTransactionAndTaskIdsStayCompleteAcrossReceiptQcPutawayAndRetry()
    {
        var options = await postgres.Database();
        var actor = new ActingPrincipal("admin", "main", "admin");
        var request = new CommandRequest("receive", "Main Warehouse", 0, JsonSerializer.SerializeToElement(new { document = "PO-SIM-100", scan = "SKU-A", qty = "4" }));
        var key = Guid.NewGuid().ToString();
        await using var db = new WmsDb(options);
        var receipt = await new CommandProcessor(db).Handle(actor, request, key);
        Assert.Matches("^[A-Za-z0-9_-]{16}$", receipt.Id);
        var inspection = await db.Documents.SingleAsync(d => d.Kind == "inspection" && d.Source == receipt.Id);
        Assert.Matches("^[A-Za-z0-9_-]{16}$", inspection.Id);

        await using var qcDb = new WmsDb(options);
        var qc = await new CommandProcessor(qcDb).Handle(actor, new CommandRequest("qc", "Main Warehouse", 0, JsonSerializer.SerializeToElement(new { task = inspection.Id, scan = "SKU-A", good = "4", bad = "0" })), Guid.NewGuid().ToString());
        Assert.Matches("^[A-Za-z0-9_-]{16}$", qc.Id);
        var putaway = await qcDb.Documents.SingleAsync(d => d.Kind == "putaway" && d.Source == inspection.Id);
        Assert.Matches("^[A-Za-z0-9_-]{16}$", putaway.Id);

        await using var putawayDb = new WmsDb(options);
        var result = await new CommandProcessor(putawayDb).Handle(actor, new CommandRequest("putaway", "Main Warehouse", 0, JsonSerializer.SerializeToElement(new { task = putaway.Id, scan = "SKU-A", destination = "A-02", locationScan = "A-02", qty = "4" })), Guid.NewGuid().ToString());
        Assert.Matches("^[A-Za-z0-9_-]{16}$", result.Id);
        Assert.Equal(putaway.Id, (await putawayDb.Movements.SingleAsync(m => m.Id == result.Id)).Source);

        await using var retryDb = new WmsDb(options);
        var retried = await new CommandProcessor(retryDb).Handle(actor, request, key);
        Assert.Equal(receipt.Id, retried.Id);
        Assert.Single(await retryDb.Movements.Where(m => m.Id == receipt.Id).ToListAsync());
        Assert.True(await retryDb.Documents.AnyAsync(d => d.Id == "PO-SIM-100"));
        Assert.Equal(putaway.Id, (await retryDb.Outbox.SingleAsync(e => e.Kind == "putaway" && e.AggregateId == putaway.Id)).AggregateId);
    }
}
