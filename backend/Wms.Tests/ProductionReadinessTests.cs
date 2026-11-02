using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Modules.Catalog;
using Wms.Modules.Inventory;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class ProductionReadinessTests(PostgresFixture postgres)
{
    [Fact]
    public async Task NewMasterLocationIsAvailableForInventoryPutaway()
    {
        await using var db = new WmsDb(await postgres.Database());
        await new EditService(db, new TestEnvironment()).Apply(new("admin", "main", "admin"), new("locationMaster", "main", JsonSerializer.SerializeToElement(new { name = "B-03", pickable = true })), CancellationToken.None);
        var location = await db.Locations.SingleOrDefaultAsync(l => l.WarehouseId == "main" && l.Code == "B-03");
        Assert.NotNull(location);
        Assert.True(location.Pickable);
        Assert.False(await db.Locations.AnyAsync(l => l.WarehouseId == "secondary" && l.Code == "B-03"));
        db.Positions.Add(new StockPosition { Id = "receive-new-location", ItemId = "demo|SKU-A", LocationId = "main|Receiving", OnHand = 2 });
        db.Documents.Add(new OperationalDocument { Id = "putaway-new-location", Kind = "putaway", ItemId = "demo|SKU-A", WarehouseId = "main", Quantity = 2 });
        await db.SaveChangesAsync();
        await new CommandProcessor(db).Handle(new("admin", "main", "admin"), new("putaway", "main", 0, JsonSerializer.SerializeToElement(new { task = "putaway-new-location", destination = "B-03", scan = "SKU-A", locationScan = "B-03", qty = "2" })), Guid.NewGuid().ToString(), CancellationToken.None);
        Assert.Equal(2, (await db.Positions.SingleAsync(p => p.LocationId == location.Id)).OnHand);
    }

    private sealed class TestEnvironment : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Production";
        public string ApplicationName { get; set; } = "Wms.Tests";
        public string ContentRootPath { get; set; } = "";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }

    [Fact]
    public async Task BootstrapCreatesOnlyConfiguredIdentityAndRejectsReinitialization()
    {
        await using var db = new WmsDb(await postgres.Database(seedDemo: false));
        var input = new BootstrapRequest("https://identity.example", "admin-subject", "admin@example.com", "Warehouse administrator", [new("warehouse-a", "Warehouse A", ["A-01"])], true);
        await ProductionBootstrap.Run(db, input);
        Assert.Equal(2, await db.Warehouses.CountAsync());
        Assert.Equal(4, await db.Locations.CountAsync());
        Assert.Empty(await db.Items.ToListAsync());
        Assert.Empty(await db.Positions.ToListAsync());
        var admin = await db.Principals.SingleAsync();
        Assert.Equal("admin-subject", admin.Subject);
        Assert.Equal("admin", (await db.AccessGrants.SingleAsync()).Role);
        Assert.True((await db.Settings.SingleAsync()).PartialAllowed);
        await Assert.ThrowsAsync<Wms.Shared.BusinessException>(() => ProductionBootstrap.Run(db, input));
    }

    private static TicketReceivedContext Ticket(WmsDb db, string subject, string email, bool verified)
    {
        var claims = new[] { new Claim("sub", subject), new Claim("iss", "https://identity.example"), new Claim("email", email), new Claim("email_verified", verified ? "true" : "false"), new Claim("name", "Warehouse user") };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "oidc"));
        var http = new DefaultHttpContext { RequestServices = new ServiceCollection().AddSingleton(db).BuildServiceProvider() };
        return new TicketReceivedContext(http, new AuthenticationScheme("oidc", null, typeof(OpenIdConnectHandler)), new OpenIdConnectOptions(), new AuthenticationTicket(principal, "oidc"));
    }

    [Fact]
    public async Task VerifiedSsoBindsPendingInvitationWithoutGrantingAccess()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Principals.Add(new Principal { Id = "invited", Issuer = "access-request", Subject = "request:invited", Email = "worker@example.com", Name = "Invited worker" });
        await db.SaveChangesAsync();
        var context = Ticket(db, "worker-subject", "WORKER@example.com", true);
        await SsoEnrollment.Ticket(context);
        var user = await db.Principals.SingleAsync(p => p.Email.ToLower() == "worker@example.com");
        Assert.Equal("invited", user.Id);
        Assert.Equal("https://identity.example", user.Issuer);
        Assert.Equal("worker-subject", user.Subject);
        Assert.True(user.Verified);
        Assert.Equal("pending", user.Status);
        Assert.False(await db.AccessGrants.AnyAsync(g => g.PrincipalId == user.Id));
        await SsoEnrollment.Ticket(Ticket(db, "worker-subject", "worker@example.com", true));
        Assert.Equal(1, await db.Principals.CountAsync(p => p.Email.ToLower() == "worker@example.com"));
    }

    [Fact]
    public async Task UnverifiedOrRevokedInvitationCannotBecomeAnotherSsoAccount()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.Principals.Add(new Principal { Id = "blocked-invite", Issuer = "access-request", Subject = "request:blocked", Email = "blocked@example.com", Status = "revoked" });
        await db.SaveChangesAsync();
        await SsoEnrollment.Ticket(Ticket(db, "unverified", "applicant@example.com", false));
        await SsoEnrollment.Ticket(Ticket(db, "blocked", "blocked@example.com", true));
        Assert.False(await db.Principals.AnyAsync(p => p.Subject == "unverified" || p.Subject == "blocked"));
        Assert.Equal("revoked", (await db.Principals.FindAsync("blocked-invite"))!.Status);
    }
}
