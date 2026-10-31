using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;

namespace Wms.Modules.Access;

public static class SsoEnrollment
{
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
        var existing = await db.Principals.SingleOrDefaultAsync(p => p.Subject == subject && p.Issuer == issuer, context.HttpContext.RequestAborted);
        if (existing?.Status == "deleted")
        {
            context.Fail("This account has been removed. Contact your access administrator.");
            return;
        }
        if (existing is null)
        {
            db.Principals.Add(new Principal { Id = Guid.NewGuid().ToString("N"), Subject = subject, Issuer = issuer, Name = principal.FindFirstValue("name") ?? "SSO account", Email = principal.FindFirstValue("email") ?? "", Verified = principal.FindFirstValue("email_verified") == "true", Status = "pending" });
            await db.SaveChangesAsync(context.HttpContext.RequestAborted);
        }
    }
}
