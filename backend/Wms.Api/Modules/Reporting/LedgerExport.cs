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
        if (actor.Role == "operator")
            Rules.Require(!await db.Documents.Join(db.Items, d => d.ItemId, i => i.Id, (d, i) => new { d, i }).Join(db.Locations, x => x.d.LocationId, l => l.Id, (x, l) => new { x.d, x.i, l }).AnyAsync(x => x.d.Kind == "count" && x.d.Status != "closed" && x.d.WarehouseId == actor.WarehouseId && x.i.Sku == sku && (string.IsNullOrEmpty(location) || x.l.Code == location), ct), "blind-count", 403);
        var rowsQuery = (from entry in db.Entries join movement in db.Movements on entry.MovementId equals movement.Id join position in db.Positions on entry.PositionId equals position.Id join loc in db.Locations on position.LocationId equals loc.Id join item in db.Items on position.ItemId equals item.Id where position.CompanyId == "demo" && loc.WarehouseId == actor.WarehouseId && item.Sku == sku && (string.IsNullOrEmpty(location) || loc.Code == location) select new { entry, movement, loc, item });
        if (!string.IsNullOrEmpty(query))
            rowsQuery = rowsQuery.Where(x => EF.Functions.ILike(x.movement.Id, $"%{query}%") || EF.Functions.ILike(x.movement.Source, $"%{query}%") || EF.Functions.ILike(x.movement.Kind, $"%{query}%"));
        var zone = (await OperationalSettings.Read(db, "warehouse", actor.WarehouseId, new WarehouseDetails(), ct)).Value.TimeZone;
        var generatedAt = DateTimeOffset.UtcNow.ToString("O");
        WarehouseDates.Date(fromDate);
        WarehouseDates.Date(toDate);
        Rules.Require(string.IsNullOrEmpty(fromDate) || string.IsNullOrEmpty(toDate) || WarehouseDates.Date(fromDate) <= WarehouseDates.Date(toDate), "required", 400);
        if (!string.IsNullOrEmpty(fromDate))
        {
            Rules.Require(DateOnly.TryParseExact(fromDate, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var from), "required", 400);
            var start = WarehouseDates.Start(from, zone);
            rowsQuery = rowsQuery.Where(x => x.movement.PostedAt >= start);
        }
        if (!string.IsNullOrEmpty(toDate))
        {
            Rules.Require(DateOnly.TryParseExact(toDate, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var to), "required", 400);
            var end = WarehouseDates.Start(to.AddDays(1), zone);
            rowsQuery = rowsQuery.Where(x => x.movement.PostedAt < end);
        }
        var rows = await rowsQuery.OrderBy(x => x.movement.PostedAt).ThenBy(x => x.entry.Id).ToListAsync(ct);
        var content = new StringBuilder("Warehouse,SKU,Source,Type,Location,Quantity,Unit,OccurredAt,PostedAt,Actor,PeriodFrom,PeriodTo,WarehouseTimeZone,GeneratedAtUTC\r\n");
        foreach (var row in rows)
            content.AppendLine(string.Join(',', new[] { Cell(actor.WarehouseId), Cell(row.item.Sku), Cell(row.movement.Source), Cell(row.movement.Kind), Cell(row.loc.Code), Rules.Number(row.entry.QuantityDelta), Cell(row.entry.Unit), Cell(row.movement.OccurredAt.ToString("O")), Cell(row.movement.PostedAt.ToString("O")), Cell(row.movement.Actor), Cell(fromDate ?? ""), Cell(toDate ?? ""), Cell(zone), Cell(generatedAt) }));
        return [0xEF, 0xBB, 0xBF, .. Encoding.UTF8.GetBytes(content.ToString())];
        static string Cell(string value)
        {
            if (value.Length > 0 && "=+-@".Contains(value[0]))
                value = "'" + value;
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
    }
}
