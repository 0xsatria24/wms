using System.Net;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Modules.Catalog;
using Wms.Modules.Inventory;
using Wms.Modules.Reporting;
using Wms.Modules.Integration;
using Wms.Modules.Settings;
using Wms.Shared;

if (args.Contains("--healthcheck", StringComparer.Ordinal))
{
    try
    {
        using var probe = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        Environment.ExitCode = (await probe.GetAsync("http://127.0.0.1:8080/health/setup-ready")).IsSuccessStatusCode ? 0 : 1;
    }
    catch (HttpRequestException) { Environment.ExitCode = 1; }
    catch (TaskCanceledException) { Environment.ExitCode = 1; }
    return;
}
var builder = WebApplication.CreateBuilder(args);
if (builder.Configuration["deployment-config"] is { } deploymentConfig)
    builder.Configuration.AddJsonFile(Path.GetFullPath(deploymentConfig), optional: false, reloadOnChange: false);
builder.Services.AddWindowsService(options => options.ServiceName = "InventoryWms.Api");
var directHttps = builder.Configuration.GetValue<bool>("Hosting:DirectHttps");
var demo = builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Development:EnableDemoAuth");
var gatewayEnabled = builder.Configuration.GetValue<bool>("Gateway:Enabled");
var erpIngressEnabled = builder.Configuration.GetValue<bool>("ErpIngress:Enabled");
var connection = builder.Configuration.GetConnectionString("Wms") ?? throw new InvalidOperationException("Configure ConnectionStrings:Wms.");
builder.Services.AddDbContext<WmsDb>(o => o.UseNpgsql(connection));
builder.Services.AddScoped<AccessService>();
builder.Services.AddScoped<SetupService>();
builder.Services.AddScoped<CommandProcessor>();
builder.Services.AddScoped<SnapshotQuery>();
builder.Services.AddScoped<EditService>();
builder.Services.AddScoped<LedgerExport>();
builder.Services.AddScoped<PurchaseOrderImport>();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-XSRF-TOKEN"; o.Cookie.Name = "Wms.Csrf"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = demo ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; });
builder.Services.AddSignalR();
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    LoginRateLimits.Configure(options);
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        if (LoginRateLimits.IsLogin(context.HttpContext))
            await context.HttpContext.Response.WriteAsJsonAsync(new { code = "login-rate-limit" }, cancellationToken);
    };
    options.AddFixedWindowLimiter("enrollment", limiter =>
    {
        limiter.PermitLimit = 10;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();
    foreach (var value in (builder.Configuration["ReverseProxy:KnownProxies"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        options.KnownProxies.Add(IPAddress.Parse(value));
});
var keyPath = builder.Configuration["DataProtection:KeyPath"];
if (!demo && !args.Contains("--bootstrap", StringComparer.Ordinal) && !args.Contains("--installation-state", StringComparer.Ordinal))
{
    if (string.IsNullOrWhiteSpace(keyPath) || (!directHttps && string.IsNullOrWhiteSpace(builder.Configuration["ReverseProxy:KnownProxies"])))
        throw new InvalidOperationException("Production requires DataProtection:KeyPath and ReverseProxy:KnownProxies.");
    Directory.CreateDirectory(keyPath);
    builder.Services.AddDataProtection().SetApplicationName("InventoryWms").PersistKeysToFileSystem(new DirectoryInfo(keyPath));
    var httpsPort = 443;
    if (directHttps)
    {
        if (!Uri.TryCreate(builder.Configuration["Kestrel:Endpoints:Https:Url"], UriKind.Absolute, out var httpsEndpoint) || httpsEndpoint.Scheme != "https")
            throw new InvalidOperationException("Direct HTTPS hosting requires Kestrel:Endpoints:Https:Url with an HTTPS URL.");
        httpsPort = httpsEndpoint.Port;
    }
    builder.Services.AddHttpsRedirection(options => options.HttpsPort = httpsPort);
}
builder.Services.AddHostedService<PgNotifications>();
var auth = builder.Services.AddAuthentication(o => { o.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme; o.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme; });
if (erpIngressEnabled) auth.AddJwtBearer("Erp", options =>
{
    options.Authority = builder.Configuration["ErpIngress:Authority"] ?? throw new InvalidOperationException("Configure ErpIngress:Authority.");
    options.Audience = builder.Configuration["ErpIngress:Audience"] ?? throw new InvalidOperationException("Configure ErpIngress:Audience.");
    options.MapInboundClaims = false;
    options.RequireHttpsMetadata = true;
});
auth.AddCookie(o => { o.Cookie.Name = "Wms.Session"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Lax; o.Cookie.SecurePolicy = demo ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; o.ExpireTimeSpan = TimeSpan.FromHours(8); o.SlidingExpiration = true; o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; }; o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; }; });
if (gatewayEnabled) auth.AddJwtBearer("Gateway", o => { o.Authority = builder.Configuration["Gateway:Authority"] ?? throw new InvalidOperationException("Configure Gateway:Authority."); o.Audience = builder.Configuration["Gateway:Audience"] ?? throw new InvalidOperationException("Configure Gateway:Audience."); o.MapInboundClaims = false; o.RequireHttpsMetadata = true; });
if (!demo) auth.AddOpenIdConnect(o =>
{
    o.Authority = builder.Configuration["Oidc:Authority"] ?? throw new InvalidOperationException("Configure Oidc:Authority.");
    o.ClientId = builder.Configuration["Oidc:ClientId"] ?? throw new InvalidOperationException("Configure Oidc:ClientId.");
    o.ClientSecret = builder.Configuration["Oidc:ClientSecret"];
    o.ResponseType = OpenIdConnectResponseType.Code;
    o.UsePkce = true;
    o.MapInboundClaims = false;
    o.SaveTokens = false;
    o.GetClaimsFromUserInfoEndpoint = true;
    o.Scope.Add("email");
    o.ClaimActions.MapUniqueJsonKey("email_verified", "email_verified", ClaimValueTypes.Boolean);
    o.TokenValidationParameters.NameClaimType = "name";
    o.Events.OnTokenValidated = SsoEnrollment.Validated;
    o.Events.OnTicketReceived = SsoEnrollment.Ticket;
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 8_000_000);
var app = builder.Build();
if (!demo)
{
    if (!directHttps) app.UseForwardedHeaders();
    app.UseWhen(context => !context.Request.Path.StartsWithSegments("/health"), branch => branch.UseHttpsRedirection());
    app.UseHsts();
}
app.Use(async (context, next) => { try { await next(); } catch (BusinessException e) { context.Response.StatusCode = e.Status; await context.Response.WriteAsJsonAsync(new { code = e.Message, requestId = context.TraceIdentifier }); } catch (DbUpdateConcurrencyException) { context.Response.StatusCode = 409; await context.Response.WriteAsJsonAsync(new { code = "conflict", requestId = context.TraceIdentifier }); } catch (AntiforgeryValidationException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { code = "csrf", requestId = context.TraceIdentifier }); } });
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method) && context.Request.Path.StartsWithSegments("/api") && context.Request.Path != "/api/logout" && context.Request.Path != "/api/dev/login")
        await RecoveryState.RequireWritable(context.RequestServices.GetRequiredService<WmsDb>(), context.RequestAborted);
    await next();
});
app.Use(async (context, next) => { if (context.Request.Path.StartsWithSegments("/api")) { context.Response.Headers.CacheControl = "no-store"; if (HttpMethods.IsPost(context.Request.Method) && context.Request.Path != "/api/rfid/observations" && !context.Request.Path.StartsWithSegments("/api/erp")) await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); } await next(); });
app.MapGet("/health/live", () => Results.Ok(new { status = "up" }));
app.MapGet("/health/ready", async (WmsDb db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) && await db.Settings.AnyAsync(ct) && await db.Warehouses.AnyAsync(w => w.Id != "transit", ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
app.MapSettings();
app.MapGet("/health/setup-ready", async (WmsDb db, SetupService setup, CancellationToken ct) => {
    try {
        if ((await db.Database.GetPendingMigrationsAsync(ct)).Any()) return Results.StatusCode(503);
        var state = await setup.State(ct);
        return state is "completed" or "required" ? Results.Ok(new { status = state == "required" ? "setup-required" : "ready" }) : Results.StatusCode(503);
    } catch (Npgsql.NpgsqlException) { return Results.StatusCode(503); }
});
if (!demo) app.MapSetup();
app.MapGet("/api/session", async (HttpContext context, IAntiforgery csrf, AccessService access, CancellationToken ct) =>
{
    var token = csrf.GetAndStoreTokens(context);
    var principal = await access.Principal(context.User, ct);
    return Results.Ok(new
    {
        mode = demo ? "development-demo" : "oidc",
        companyName = builder.Configuration["Company:Name"] ?? (demo ? "Demo Company" : "Inventory / WMS"),
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
        Rules.Require(principal.Status == "active", "account-unavailable", 403);
        var claims = new[] { new Claim("sub", principal.Subject), new Claim("iss", principal.Issuer), new Claim("name", principal.Name) };
        var rememberMe = payload.TryGetProperty("rememberMe", out var remember) && remember.ValueKind == JsonValueKind.True;
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)), LoginSession.Properties(rememberMe));
        return Results.NoContent();
    }).RequireRateLimiting(LoginRateLimits.Policy);
    app.MapPost("/api/dev/verify-email", async (JsonElement payload, WmsDb db, CancellationToken ct) => { var principal = await db.Principals.FirstOrDefaultAsync(p => p.Email == payload.Text("email") && p.Status == "pending", ct); if (principal is not null) { principal.Verified = true; await db.SaveChangesAsync(ct); } return Results.NoContent(); });
}
app.MapGet("/auth/login", (bool? rememberMe) =>
{
    var properties = LoginSession.Properties(rememberMe == true);
    properties.RedirectUri = "/";
    return Results.Challenge(properties, [OpenIdConnectDefaults.AuthenticationScheme]);
}).RequireRateLimiting(LoginRateLimits.Policy);
app.MapPost("/api/logout", async (HttpContext context) => { await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); return Results.NoContent(); });
app.MapPost("/api/access/request", async (JsonElement payload, WmsDb db, CancellationToken ct) =>
{
    var email = payload.Text("email").Trim().ToLowerInvariant();
    var name = payload.Text("name").Trim();
    Rules.Require(email.Length is > 3 and < 254 && email.Contains('@') && name.Length is > 0 and < 200, "required", 400);
    await using var transaction = await db.Database.BeginTransactionAsync(ct);
    await SetupService.EnrollmentLock(db, ct);
    var acquired = await db.Database.SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock(hashtextextended({"edit:demo:users"}, 0)) AS \"Value\"").SingleAsync(ct);
    Rules.Require(acquired, "enrollment-busy", 429);
    if (!await db.Principals.AnyAsync(p => p.Email.ToLower() == email, ct))
    {
        await EnrollmentLimits.RequireCapacity(db, ct);
        var id = Guid.NewGuid().ToString("N");
        db.Principals.Add(new Principal { Id = id, Subject = $"request:{id}", Issuer = "access-request", Email = email, Name = name, Status = "pending" });
        await db.SaveChangesAsync(ct);
    }
    await transaction.CommitAsync(ct);
    return Results.Accepted(value: new
    {
        message = "request-received"
    });
}).RequireRateLimiting("enrollment");
app.MapGet("/api/workspaces/{warehouse}/snapshot", async (string warehouse, [AsParameters] WorkspaceQuery input, HttpContext context, AccessService access, SnapshotQuery query, CancellationToken ct) => { var actor = await access.Resolve(context.User, warehouse, ct); return Results.Ok(await query.Read(actor, ct, input)); }).RequireAuthorization();
if (erpIngressEnabled)
    app.MapPost("/api/erp/workspaces/{warehouse}/purchase-orders", async (string warehouse, PurchaseOrderMessage input, HttpContext context, AccessService access, PurchaseOrderImport importer, IHubContext<WorkspaceHub> hub, CancellationToken ct) =>
    {
        var actor = await access.Resolve(context.User, warehouse, ct);
        var result = await importer.Apply(actor, input, context.Request.Headers["Idempotency-Key"].ToString(), ct);
        await hub.Clients.Group($"warehouse:{actor.WarehouseId}").SendAsync("WorkspaceChanged", new { kind = "erp-purchase-order" }, ct);
        return Results.Ok(result);
    }).RequireAuthorization(policy => policy.AddAuthenticationSchemes("Erp").RequireAuthenticatedUser().RequireAssertion(context => context.User.FindAll("scope").Any(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries).Contains("wms.po.write", StringComparer.Ordinal))));
app.MapGet("/api/items/{sku}/image", async (string sku, string warehouse, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) =>
{
    await access.Resolve(context.User, warehouse, ct);
    var image = await db.Items.Where(i => i.CompanyId == "demo" && i.Sku == sku).Select(i => i.Image).SingleOrDefaultAsync(ct);
    if (image is null) return Results.NotFound();
    var comma = image.IndexOf(',');
    if (comma < 0) return Results.NotFound();
    var mime = image.StartsWith("data:image/png", StringComparison.OrdinalIgnoreCase) ? "image/png" : image.StartsWith("data:image/webp", StringComparison.OrdinalIgnoreCase) ? "image/webp" : "image/jpeg";
    return Results.File(Convert.FromBase64String(image[(comma + 1)..]), mime);
}).RequireAuthorization();
app.MapGet("/api/workspaces/{warehouse}/ledger.csv", async (string warehouse, string sku, string? location, string? query, string? from, string? to, HttpContext context, AccessService access, LedgerExport export, CancellationToken ct) => { var actor = await access.Resolve(context.User, warehouse, ct); return Results.File(await export.Csv(actor, sku, location, query, ct, from, to), "text/csv; charset=utf-8", "stock-movements.csv"); }).RequireAuthorization();
app.MapPost("/api/commands", async (CommandRequest request, HttpContext context, AccessService access, CommandProcessor commands, IHubContext<WorkspaceHub> hub, WmsDb db, CancellationToken ct) =>
{
    var actor = await access.Resolve(context.User, request.Warehouse, ct);
    Rules.Require(request.PrincipalId == actor.Id, "pending-owner", 403);
    var key = context.Request.Headers["Idempotency-Key"].ToString();
    var result = await commands.Handle(actor, request, key, ct);
    await hub.Clients.Group($"warehouse:{actor.WarehouseId}").SendAsync("WorkspaceChanged", new
    {
        kind = "data-changed"
    }, ct);
    if (request.Type is "transfer-send" or "transfer-receive")
    {
        var transfer = request.Type == "transfer-receive"
            ? await db.Documents.SingleOrDefaultAsync(d => d.Id == request.Payload.Text("document") && d.Kind == "transfer", ct)
            : await db.Documents.SingleOrDefaultAsync(d => d.Source == result.Id && d.Kind == "transfer", ct);
        var other = transfer?.WarehouseId == actor.WarehouseId ? transfer?.TargetWarehouseId : transfer?.WarehouseId;
        if (other is not null && other != actor.WarehouseId)
            await hub.Clients.Group($"warehouse:{other}").SendAsync("WorkspaceChanged", new { kind = "data-changed" }, ct);
    }
    return Results.Ok(result);
}).RequireAuthorization();
app.MapGet("/api/requests/{type}/{key}", async (string type, string key, string warehouse, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) =>
{
    var actor = await access.Resolve(context.User, warehouse, ct);
    var scope = $"demo:{actor.Id}:{type}:{key}";
    var result = await db.Requests.SingleOrDefaultAsync(r => r.ScopeKey == scope && r.WarehouseId == actor.WarehouseId, ct);
    return result is null
        ? Results.NotFound(new
        {
            code = "not-found"
        })
        : Results.Ok(JsonSerializer.Deserialize<CommandResult>(result.ResultJson));
}).RequireAuthorization();
app.MapPost("/api/edit", async (EditRequest request, HttpContext context, AccessService access, EditService editor, IHubContext<WorkspaceHub> hub, CancellationToken ct) => { var actor = await access.Resolve(context.User, request.Warehouse, ct); await editor.Apply(actor, request, ct); await hub.Clients.All.SendAsync("WorkspaceChanged", new { kind = "data-changed" }, ct); return Results.NoContent(); }).RequireAuthorization();
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
var bootstrapIndex = Array.IndexOf(args, "--bootstrap");
if (args.Contains("--installation-state", StringComparer.Ordinal))
{
    Rules.Require(!demo, "installation-state-production", 400);
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
    Rules.Require(!(await db.Database.GetPendingMigrationsAsync()).Any(), "installation-migrations-required", 409);
    var settings = await db.Settings.AnyAsync();
    var warehouses = await db.Warehouses.AnyAsync();
    var principals = await db.Principals.AnyAsync();
    if (!settings && !warehouses && !principals) Console.WriteLine("empty");
    else if (settings && await db.Warehouses.AnyAsync(w => w.Id != "transit")) Console.WriteLine("initialized");
    else throw new InvalidOperationException("Installation data is incomplete; IT review is required.");
    return;
}
if (bootstrapIndex >= 0)
{
    Rules.Require(!demo && bootstrapIndex + 1 < args.Length, "bootstrap-configuration", 400);
    var input = JsonSerializer.Deserialize<BootstrapRequest>(await File.ReadAllTextAsync(args[bootstrapIndex + 1]), new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? throw new InvalidOperationException("Bootstrap configuration is required.");
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
    await db.Database.MigrateAsync();
    await ProductionBootstrap.Run(db, input);
    return;
}
var migrateOnly = args.Contains("--migrate-only", StringComparer.Ordinal);
if (migrateOnly || args.Contains("--migrate", StringComparer.Ordinal) || builder.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
    await db.Database.MigrateAsync();
    if (demo && builder.Configuration.GetValue<bool>("Development:SeedDemo"))
        await Seed.Demo(db);
}
if (migrateOnly) return;
if (builder.Configuration.GetValue<bool>("Hosting:ServeFrontend"))
{
    app.UseStaticFiles();
    app.MapFallback("{*path:nonfile}", async context =>
    {
        var reserved = new[] { "/api", "/auth", "/health", "/hubs", "/signin-oidc", "/signout-callback-oidc" };
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) ||
            reserved.Any(prefix => context.Request.Path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase)))
        {
            context.Response.StatusCode = 404;
            return;
        }
        var index = app.Environment.WebRootFileProvider.GetFileInfo("index.html");
        if (!index.Exists) { context.Response.StatusCode = 404; return; }
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.Headers.CacheControl = "no-cache";
        if (!HttpMethods.IsHead(context.Request.Method))
            await context.Response.SendFileAsync(index, context.RequestAborted);
    });
}
app.Run();
public partial class Program;
