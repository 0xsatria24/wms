extern alias WmsApi;
using System.Net;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Xunit;

namespace Wms.Tests;

public sealed class DeploymentTests
{
    private static WebApplicationFactory<WmsApi::Program> Factory()
    {
        return new WebApplicationFactory<WmsApi::Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseSetting("DataProtection:KeyPath", Path.Combine(Path.GetTempPath(), "wms-test-keys"));
            builder.UseSetting("ReverseProxy:KnownProxies", "10.20.0.10");
            foreach (var setting in new Dictionary<string, string?>
            {
                ["ConnectionStrings:Wms"] = "Host=127.0.0.1;Port=1;Database=unused;Username=unused;Timeout=1",
                ["Oidc:Authority"] = "https://identity.example",
                ["Oidc:ClientId"] = "wms",
                ["Database:MigrateOnStartup"] = "false",
                ["AllowedHosts"] = "warehouse.example",
                ["ReverseProxy:KnownProxies"] = "10.20.0.10",
                ["DataProtection:KeyPath"] = Path.Combine(Path.GetTempPath(), "wms-test-keys")
            }) builder.UseSetting(setting.Key, setting.Value);
            builder.ConfigureServices(services =>
            {
                services.AddTransient<IStartupFilter, ProxyAddress>();
                var notifications = services.SingleOrDefault(s => s.ImplementationType == typeof(Wms.Modules.Access.PgNotifications));
                if (notifications is not null) services.Remove(notifications);
                services.PostConfigure<OpenIdConnectOptions>(OpenIdConnectDefaults.AuthenticationScheme, options => options.ConfigurationManager = new Microsoft.IdentityModel.Protocols.StaticConfigurationManager<OpenIdConnectConfiguration>(new OpenIdConnectConfiguration { Issuer = "https://identity.example", AuthorizationEndpoint = "https://identity.example/authorize", TokenEndpoint = "https://identity.example/token" }));
            });
        });
    }

    [Fact]
    public async Task UserInfoVerifiedEmailIsMappedByOidcClaimActions()
    {
        await using var factory = Factory();
        var options = factory.Services.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<OpenIdConnectOptions>>().Get(OpenIdConnectDefaults.AuthenticationScheme);
        var identity = new System.Security.Claims.ClaimsIdentity("oidc");
        using var userInfo = System.Text.Json.JsonDocument.Parse("{\"email\":\"verified@example.com\",\"email_verified\":true}");
        foreach (var action in options.ClaimActions) action.Run(userInfo.RootElement, identity, "https://identity.example");
        Assert.True(bool.TryParse(identity.FindFirst("email_verified")?.Value, out var verified) && verified);
    }

    [Fact]
    public async Task AnonymousProductionApiReturns401WithoutRedirectingToTheIdentityProvider()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://warehouse.example"), AllowAutoRedirect = false });
        using var response = await client.GetAsync("/api/workspaces/main/snapshot");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TrustedTlsProxyProducesHttpsOidcCallback()
    {
        await using var factory = Factory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://warehouse.example"), AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("X-Forwarded-Proto", "https");
        using var response = await client.GetAsync("/auth/login");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Contains("redirect_uri=https%3A%2F%2Fwarehouse.example%2Fsignin-oidc", response.Headers.Location!.OriginalString);
    }

    private sealed class ProxyAddress : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, following) => { context.Connection.RemoteIpAddress = IPAddress.Parse("10.20.0.10"); return following(context); });
            next(app);
        };
    }
}
