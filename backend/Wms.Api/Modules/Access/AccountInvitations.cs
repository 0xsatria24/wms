using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Access;

public sealed record InviteAccount(string Name, string Email, string Role, string[] Warehouses, string Reason, bool Resend = false);
public sealed record AccountInvitation(Guid Id, string PrincipalId, string InviterId, string Name, string Email, string Role, string[] Warehouses, string Reason,
    DateTimeOffset ExpiresAt, string State = "preparing", string? ProviderSubject = null, bool NeedsPassword = false, string? ProviderIssuer = null);

public sealed class AccountInvitations(WmsDb db, IAccountIdentity identity)
{
    public const string Kind = "account-invitation";
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    static string Key(string id) => Kind + "|" + id;
    public static AccountInvitation Read(SupportingRecord row) => JsonSerializer.Deserialize<AccountInvitation>(row.PayloadJson, Json)!;
    static void Write(SupportingRecord row, AccountInvitation invitation) { row.PayloadJson = JsonSerializer.Serialize(invitation, Json); row.Version++; }
    static void Admin(ActingPrincipal actor) => Require(actor.Role == "admin", "denied", 403);

    public async Task<AccountInvitation> Get(ActingPrincipal actor, Guid id, CancellationToken ct)
    {
        Admin(actor);
        var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == Key(id.ToString("N")) && r.WarehouseId == actor.WarehouseId, ct);
        Require(row is not null, "source", 404);
        var invite = Read(row!);
        await Scope(actor, invite.Warehouses, ct);
        var principal = await db.Principals.SingleAsync(p => p.Id == invite.PrincipalId, ct);
        return invite with { State = principal.Status == "active" ? "accepted" : principal.Status != "pending" ? "cancelled" : invite.ExpiresAt <= DateTimeOffset.UtcNow ? "expired" : invite.State };
    }

    async Task Scope(ActingPrincipal actor, string[] warehouses, CancellationToken ct)
    {
        Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct), "denied", 403);
        var allowed = await db.AccessGrants.Where(g => g.PrincipalId == actor.Id && g.Role == "admin").Select(g => g.WarehouseId).ToArrayAsync(ct);
        Require(warehouses.Length > 0 && warehouses.All(allowed.Contains), "scope", 403);
    }

    public async Task<AccountInvitation> Invite(ActingPrincipal actor, Guid id, InviteAccount input, CancellationToken ct)
    {
        Admin(actor);
        Require(id != Guid.Empty, "required", 400);
        Require(identity.Configured, "identity-not-configured", 503);
        var name = (input.Name ?? "").Trim(); var email = (input.Email ?? "").Trim().ToLowerInvariant(); var reason = (input.Reason ?? "").Trim();
        Require(name.Length is > 0 and < 200 && email.Length is > 3 and < 254 && System.Net.Mail.MailAddress.TryCreate(email, out var address) && address.Address == email, "required", 400);
        Require(reason.Length is > 0 and <= 2000 && input.Role is "admin" or "supervisor" or "operator" or "viewer", "required", 400);
        var requested = input.Warehouses ?? [];
        Require(requested.Length is > 0 and <= 100 && requested.Distinct().Count() == requested.Length, "scope", 403);
        var warehouses = await db.Warehouses.Where(w => w.Id != "transit" && (requested.Contains(w.Id) || requested.Contains(w.Name))).Select(w => w.Id).OrderBy(w => w).ToArrayAsync(ct);
        Require(warehouses.Length == requested.Length, "scope", 403);
        await Scope(actor, warehouses, ct);
        var key = Key(id.ToString("N"));
        await using (var transaction = await db.Database.BeginTransactionAsync(ct))
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"edit:demo:users"}, 0))", ct);
            var saved = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == key, ct);
            if (saved is null)
            {
                Require(!await db.Principals.AnyAsync(p => p.Email.ToLower() == email, ct), "user-duplicate", 409);
                var principalId = id.ToString("N");
                db.Principals.Add(new Principal { Id = principalId, Issuer = "access-request", Subject = "request:" + principalId, Email = email, Name = name });
                var invite = new AccountInvitation(id, principalId, actor.Id, name, email, input.Role, warehouses, reason, DateTimeOffset.UtcNow.AddDays(1));
                saved = new SupportingRecord { Id = key, WarehouseId = actor.WarehouseId, Kind = Kind };
                Write(saved, invite); db.SupportingRecords.Add(saved);
                db.Audit.Add(new AuditRecord { TransactionId = ReferenceId.New(), PrincipalId = actor.Id, WarehouseId = actor.WarehouseId, Action = "invite-user", DetailJson = JsonSerializer.Serialize(new { Target = principalId, Role = input.Role, Warehouses = warehouses, Reason = reason }), PostedAt = DateTimeOffset.UtcNow });
                await db.SaveChangesAsync(ct);
            }
            else
            {
                var existing = Read(saved);
                Require(saved.WarehouseId == actor.WarehouseId && existing.InviterId == actor.Id, "scope", 403);
                Require(existing.Name == name && existing.Email == email && existing.Role == input.Role && existing.Reason == reason && existing.Warehouses.SequenceEqual(warehouses), "key-changed", 409);
            }
            await transaction.CommitAsync(ct);
        }

        // Keep a session lock across durable checkpoints without holding the global user-administration lock.
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(12));
        var deliveryToken = deadline.Token;
        await db.Database.OpenConnectionAsync(deliveryToken);
        var acquired = false;
        try
        {
            acquired = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_lock(hashtextextended({key}, 0)) AS \"Value\"").SingleAsync(deliveryToken);
            if (!acquired) return await Get(actor, id, deliveryToken);
            var row = await db.SupportingRecords.SingleAsync(r => r.Id == key, deliveryToken);
            await db.Entry(row).ReloadAsync(deliveryToken);
            var current = await Get(actor, id, deliveryToken);
            if (current.State is "accepted" or "cancelled" or "blocked" || !input.Resend && current.State is "sent" or "unknown" or "expired") return current;
            if (input.Resend) current = current with { ExpiresAt = DateTimeOffset.UtcNow.AddDays(1) };
            async Task Persist()
            {
                await db.Entry(row).ReloadAsync(CancellationToken.None);
                var latest = Read(row);
                if (latest.State == "accepted") current = latest;
                Write(row, current);
                await db.SaveChangesAsync(CancellationToken.None);
            }
            var sendingEmail = false;
            try
            {
                var provider = await identity.EnsureUser(id, name, email, deliveryToken);
                if (current.ProviderSubject is not null && (current.ProviderSubject != provider.Subject || current.ProviderIssuer != provider.Issuer))
                {
                    current = current with { State = "blocked" };
                    await Persist();
                    return current;
                }
                current = current with { ProviderSubject = provider.Subject, NeedsPassword = provider.NeedsPassword, ProviderIssuer = provider.Issuer, State = "unknown" };
                // A crash after dispatch must leave a read-only uncertain result, never a blind email replay.
                await Persist();
                sendingEmail = true;
                await identity.SendInvitation(provider, deliveryToken);
                current = current with { State = "sent" };
            }
            catch (Exception error) when (error is IdentityUnavailable or HttpRequestException or OperationCanceledException or JsonException)
            {
                current = current with { State = sendingEmail || error is IdentityUnavailable { Uncertain: true } ? "unknown" : "failed" };
            }
            await Persist();
            return await Get(actor, id, CancellationToken.None);
        }
        finally
        {
            try { if (acquired) await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_unlock(hashtextextended({key}, 0))", CancellationToken.None); }
            finally { await db.Database.CloseConnectionAsync(); }
        }
    }

    public static async Task<bool> Matches(WmsDb db, string principalId, string issuer, string subject, CancellationToken ct)
    {
        var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == Key(principalId) && r.Kind == Kind, ct);
        return row is null || Read(row) is var invite && invite.ProviderSubject == subject && invite.ProviderIssuer == issuer;
    }

    public static async Task Accept(WmsDb db, Principal principal, CancellationToken ct)
    {
        if (!principal.Verified || principal.Status != "pending") return;
        var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == Key(principal.Id) && r.Kind == Kind, ct);
        if (row is null) return;
        var invite = Read(row);
        if (invite.ExpiresAt <= DateTimeOffset.UtcNow || invite.ProviderSubject != principal.Subject || invite.ProviderIssuer != principal.Issuer || invite.State is not ("sent" or "unknown")
            || !await db.Principals.AnyAsync(p => p.Id == invite.InviterId && p.Status == "active", ct)
            || await db.AccessGrants.AnyAsync(g => g.PrincipalId == principal.Id, ct)) return;
        var allowed = await db.AccessGrants.Where(g => g.PrincipalId == invite.InviterId && g.Role == "admin").Select(g => g.WarehouseId).ToArrayAsync(ct);
        if (!invite.Warehouses.All(allowed.Contains)) return;
        foreach (var warehouse in invite.Warehouses) db.AccessGrants.Add(new AccessGrant { PrincipalId = principal.Id, WarehouseId = warehouse, Role = invite.Role });
        principal.Status = "active";
        Write(row, invite with { State = "accepted" });
        db.Audit.Add(new AuditRecord { TransactionId = ReferenceId.New(), PrincipalId = principal.Id, WarehouseId = row.WarehouseId, Action = "accept-invitation", DetailJson = JsonSerializer.Serialize(new { Inviter = invite.InviterId, Role = invite.Role, Warehouses = invite.Warehouses }), PostedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
    }
}
