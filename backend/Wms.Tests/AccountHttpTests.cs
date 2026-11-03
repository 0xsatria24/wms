using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Wms.Modules.Access;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Fact]
    public async Task AccountInvitationsRequireAdminAndConfiguredProvider()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var op = await Login(factory, "operator");
        var path = $"/api/workspaces/Main%20Warehouse/invitations/{Guid.NewGuid()}";
        var body = new { name = "Invited worker", email = "invite@example.test", role = "operator", warehouses = new[] { "Main Warehouse" }, reason = "New employee" };
        Assert.Equal(HttpStatusCode.Forbidden, (await op.PostAsJsonAsync(path, body)).StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await admin.PostAsJsonAsync(path, body)).StatusCode);
    }

    [Fact]
    public async Task AccountRecoveryDoesNotPretendToSendWithoutConfiguration()
    {
        await using var factory = await Factory();
        using var client = factory.CreateClient();
        await Token(client);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync("/api/accounts/recovery", new { email = "unknown@example.test" })).StatusCode);
    }

    [Fact]
    public async Task RecoveryResponseDoesNotRevealExistingAccountsWhenEmailDeliveryFails()
    {
        await using var factory = await Factory();
        await using var configured = factory.WithWebHostBuilder(builder => builder.ConfigureServices(services => services.AddSingleton<IAccountIdentity>(new RecoveryIdentity())));
        using var client = configured.CreateClient(); await Token(client);
        var known = await client.PostAsJsonAsync("/api/accounts/recovery", new { email = "known@example.test" });
        var missing = await client.PostAsJsonAsync("/api/accounts/recovery", new { email = "missing@example.test" });
        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode);
        Assert.Equal(known.StatusCode, missing.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await missing.Content.ReadAsStringAsync());
    }

    sealed class RecoveryIdentity : IAccountIdentity
    {
        public bool Configured => true;
        public Task<ProviderAccount> EnsureUser(Guid id, string name, string email, CancellationToken ct) => throw new NotSupportedException();
        public Task SendInvitation(ProviderAccount account, CancellationToken ct) => throw new NotSupportedException();
        public Task Recover(string email, CancellationToken ct) => email == "known@example.test" ? Task.FromException(new IdentityUnavailable()) : Task.CompletedTask;
    }
}
