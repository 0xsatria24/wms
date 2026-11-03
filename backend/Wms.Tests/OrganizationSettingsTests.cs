using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Wms.Tests;
public sealed partial class HttpApiTests
{
    [Fact]
    public async Task WarehouseNamesCannotMakeExistingIdRoutesAmbiguous()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin");
        var response = await admin.PostAsJsonAsync("/api/organization", new { version = 0, companyName = "Company", warehouseName = "main", locations = new[] { "A-01" }, reason = "New warehouse" });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/workspaces/main/settings")).StatusCode);
    }

    [Fact]
    public async Task CompanyNameCanChangeWithoutCreatingAnotherWarehouse()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin");
        await Read(await admin.PostAsJsonAsync("/api/organization", new { version = 0, companyName = "Original Company", warehouseName = "Configured warehouse", locations = new[] { "A-01" }, reason = "Initial setup" }));
        var before = await Read(await admin.GetAsync("/api/session"));
        var saved = await Read(await admin.PostAsJsonAsync("/api/organization", new { version = 1, companyName = "Renamed Company", warehouseName = "", locations = Array.Empty<string>(), reason = "Update legal name" }));
        Assert.Equal(2, saved.GetProperty("version").GetInt64());
        var after = await Read(await admin.GetAsync("/api/session"));
        Assert.Equal("Renamed Company", after.GetProperty("companyName").GetString());
        Assert.Equal(before.GetProperty("user").GetProperty("warehouses").GetRawText(), after.GetProperty("user").GetProperty("warehouses").GetRawText());
        Assert.Equal("Configured warehouse", after.GetProperty("organizationWarehouse").GetString());
    }

    [Fact]
    public async Task OrganizationSetupCreatesScopedWarehouseLocationsAndPersistsCompanyName()
    {
        await using var factory = await Factory(); using var admin = await Login(factory, "admin"); using var op = await Login(factory, "operator");
        var input = new { version = 0, companyName = "Example Company", warehouseName = "New warehouse", locations = new[] { "A-01", "B-01" }, reason = "Initial organization setup" };
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync("/api/organization", input)).StatusCode);
        var saved = await Read(await admin.PostAsJsonAsync("/api/organization", input));
        Assert.Equal("New warehouse", saved.GetProperty("warehouseName").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/organization", input)).StatusCode);
        var session = await Read(await admin.GetAsync("/api/session"));
        Assert.Equal("Example Company", session.GetProperty("companyName").GetString());
        Assert.Contains(session.GetProperty("user").GetProperty("warehouses").EnumerateArray(), x => x.GetString() == "New warehouse");
        var config = await Read(await admin.GetAsync("/api/workspaces/New%20warehouse/settings"));
        Assert.Equal(5, config.GetProperty("locations").GetArrayLength());
    }
}
