using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Reporting;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class WorkspacePagingTests(PostgresFixture postgres)
{
    [Fact]
    public async Task StockAndOperationalQueueQueriesExecuteWithStablePages()
    {
        await using var db = new WmsDb(await postgres.Database());
        var query = new SnapshotQuery(db);
        foreach (var view in new[] { "stock", "receiving", "quality", "putaway", "orders", "reservations", "picking", "shipping", "movements", "tracking" })
        {
            var result = JsonSerializer.SerializeToElement(await query.Read(new("admin", "main", "admin"), CancellationToken.None, new WorkspaceQuery { View = view, PageSize = 10, Sort = view == "stock" ? "available" : "remaining-desc", FocusSku = "SKU-A" }));
            Assert.InRange(result.GetProperty("products").GetArrayLength(), 1, 50);
            Assert.Equal(view, result.GetProperty("catalogue").GetProperty("view").GetString());
            Assert.InRange(result.GetProperty("catalogue").GetProperty("ids").GetArrayLength(), 0, 10);
            if (view == "tracking") Assert.NotEmpty(result.GetProperty("ledger").EnumerateArray());
        }
    }

    [Fact]
    public async Task SnapshotPagesCatalogueInDatabaseAndDoesNotShipFullLedger()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Items.AddRange(Enumerable.Range(0, 120).Select(index => new Item { Id = $"bulk-{index:D4}", Sku = $"BULK-{index:D4}", Name = $"Bulk item {index:D4}", Barcode = $"999{index:D6}" }));
        await db.SaveChangesAsync();
        var query = new SnapshotQuery(db);
        var result = JsonSerializer.SerializeToElement(await query.Read(new("admin", "main", "admin"), CancellationToken.None, new WorkspaceQuery { View = "master", Page = 2, PageSize = 10, Query = "BULK-", Sort = "sku", RequestKey = "page-two" }));
        Assert.Equal(10, result.GetProperty("products").GetArrayLength());
        Assert.Equal("BULK-0010", result.GetProperty("products")[0].GetProperty("sku").GetString());
        Assert.Equal(120, result.GetProperty("catalogue").GetProperty("total").GetInt32());
        Assert.Equal(12, result.GetProperty("catalogue").GetProperty("pages").GetInt32());
        Assert.Empty(result.GetProperty("ledger").EnumerateArray());
    }
}
