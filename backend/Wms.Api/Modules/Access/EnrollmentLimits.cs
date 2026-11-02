using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;

namespace Wms.Modules.Access;

internal static class EnrollmentLimits
{
    // Hold edit:demo:users so API instances share an atomic quota.
    public static async Task RequireCapacity(WmsDb db, CancellationToken ct)
    {
        Rules.Require(await db.Principals.CountAsync(p => p.Status == "pending", ct) < 100
            && await db.Principals.CountAsync(ct) < 10000, "enrollment-capacity", 429);
    }
}
