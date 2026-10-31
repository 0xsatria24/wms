using System.Text;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;

namespace Wms.Modules.Reporting;

public sealed class LedgerExport(WmsDb db)
{
    public async Task<byte[]> Csv(ActingPrincipal actor, string sku, string? location, string? query, CancellationToken ct, string? fromDate = null, string? toDate = null)
    {
        Rules.Require(await db.Principals.AnyAsync(p => p.Id == actor.Id && p.Status == "active", ct) && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
        var rows = await (from entry in db.Entries join movement in db.Movements on entry.MovementId equals movement.Id join position in db.Positions on entry.PositionId equals position.Id join loc in db.Locations on position.LocationId equals loc.Id join item in db.Items on position.ItemId equals item.Id where position.CompanyId == "demo" && loc.WarehouseId == actor.WarehouseId && item.Sku == sku && (string.IsNullOrEmpty(location) || loc.Code == location) select new { entry, movement, loc, item }).OrderBy(x => x.movement.PostedAt).ThenBy(x => x.entry.Id).ToListAsync(ct);
        if (!string.IsNullOrEmpty(query))
            rows = rows.Where(x => $"{x.movement.Id} {x.movement.Source} {x.movement.Kind}".Contains(query, StringComparison.OrdinalIgnoreCase)).ToList();
        if (!string.IsNullOrEmpty(fromDate))
        {
            Rules.Require(DateOnly.TryParseExact(fromDate, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var from), "required", 400);
            rows = rows.Where(x => DateOnly.FromDateTime(x.movement.PostedAt.ToOffset(TimeSpan.FromHours(7)).Date) >= from).ToList();
        }
        if (!string.IsNullOrEmpty(toDate))
        {
            Rules.Require(DateOnly.TryParseExact(toDate, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var to), "required", 400);
            rows = rows.Where(x => DateOnly.FromDateTime(x.movement.PostedAt.ToOffset(TimeSpan.FromHours(7)).Date) <= to).ToList();
        }
        var content = new StringBuilder("Warehouse,SKU,Source,Type,Location,Quantity,Unit,OccurredAt,PostedAt\r\n");
        foreach (var row in rows)
            content.AppendLine(string.Join(',', new[] { Cell(actor.WarehouseId), Cell(row.item.Sku), Cell(row.movement.Source), Cell(row.movement.Kind), Cell(row.loc.Code), Rules.Number(row.entry.QuantityDelta), Cell(row.entry.Unit), Cell(row.movement.OccurredAt.ToString("O")), Cell(row.movement.PostedAt.ToString("O")) }));
        return [0xEF, 0xBB, 0xBF, .. Encoding.UTF8.GetBytes(content.ToString())];
        static string Cell(string value)
        {
            if (value.Length > 0 && "=+-@".Contains(value[0]))
                value = "'" + value;
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
    }
}
