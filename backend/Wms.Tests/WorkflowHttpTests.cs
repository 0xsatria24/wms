using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Fact]
    public async Task WorkflowRoutesPersistOwnerDraftAndExposeManualReceiptLineageAndPdf()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin"); using var op = await Login(factory, "operator");
        const string path = "/api/workspaces/Main%20Warehouse/workflow";
        var draft = ReferenceId.New();
        var save = await op.PostAsJsonAsync(path + "/drafts/" + draft, new { version = 0, data = new { action = "receive", qty = "0.5" } });
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync(path + "/drafts/" + draft)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await op.GetAsync(path + "/drafts/" + draft)).StatusCode);
        var receipt = ReferenceId.New(); var line = ReferenceId.New(); long version;
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<WmsDb>(); version = (await db.Items.SingleAsync(i => i.Sku == "SKU-A")).Version; }
        var posted = await Command(admin, "admin", "manual-receive", 0, new { document = receipt, origin = "Local preview", reason = "Without PO", lines = new[] { new { id = line, sku = "SKU-A", scan = "SKU-A", unit = "units", version, qty = "0.5" } } });
        Assert.Equal(HttpStatusCode.OK, posted.StatusCode);
        var read = await admin.GetAsync(path + "?document=" + receipt);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        var graph = await read.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains(graph.GetProperty("documents").EnumerateArray(), d => d.GetProperty("kind").GetString() == "inspection" && d.GetProperty("source").GetString() == line);
        long lineVersion;
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<WmsDb>(); lineVersion = (await db.Documents.SingleAsync(d => d.Id == line)).Version; }
        var export = await admin.PostAsJsonAsync("/api/workspaces/Main%20Warehouse/exports", new { type = "manual-receive", format = "pdf", documentId = line, version = lineVersion });
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        Assert.StartsWith("%PDF-", System.Text.Encoding.ASCII.GetString(await export.Content.ReadAsByteArrayAsync()));
    }
}
