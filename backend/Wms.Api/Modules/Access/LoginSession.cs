using Microsoft.AspNetCore.Authentication;

namespace Wms.Modules.Access;

internal static class LoginSession
{
    public static AuthenticationProperties Properties(bool rememberMe) => new()
    {
        IsPersistent = rememberMe,
        ExpiresUtc = rememberMe ? DateTimeOffset.UtcNow.AddDays(14) : null,
        AllowRefresh = rememberMe ? false : null
    };
}
