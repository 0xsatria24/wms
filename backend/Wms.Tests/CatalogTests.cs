using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Wms.Infrastructure;
using Wms.Modules.Catalog;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class CatalogTests(PostgresFixture postgres)
{
    private static readonly ActingPrincipal Admin = new("admin", "main", "admin");
    private static EditRequest Delete(string reason = "Duplicate unused master", long version = 0) =>
        new("delete-master", "Main Warehouse", JsonSerializer.SerializeToElement(new
        {
            sku = "SKU-DELETE",
            version,
            reason
        }));

    private async Task<DbContextOptions<WmsDb>> UnusedItem()
    {
        var options = await postgres.Database();
        await using var db = new WmsDb(options);
        db.Items.Add(new Item { Id = "demo|SKU-DELETE", Sku = "SKU-DELETE", Name = "Unused test item", Barcode = "000012345" });
        await db.SaveChangesAsync();
        return options;
    }

    [Theory]
    [InlineData("admin", "admin")]
    [InlineData("supervisor", "supervisor")]
    public async Task UnusedItemCanBeDeletedWithAuditSnapshot(string id, string role)
    {
        var options = await UnusedItem();
        await using (var db = new WmsDb(options))
            await new EditService(db, new DevelopmentEnvironment()).Apply(new(id, "main", role), Delete(), CancellationToken.None);
        await using var verify = new WmsDb(options);
        Assert.False(await verify.Items.AnyAsync(item => item.Sku == "SKU-DELETE"));
        var audit = await verify.Audit.SingleAsync(record => record.Action == "delete-master");
        Assert.Equal(id, audit.PrincipalId);
        var detail = JsonSerializer.Deserialize<JsonElement>(audit.DetailJson);
        Assert.Equal("Duplicate unused master", detail.GetProperty("Reason").GetString());
        Assert.Equal("000012345", detail.GetProperty("DeletedItem").GetProperty("Barcode").GetString());
        Assert.Empty(await verify.Movements.Where(movement => movement.Kind == "delete-master").ToListAsync());
    }

    [Theory]
    [InlineData("stock")]
    [InlineData("document")]
    [InlineData("package")]
    [InlineData("label")]
    public async Task ReferencedItemCannotBeDeletedEvenWhenStockIsZeroOrReferenceIsInAnotherWarehouse(string reference)
    {
        var options = await UnusedItem();
        await using (var db = new WmsDb(options))
        {
            if (reference == "stock")
                db.Positions.Add(new StockPosition { Id = "POS-DELETE", ItemId = "demo|SKU-DELETE", LocationId = "main|A-01", OnHand = 0 });
            else if (reference == "document")
                db.Documents.Add(new OperationalDocument { Id = "SO-DELETE", ItemId = "demo|SKU-DELETE", WarehouseId = "secondary", Kind = "order", Quantity = 1 });
            else
                db.SupportingRecords.Add(new SupportingRecord { Id = "REF-DELETE", WarehouseId = "secondary", Kind = reference == "package" ? "packages" : "labelHistory", PayloadJson = reference == "package" ? "{\"items\":[{\"sku\":\"SKU-DELETE\",\"qty\":\"1\"}]}" : "{\"sku\":\"SKU-DELETE\",\"code\":\"000012345\"}" });
            await db.SaveChangesAsync();
        }
        await using (var attempt = new WmsDb(options))
        {
            var error = await Assert.ThrowsAsync<BusinessException>(() => new EditService(attempt, new DevelopmentEnvironment()).Apply(Admin, Delete(), CancellationToken.None));
            Assert.Equal("item-in-use", error.Message);
        }
        await using var verify = new WmsDb(options);
        Assert.True(await verify.Items.AnyAsync(item => item.Sku == "SKU-DELETE"));
        Assert.False(await verify.Audit.AnyAsync(record => record.Action == "delete-master"));
    }

    [Theory]
    [InlineData("operator", "operator", "Reason", 0, "denied")]
    [InlineData("admin", "admin", "", 0, "reason")]
    [InlineData("admin", "admin", "Reason", 1, "conflict")]
    public async Task DeletionRequiresCurrentRoleReasonAndVersion(string id, string role, string reason, long version, string code)
    {
        var options = await UnusedItem();
        await using (var attempt = new WmsDb(options))
        {
            var error = await Assert.ThrowsAsync<BusinessException>(() => new EditService(attempt, new DevelopmentEnvironment()).Apply(new(id, "main", role), Delete(reason, version), CancellationToken.None));
            Assert.Equal(code, error.Message);
        }
        await using var verify = new WmsDb(options);
        Assert.True(await verify.Items.AnyAsync(item => item.Sku == "SKU-DELETE"));
        Assert.False(await verify.Audit.AnyAsync(record => record.Action == "delete-master"));
    }

    [Fact]
    public async Task AutomaticBarcodeIsStableOnRetryAndRejectsChangedCreate()
    {
        var options = await postgres.Database();
        EditRequest Create(string name = "Auto item") => new("master", "Main Warehouse", JsonSerializer.SerializeToElement(new {
            sku = "AUTO-ITEM", name, barcode = "", generateBarcode = true, unit = "units", factor = "1", active = true,
            category = "General goods", dimensions = "", weight = "", version = 0
        }));
        async Task Apply(EditRequest request) { await using var db = new WmsDb(options); await new EditService(db, new DevelopmentEnvironment()).Apply(Admin, request, CancellationToken.None); }
        await Apply(Create());
        string barcode;
        await using (var db = new WmsDb(options)) { barcode = (await db.Items.SingleAsync(i => i.Sku == "AUTO-ITEM")).Barcode; }
        Assert.StartsWith("IW-", barcode);
        await Apply(Create());
        var error = await Assert.ThrowsAsync<BusinessException>(() => Apply(Create("Different item")));
        Assert.Equal("conflict", error.Message);
        await using var verify = new WmsDb(options);
        var item = await verify.Items.SingleAsync(i => i.Sku == "AUTO-ITEM");
        Assert.Equal(barcode, item.Barcode); Assert.Equal(1, item.Version);
        Assert.Empty(await verify.Positions.Where(p => p.ItemId == item.Id).ToListAsync());
    }

    [Fact]
    public async Task ScannedBarcodePreservesZerosAndRejectsDuplicates()
    {
        var options = await postgres.Database();
        async Task Apply(string sku, string barcode) { await using var db = new WmsDb(options); await new EditService(db, new DevelopmentEnvironment()).Apply(Admin,
            new("master", "Main Warehouse", JsonSerializer.SerializeToElement(new {sku, name = "Scanned item", barcode, unit = "units", factor = "1", active = true, version = 0})), CancellationToken.None); }
        await Apply("SCAN-ITEM", "000123");
        await using var verify = new WmsDb(options);
        Assert.Equal("000123", (await verify.Items.SingleAsync(i => i.Sku == "SCAN-ITEM")).Barcode);
        await Assert.ThrowsAsync<BusinessException>(() => Apply("OTHER-ITEM", "000123"));
        await Assert.ThrowsAsync<BusinessException>(() => Apply("000123", "OTHER-CODE"));
    }

    private sealed class DevelopmentEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "Wms.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
