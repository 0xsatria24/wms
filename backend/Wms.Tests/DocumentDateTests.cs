using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Fact]
    public async Task StockRowsCarryLastPostedMovementOutsideLedgerPaginationAndRespectBlindScopes()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var op = await Login(factory, "operator");
        var latest = DateTimeOffset.Parse("2026-11-03T03:00:00Z");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            var position = await db.Positions.SingleAsync(p => p.Id == "POS-A");
            foreach (var (id, at) in new[] { ("ROW-OLDER", latest.AddDays(-1)), ("ROW-LATEST", latest) })
            {
                db.Movements.Add(new StockMovement { Id = id, WarehouseId = "main", Kind = "opening", Source = id, Actor = "admin", OccurredAt = at.AddHours(-1), PostedAt = at });
                db.Entries.Add(new StockEntry { MovementId = id, PositionId = position.Id, QuantityDelta = 0 });
            }
            db.Positions.Add(new StockPosition { Id = "ROW-UNKNOWN", ItemId = position.ItemId, LocationId = position.LocationId, Condition = "unassessed", Hold = "unknown-date", OnHand = 1 });
            await db.SaveChangesAsync();
        }
        var path = SnapshotPath + "?view=stock&focusSku=SKU-A";
        var snapshot = await Read(await admin.GetAsync(path));
        Assert.Empty(snapshot.GetProperty("ledger").EnumerateArray());
        var rows = snapshot.GetProperty("positions").EnumerateArray().Where(p => p.GetProperty("sku").GetString() == "SKU-A" && p.GetProperty("location").GetString() == "A-01").ToArray();
        Assert.Equal(latest, rows.Single(p => p.GetProperty("condition").GetString() == "good").GetProperty("lastMovementAt").GetDateTimeOffset());
        Assert.Equal(JsonValueKind.Null, rows.Single(p => p.GetProperty("hold").GetString() == "unknown-date").GetProperty("lastMovementAt").ValueKind);
        var again = await Read(await admin.GetAsync(path));
        Assert.Equal(rows[0].GetProperty("lastMovementAt").GetRawText(), again.GetProperty("positions").EnumerateArray().First(p => p.GetProperty("sku").GetString() == "SKU-A" && p.GetProperty("location").GetString() == "A-01").GetProperty("lastMovementAt").GetRawText());
        await Read(await Command(admin, "admin", "freeze", 0, new { sku = "SKU-A", location = "A-01" }));
        var blind = await Read(await op.GetAsync(path));
        Assert.DoesNotContain(blind.GetProperty("positions").EnumerateArray(), p => p.GetProperty("sku").GetString() == "SKU-A" && p.GetProperty("location").GetString() == "A-01");
    }

    [Fact]
    public async Task WarehouseReportDateBoundariesMatchCsvAndSnapshot()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            var at = DateTimeOffset.Parse("2026-11-01T16:30:00Z");
            db.Movements.Add(new StockMovement { Id = "DATE-BOUNDARY", WarehouseId = "main", Kind = "opening", Source = "DATE-BOUNDARY", Actor = "admin", OccurredAt = at, PostedAt = at });
            db.Entries.Add(new StockEntry { MovementId = "DATE-BOUNDARY", PositionId = "POS-A", QuantityDelta = 0 });
            await db.SaveChangesAsync();
        }
        var path = SnapshotPath + "?view=movements&sku=SKU-A&query=DATE-BOUNDARY&from=2026-11-02&to=2026-11-02";
        Assert.Empty((await Read(await admin.GetAsync(path))).GetProperty("ledger").EnumerateArray());
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync(SettingsPath + "/warehouse", new { version = 0, address = "", timeZone = "Asia/Makassar", reason = "Timezone boundary check" })).StatusCode);
        var snapshot = await Read(await admin.GetAsync(path));
        Assert.Single(snapshot.GetProperty("ledger").EnumerateArray());
        var csv = await admin.GetStringAsync("/api/workspaces/Main%20Warehouse/ledger.csv?sku=SKU-A&query=DATE-BOUNDARY&from=2026-11-02&to=2026-11-02");
        Assert.Contains("DATE-BOUNDARY", csv);
        Assert.Contains("Asia/Makassar", csv);
        Assert.Contains("GeneratedAtUTC", csv);
        Assert.Contains("2026-11-02", csv);
    }

    [Fact]
    public async Task DocumentDatesEnforceScopeVersionAndFilterBeforePagination()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var op = await Login(factory, "operator");
        const string id = "SO-SIM-1002";
        var payload = new { id, version = 0, documentDate = "2026-11-02", scheduledDate = "2026-11-05" };
        Assert.Equal(HttpStatusCode.Forbidden, (await Edit(op, "document-dates", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "document-dates", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Edit(admin, "document-dates", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(admin, "document-dates", new { id, version = 1, documentDate = "2026-02-30", scheduledDate = "" })).StatusCode);
        var snapshot = await Read(await admin.GetAsync(SnapshotPath + "?view=orders&from=2026-11-02&to=2026-11-02&focusDocument=" + id));
        var dates = snapshot.GetProperty("documentDates").GetProperty(id);
        Assert.Equal("2026-11-05", dates.GetProperty("scheduledDate").GetString());
        Assert.NotEqual(JsonValueKind.Null, dates.GetProperty("updatedAt").ValueKind);
        Assert.Contains(snapshot.GetProperty("catalogue").GetProperty("ids").EnumerateArray(), row => row.GetString() == id);
        var empty = await Read(await admin.GetAsync(SnapshotPath + "?view=orders&from=1999-01-01&to=1999-01-01"));
        Assert.Equal(0, empty.GetProperty("catalogue").GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync(SnapshotPath + "?view=orders&from=2026-11-03&to=2026-11-02")).StatusCode);
    }

    [Fact]
    public async Task CountLifecycleKeepsServerTimesAndIdempotentRetry()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var op = await Login(factory, "operator");
        await Read(await Command(admin, "admin", "freeze", 0, new { sku = "SKU-A", location = "A-01" }));
        var snapshot = await Read(await admin.GetAsync(SnapshotPath + "?view=count"));
        var task = snapshot.GetProperty("counts")[0].GetProperty("id").GetString();
        var dates = snapshot.GetProperty("documentDates").GetProperty(task!);
        Assert.NotEqual(JsonValueKind.Null, dates.GetProperty("startedAt").ValueKind);
        var key = Guid.NewGuid().ToString();
        await Read(await Command(op, "operator", "count-submit", 0, new { task, qty = "100" }, key));
        var submitted = (await Read(await admin.GetAsync(SnapshotPath + "?view=count"))).GetProperty("documentDates").GetProperty(task!).GetProperty("submittedAt").GetString();
        await Read(await Command(op, "operator", "count-submit", 0, new { task, qty = "100" }, key));
        var retried = (await Read(await admin.GetAsync(SnapshotPath + "?view=count"))).GetProperty("documentDates").GetProperty(task!).GetProperty("submittedAt").GetString();
        Assert.Equal(submitted, retried);
        await Read(await Command(admin, "admin", "adjust-count", 1, new { task, reason = "Verified physical count" }));
        dates = (await Read(await admin.GetAsync(SnapshotPath + "?view=count"))).GetProperty("documentDates").GetProperty(task!);
        Assert.NotEqual(JsonValueKind.Null, dates.GetProperty("approvedAt").ValueKind);
    }
}

public sealed class WarehouseDateBoundaryTests
{
    [Fact]
    public void BoundariesRespectWarehouseZone()
    {
        var date = new DateOnly(2026, 11, 2);
        Assert.Equal(DateTimeOffset.Parse("2026-11-01T17:00:00Z"), WarehouseDates.Start(date, "Asia/Jakarta"));
        Assert.Equal(DateTimeOffset.Parse("2026-11-01T16:00:00Z"), WarehouseDates.Start(date, "Asia/Makassar"));
    }
}
