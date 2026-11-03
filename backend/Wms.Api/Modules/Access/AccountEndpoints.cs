using Wms.Shared;
using Wms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Wms.Modules.Access;

public static class AccountEndpoints
{
    public static void MapAccounts(this WebApplication app)
    {
        app.MapPost("/api/workspaces/{warehouse}/invitations/{id:guid}", async (string warehouse, Guid id, InviteAccount input, HttpContext http, AccessService access, AccountInvitations invitations, WmsDb db, CancellationToken ct) =>
            Results.Ok(await Present(await invitations.Invite(await access.Resolve(http.User, warehouse, ct), id, input, ct), db, ct))).RequireAuthorization().RequireRateLimiting("enrollment");
        app.MapGet("/api/workspaces/{warehouse}/invitations/{id:guid}", async (string warehouse, Guid id, HttpContext http, AccessService access, AccountInvitations invitations, WmsDb db, CancellationToken ct) =>
            Results.Ok(await Present(await invitations.Get(await access.Resolve(http.User, warehouse, ct), id, ct), db, ct))).RequireAuthorization();
        app.MapPost("/api/accounts/recovery", async (RecoveryEmail input, IAccountIdentity identity, ILoggerFactory logs, CancellationToken ct) => {
            Rules.Require(identity.Configured, "identity-not-configured", 503);
            var email = (input.Email ?? "").Trim().ToLowerInvariant();
            Rules.Require(email.Length is > 3 and < 254 && System.Net.Mail.MailAddress.TryCreate(email, out var address) && address.Address == email, "required", 400);
            try { await identity.Recover(email, ct); }
            catch (Exception error) when (error is IdentityUnavailable or HttpRequestException or OperationCanceledException or System.Text.Json.JsonException) {
                logs.CreateLogger("AccountRecovery").LogWarning("The identity service could not process a password-recovery request.");
            }
            return Results.Accepted(value: new { message = "recovery-requested" });
        }).RequireRateLimiting("enrollment");
    }
    static async Task<AccountInvitation> Present(AccountInvitation invitation, WmsDb db, CancellationToken ct) => invitation with {
        Warehouses = await db.Warehouses.Where(w => invitation.Warehouses.Contains(w.Id)).OrderBy(w => w.Id).Select(w => w.Name).ToArrayAsync(ct)
    };
    public sealed record RecoveryEmail(string Email);
}
