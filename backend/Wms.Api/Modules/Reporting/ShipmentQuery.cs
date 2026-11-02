using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Reporting;

public sealed class ShipmentQuery(WmsDb db)
{
    public async Task<object> Read(ActingPrincipal actor, string sku, CancellationToken ct, DateTimeOffset? asOf = null)
    {
        Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct) && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
        var now = asOf ?? DateTimeOffset.UtcNow;
        var local = now.ToOffset(TimeSpan.FromHours(7));
        var start = new DateTimeOffset(local.Year - 2, 1, 1, 0, 0, 0, local.Offset).ToUniversalTime();
        var priorCutoff = now.AddYears(-1);
        var hidden = actor.Role == "operator" && await db.Documents.AnyAsync(d => d.Kind == "count" && d.Status != "closed" && d.WarehouseId == actor.WarehouseId && db.Items.Any(i => i.Id == d.ItemId && i.Sku == sku), ct);
        if (hidden) return new { sku, year = local.Year, asOf = local, hidden, units = Array.Empty<object>() };
        var shipments = from entry in db.Entries join movement in db.Movements on entry.MovementId equals movement.Id
            join position in db.Positions on entry.PositionId equals position.Id join location in db.Locations on position.LocationId equals location.Id join item in db.Items on position.ItemId equals item.Id
            where item.Sku == sku && item.CompanyId == "demo" && location.WarehouseId == actor.WarehouseId && movement.WarehouseId == actor.WarehouseId && movement.Kind == "ship" && entry.QuantityDelta < 0 && movement.PostedAt >= start && movement.PostedAt <= now
            group new { entry, movement } by new { year = movement.PostedAt.AddHours(7).Year, month = movement.PostedAt.AddHours(7).Month, entry.Unit } into months
            select new { months.Key.year, months.Key.month, unit = months.Key.Unit, qty = months.Sum(x => -x.entry.QuantityDelta), priorYtd = months.Sum(x => x.movement.PostedAt <= priorCutoff && x.movement.PostedAt.AddHours(7).Year == local.Year - 1 ? -x.entry.QuantityDelta : 0m) };
        var rows = await shipments.ToListAsync(ct);
        decimal? Change(decimal value, decimal previous) => previous == 0 ? null : decimal.Round((value - previous) * 100 / previous, 1);
        var last = local.AddMonths(-1);
        var units = rows.GroupBy(row => row.unit).Select(group =>
        {
            decimal Qty(int year, int month) => group.Where(row => row.year == year && row.month == month).Sum(row => row.qty);
            var ytd = group.Where(row => row.year == local.Year).Sum(row => row.qty);
            var priorYtd = group.Sum(row => row.priorYtd);
            var lastQty = Qty(last.Year, last.Month);
            return new { unit = group.Key, ytd = Number(ytd), priorYtd = Number(priorYtd), ytdChange = Change(ytd, priorYtd), lastMonth = last.ToString("yyyy-MM"), mom = Change(lastQty, Qty(last.AddMonths(-1).Year, last.AddMonths(-1).Month)), yoy = Change(lastQty, Qty(last.Year - 1, last.Month)), months = Enumerable.Range(1, local.Month).Select(month => new { month, qty = Number(Qty(local.Year, month)) }).ToArray() };
        }).ToArray();
        return new { sku, year = local.Year, asOf = local, hidden, units };
    }
}
