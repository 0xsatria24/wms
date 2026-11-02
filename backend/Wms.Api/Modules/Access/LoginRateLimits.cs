using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

namespace Wms.Modules.Access;

internal static class LoginRateLimits
{
    public const string Policy = "login";

    public static bool IsLogin(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName == Policy;

    public static void Configure(RateLimiterOptions options)
    {
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context => IsLogin(context)
            ? RateLimitPartition.GetFixedWindowLimiter("login-total", _ => Window(100))
            : RateLimitPartition.GetNoLimiter("other"));
        options.AddPolicy(Policy, context => RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.MapToIPv6().ToString() ?? "unknown", _ => Window(5)));
    }

    private static FixedWindowRateLimiterOptions Window(int limit) => new()
    {
        PermitLimit = limit,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0,
        AutoReplenishment = true
    };
}
