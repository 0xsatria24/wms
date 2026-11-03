using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Wms.Tests;
public sealed partial class HttpApiTests
{
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
