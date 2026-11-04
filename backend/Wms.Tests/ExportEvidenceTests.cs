using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Fact]
    public async Task ExportEvidenceLinksCountToOriginalTransactionWithoutDuplicatingOnRetry()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        var key = Guid.NewGuid().ToString();
        var result = await Read(await Command(admin, "admin", "freeze", 0,
            new { sku = "SKU-A", location = "A-01" }, key));
        await Read(await Command(admin, "admin", "freeze", 0,
            new { sku = "SKU-A", location = "A-01" }, key));
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
        var evidence = await db.SupportingRecords.Where(r => r.Kind == "export-evidence").ToListAsync();
        var record = Assert.Single(evidence);
        using var payload = JsonDocument.Parse(record.PayloadJson);
        var data = payload.RootElement;
        Assert.Equal("freeze", data.GetProperty("kind").GetString());
        Assert.Equal("admin", data.GetProperty("actor").GetString());
        var task = await db.Documents.SingleAsync(d => d.Kind == "count");
        Assert.Equal(task.Id, Assert.Single(data.GetProperty("documentIds").EnumerateArray()).GetString());
        Assert.Equal("main", record.WarehouseId);
        Assert.True(await db.Audit.AnyAsync(a => a.TransactionId == data.GetProperty("transactionId").GetString()));
    }
}
