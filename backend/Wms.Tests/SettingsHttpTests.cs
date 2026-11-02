using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    private const string SettingsPath = "/api/workspaces/Main%20Warehouse/settings";

    [Fact]
    public async Task SettingsPreferencesPersistPrivatelyAndValidateWarehouseAccess()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var op = await Login(factory, "operator");
        var saved = await Read(await admin.PostAsJsonAsync("/api/preferences", new { version = 0, language = "id", theme = "dark", defaultWarehouse = "Secondary Warehouse", startPage = "stock", pageSize = 50 }));
        Assert.Equal(1, saved.GetProperty("version").GetInt64());
        var reloaded = await Read(await admin.GetAsync("/api/preferences"));
        Assert.Equal("dark", reloaded.GetProperty("theme").GetString());
        Assert.Equal("en", (await Read(await op.GetAsync("/api/preferences"))).GetProperty("language").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync("/api/preferences", new { version = 0, language = "en", theme = "light", defaultWarehouse = "Secondary Warehouse", startPage = "stock", pageSize = 25 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/preferences", new { version = 0, language = "en", theme = "light", defaultWarehouse = "Main Warehouse", startPage = "stock", pageSize = 10 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/preferences", new { version = 1, language = "en", theme = "light", defaultWarehouse = "", startPage = "unknown", pageSize = 10 })).StatusCode);
    }

    [Fact]
    public async Task SettingsWarehouseMetadataIsScopedVersionedAndAudited()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var op = await Login(factory, "operator");
        var body = new { version = 0, address = "Building A", timeZone = "Asia/Makassar", reason = "Warehouse setup" };
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync(SettingsPath + "/warehouse", body)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync(SettingsPath + "/warehouse", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync(SettingsPath + "/warehouse", body)).StatusCode);
        var settings = await Read(await op.GetAsync(SettingsPath));
        Assert.Equal("Building A", settings.GetProperty("warehouse").GetProperty("address").GetString());
        Assert.Equal("Asia/Makassar", settings.GetProperty("warehouse").GetProperty("timeZone").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync(SettingsPath + "/warehouse", new { version = 1, address = "", timeZone = "invalid", reason = "test" })).StatusCode);
        var secondary = await Read(await admin.GetAsync("/api/workspaces/Secondary%20Warehouse/settings"));
        Assert.Equal("", secondary.GetProperty("warehouse").GetProperty("address").GetString());
        var snapshot = await Read(await admin.GetAsync(SnapshotPath));
        Assert.Equal("Asia/Makassar", snapshot.GetProperty("warehouseTimeZone").GetString());
        Assert.Contains(snapshot.GetProperty("audit").EnumerateArray(), row => row.GetProperty("type").GetString() == "settings-warehouse");
    }

    [Fact]
    public async Task SettingsApprovalPolicyIsEnforcedInCommandsWithoutAllowingSelfReview()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var supervisor = await Login(factory, "supervisor");
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync(SettingsPath + "/approvals", new { version = 0, orderReview = "admin", countReview = "admin", reason = "Restrict reviews" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Command(supervisor, "supervisor", "approve-order", 0, new { order = "SO-SIM-1002" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Command(admin, "admin", "approve-order", 0, new { order = "SO-SIM-1002" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync(SettingsPath + "/approvals", new { version = 1, orderReview = "operator", countReview = "admin", reason = "invalid" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await supervisor.PostAsJsonAsync(SettingsPath + "/approvals", new { version = 1, orderReview = "supervisor", countReview = "supervisor", reason = "test" })).StatusCode);
        var freeze = await Read(await Command(admin, "admin", "freeze", 0, new { sku = "SKU-A", location = "A-01" }));
        var count = (await Read(await admin.GetAsync(SnapshotPath))).GetProperty("counts").EnumerateArray().Single();
        var task = count.GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.OK, (await Command(admin, "admin", "count-submit", 0, new { task, qty = "100" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Command(supervisor, "supervisor", "adjust-count", 1, new { task, reason = "Review" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Command(admin, "admin", "adjust-count", 1, new { task, reason = "Self-review" })).StatusCode);
    }

    [Fact]
    public async Task SettingsPreferenceDefaultFallsBackAfterWarehouseAccessRevocation()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        await Read(await admin.PostAsJsonAsync("/api/preferences", new { version = 0, language = "id", theme = "dark", defaultWarehouse = "Secondary Warehouse", startPage = "orders", pageSize = 25 }));
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            db.AccessGrants.Remove(await db.AccessGrants.SingleAsync(g => g.PrincipalId == "admin" && g.WarehouseId == "secondary"));
            await db.SaveChangesAsync();
        }
        var prefs = await Read(await admin.GetAsync("/api/preferences"));
        Assert.Equal("", prefs.GetProperty("defaultWarehouse").GetString());
    }
}
