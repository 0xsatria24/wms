extern alias WmsApi;
using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Wms.Tests;

public sealed class WindowsHostingTests
{
    private static WebApplicationFactory<WmsApi::Program> Factory(string webRoot, bool directHttps = true)
        => new WebApplicationFactory<WmsApi::Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.UseWebRoot(webRoot);
            foreach (var setting in new Dictionary<string, string?>
            {
                ["ConnectionStrings:Wms"] = "Host=127.0.0.1;Port=1;Database=unused;Username=unused;Timeout=1",
                ["Oidc:Authority"] = "https://identity.example",
                ["Oidc:ClientId"] = "wms",
                ["DataProtection:KeyPath"] = Path.Combine(webRoot, "keys"),
                ["ReverseProxy:KnownProxies"] = directHttps ? "" : "10.20.0.10",
                ["Hosting:DirectHttps"] = directHttps.ToString(),
                ["Hosting:ServeFrontend"] = "true",
                ["Kestrel:Endpoints:Https:Url"] = "https://localhost:5443",
                ["AllowedHosts"] = "localhost",
                ["Database:MigrateOnStartup"] = "false"
            }) builder.UseSetting(setting.Key, setting.Value);
            builder.ConfigureServices(services =>
            {
                var notifications = services.SingleOrDefault(s => s.ImplementationType == typeof(Wms.Modules.Access.PgNotifications));
                if (notifications is not null) services.Remove(notifications);
            });
        });

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task SpaNavigationWorksAndReservedRoutesRemain404(bool directHttps)
    {
        var root = Path.Combine(Path.GetTempPath(), "wms-web-" + Guid.NewGuid());
        Directory.CreateDirectory(root);
        await File.WriteAllTextAsync(Path.Combine(root, "index.html"), "<html>Windows frontend</html>");
        try
        {
            await using var factory = Factory(root, directHttps);
            using var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost:5443"), AllowAutoRedirect = false });
            foreach (var path in new[] { "/", "/stock", "/orders/new" })
            {
                var response = await client.GetAsync(path);
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                Assert.Contains("Windows frontend", await response.Content.ReadAsStringAsync());
            }
            foreach (var path in new[] { "/api/missing", "/API/missing", "/auth/missing", "/health/missing", "/hubs/missing", "/signin-oidc/missing", "/signout-callback-oidc/missing", "/missing.js" })
                Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/workspaces/main/snapshot")).StatusCode);
        }
        finally { Directory.Delete(root, recursive: true); }
    }

    [Fact]
    public async Task DirectHttpsRequiresHttpsEndpoint()
    {
        var root = Path.Combine(Path.GetTempPath(), "wms-web-" + Guid.NewGuid());
        Directory.CreateDirectory(root);
        try
        {
            await using var factory = Factory(root).WithWebHostBuilder(builder => builder.UseSetting("Kestrel:Endpoints:Https:Url", "http://localhost:5443"));
            Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        }
        finally { Directory.Delete(root, recursive: true); }
    }
}
