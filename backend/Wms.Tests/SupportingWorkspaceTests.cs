using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Wms.Infrastructure;
using Wms.Modules.Catalog;
using Wms.Modules.Reporting;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class SupportingWorkspaceTests(PostgresFixture postgres)
{
    private static readonly ActingPrincipal Admin = new("admin", "main", "admin");
    private static readonly CancellationToken Ct = CancellationToken.None;
    private static async Task<JsonElement> Read(WmsDb db, WorkspaceQuery input, ActingPrincipal? actor = null) =>
        JsonSerializer.SerializeToElement(await new SnapshotQuery(db).Read(actor ?? Admin, Ct, input));

    [Fact]
    public async Task ZeroStockHistoryAndUnitTotalsUseTheFullFilterAcrossPages()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Items.AddRange(Enumerable.Range(0, 30).Select(n => new Item { Id = $"extra-{n}", Sku = $"EXTRA-{n:D2}", Name = "Extra catalogue item", Barcode = $"extra-{n}" }));
        db.Items.Add(new Item { Id = "zero", Sku = "ZZ-ZERO", Name = "Zero history", Barcode = "zero", Unit = "kg" });
        db.Positions.Add(new StockPosition { Id = "zero-pos", ItemId = "zero", LocationId = "main|A-02" });
        for (var n = 0; n < 32; n++)
        {
            db.Movements.Add(new StockMovement { Id = $"history-{n:D2}", WarehouseId = "main", Kind = "opening", Source = "old-source", PostedAt = DateTimeOffset.UtcNow.AddMinutes(n), OccurredAt = DateTimeOffset.UtcNow });
            db.Entries.Add(new StockEntry { MovementId = $"history-{n:D2}", PositionId = "zero-pos", QuantityDelta = n % 2 == 0 ? 1.25m : -1.25m, Unit = "kg" });
        }
        await db.SaveChangesAsync();
        foreach (var page in new[] { 1, 2 })
        {
            var result = await Read(db, new WorkspaceQuery(View: "tracking", Page: page, PageSize: 25, Query: "old-source", Sku: "ZZ-ZERO"));
            Assert.Contains(result.GetProperty("products").EnumerateArray(), item => item.GetProperty("sku").GetString() == "ZZ-ZERO");
            Assert.Equal(32, result.GetProperty("ledgerPage").GetProperty("total").GetInt32());
            Assert.Equal(page == 1 ? 25 : 7, result.GetProperty("ledger").GetArrayLength());
            var summary = result.GetProperty("ledgerSummary");
            Assert.Equal(32, summary.GetProperty("total").GetInt32());
            var quantity = Assert.Single(summary.GetProperty("quantities").EnumerateArray());
            Assert.Equal("kg", quantity.GetProperty("unit").GetString());
            Assert.Equal("0", quantity.GetProperty("qty").GetString());
        }
        var all = await Read(db, new WorkspaceQuery(View: "movements", PageSize: 1));
        Assert.Equal(2, all.GetProperty("ledgerSummary").GetProperty("quantities").GetArrayLength());
        Assert.Contains(all.GetProperty("ledgerSummary").GetProperty("quantities").EnumerateArray(), q => q.GetProperty("unit").GetString() == "units" && q.GetProperty("qty").GetString() == "128");
    }

    [Fact]
    public async Task BlindCountsHideLedgerRowsCountsAndAggregatesBeforePagination()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Documents.Add(new OperationalDocument { Id = "blind", Kind = "count", WarehouseId = "main", ItemId = "demo|SKU-A", LocationId = "main|A-01", Status = "counting" });
        var payload = JsonSerializer.Serialize(new { document = "PO-1", Payload = new { lines = new[] { new { quantity = 333, expected = 333 } } } });
        db.Audit.Add(new AuditRecord { TransactionId = "blind-payload", PrincipalId = "admin", WarehouseId = "main", Action = "opening", DetailJson = payload, PostedAt = DateTimeOffset.UtcNow });
        db.Outbox.Add(new OutboxEvent { WarehouseId = "main", AggregateId = "blind-payload", Kind = "opening", PayloadJson = payload, CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        var result = await Read(db, new WorkspaceQuery(View: "movements", Sku: "SKU-A"), new("operator", "main", "operator"));
        Assert.Empty(result.GetProperty("ledger").EnumerateArray());
        Assert.Equal(0, result.GetProperty("ledgerPage").GetProperty("total").GetInt32());
        Assert.Equal(0, result.GetProperty("ledgerSummary").GetProperty("total").GetInt32());
        Assert.Empty(result.GetProperty("ledgerSummary").GetProperty("quantities").EnumerateArray());
        foreach (var view in new[] { "count", "integration", "stock" })
        {
            var blind = await Read(db, new WorkspaceQuery(View: view), new("operator", "main", "operator"));
            Assert.All(blind.GetProperty("audit").EnumerateArray(), a => Assert.Empty(a.GetProperty("payload").EnumerateObject()));
            Assert.All(blind.GetProperty("events").EnumerateArray(), e => Assert.Empty(e.GetProperty("payload").EnumerateObject()));
        }
        var reviewer = await Read(db, new WorkspaceQuery(View: "integration"));
        Assert.Contains("333", reviewer.GetProperty("events").GetRawText());
        (await db.Documents.SingleAsync(d => d.Id == "blind")).Status = "closed";
        await db.SaveChangesAsync();
        var closed = await Read(db, new WorkspaceQuery(View: "integration"), new("operator", "main", "operator"));
        Assert.Contains("333", closed.GetProperty("events").GetRawText());
    }

    [Fact]
    public async Task CatalogueIdsKeepNameSortOrder()
    {
        await using var db = new WmsDb(await postgres.Database());
        (await db.Items.SingleAsync(i => i.Sku == "SKU-A")).Name = "Zulu";
        (await db.Items.SingleAsync(i => i.Sku == "SKU-B")).Name = "Alpha";
        (await db.Items.SingleAsync(i => i.Sku == "SKU-C")).Name = "Middle";
        await db.SaveChangesAsync();
        var ascending = await Read(db, new WorkspaceQuery(View: "master", Sort: "item"));
        Assert.Equal(new[] { "SKU-B", "SKU-C", "SKU-A" }, ascending.GetProperty("catalogue").GetProperty("ids").EnumerateArray().Select(i => i.GetString()));
        var descending = await Read(db, new WorkspaceQuery(View: "master", Sort: "item", Descending: true));
        Assert.Equal(new[] { "SKU-A", "SKU-C", "SKU-B" }, descending.GetProperty("catalogue").GetProperty("ids").EnumerateArray().Select(i => i.GetString()));
    }

    [Fact]
    public async Task OldErpExceptionsRemainSearchableBeyondTwoHundredAcceptedEvents()
    {
        await using var db = new WmsDb(await postgres.Database());
        var stamp = DateTimeOffset.UtcNow;
        for (var n = 0; n < 205; n++)
            db.Outbox.Add(new OutboxEvent { WarehouseId = "main", AggregateId = $"done-{n:D3}", Kind = "confirmed", BusinessStatus = "accepted", TransportStatus = "delivered", CreatedAt = stamp.AddMinutes(n) });
        db.Outbox.Add(new OutboxEvent { WarehouseId = "main", AggregateId = "old-failure", Kind = "confirmed", BusinessStatus = "rejected", TransportStatus = "delivered", CreatedAt = stamp.AddDays(-10) });
        db.Outbox.Add(new OutboxEvent { WarehouseId = "secondary", AggregateId = "old-failure", BusinessStatus = "rejected", CreatedAt = stamp });
        await db.SaveChangesAsync();
        var result = await Read(db, new WorkspaceQuery(View: "integration", Query: "old-failure", Status: "needs-attention"));
        Assert.Equal("old-failure", Assert.Single(result.GetProperty("events").EnumerateArray()).GetProperty("source").GetString());
        Assert.Equal(1, result.GetProperty("eventPage").GetProperty("total").GetInt32());
        Assert.Equal(207, result.GetProperty("eventPage").GetProperty("scopeTotal").GetInt32());
        var last = await Read(db, new WorkspaceQuery(View: "integration", Page: 9, PageSize: 25));
        Assert.Equal(7, last.GetProperty("events").GetArrayLength());
        Assert.Equal(207, last.GetProperty("eventPage").GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task WarehouseRoleMapSurvivesUnchangedSaveAndChangesOnlyExplicitRows()
    {
        var options = await postgres.Database();
        await using (var db = new WmsDb(options))
        {
            db.AccessGrants.Add(new AccessGrant { PrincipalId = "operator", WarehouseId = "secondary", Role = "viewer" });
            await db.SaveChangesAsync();
            var result = await Read(db, new WorkspaceQuery(View: "access"));
            var user = result.GetProperty("users").EnumerateArray().Single(u => u.GetProperty("id").GetString() == "operator");
            Assert.Equal("viewer", user.GetProperty("warehouseRoles").GetProperty("Secondary Warehouse").GetString());
            await new EditService(db, new DevelopmentEnvironment()).Apply(Admin, new("access", "Main Warehouse", JsonSerializer.SerializeToElement(new { id = "operator", status = "active", role = "operator", warehouses = new[] { "Main Warehouse", "Secondary Warehouse" }, reason = "No changes" })), Ct);
        }
        await using (var db = new WmsDb(options))
        {
            Assert.Equal("viewer", (await db.AccessGrants.SingleAsync(g => g.PrincipalId == "operator" && g.WarehouseId == "secondary")).Role);
            await new EditService(db, new DevelopmentEnvironment()).Apply(Admin, new("access", "Main Warehouse", JsonSerializer.SerializeToElement(new { id = "operator", status = "active", warehouseRoles = new Dictionary<string, string> { ["Main Warehouse"] = "supervisor", ["Secondary Warehouse"] = "viewer" }, reason = "Promote main only" })), Ct);
        }
        await using var verify = new WmsDb(options);
        Assert.Equal("supervisor", (await verify.AccessGrants.SingleAsync(g => g.PrincipalId == "operator" && g.WarehouseId == "main")).Role);
        Assert.Equal("viewer", (await verify.AccessGrants.SingleAsync(g => g.PrincipalId == "operator" && g.WarehouseId == "secondary")).Role);
    }

    [Fact]
    public async Task PackageCatalogueSearchReachesTheHundredthPackageAndLocationsExposeOperatingState()
    {
        await using var db = new WmsDb(await postgres.Database());
        for (var n = 2; n <= 100; n++)
            db.SupportingRecords.Add(new SupportingRecord { Id = $"package|PKG-{n:D3}", WarehouseId = "main", Kind = "packages", PayloadJson = JsonSerializer.Serialize(new { id = $"PKG-{n:D3}", version = 1, items = new[] { new { sku = "SKU-A", qty = "2" } } }) });
        (await db.Locations.SingleAsync(l => l.Id == "main|A-02")).Frozen = true;
        await db.SaveChangesAsync();
        var input = JsonSerializer.Deserialize<WorkspaceQuery>("{\"View\":\"labels\",\"PackagesQuery\":\"PKG-100\"}")!;
        var result = await Read(db, input);
        Assert.Equal("PKG-100", Assert.Single(result.GetProperty("packages").EnumerateArray()).GetProperty("id").GetString());
        Assert.Equal(1, result.GetProperty("packagePage").GetProperty("total").GetInt32());
        var frozen = result.GetProperty("locationMaster").EnumerateArray().Single(l => l.GetProperty("name").GetString() == "A-02");
        Assert.True(frozen.GetProperty("frozen").GetBoolean());
        Assert.True(frozen.GetProperty("pickable").GetBoolean());
        var last = await Read(db, new WorkspaceQuery(View: "labels", PackagesPage: 4));
        Assert.Equal(25, last.GetProperty("packages").GetArrayLength());
        Assert.Equal(100, last.GetProperty("packagePage").GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task ReturnSourcesGroupShipmentEntriesSubtractPriorReturnsAndRespectWarehouseAndQcAvailability()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Items.Add(new Item { Id = "shipped-item", Sku = "ZZ-SHIPPED", Name = "Shipped item", Barcode = "shipped" });
        db.Positions.Add(new StockPosition { Id = "shipped-pos", ItemId = "shipped-item", LocationId = "main|Staging" });
        db.Movements.Add(new StockMovement { Id = "valid-shipment", WarehouseId = "main", Kind = "ship", PostedAt = DateTimeOffset.UtcNow });
        db.Entries.AddRange(new StockEntry { MovementId = "valid-shipment", PositionId = "shipped-pos", QuantityDelta = -5 }, new StockEntry { MovementId = "valid-shipment", PositionId = "shipped-pos", QuantityDelta = -3 });
        db.Documents.Add(new OperationalDocument { Id = "prior-return", Kind = "customer-return", WarehouseId = "main", ItemId = "shipped-item", Source = "valid-shipment", Quantity = 2, Actual = 2 });
        db.Movements.Add(new StockMovement { Id = "foreign-shipment", WarehouseId = "secondary", Kind = "ship", PostedAt = DateTimeOffset.UtcNow });
        db.Entries.Add(new StockEntry { MovementId = "foreign-shipment", PositionId = "shipped-pos", QuantityDelta = -100 });
        db.Documents.Add(new OperationalDocument { Id = "prior-supplier-return", Kind = "supplier-return", WarehouseId = "main", ItemId = "demo|SKU-B", Source = "OPEN-POS-B", Quantity = 5, Actual = 5 });
        await db.SaveChangesAsync();
        var result = await Read(db, new WorkspaceQuery(View: "returns", Sku: "ZZ-SHIPPED"));
        var source = Assert.Single(result.GetProperty("returnSources").EnumerateArray());
        Assert.Equal("valid-shipment", source.GetProperty("id").GetString());
        Assert.Equal("6", source.GetProperty("remaining").GetString());
        var supplier = await Read(db, new WorkspaceQuery(View: "returns", Sku: "SKU-B"));
        Assert.Equal("12", Assert.Single(supplier.GetProperty("returnSources").EnumerateArray()).GetProperty("remaining").GetString());
    }

    [Fact]
    public async Task FollowupsKeepTheOriginalWarehouseCaseReference()
    {
        await using var db = new WmsDb(await postgres.Database());
        await new EditService(db, new DevelopmentEnvironment()).Apply(Admin, new("followups", "Main Warehouse", JsonSerializer.SerializeToElement(new { caseReference = "HIST-SIM-020", note = "Ask ERP owner to configure delivery", user = "ignored", warehouse = "ignored", stamp = "ignored" })), Ct);
        var result = await Read(db, new WorkspaceQuery(View: "monitoring"));
        var followup = Assert.Single(result.GetProperty("followups").EnumerateArray());
        Assert.Equal("HIST-SIM-020", followup.GetProperty("caseReference").GetString());
        Assert.Equal("admin", followup.GetProperty("user").GetString());
        Assert.Equal("Main Warehouse", followup.GetProperty("warehouse").GetString());
    }

    [Fact]
    public async Task ExplicitWarehouseRoleChangesCannotCrossTheAdministratorsScope()
    {
        var options = await postgres.Database();
        await using (var db = new WmsDb(options))
        {
            (await db.AccessGrants.SingleAsync(g => g.PrincipalId == "admin" && g.WarehouseId == "secondary")).Role = "viewer";
            await db.SaveChangesAsync();
            var error = await Assert.ThrowsAsync<BusinessException>(() => new EditService(db, new DevelopmentEnvironment()).Apply(Admin, new("access", "Main Warehouse", JsonSerializer.SerializeToElement(new { id = "operator", status = "active", warehouseRoles = new Dictionary<string, string> { ["Main Warehouse"] = "operator", ["Secondary Warehouse"] = "admin" }, reason = "Unauthorized addition" })), Ct));
            Assert.Equal("scope", error.Message);
        }
        await using var verify = new WmsDb(options);
        Assert.Single(await verify.AccessGrants.Where(g => g.PrincipalId == "operator").ToListAsync());
        Assert.False(await verify.Audit.AnyAsync(a => a.Action == "access"));
    }

    private sealed class DevelopmentEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "Wms.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
