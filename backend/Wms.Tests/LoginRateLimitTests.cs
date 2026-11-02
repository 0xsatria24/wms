using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Fact]
    public async Task DemoLoginFailuresAreLimitedBeforeCredentialChecking()
    {
        await using var factory = await Factory();
        using var client = factory.CreateClient();
        await Token(client);
        for (var attempt = 0; attempt < 5; attempt++)
        {
            client.DefaultRequestHeaders.Remove("X-Forwarded-For");
            client.DefaultRequestHeaders.Add("X-Forwarded-For", $"203.0.113.{attempt + 1}");
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/dev/login", new { account = "admin", password = "wrong" })).StatusCode);
        }
        var blocked = await client.PostAsJsonAsync("/API/DEV/LOGIN/", new { account = "operator", password = "demo123" });
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.NotNull(blocked.Headers.RetryAfter);
        Assert.True(blocked.Headers.CacheControl!.NoStore);
        var problem = await blocked.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.Equal("login-rate-limit", problem.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/session")).StatusCode);
    }
}
