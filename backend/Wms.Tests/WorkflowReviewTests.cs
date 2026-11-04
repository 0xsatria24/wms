using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Inventory;
using Wms.Modules.Workflow;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class WorkflowReviewTests(PostgresFixture postgres)
{
    private static readonly ActingPrincipal Admin = new("admin", "main", "admin");
    private static JsonElement Json(object value) => JsonSerializer.SerializeToElement(value);
    private static async Task<CommandResult> Run(DbContextOptions<WmsDb> options, string type, object payload)
    {
        await using var db = new WmsDb(options); return await new CommandProcessor(db).Handle(Admin,new(type,"main",null,Json(payload)),Guid.NewGuid().ToString());
    }
    [Fact]
    public async Task AmbiguousCrossFieldCodeCannotPostAReceipt()
    {
        var options=await postgres.Database();
        await using(var db=new WmsDb(options)){db.Items.Add(new(){Id="demo|COLLISION",Sku="COLLISION",Name="Other item",Barcode="SKU-A"});await db.SaveChangesAsync();}
        var receipt=ReferenceId.New();
        var failure=await Assert.ThrowsAsync<BusinessException>(()=>Run(options,"manual-receive",new{document=receipt,origin="Delivery",reason="Manual",lines=new[]{new{id=ReferenceId.New(),sku="SKU-A",scan="SKU-A",qty="5",unit="units",version=0L}}}));
        Assert.Equal("ambiguous-item",failure.Message);
        await using var verify=new WmsDb(options);Assert.False(await verify.Movements.AnyAsync(m=>m.Source==receipt));
        var lookup=Json(await new WorkflowService(verify).Read(Admin,new(Sku:"SKU-A"),CancellationToken.None));
        Assert.Contains(lookup.GetProperty("items").EnumerateArray(),i=>i.GetProperty("sku").GetString()=="COLLISION");
    }
    [Fact]
    public async Task PhysicalScanRejectsCrossFieldAmbiguityBeyondReceipt()
    {
        var options=await postgres.Database();long version;
        await using(var db=new WmsDb(options)){db.Items.Add(new(){Id="demo|COLLISION",Sku="COLLISION",Name="Other item",Barcode="SKU-A"});await db.SaveChangesAsync();version=(await db.Positions.SingleAsync(p=>p.Id=="POS-A")).Version;}
        var failure=await Assert.ThrowsAsync<BusinessException>(()=>Run(options,"relocate",new{document=ReferenceId.New(),sku="SKU-A",scan="SKU-A",position="POS-A",positionVersion=version,sourceScan="A-01",destination="A-02",locationScan="A-02",qty="5"}));
        Assert.Equal("ambiguous-item",failure.Message);
    }
    [Fact]
    public async Task ProposalPagesAreIndependentAndLinkedIdRemainsReachable()
    {
        await using var db=new WmsDb(await postgres.Database());var service=new WorkflowService(db);
        for(var i=1;i<=26;i++)await service.Propose(Admin,"P"+i.ToString("D15"),Json(new{name="Proposed",sku="PROPOSED"+i,unit="kg",barcode="PROPOSAL"+i}),CancellationToken.None);
        var second=Json(await service.Read(Admin,new(ProposalPage:2),CancellationToken.None));
        Assert.Equal(1,second.GetProperty("itemPage").GetProperty("page").GetInt32());Assert.Equal(2,second.GetProperty("proposalPage").GetProperty("page").GetInt32());Assert.Single(second.GetProperty("proposals").EnumerateArray());
        var exact=Json(await service.Read(Admin,new(Proposal:"P000000000000026"),CancellationToken.None));
        Assert.Contains(exact.GetProperty("proposals").EnumerateArray(),p=>p.GetProperty("proposal").GetProperty("id").GetString()=="P000000000000026");
    }
    [Fact]
    public async Task ConfirmedRelocationDraftLinksItsResultAndCannotBeReplayedWithANewKey()
    {
        var options=await postgres.Database();var draft=ReferenceId.New();var document=ReferenceId.New();long version;
        await using(var db=new WmsDb(options)){version=(await db.Positions.SingleAsync(p=>p.Id=="POS-A")).Version;await new WorkflowService(db).SaveDraft(Admin,draft,new(0,Json(new{context=new{action="relocate",sku="SKU-A"},form=new{document,qty="5",position="POS-A"}})),CancellationToken.None);}
        var payload=new{document,workflowDraft=draft,draftVersion=1L,sku="SKU-A",scan="SKU-A",position="POS-A",positionVersion=version,sourceScan="A-01",destination="A-02",locationScan="A-02",qty="5"};
        var result=await Run(options,"relocate",payload);
        await using(var db=new WmsDb(options)){
            var saved=Json(await new WorkflowService(db).ReadDraft(Admin,draft,CancellationToken.None));
            Assert.Equal("confirmed",saved.GetProperty("status").GetString());Assert.Equal(result.Id,saved.GetProperty("result").GetProperty("id").GetString());
            version=(await db.Positions.SingleAsync(p=>p.Id=="POS-A")).Version;
        }
        Assert.Equal("duplicate",(await Assert.ThrowsAsync<BusinessException>(()=>Run(options,"relocate",new{document,sku="SKU-A",scan="SKU-A",position="POS-A",positionVersion=version,sourceScan="A-01",destination="A-02",locationScan="A-02",qty="5"}))).Message);
        await using var verify=new WmsDb(options);Assert.Equal(95m,(await verify.Positions.SingleAsync(p=>p.Id=="POS-A")).OnHand);
    }
}
