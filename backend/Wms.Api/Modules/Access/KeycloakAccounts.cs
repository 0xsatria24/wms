using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Wms.Modules.Access;

public sealed record ProviderAccount(string Subject, bool NeedsPassword, string Issuer);
public interface IAccountIdentity
{
    bool Configured { get; }
    Task<ProviderAccount> EnsureUser(Guid invitation, string name, string email, CancellationToken ct);
    Task SendInvitation(ProviderAccount account, CancellationToken ct);
    Task Recover(string email, CancellationToken ct);
}

public sealed class IdentityUnavailable(bool uncertain = false) : Exception("identity-unavailable")
{
    public bool Uncertain { get; } = uncertain;
}

public sealed class KeycloakAccounts(HttpClient http, IConfiguration config) : IAccountIdentity
{
    string? token;
    string Authority => (config["Oidc:Authority"] ?? "").TrimEnd('/');
    string Client => config["IdentityProvisioning:ClientId"] ?? "";
    string Secret => config["IdentityProvisioning:ClientSecret"] ?? "";
    string ReturnUrl => config["IdentityProvisioning:ReturnUrl"] ?? "";
    public bool Configured => Uri.TryCreate(Authority, UriKind.Absolute, out var authority) && authority.Scheme == "https"
        && authority.AbsolutePath.LastIndexOf("/realms/", StringComparison.Ordinal) >= 0
        && !authority.Query.Any() && !authority.Fragment.Any() && !authority.UserInfo.Any()
        && !string.IsNullOrWhiteSpace(config["Oidc:ClientId"]) && !string.IsNullOrWhiteSpace(Client) && !string.IsNullOrWhiteSpace(Secret)
        && Uri.TryCreate(ReturnUrl, UriKind.Absolute, out var redirect) && redirect.Scheme == "https" && redirect.UserInfo.Length == 0 && redirect.Fragment.Length == 0;
    string AdminUrl {
        get {
            var index = Authority.LastIndexOf("/realms/", StringComparison.Ordinal);
            if (!Configured || index < 0 || Authority[(index + 8)..].Contains('/')) throw new IdentityUnavailable();
            return Authority[..index] + "/admin/realms/" + Uri.EscapeDataString(Uri.UnescapeDataString(Authority[(index + 8)..]));
        }
    }

    async Task<HttpResponseMessage> Send(HttpMethod method, string url, object? body, CancellationToken ct)
    {
        if (!Configured) throw new IdentityUnavailable();
        if (token is null)
        {
            using var response = await http.PostAsync(Authority + "/protocol/openid-connect/token", new FormUrlEncodedContent(new Dictionary<string, string> {
                ["grant_type"] = "client_credentials", ["client_id"] = Client, ["client_secret"] = Secret
            }), ct);
            if (!response.IsSuccessStatusCode) throw new IdentityUnavailable();
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (!json.RootElement.TryGetProperty("access_token", out var value) || value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetString())) throw new IdentityUnavailable();
            token = value.GetString();
        }
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await http.SendAsync(request, ct);
    }

    async Task<JsonElement?> Find(string email, CancellationToken ct)
    {
        using var response = await Send(HttpMethod.Get, AdminUrl + "/users?email=" + Uri.EscapeDataString(email) + "&exact=true&max=2", null, ct);
        if (!response.IsSuccessStatusCode) throw new IdentityUnavailable();
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var users = document.RootElement.EnumerateArray().Where(u => u.TryGetProperty("email", out var e) && string.Equals(e.GetString(), email, StringComparison.OrdinalIgnoreCase)).ToArray();
        if (users.Length > 1) throw new IdentityUnavailable();
        return users.Length == 0 ? null : users[0].Clone();
    }

    ProviderAccount Account(JsonElement user, Guid invitation)
    {
        var id = user.GetProperty("id").GetString();
        if (string.IsNullOrWhiteSpace(id) || user.TryGetProperty("enabled", out var enabled) && enabled.ValueKind == JsonValueKind.False) throw new IdentityUnavailable();
        var ours = user.TryGetProperty("attributes", out var attributes) && attributes.ValueKind == JsonValueKind.Object && attributes.TryGetProperty("wmsInvitation", out var marker)
            && marker.ValueKind == JsonValueKind.Array && marker.EnumerateArray().Any(x => x.GetString() == invitation.ToString("N"));
        var needsPassword = ours && user.TryGetProperty("requiredActions", out var actions) && actions.ValueKind == JsonValueKind.Array
            && actions.EnumerateArray().Any(action => action.ValueKind == JsonValueKind.String && action.GetString() == "UPDATE_PASSWORD");
        return new(id, needsPassword, Authority);
    }

    public async Task<ProviderAccount> EnsureUser(Guid invitation, string name, string email, CancellationToken ct)
    {
        var existing = await Find(email, ct);
        if (existing.HasValue) return Account(existing.Value, invitation);
        using var response = await Send(HttpMethod.Post, AdminUrl + "/users", new {
            username = email, email, firstName = name, enabled = true, emailVerified = false,
            requiredActions = new[] { "VERIFY_EMAIL", "UPDATE_PASSWORD" },
            attributes = new Dictionary<string, string[]> { ["wmsInvitation"] = [invitation.ToString("N")] }
        }, ct);
        if (response.StatusCode != HttpStatusCode.Created && response.StatusCode != HttpStatusCode.Conflict) throw new IdentityUnavailable();
        // Reconcile by email after a conflict or lost earlier create response; never issue a second identity blindly.
        var created = await Find(email, ct);
        return created.HasValue ? Account(created.Value, invitation) : throw new IdentityUnavailable(true);
    }

    public async Task SendInvitation(ProviderAccount account, CancellationToken ct)
    {
        var actions = account.NeedsPassword ? new[] { "VERIFY_EMAIL", "UPDATE_PASSWORD" } : new[] { "VERIFY_EMAIL" };
        using var response = await Send(HttpMethod.Put, ActionUrl(account.Subject), actions, ct);
        if (!response.IsSuccessStatusCode) throw new IdentityUnavailable(response.StatusCode >= HttpStatusCode.InternalServerError);
    }

    string ActionUrl(string subject) => AdminUrl + "/users/" + Uri.EscapeDataString(subject)
        + "/execute-actions-email?client_id=" + Uri.EscapeDataString(config["Oidc:ClientId"]!) + "&redirect_uri=" + Uri.EscapeDataString(ReturnUrl) + "&lifespan=86400";

    public async Task Recover(string email, CancellationToken ct)
    {
        var user = await Find(email, ct);
        if (!user.HasValue) return;
        using var response = await Send(HttpMethod.Put, ActionUrl(user.Value.GetProperty("id").GetString()!), new[] { "UPDATE_PASSWORD" }, ct);
        if (!response.IsSuccessStatusCode) throw new IdentityUnavailable();
    }
}
