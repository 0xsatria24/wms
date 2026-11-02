using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;

namespace Wms.Modules.Access;

public static class SsoEnrollment
{
    private static bool Verified(ClaimsPrincipal principal) => bool.TryParse(principal.FindFirstValue("email_verified"), out var verified) && verified;
    public static Task Validated(TokenValidatedContext context)
    {
        var identity = (ClaimsIdentity)context.Principal!.Identity!;
        if (!identity.HasClaim(c => c.Type == "iss"))
            identity.AddClaim(new Claim("iss", context.SecurityToken.Issuer));
        return Task.CompletedTask;
    }
    public static async Task Ticket(TicketReceivedContext context)
    {
        var principal = context.Principal!;
        var subject = principal.FindFirstValue("sub");
        var issuer = principal.FindFirstValue("iss");
        if (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(issuer))
        {
            context.Fail("The identity provider did not supply a stable subject and issuer.");
            return;
        }
        var db = context.HttpContext.RequestServices.GetRequiredService<WmsDb>();
        var ct = context.HttpContext.RequestAborted;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"edit:demo:users"}, 0))", ct);
        var existing = await db.Principals.SingleOrDefaultAsync(p => p.Subject == subject && p.Issuer == issuer, context.HttpContext.RequestAborted);
        if (existing?.Status is "deleted" or "revoked" or "rejected")
        {
            context.Fail("This account has been removed. Contact your access administrator.");
            return;
        }
        if (existing is null)
        {
            var email = principal.FindFirstValue("email")?.Trim().ToLowerInvariant() ?? "";
            if (!Verified(principal) || !System.Net.Mail.MailAddress.TryCreate(email, out var address) || address.Address != email)
            {
                context.Fail("A verified email from your identity provider is required for enrollment.");
                return;
            }
            var matches = await db.Principals.Where(p => p.Email.ToLower() == email).ToListAsync(ct);
            if (matches.Count > 1 || matches.Any(p => p.Issuer != "access-request" || p.Status != "pending") ||
                await db.AccessGrants.AnyAsync(g => matches.Select(p => p.Id).Contains(g.PrincipalId), ct))
            {
                context.Fail("This identity requires review by your access administrator.");
                return;
            }
            existing = matches.SingleOrDefault();
            if (existing is null)
            {
                existing = new Principal { Id = Guid.NewGuid().ToString("N"), Email = email, Name = principal.FindFirstValue("name") ?? "SSO account", Status = "pending" };
                db.Principals.Add(existing);
            }
            existing.Subject = subject;
            existing.Issuer = issuer;
            existing.Verified = true;
            await db.SaveChangesAsync(ct);
        }
        if (!existing.Verified && Verified(principal) && string.Equals(existing.Email, principal.FindFirstValue("email")?.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            existing.Verified = true;
            await db.SaveChangesAsync(ct);
        }
        await transaction.CommitAsync(ct);
    }
}
