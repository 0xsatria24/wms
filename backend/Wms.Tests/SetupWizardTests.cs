extern alias WmsApi;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Shared;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public class SetupWizardTests(PostgresFixture postgres)
{
    static IConfiguration Config(string code, DateTimeOffset expiry) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
        ["Setup:Enabled"] = "true", ["Setup:CodeHash"] = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(code))),
        ["Setup:ExpiresAt"] = expiry.ToString("O"), ["Setup:Warehouse:Id"] = "main", ["Setup:Warehouse:Name"] = "Configured warehouse", ["Setup:Warehouse:StorageLocations:0"] = "Configured-A" }).Build();

    [Fact]
    public async Task ActivationRejectsWrongExpiredAndRotatedCodes()
    {
        await using var db = new WmsDb(await postgres.Database(false));
        var protection = new EphemeralDataProtectionProvider();
        var service = new SetupService(db, Config("secret", DateTimeOffset.UtcNow.AddHours(1)), protection);
        Assert.Equal("required", await service.State(default));
        Assert.Throws<BusinessException>(() => service.Activate(new DefaultHttpContext(), "wrong"));
        var http = new DefaultHttpContext();
        service.Activate(http, "secret");
        Assert.Contains("samesite=none", http.Response.Headers.SetCookie.ToString().ToLowerInvariant());
        Assert.Contains("secure", http.Response.Headers.SetCookie.ToString().ToLowerInvariant());
        var cookie = http.Response.Headers.SetCookie.ToString().Split(';')[0];
        var next = new DefaultHttpContext(); next.Request.Headers.Cookie = cookie;
        Assert.NotNull(service.Read(next));
        Assert.Null(new SetupService(db, Config("rotated", DateTimeOffset.UtcNow.AddHours(1)), protection).Read(next));
        Assert.Throws<BusinessException>(() => new SetupService(db, Config("secret", DateTimeOffset.UtcNow.AddHours(-1)), protection).Activate(new DefaultHttpContext(), "secret"));
    }

    [Fact]
    public async Task ConcurrentBootstrapCreatesOneAdminAndLocksSetup()
    {
        var options = await postgres.Database(false);
        var input = new BootstrapRequest("https://identity.example", "first", "admin@example.com", "Admin", [new("main", "Main", ["A-01"])]);
        async Task<bool> Run() { await using var db = new WmsDb(options); try { await ProductionBootstrap.Run(db, input); return true; } catch (BusinessException) { return false; } }
        Assert.Single(await Task.WhenAll(Run(), Run()), x => x);
        await using var check = new WmsDb(options);
        Assert.Equal(1, await check.Principals.CountAsync());
        Assert.Equal(1, await check.AccessGrants.CountAsync());
        Assert.Equal(4, await check.Locations.CountAsync());
        Assert.Empty(await check.Positions.ToListAsync());
        Assert.Equal("completed", await new SetupService(check, Config("secret", DateTimeOffset.UtcNow.AddHours(1)), new EphemeralDataProtectionProvider()).State(default));
    }

    [Fact]
    public async Task PartialDatabaseAndTrimmedDuplicateLocationsAreRejected()
    {
        await using var db = new WmsDb(await postgres.Database(false));
        await Assert.ThrowsAsync<BusinessException>(() => ProductionBootstrap.Run(db, new("https://identity.example", "first", "admin@example.com", "Admin", [new("main", "Main", ["A", " A "])])));
        Assert.Empty(await db.Principals.ToListAsync());
        db.Warehouses.Add(new Warehouse { Id = "main", Name = "Main" }); await db.SaveChangesAsync();
        Assert.Equal("blocked", await new SetupService(db, Config("secret", DateTimeOffset.UtcNow.AddHours(1)), new EphemeralDataProtectionProvider()).State(default));
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task SetupSsoRequiresBoundActivationAndVerifiedEmail(bool activated, bool verified)
    {
        await using var db = new WmsDb(await postgres.Database(false));
        var service = new SetupService(db, Config("secret", DateTimeOffset.UtcNow.AddHours(1)), new EphemeralDataProtectionProvider());
        var activation = new DefaultHttpContext(); service.Activate(activation, "secret");
        var http = new DefaultHttpContext { RequestServices = new ServiceCollection().AddSingleton(db).AddSingleton(service).BuildServiceProvider() };
        if (activated) http.Request.Headers.Cookie = activation.Response.Headers.SetCookie.ToString().Split(';')[0];
        var props = new AuthenticationProperties(); props.Items[SetupService.Flow] = service.Read(http)?.Nonce ?? "missing";
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "first"), new Claim("iss", "https://identity.example"), new Claim("email", "admin@example.com"), new Claim("email_verified", verified.ToString())], "oidc"));
        var context = new TicketReceivedContext(http, new AuthenticationScheme("oidc", null, typeof(OpenIdConnectHandler)), new OpenIdConnectOptions(), new AuthenticationTicket(principal, props, "oidc"));
        await SsoEnrollment.Ticket(context);
        Assert.True(context.Result?.Handled);
        Assert.Empty(await db.Principals.ToListAsync());
        Assert.Equal(activated && verified ? "/" : "/#setup-expired", http.Response.Headers.Location.ToString());
        if (activated && verified) {
            var next = new DefaultHttpContext(); next.Request.Headers.Cookie = http.Response.Headers.SetCookie.ToString().Split(';')[0];
            Assert.Equal("admin@example.com", service.Read(next)?.Identity?.Email);
        }
    }

    [Fact]
    public async Task HttpSetupEnforcesCsrfNoOperationalGrantAndCompletionReplayProtection()
    {
        var options = await postgres.Database(false);
        await using var db = new WmsDb(options);
        var connection = db.Database.GetConnectionString()!;
        await using var factory = new WebApplicationFactory<WmsApi::Program>().WithWebHostBuilder(builder => {
            builder.UseEnvironment("Production");
            foreach (var setting in new Dictionary<string,string?> {
                ["ConnectionStrings:Wms"] = connection, ["Setup:Enabled"] = "true",
                ["Setup:Warehouse:Id"] = "main", ["Setup:Warehouse:Name"] = "Configured warehouse", ["Setup:Warehouse:StorageLocations:0"] = "Configured-A",
                ["Setup:CodeHash"] = Config("secret", DateTimeOffset.UtcNow.AddHours(1))["Setup:CodeHash"], ["Setup:ExpiresAt"] = DateTimeOffset.UtcNow.AddHours(1).ToString("O"),
                ["Oidc:Authority"] = "https://identity.example", ["Oidc:ClientId"] = "wms", ["AllowedHosts"] = "localhost",
                ["DataProtection:KeyPath"] = Path.Combine(Path.GetTempPath(), "wms-setup-test-keys"), ["ReverseProxy:KnownProxies"] = "127.0.0.1", ["Database:MigrateOnStartup"] = "false"
            }) builder.UseSetting(setting.Key, setting.Value);
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/setup-ready")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/setup/activate", new { code = "secret" })).StatusCode);
        var session = await client.GetFromJsonAsync<JsonElement>("/api/setup/session");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", session.GetProperty("csrfToken").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/setup/activate", new { code = "secret" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/workspaces/main/snapshot")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/setup/complete", new { warehouseId = "main", warehouseName = "Main", storageLocations = new[]{"A"} })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/access/request", new { email = "worker@example.com", name = "Worker" })).StatusCode);
        Assert.Empty(await db.Principals.ToListAsync());
        using var signed = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false, HandleCookies = false });
        using var tokenResponse = await signed.GetAsync("/api/setup/session");
        var token = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
        using var scope = factory.Services.CreateScope();
        var setup = scope.ServiceProvider.GetRequiredService<SetupService>();
        var activated = new DefaultHttpContext(); setup.Activate(activated, "secret");
        var incoming = new DefaultHttpContext(); incoming.Request.Headers.Cookie = activated.Response.Headers.SetCookie.ToString().Split(';')[0];
        setup.Write(incoming, setup.Read(incoming)! with { Identity = new("https://identity.example", "first", "admin@example.com", "Admin") });
        signed.DefaultRequestHeaders.Add("Cookie", tokenResponse.Headers.GetValues("Set-Cookie").First().Split(';')[0] + "; " + incoming.Response.Headers.SetCookie.ToString().Split(';')[0]);
        signed.DefaultRequestHeaders.Add("X-XSRF-TOKEN", token.GetProperty("csrfToken").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await signed.PostAsJsonAsync("/api/setup/complete", new { warehouseId = "main", warehouseName = "Main", storageLocations = new[]{"A"} })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await signed.PostAsJsonAsync("/api/setup/complete", new { warehouseId = "other", warehouseName = "Other", storageLocations = new[]{"B"} })).StatusCode);
        Assert.Equal(1, await db.Principals.CountAsync());
        Assert.Equal("Configured warehouse", (await db.Warehouses.SingleAsync(w => w.Id == "main")).Name);
        Assert.True(await db.Locations.AnyAsync(l => l.Code == "Configured-A"));
        Assert.False(await db.Locations.AnyAsync(l => l.Code == "A"));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/setup/activate", new { code = "secret" })).StatusCode);
        Assert.Equal("activation", (await client.GetFromJsonAsync<JsonElement>("/api/setup/session")).GetProperty("stage").GetString());
        var limited = false;
        for (var i = 0; i < 12; i++) {
            using var response = await client.PostAsJsonAsync("/api/setup/activate", new { code = "secret" });
            limited |= response.StatusCode == HttpStatusCode.TooManyRequests;
        }
        Assert.True(limited);
    }

    [Fact]
    public async Task MissingWarehouseProvisioningDoesNotOfferSetup()
    {
        await using var db = new WmsDb(await postgres.Database(false));
        var config = Config("secret", DateTimeOffset.UtcNow.AddHours(1));
        config["Setup:Warehouse:Id"] = "";
        Assert.Equal("unavailable", await new SetupService(db, config, new EphemeralDataProtectionProvider()).State(default));
        Assert.Empty(await db.Principals.ToListAsync());
    }

    [Fact]
    public async Task InstallerProbeReportsEmptyAndInitializedWithoutBootstrapping()
    {
        await using var db = new WmsDb(await postgres.Database(false));
        async Task<string> Probe() {
            var start = new System.Diagnostics.ProcessStartInfo(Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") ?? "dotnet") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
            start.ArgumentList.Add(typeof(SetupService).Assembly.Location);
            start.ArgumentList.Add("--installation-state");
            start.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
            start.Environment["DOTNET_ENVIRONMENT"] = "Production";
            start.Environment["ConnectionStrings__Wms"] = db.Database.GetConnectionString();
            start.Environment["Oidc__Authority"] = "https://identity.example";
            start.Environment["Oidc__ClientId"] = "probe-test";
            start.Environment["Development__EnableDemoAuth"] = "false";
            start.Environment["Database__MigrateOnStartup"] = "false";
            using var process = System.Diagnostics.Process.Start(start)!;
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            try { await process.WaitForExitAsync(deadline.Token); } catch { process.Kill(true); throw; }
            Assert.Equal(0, process.ExitCode);
            await stderr;
            return (await stdout).Trim().Split('\n').Last().Trim();
        }
        Assert.Equal("empty", await Probe());
        Assert.Empty(await db.Principals.ToListAsync());
        await ProductionBootstrap.Run(db, new("https://identity.example", "first", "admin@example.com", "Admin", [new("main", "Main", ["A"])]));
        Assert.Equal("initialized", await Probe());
        Assert.Equal(1, await db.Principals.CountAsync());
    }
}
