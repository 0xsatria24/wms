using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Wms.Modules.Access;
using Xunit;

namespace Wms.Tests;

public sealed class KeycloakAccountTests
{
    static KeycloakAccounts Client(Provider provider) => new(new HttpClient(provider), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
        ["Oidc:Authority"] = "https://identity.example/realms/wms", ["Oidc:ClientId"] = "wms",
        ["IdentityProvisioning:ClientId"] = "wms-accounts", ["IdentityProvisioning:ClientSecret"] = "test-only-secret",
        ["IdentityProvisioning:ReturnUrl"] = "https://warehouse.example/"
    }).Build());

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ProvisioningNeverSuppliesPasswordsOrChangesExistingCredentials(bool existing)
    {
        var provider = new Provider { Existing = existing }; var client = Client(provider);
        var account = await client.EnsureUser(Guid.NewGuid(), "Worker", "worker@example.test", default);
        await client.SendInvitation(account, default);
        Assert.Equal(existing ? 0 : 1, provider.Creates);
        Assert.Equal(existing ? new[] { "VERIFY_EMAIL" } : new[] { "VERIFY_EMAIL", "UPDATE_PASSWORD" }, provider.Actions);
        Assert.Equal("provider-worker", account.Subject);
        Assert.Equal("https://identity.example/realms/wms", account.Issuer);
    }

    [Fact]
    public async Task RetryAfterLostCreateResponseFindsTheOriginalProviderIdentity()
    {
        var provider = new Provider { LoseCreateResponse = true }; var client = Client(provider); var id = Guid.NewGuid();
        await Assert.ThrowsAsync<HttpRequestException>(() => client.EnsureUser(id, "Worker", "worker@example.test", default));
        var retried = await client.EnsureUser(id, "Worker", "worker@example.test", default);
        Assert.Equal("provider-worker", retried.Subject); Assert.True(retried.NeedsPassword); Assert.Equal(1, provider.Creates);
    }

    [Fact]
    public async Task ResendKeepsThePasswordAfterKeycloakRequiredActionsAreComplete()
    {
        var id = Guid.NewGuid(); var provider = new Provider { Existing = true, InvitationMarker = id.ToString("N"), PasswordSet = true };
        var client = Client(provider);
        var account = await client.EnsureUser(id, "Worker", "worker@example.test", default);
        await client.SendInvitation(account, default);
        Assert.False(account.NeedsPassword);
        Assert.Equal(new[] { "VERIFY_EMAIL" }, provider.Actions);
    }

    sealed class Provider : HttpMessageHandler
    {
        public bool Existing { get; set; }
        public bool LoseCreateResponse { get; set; }
        public string? InvitationMarker { get; set; }
        public bool PasswordSet { get; set; }
        public int Creates { get; private set; }
        public string[] Actions { get; private set; } = [];
        JsonElement? attributes;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.Equal("identity.example", request.RequestUri!.Host);
            if (request.RequestUri.AbsolutePath.EndsWith("/token")) return new(HttpStatusCode.OK) { Content = JsonContent.Create(new { access_token = "test-only-token" }) };
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            if (request.Method == HttpMethod.Get) {
                if (InvitationMarker is not null) attributes = JsonSerializer.SerializeToElement(new { wmsInvitation = new[] { InvitationMarker } });
                return new(HttpStatusCode.OK) { Content = JsonContent.Create(Existing || Creates > 0 ? new[] { new { id = "provider-worker", email = "worker@example.test", enabled = true, emailVerified = Existing, attributes, requiredActions = PasswordSet ? Array.Empty<string>() : new[] { "VERIFY_EMAIL", "UPDATE_PASSWORD" } } } : []) };
            }
            if (request.Method == HttpMethod.Post) {
                var payload = await request.Content!.ReadFromJsonAsync<JsonElement>(ct);
                Assert.False(payload.TryGetProperty("credentials", out _));
                Assert.False(payload.GetProperty("emailVerified").GetBoolean());
                Assert.Equal(new[] { "VERIFY_EMAIL", "UPDATE_PASSWORD" }, payload.GetProperty("requiredActions").EnumerateArray().Select(x => x.GetString()).ToArray());
                attributes = payload.GetProperty("attributes").Clone(); Creates++;
                if (LoseCreateResponse) throw new HttpRequestException("Simulated lost response");
                return new(HttpStatusCode.Created);
            }
            Assert.Equal(HttpMethod.Put, request.Method);
            Assert.EndsWith("/provider-worker/execute-actions-email", request.RequestUri.AbsolutePath);
            Actions = (await request.Content!.ReadFromJsonAsync<string[]>(ct))!;
            return new(HttpStatusCode.NoContent);
        }
    }
}
