using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wms.Infrastructure;
using Wms.Modules.Integration;
using Wms.Shared;
using Wms.Worker;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class ErpIntegrationTests(PostgresFixture postgres)
{
    [Fact]
    public async Task PurchaseOrderImportIsIdempotentScopedAndDoesNotPostStock()
    {
        await using var db = new WmsDb(await postgres.Database());
        var importer = new PurchaseOrderImport(db);
        var actor = new ActingPrincipal("admin", "main", "admin");
        var input = new PurchaseOrderMessage("PO-REAL-1-L1", "SKU-A", "12", "units", 1);
        var key = Guid.NewGuid().ToString();
        var movementCount = await db.Movements.CountAsync();
        var first = await importer.Apply(actor, input, key, CancellationToken.None);
        var replay = await importer.Apply(actor, input, key, CancellationToken.None);
        Assert.Equal(first, replay);
        var doc = await db.Documents.SingleAsync(d => d.Source == "erp:PO-REAL-1-L1");
        Assert.Equal(12, doc.Quantity);
        Assert.Equal("main", doc.WarehouseId);
        Assert.Equal(movementCount, await db.Movements.CountAsync());
        await Assert.ThrowsAsync<BusinessException>(() => importer.Apply(actor, input with { Qty = "13" }, key, CancellationToken.None));
        await Assert.ThrowsAsync<BusinessException>(() => importer.Apply(new("operator", "main", "operator"), input with { SourceVersion = 2 }, Guid.NewGuid().ToString(), CancellationToken.None));
    }

    [Fact]
    public async Task RestoreHoldPreventsDispatchAndBusinessRejectionIsTerminal()
    {
        var options = await postgres.Database(seedDemo: false);
        await using (var db = new WmsDb(options))
        {
            db.Outbox.Add(new OutboxEvent { WarehouseId = "main", AggregateId = "ERP-TEST", Kind = "receive", PayloadJson = "{}", CreatedAt = DateTimeOffset.UtcNow, NextAttemptAt = DateTimeOffset.UtcNow });
            db.SupportingRecords.Add(new SupportingRecord { Id = "restore-hold", Kind = "outbox-pause", PayloadJson = "{}" });
            await db.SaveChangesAsync();
        }
        using var services = new ServiceCollection().AddDbContext<WmsDb>(o => o.UseNpgsql(new WmsDb(options).Database.GetConnectionString())).BuildServiceProvider();
        var transport = new ErpTransport();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Erp:Enabled"] = "true", ["Erp:Endpoint"] = "https://erp.example/events", ["Erp:SupportsIdempotency"] = "true", ["Erp:Protocol"] = "wms-v1", ["Erp:StatusEndpoint"] = "https://erp.example/events/{eventId}" }).Build();
        using var worker = new OutboxWorker(services.GetRequiredService<IServiceScopeFactory>(), transport, config, NullLogger<OutboxWorker>.Instance);
        await worker.ProcessOnce(CancellationToken.None);
        Assert.Equal(0, transport.Calls);
        await using (var db = new WmsDb(options))
        {
            db.SupportingRecords.Remove(await db.SupportingRecords.SingleAsync(r => r.Id == "restore-hold"));
            await db.SaveChangesAsync();
        }
        await worker.ProcessOnce(CancellationToken.None);
        await worker.ProcessOnce(CancellationToken.None);
        Assert.Equal(1, transport.Calls);
        await using var verify = new WmsDb(options);
        Assert.Equal("rejected", (await verify.Outbox.SingleAsync()).BusinessStatus);
    }

    private sealed class ErpTransport : HttpMessageHandler, IHttpClientFactory
    {
        public int Calls { get; private set; }
        public HttpClient CreateClient(string name) => new(this, disposeHandler: false);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"businessStatus\":\"rejected\"}", System.Text.Encoding.UTF8, "application/json") });
        }
    }
}
