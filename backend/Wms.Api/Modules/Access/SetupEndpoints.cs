using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Wms.Infrastructure;
using static Wms.Shared.Rules;

namespace Wms.Modules.Access;

public sealed record SetupActivation(string Code);

public static class SetupEndpoints
{
    public static void MapSetup(this WebApplication app)
    {
        app.MapGet("/api/setup/status", async (SetupService setup, IConfiguration config, CancellationToken ct) => Results.Ok(new { state = await setup.State(ct), companyName = config["Company:Name"] ?? "Inventory / WMS" }));
        app.MapGet("/api/setup/session", async (HttpContext http, SetupService setup, IAntiforgery csrf, CancellationToken ct) => {
            var ticket = await setup.State(ct) == "required" ? setup.Read(http) : null;
            return Results.Ok(new { csrfToken = csrf.GetAndStoreTokens(http).RequestToken, stage = ticket is null ? "activation" : ticket.Identity is null ? "identity" : "review", expiresAt = ticket?.ExpiresAt, identity = ticket?.Identity is { } id ? new { id.Name, id.Email } : null });
        });
        app.MapPost("/api/setup/activate", async (SetupActivation input, HttpContext http, SetupService setup, CancellationToken ct) => {
            Require(await setup.State(ct) == "required", "setup-unavailable", 409);
            setup.Activate(http, input.Code ?? ""); return Results.NoContent();
        }).RequireRateLimiting("enrollment");
        app.MapGet("/auth/setup-login", async (HttpContext http, SetupService setup, CancellationToken ct) => {
            var ticket = setup.Read(http);
            Require(await setup.State(ct) == "required" && ticket is not null, "setup-session", 403);
            var properties = new AuthenticationProperties { RedirectUri = "/" };
            properties.Items[SetupService.Flow] = ticket!.Nonce;
            return Results.Challenge(properties, [OpenIdConnectDefaults.AuthenticationScheme]);
        }).RequireRateLimiting("enrollment");
        app.MapPost("/api/setup/complete", async (HttpContext http, SetupService setup, WmsDb db, CancellationToken ct) => {
            var ticket = setup.Read(http);
            Require(await setup.State(ct) == "required" && ticket?.Identity is not null, "setup-session", 403);
            var id = ticket!.Identity!;
            await ProductionBootstrap.Run(db, new(id.Issuer, id.Subject, id.Email, id.Name, [setup.InitialWarehouse()]), ct);
            http.Response.Cookies.Delete(SetupService.Cookie, new CookieOptions { Path = "/", Secure = true });
            return Results.NoContent();
        }).RequireRateLimiting("enrollment");
    }
}
