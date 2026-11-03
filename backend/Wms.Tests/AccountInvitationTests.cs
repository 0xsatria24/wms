using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class AccountInvitationTests(PostgresFixture postgres)
{
    static InviteAccount Input => new("Warehouse worker", "worker@example.test", "supervisor", ["Main Warehouse"], "New employee");
    static readonly ActingPrincipal Admin = new("admin", "main", "admin");

    [Fact]
    public async Task InvitationReplayPreservesOnePendingIdentityAndApproval()
    {
        await using var db = new WmsDb(await postgres.Database());
        var provider = new Identity(); var service = new AccountInvitations(db, provider); var id = Guid.NewGuid();
        var result = await service.Invite(Admin, id, Input, default);
        Assert.Equal("sent", result.State);
        await service.Invite(Admin, id, Input, default);
        Assert.Single(await db.Principals.Where(p => p.Email == "worker@example.test").ToListAsync());
        Assert.Single(await db.Audit.Where(a => a.Action == "invite-user").ToListAsync());
        Assert.Equal(1, provider.Emails);
        Assert.False((await db.Principals.SingleAsync(p => p.Id == id.ToString("N"))).Verified);
        Assert.False(await db.AccessGrants.AnyAsync(g => g.PrincipalId == id.ToString("N")));
        var changed = await Assert.ThrowsAsync<BusinessException>(() => service.Invite(Admin, id, Input with { Role = "admin" }, default));
        Assert.Equal("key-changed", changed.Message);
    }

    [Fact]
    public async Task UncertainEmailRequiresExplicitResendAndKeepsSameAccount()
    {
        await using var db = new WmsDb(await postgres.Database());
        var provider = new Identity { Uncertain = true }; var service = new AccountInvitations(db, provider); var id = Guid.NewGuid();
        Assert.Equal("unknown", (await service.Invite(Admin, id, Input, default)).State);
        Assert.Equal("unknown", (await service.Invite(Admin, id, Input, default)).State);
        Assert.Equal(1, provider.Emails);
        provider.Uncertain = false;
        Assert.Equal("sent", (await service.Invite(Admin, id, Input with { Resend = true }, default)).State);
        Assert.Equal(2, provider.Emails);
        Assert.Single(await db.Principals.Where(p => p.Email == Input.Email).ToListAsync());
    }

    [Fact]
    public async Task InvitationRejectsWarehouseOutsideCurrentAdminScope()
    {
        await using var db = new WmsDb(await postgres.Database());
        db.AccessGrants.Remove(await db.AccessGrants.SingleAsync(g => g.PrincipalId == "admin" && g.WarehouseId == "secondary")); await db.SaveChangesAsync();
        var provider = new Identity(); var service = new AccountInvitations(db, provider);
        var error = await Assert.ThrowsAsync<BusinessException>(() => service.Invite(Admin, Guid.NewGuid(), Input with { Warehouses = ["Secondary Warehouse"] }, default));
        Assert.Equal(403, error.Status); Assert.Equal(0, provider.Emails);
        Assert.False(await db.Principals.AnyAsync(p => p.Email == Input.Email));
    }

    [Theory]
    [InlineData("valid", "active")]
    [InlineData("expired", "pending")]
    [InlineData("revoked-inviter", "pending")]
    [InlineData("lost-admin-grant", "pending")]
    public async Task VerifiedSsoAcceptsOnlyStillAuthorizedInvitation(string condition, string expected)
    {
        await using var db = new WmsDb(await postgres.Database());
        var id = Guid.NewGuid(); await new AccountInvitations(db, new Identity()).Invite(Admin, id, Input, default);
        if (condition == "expired") {
            var row = await db.SupportingRecords.SingleAsync(r => r.Kind == AccountInvitations.Kind);
            row.PayloadJson = JsonSerializer.Serialize(AccountInvitations.Read(row) with { ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1) }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        if (condition == "revoked-inviter") (await db.Principals.SingleAsync(p => p.Id == "admin")).Status = "revoked";
        if (condition == "lost-admin-grant") db.AccessGrants.Remove(await db.AccessGrants.SingleAsync(g => g.PrincipalId == "admin" && g.WarehouseId == "main"));
        await db.SaveChangesAsync();
        await SsoEnrollment.Ticket(Ticket(db, "provider-worker"));
        var principal = await db.Principals.SingleAsync(p => p.Id == id.ToString("N"));
        Assert.Equal(expected, principal.Status);
        var grants = await db.AccessGrants.Where(g => g.PrincipalId == principal.Id).ToListAsync();
        if (expected == "active") { var grant = Assert.Single(grants); Assert.Equal("main", grant.WarehouseId); Assert.Equal("supervisor", grant.Role); }
        else Assert.Empty(grants);
    }

    [Fact]
    public async Task AnotherProviderSubjectCannotClaimAnInvitationByEmail()
    {
        await using var db = new WmsDb(await postgres.Database()); var id = Guid.NewGuid();
        await new AccountInvitations(db, new Identity()).Invite(Admin, id, Input, default);
        var ticket = Ticket(db, "different-subject"); await SsoEnrollment.Ticket(ticket);
        Assert.NotNull(ticket.Result?.Failure);
        var principal = await db.Principals.SingleAsync(p => p.Id == id.ToString("N"));
        Assert.Equal("access-request", principal.Issuer);
        Assert.False(principal.Verified);
    }

    [Fact]
    public async Task ResendCannotMoveApprovalToAReplacementProviderIdentity()
    {
        await using var db = new WmsDb(await postgres.Database()); var id = Guid.NewGuid(); var provider = new Identity();
        var service = new AccountInvitations(db, provider); await service.Invite(Admin, id, Input, default);
        provider.Subject = "replacement-subject";
        var result = await service.Invite(Admin, id, Input with { Resend = true }, default);
        Assert.Equal("blocked", result.State);
        Assert.Equal("provider-worker", result.ProviderSubject);
        Assert.Equal(1, provider.Emails);
    }

    [Fact]
    public async Task EmailDispatchHasADurableUncertainMarkerBeforeTheExternalSideEffect()
    {
        var options = await postgres.Database();
        await using var db = new WmsDb(options); var id = Guid.NewGuid(); var provider = new Identity();
        provider.BeforeEmail = async () => {
            await using var observer = new WmsDb(options);
            var saved = AccountInvitations.Read(await observer.SupportingRecords.SingleAsync(r => r.Kind == AccountInvitations.Kind));
            Assert.Equal("unknown", saved.State);
            Assert.Equal("provider-worker", saved.ProviderSubject);
            throw new SimulatedInterruption();
        };
        await Assert.ThrowsAsync<SimulatedInterruption>(() => new AccountInvitations(db, provider).Invite(Admin, id, Input, default));
        provider.BeforeEmail = null;
        await using var restarted = new WmsDb(options);
        Assert.Equal("unknown", (await new AccountInvitations(restarted, provider).Invite(Admin, id, Input, default)).State);
        Assert.Equal(1, provider.Emails);
    }

    [Theory]
    [InlineData(false, "worker@example.test")]
    [InlineData(true, "changed@example.test")]
    public async Task HistoricalVerificationCannotActivateAResentInvitation(bool verified, string email)
    {
        await using var db = new WmsDb(await postgres.Database()); var id = Guid.NewGuid(); var service = new AccountInvitations(db, new Identity());
        await service.Invite(Admin, id, Input, default);
        var row = await db.SupportingRecords.SingleAsync(r => r.Kind == AccountInvitations.Kind);
        row.PayloadJson = JsonSerializer.Serialize(AccountInvitations.Read(row) with { ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1) }, new JsonSerializerOptions(JsonSerializerDefaults.Web)); await db.SaveChangesAsync();
        await SsoEnrollment.Ticket(Ticket(db, "provider-worker"));
        Assert.True((await db.Principals.SingleAsync(p => p.Id == id.ToString("N"))).Verified);
        await service.Invite(Admin, id, Input with { Resend = true }, default);
        await SsoEnrollment.Ticket(Ticket(db, "provider-worker", verified, email));
        Assert.Equal("pending", (await db.Principals.SingleAsync(p => p.Id == id.ToString("N"))).Status);
        Assert.False(await db.AccessGrants.AnyAsync(g => g.PrincipalId == id.ToString("N")));
    }

    sealed class SimulatedInterruption : Exception;

    static TicketReceivedContext Ticket(WmsDb db, string subject, bool verified = true, string? email = null)
    {
        var identity = new ClaimsIdentity([new("sub", subject), new("iss", "https://identity.example"), new("email", email ?? Input.Email), new("email_verified", verified.ToString())], "oidc");
        var http = new DefaultHttpContext { RequestServices = new ServiceCollection().AddSingleton(db).BuildServiceProvider() };
        return new TicketReceivedContext(http, new AuthenticationScheme("oidc", null, typeof(OpenIdConnectHandler)), new OpenIdConnectOptions(), new AuthenticationTicket(new ClaimsPrincipal(identity), "oidc"));
    }

    sealed class Identity : IAccountIdentity
    {
        public bool Configured => true;
        public bool Uncertain { get; set; }
        public string Subject { get; set; } = "provider-worker";
        public Func<Task>? BeforeEmail { get; set; }
        public int Emails { get; private set; }
        public Task<ProviderAccount> EnsureUser(Guid invitation, string name, string email, CancellationToken ct) => Task.FromResult(new ProviderAccount(Subject, true, "https://identity.example"));
        public async Task SendInvitation(ProviderAccount account, CancellationToken ct) { Emails++; if (BeforeEmail is not null) await BeforeEmail(); if (Uncertain) throw new IdentityUnavailable(true); }
        public Task Recover(string email, CancellationToken ct) => Task.CompletedTask;
    }
}
