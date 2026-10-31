using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Modules.Catalog;
using Wms.Modules.Inventory;
using Wms.Modules.Reporting;
using Wms.Shared;

var builder = WebApplication.CreateBuilder(args);
var demo = builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Development:EnableDemoAuth");
var gatewayEnabled = builder.Configuration.GetValue<bool>("Gateway:Enabled");
var connection = builder.Configuration.GetConnectionString("Wms") ?? throw new InvalidOperationException("Configure ConnectionStrings:Wms.");
builder.Services.AddDbContext<WmsDb>(o => o.UseNpgsql(connection));
builder.Services.AddScoped<AccessService>();
builder.Services.AddScoped<CommandProcessor>();
builder.Services.AddScoped<SnapshotQuery>();
builder.Services.AddScoped<EditService>();
builder.Services.AddScoped<LedgerExport>();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-XSRF-TOKEN"; o.Cookie.Name = "Wms.Csrf"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = demo ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; });
builder.Services.AddSignalR();
builder.Services.AddAuthorization();
builder.Services.AddHostedService<PgNotifications>();
var auth = builder.Services.AddAuthentication(o => { o.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme; o.DefaultChallengeScheme = demo ? CookieAuthenticationDefaults.AuthenticationScheme : OpenIdConnectDefaults.AuthenticationScheme; });
auth.AddCookie(o => { o.Cookie.Name = "Wms.Session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Lax; o.Cookie.SecurePolicy = demo ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; o.ExpireTimeSpan = TimeSpan.FromHours(8); o.SlidingExpiration = true; o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; }; o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; }; });
if (gatewayEnabled) auth.AddJwtBearer("Gateway", o => { o.Authority = builder.Configuration["Gateway:Authority"] ?? throw new InvalidOperationException("Configure Gateway:Authority."); o.Audience = builder.Configuration["Gateway:Audience"] ?? throw new InvalidOperationException("Configure Gateway:Audience."); o.MapInboundClaims = false; o.RequireHttpsMetadata = true; });
if (!demo) auth.AddOpenIdConnect(o => { o.Authority = builder.Configuration["Oidc:Authority"] ?? throw new InvalidOperationException("Configure Oidc:Authority."); o.ClientId = builder.Configuration["Oidc:ClientId"] ?? throw new InvalidOperationException("Configure Oidc:ClientId."); o.ClientSecret = builder.Configuration["Oidc:ClientSecret"]; o.ResponseType = OpenIdConnectResponseType.Code; o.UsePkce = true; o.MapInboundClaims = false; o.SaveTokens = false; o.GetClaimsFromUserInfoEndpoint = true; o.Scope.Add("email"); o.TokenValidationParameters.NameClaimType = "name"; o.Events.OnTokenValidated = SsoEnrollment.Validated; o.Events.OnTicketReceived = SsoEnrollment.Ticket; });
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 8_000_000);
var app = builder.Build();
app.Use(async (context, next) => { try { await next(); } catch (BusinessException e) { context.Response.StatusCode = e.Status; await context.Response.WriteAsJsonAsync(new { code = e.Message, requestId = context.TraceIdentifier }); } catch (DbUpdateConcurrencyException) { context.Response.StatusCode = 409; await context.Response.WriteAsJsonAsync(new { code = "conflict", requestId = context.TraceIdentifier }); } catch (AntiforgeryValidationException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { code = "csrf", requestId = context.TraceIdentifier }); } });
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) => { if (context.Request.Path.StartsWithSegments("/api")) { context.Response.Headers.CacheControl = "no-store"; if (HttpMethods.IsPost(context.Request.Method) && context.Request.Path != "/api/rfid/observations") await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); } await next(); });
app.MapGet("/health/live", () => Results.Ok(new { status = "up" }));
app.MapGet("/health/ready", async (WmsDb db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
app.MapGet("/api/session", async (HttpContext context, IAntiforgery csrf, AccessService access, CancellationToken ct) =>
{
    var token = csrf.GetAndStoreTokens(context);
    var principal = await access.Principal(context.User, ct);
    return Results.Ok(new
    {
        mode = demo ? "development-demo" : "oidc",
        csrfToken = token.RequestToken,
        user = principal is null ? null : await access.User(principal, ct)
    });
});
if (demo)
{
    app.MapPost("/api/dev/login", async (HttpContext context, JsonElement payload, WmsDb db, CancellationToken ct) =>
    {
        Rules.Require(context.Connection.RemoteIpAddress is not null && IPAddress.IsLoopback(context.Connection.RemoteIpAddress), "denied", 403);
        var account = payload.Text("account");
        Rules.Require(account is "admin" or "operator" or "supervisor" && payload.Text("password") == "demo123", "credentials", 401);
        var principal = await db.Principals.SingleAsync(p => p.Id == account, ct);
        var claims = new[] { new Claim("sub", principal.Subject), new Claim("iss", principal.Issuer), new Claim("name", principal.Name) };
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
        return Results.NoContent();
    });
    app.MapPost("/api/dev/verify-email", async (JsonElement payload, WmsDb db, CancellationToken ct) => { var principal = await db.Principals.FirstOrDefaultAsync(p => p.Email == payload.Text("email") && p.Status == "pending", ct); if (principal is not null) { principal.Verified = true; await db.SaveChangesAsync(ct); } return Results.NoContent(); });
}
app.MapGet("/auth/login", () => Results.Challenge(new AuthenticationProperties { RedirectUri = "/" }, [OpenIdConnectDefaults.AuthenticationScheme]));
app.MapPost("/api/logout", async (HttpContext context) => { await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); return Results.NoContent(); });
app.MapPost("/api/access/request", async (JsonElement payload, WmsDb db, CancellationToken ct) =>
{
    var email = payload.Text("email");
    Rules.Require(email.Length is > 3 and < 254 && email.Contains('@') && payload.Text("name").Length is > 0 and < 200, "required", 400);
    if (!await db.Principals.AnyAsync(p => p.Email == email, ct))
    {
        var id = Guid.NewGuid().ToString("N");
        db.Principals.Add(new Principal { Id = id, Subject = $"request:{id}", Issuer = "access-request", Email = email, Name = payload.Text("name"), Status = "pending" });
        await db.SaveChangesAsync(ct);
    }
    return Results.Accepted(value: new
    {
        message = "request-received"
    });
});
app.MapGet("/api/workspaces/{warehouse}/snapshot", async (string warehouse, HttpContext context, AccessService access, SnapshotQuery query, CancellationToken ct) => { var actor = await access.Resolve(context.User, warehouse, ct); return Results.Ok(await query.Read(actor, ct)); }).RequireAuthorization();
app.MapGet("/api/workspaces/{warehouse}/ledger.csv", async (string warehouse, string sku, string? location, string? query, string? from, string? to, HttpContext context, AccessService access, LedgerExport export, CancellationToken ct) => { var actor = await access.Resolve(context.User, warehouse, ct); return Results.File(await export.Csv(actor, sku, location, query, ct, from, to), "text/csv; charset=utf-8", "stock-movements.csv"); }).RequireAuthorization();
app.MapPost("/api/commands", async (CommandRequest request, HttpContext context, AccessService access, CommandProcessor commands, IHubContext<WorkspaceHub> hub, CancellationToken ct) =>
{
    var actor = await access.Resolve(context.User, request.Warehouse, ct);
    Rules.Require(request.PrincipalId == actor.Id, "pending-owner", 403);
    var key = context.Request.Headers["Idempotency-Key"].ToString();
    var result = await commands.Handle(actor, request, key, ct);
    await hub.Clients.Group($"warehouse:{actor.WarehouseId}").SendAsync("WorkspaceChanged", new
    {
        kind = "data-changed"
    }, ct);
    return Results.Ok(result);
}).RequireAuthorization();
app.MapGet("/api/requests/{type}/{key}", async (string type, string key, string warehouse, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) => { var actor = await access.Resolve(context.User, warehouse, ct); var scope = $"demo:{actor.Id}:{type}:{key}"; var result = await db.Requests.SingleOrDefaultAsync(r => r.ScopeKey == scope && r.WarehouseId == actor.WarehouseId, ct); return result is null ? Results.NotFound(new { code = "not-found" }) : Results.Content(result.ResultJson, "application/json"); }).RequireAuthorization();
app.MapPost("/api/edit", async (EditRequest request, HttpContext context, AccessService access, EditService editor, CancellationToken ct) => { var actor = await access.Resolve(context.User, request.Warehouse, ct); await editor.Apply(actor, request, ct); return Results.NoContent(); }).RequireAuthorization();
if (gatewayEnabled)
    app.MapPost("/api/rfid/observations", async (JsonElement payload, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) =>
    {
        var actor = await access.Resolve(context.User, payload.Text("warehouse"), ct);
        Rules.Supervisor(actor);
        Rules.Require(Guid.TryParse(payload.Text("id"), out var id), "required", 400);
        Rules.Require(await db.SupportingRecords.AnyAsync(r => r.Kind == "devices" && r.Id == "device|" + payload.Text("readerId") && r.WarehouseId == actor.WarehouseId, ct), "device-unregistered", 403);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({id.ToString()}, 0))", ct);
        var hash = Rules.Hash(Rules.Canonical(payload));
        var previous = await db.Observations.FindAsync([id], ct);
        if (previous is not null)
        {
            Rules.Require(previous.PayloadHash == hash && previous.WarehouseId == actor.WarehouseId, "key-changed");
            return Results.Ok(new
            {
                id
            });
        }
        Rules.Require(DateTimeOffset.TryParse(payload.Text("observedAt"), out var observedAt) && payload.Text("tagCode").Length is > 0 and <= 256, "required", 400);
        db.Observations.Add(new Observation { Id = id, WarehouseId = actor.WarehouseId, ReaderId = payload.Text("readerId"), SessionId = payload.Text("sessionId"), TagCode = payload.Text("tagCode"), ObservedAt = observedAt.ToUniversalTime(), ReceivedAt = DateTimeOffset.UtcNow, PayloadHash = hash });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Results.Ok(new
        {
            id
        });
    }).RequireAuthorization(policy => policy.AddAuthenticationSchemes("Gateway").RequireAuthenticatedUser());
else
    app.MapPost("/api/rfid/observations", () => Results.Problem("Gateway identity and reader registration must be configured.", statusCode: 503));
app.MapHub<WorkspaceHub>("/hubs/workspace");
if (args.Contains("--migrate", StringComparer.Ordinal) || builder.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
    await db.Database.MigrateAsync();
    if (demo && builder.Configuration.GetValue<bool>("Development:SeedDemo"))
        await Seed.Demo(db);
}
app.Run();
public partial class Program;
