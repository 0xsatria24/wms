using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Xunit;

namespace Wms.Tests;

public sealed partial class HttpApiTests
{
    [Theory]
    [InlineData(null)]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RememberMeControlsCookieLifetimeAndRestoredSessionCanLogOut(bool? rememberMe)
    {
        await using var factory = await Factory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://127.0.0.1"), AllowAutoRedirect = false });
        await Token(client);
        var payload = new Dictionary<string, object> { ["account"] = "operator", ["password"] = "demo123" };
        if (rememberMe.HasValue) payload["rememberMe"] = rememberMe.Value;
        using var response = await client.PostAsJsonAsync("/api/dev/login", payload);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var cookie = Assert.Single(SetCookieHeaderValue.ParseList(response.Headers.GetValues("Set-Cookie").ToList()), c => c.Name == "Wms.Session");
        Assert.True(cookie.HttpOnly);
        Assert.Equal(SameSiteMode.Lax, cookie.SameSite);
        Assert.Equal(rememberMe == true, cookie.Expires.HasValue);

        var options = factory.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(CookieAuthenticationDefaults.AuthenticationScheme);
        var ticket = options.TicketDataFormat.Unprotect(cookie.Value.ToString());
        Assert.NotNull(ticket);
        Assert.Equal(rememberMe == true, ticket.Properties.IsPersistent);
        var lifetime = ticket.Properties.ExpiresUtc!.Value - ticket.Properties.IssuedUtc!.Value;
        Assert.Equal(rememberMe == true ? TimeSpan.FromDays(14) : TimeSpan.FromHours(8), lifetime);
        if (rememberMe == true) Assert.False(ticket.Properties.AllowRefresh);

        using var restored = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://127.0.0.1") });
        restored.DefaultRequestHeaders.Add("Cookie", $"Wms.Session={cookie.Value}");
        var session = await Read(await restored.GetAsync("/api/session"));
        Assert.Equal("operator", session.GetProperty("user").GetProperty("id").GetString());
        await Token(restored);
        using var logout = await restored.PostAsJsonAsync("/api/logout", new { });
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        var cleared = Assert.Single(SetCookieHeaderValue.ParseList(logout.Headers.GetValues("Set-Cookie").ToList()), c => c.Name == "Wms.Session");
        Assert.True(cleared.Expires < DateTimeOffset.UtcNow);
        Assert.True(string.IsNullOrEmpty(cleared.Value.ToString()));
    }

    [Fact]
    public async Task SigningInWithoutRememberMeReplacesPersistentCookieWithSessionCookie()
    {
        await using var factory = await Factory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://127.0.0.1") });
        await Token(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/dev/login", new { account = "operator", password = "demo123", rememberMe = true })).StatusCode);
        await Token(client);
        using var response = await client.PostAsJsonAsync("/api/dev/login", new { account = "operator", password = "demo123", rememberMe = false });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var cookie = Assert.Single(SetCookieHeaderValue.ParseList(response.Headers.GetValues("Set-Cookie").ToList()), c => c.Name == "Wms.Session");
        Assert.Null(cookie.Expires);
    }
}
