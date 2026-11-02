using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Fact]
    public async Task BulkAccessStatusPreservesIndividualWarehouseRolesAndRejectsStaleTransitions()
    {
        await using var factory = await Factory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            (await db.Principals.SingleAsync(p => p.Id == "supervisor")).Status = "pending";
            db.AccessGrants.Add(new AccessGrant { PrincipalId = "supervisor", WarehouseId = "secondary", Role = "viewer" });
            await db.SaveChangesAsync();
        }
        using var admin = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "access-status", new { id = "supervisor", expectedStatus = "pending", status = "active", reason = "Approve existing grants" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Edit(admin, "access-status", new { id = "supervisor", expectedStatus = "pending", status = "active", reason = "Stale approval" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "access-status", new { id = "supervisor", expectedStatus = "active", status = "revoked", reason = "End access" })).StatusCode);
        using var verify = factory.Services.CreateScope();
        var final = verify.ServiceProvider.GetRequiredService<WmsDb>();
        Assert.Equal("revoked", (await final.Principals.SingleAsync(p => p.Id == "supervisor")).Status);
        var grants = await final.AccessGrants.Where(g => g.PrincipalId == "supervisor").ToDictionaryAsync(g => g.WarehouseId, g => g.Role);
        Assert.Equal("supervisor", grants["main"]);
        Assert.Equal("viewer", grants["secondary"]);
    }

    [Fact]
    public async Task BulkAccessRejectDoesNotCreateGrantsAndApprovalRequiresVerification()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            db.Principals.AddRange(new Principal { Id = "bulk-reject", Name = "Rejected fixture", Email = "reject@example.test", Subject = "bulk-reject", Verified = false }, new Principal { Id = "bulk-approve", Name = "Approved fixture", Email = "approve@example.test", Subject = "bulk-approve", Verified = true });
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(admin, "access-status", new { id = "bulk-reject", expectedStatus = "pending", status = "active", reason = "Unverified" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "access-status", new { id = "bulk-reject", expectedStatus = "pending", status = "rejected", reason = "Reject request" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "access-status", new { id = "bulk-approve", expectedStatus = "pending", status = "active", reason = "Approve minimum access" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Edit(admin, "access-status", new { id = "admin", expectedStatus = "active", status = "revoked", reason = "No self changes" })).StatusCode);
        using var verify = factory.Services.CreateScope();
        var final = verify.ServiceProvider.GetRequiredService<WmsDb>();
        Assert.False(await final.AccessGrants.AnyAsync(g => g.PrincipalId == "bulk-reject"));
        var granted = Assert.Single(await final.AccessGrants.Where(g => g.PrincipalId == "bulk-approve").ToListAsync());
        Assert.Equal("main", granted.WarehouseId);
        Assert.Equal("operator", granted.Role);
    }

    [Fact]
    public async Task BulkItemStatusCannotRecreateDeletedItemsOrOverwriteOtherFields()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.NotFound, (await Edit(admin, "master-status", new { sku = "MISSING-BULK", version = 5, active = true, reason = "Must not recreate" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "master-status", new { sku = "SKU-A", version = 0, active = false, reason = "Disable item" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Edit(admin, "master-status", new { sku = "SKU-A", version = 0, active = true, reason = "Stale version" })).StatusCode);
        using var verify = factory.Services.CreateScope();
        var final = verify.ServiceProvider.GetRequiredService<WmsDb>();
        Assert.False(await final.Items.AnyAsync(i => i.Sku == "MISSING-BULK"));
        var item = await final.Items.SingleAsync(i => i.Sku == "SKU-A");
        Assert.False(item.Active);
        Assert.Equal(1, item.Version);
    }

    [Fact]
    public async Task BulkLabelHistoryRejectsAStaleReviewedIdentifier()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            var item = await db.Items.SingleAsync(i => i.Sku == "SKU-A");
            item.Barcode = "BULK-NEW-BARCODE";
            item.Version++;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict, (await Edit(admin, "labelHistory", new { sku = "SKU-A", version = 0, code = "OLD-BARCODE", action = "download" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(admin, "labelHistory", new { sku = "SKU-A", version = 1.25, code = "BULK-NEW-BARCODE", action = "download" })).StatusCode);
        using (var verify = factory.Services.CreateScope())
            Assert.False(await verify.ServiceProvider.GetRequiredService<WmsDb>().SupportingRecords.AnyAsync(r => r.Kind == "labelHistory"));
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "labelHistory", new { sku = "SKU-A", version = 1, code = "BULK-NEW-BARCODE", action = "download" })).StatusCode);
    }
}
