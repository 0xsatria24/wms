using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Workflow;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class WorkflowWorkspaceTests(PostgresFixture postgres)
{
    private static readonly ActingPrincipal Admin = new("admin", "main", "admin");
    private static readonly ActingPrincipal Operator = new("operator", "main", "operator");
    private static JsonElement Json(object value) => JsonSerializer.SerializeToElement(value);
    [Fact]
    public async Task DraftIsVersionedOwnerScopedAndIdempotentForTheSameContent()
    {
        await using var db = new WmsDb(await postgres.Database());
        var service = new WorkflowService(db);
        var id = ReferenceId.New();
        var data = Json(new { action = "receive", qty = "0.5", sku = "SKU-A" });
        var first = Json(await service.SaveDraft(Operator, id, new(0, data), CancellationToken.None));
        Assert.Equal(1, first.GetProperty("version").GetInt64());
        var replay = Json(await service.SaveDraft(Operator, id, new(0, data), CancellationToken.None));
        Assert.Equal(1, replay.GetProperty("version").GetInt64());
        await Assert.ThrowsAsync<BusinessException>(() => service.SaveDraft(Operator, id, new(0, Json(new { action = "receive", qty = "2" })), CancellationToken.None));
        await Assert.ThrowsAsync<BusinessException>(() => service.ReadDraft(Admin, id, CancellationToken.None));
        var draft = Json(await service.ReadDraft(Operator, id, CancellationToken.None));
        Assert.Equal("0.5", draft.GetProperty("data").GetProperty("qty").GetString());
    }
    [Fact]
    public async Task ItemProposalNeedsAuthorizedReviewAndNeverPostsStock()
    {
        await using var db = new WmsDb(await postgres.Database());
        var service = new WorkflowService(db);
        var id = ReferenceId.New();
        var data = Json(new { name = "New material", sku = "NEW-SKU", unit = "kg", barcode = "000NEW" });
        await service.Propose(Operator, id, data, CancellationToken.None);
        Assert.False(await db.Items.AnyAsync(i => i.Sku == "NEW-SKU"));
        await Assert.ThrowsAsync<BusinessException>(() => service.ReviewProposal(Operator, id, new(1, Json(new { action = "approve", sku = "NEW-SKU" })), CancellationToken.None));
        await service.ReviewProposal(Admin, id, new(1, Json(new { action = "approve", sku = "NEW-SKU" })), CancellationToken.None);
        var item = await db.Items.SingleAsync(i => i.Sku == "NEW-SKU");
        Assert.Equal("kg", item.Unit);
        Assert.Equal("000NEW", item.Barcode);
        Assert.False(await db.Positions.AnyAsync(p => p.ItemId == item.Id));
        Assert.False(await db.Movements.AnyAsync(m => m.Kind == "item-proposal"));
    }
    [Fact]
    public async Task ViewerCannotWriteAndSelectedReceiptItemSurvivesBeyondFirstPage()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Principals.Add(new() { Id = "workflow-viewer", Name = "Viewer", Status = "active" });
        db.AccessGrants.Add(new() { PrincipalId = "workflow-viewer", WarehouseId = "main", Role = "viewer" });
        for (var i=0;i<40;i++) db.Items.Add(new() { Id = "demo|ZZ"+i, Sku = "ZZ"+i, Name = "Material", Barcode = "ZZ"+i });
        await db.SaveChangesAsync();
        var viewer = new ActingPrincipal("workflow-viewer", "main", "viewer"); var service = new WorkflowService(db);
        Assert.Equal("denied", (await Assert.ThrowsAsync<BusinessException>(() => service.SaveDraft(viewer, ReferenceId.New(), new(0,Json(new { qty = "1" })), CancellationToken.None))).Message);
        var result = Json(await service.Read(Admin,new(SelectedItems: "[\"ZZ39\"]"),CancellationToken.None));
        Assert.Contains(result.GetProperty("items").EnumerateArray(), i=>i.GetProperty("sku").GetString()=="ZZ39");
    }
    [Fact]
    public async Task WorkflowDoesNotExposeBlindCountBalancesThroughPositionsDocumentsOrHistory()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Documents.Add(new() { Id = ReferenceId.New(), Kind = "count", WarehouseId = "main", ItemId = "demo|SKU-A", LocationId = "main|A-01", Quantity = 0, Expected = 100, Status = "counting", Counter = "operator" });
        await db.SaveChangesAsync();
        var result = Json(await new WorkflowService(db).Read(Operator, new(Sku: "SKU-A"), CancellationToken.None));
        Assert.Empty(result.GetProperty("positions").EnumerateArray());
        Assert.Empty(result.GetProperty("documents").EnumerateArray());
        Assert.Empty(result.GetProperty("history").EnumerateArray());
        Assert.True(result.GetProperty("items")[0].GetProperty("restricted").GetBoolean());
        Assert.DoesNotContain("expected", result.GetRawText(), StringComparison.OrdinalIgnoreCase);
    }
}
