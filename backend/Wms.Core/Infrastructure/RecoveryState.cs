using Microsoft.EntityFrameworkCore;
using Wms.Shared;

namespace Wms.Infrastructure;

public static class RecoveryState
{
    public static async Task RequireWritable(WmsDb db, CancellationToken ct)
    {
        Rules.Require(!await db.SupportingRecords.AnyAsync(record => record.Id == "outbox-recovery-hold" && record.Kind == "outbox-pause", ct), "recovery-hold", 503);
    }
}
