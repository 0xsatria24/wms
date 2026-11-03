using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Fact]
    public async Task SessionSeparatesAdministrativeWarehousesFromOtherAccess()
    {
        await using var factory = await Factory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            (await db.AccessGrants.SingleAsync(g => g.PrincipalId == "admin" && g.WarehouseId == "secondary")).Role = "viewer";
            await db.SaveChangesAsync();
        }
        using var admin = await Login(factory, "admin");
        var session = await Read(await admin.GetAsync("/api/session"));
        var user = session.GetProperty("user");
        Assert.Equal(2, user.GetProperty("warehouses").GetArrayLength());
        Assert.Equal(Warehouse, Assert.Single(user.GetProperty("adminWarehouses").EnumerateArray()).GetString());
        using var viewer = await Login(factory, "operator");
        var other = await Read(await viewer.GetAsync("/api/session"));
        Assert.Empty(other.GetProperty("user").GetProperty("adminWarehouses").EnumerateArray());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task IndividualRejectionNeverAssignsWarehouseGrants(bool warehouseSelected)
    {
        await using var factory = await Factory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            db.Principals.Add(new Principal { Id = "reject-new", Subject = "request:reject-new", Issuer = "access-request", Name = "New applicant", Email = "reject-new@example.test", Status = "pending", Verified = false });
            await db.SaveChangesAsync();
        }
        using var admin = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "access", new { id = "reject-new", status = "rejected", role = "operator", warehouses = warehouseSelected ? new[] { Warehouse } : [], reason = "Access not required" })).StatusCode);
        using var verify = factory.Services.CreateScope();
        var final = verify.ServiceProvider.GetRequiredService<WmsDb>();
        Assert.Equal("rejected", (await final.Principals.SingleAsync(p => p.Id == "reject-new")).Status);
        Assert.False(await final.AccessGrants.AnyAsync(g => g.PrincipalId == "reject-new"));
    }

    [Fact]
    public async Task IndividualRevocationPreservesExistingWarehouseRoles()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "access", new { id = "operator", status = "revoked", role = "admin", warehouses = Array.Empty<string>(), reason = "End access" })).StatusCode);
        using var verify = factory.Services.CreateScope();
        var db = verify.ServiceProvider.GetRequiredService<WmsDb>();
        Assert.Equal("revoked", (await db.Principals.SingleAsync(p => p.Id == "operator")).Status);
        var grants = await db.AccessGrants.Where(g => g.PrincipalId == "operator").ToListAsync();
        Assert.NotEmpty(grants);
        Assert.All(grants, grant => Assert.Equal("operator", grant.Role));
    }
}
