using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Settings;
public sealed record OrganizationProfile(string Name = "", string WarehouseName = "");
public static class OrganizationSettings
{
    public sealed record Input(long Version, string CompanyName, string WarehouseName, string[] Locations, string Reason);
    public static void MapOrganization(this WebApplication app)
    {
        app.MapPost("/api/organization", async (Input input, HttpContext http, AccessService access, WmsDb db, CancellationToken ct) => {
            var principal = await access.Principal(http.User, ct);
            Require(principal?.Status == "active", "denied", 403);
            var name = (input.CompanyName ?? "").Trim(); var warehouseName = (input.WarehouseName ?? "").Trim();
            var addingWarehouse = warehouseName.Length > 0;
            var locations = (input.Locations ?? []).Select(x => (x ?? "").Trim()).ToArray();
            Require(name.Length is > 0 and <= 200 && warehouseName.Length <= 200 && (addingWarehouse || input.Version > 0) && !string.IsNullOrWhiteSpace(input.Reason) && input.Reason.Length <= 2000, "required", 400);
            Require((addingWarehouse ? locations.Length is > 0 and <= 1000 : locations.Length == 0) && locations.Distinct().Count() == locations.Length && locations.All(x => x.Length is > 0 and <= 100 && !x.Contains('|') && x is not "Receiving" and not "QC" and not "Staging"), "required", 400);
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await RecoveryState.RequireWritable(db, ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"settings:company:demo"},0))", ct);
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"edit:demo:users"},0))", ct);
            Require(await db.Principals.AnyAsync(p => p.Id == principal!.Id && p.Status == "active", ct)
                && !await db.Warehouses.AnyAsync(w => w.CompanyId == "demo" && w.Id != "transit" && !db.AccessGrants.Any(g => g.PrincipalId == principal!.Id && g.WarehouseId == w.Id && g.Role == "admin")), "denied", 403);
            var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == "settings:company:demo", ct);
            Require((row?.Version ?? 0) == input.Version, "conflict");
            string id;
            if (addingWarehouse)
            {
                Require(!await db.Warehouses.AnyAsync(w => w.CompanyId == "demo" && (w.Name == warehouseName || w.Id == warehouseName)), "duplicate", 409);
                do { id = ReferenceId.New(); } while (id == warehouseName || await db.Warehouses.AnyAsync(w => w.Id == id || w.Name == id, ct));
                db.Warehouses.Add(new Warehouse { Id = id, Name = warehouseName });
                db.AccessGrants.Add(new AccessGrant { PrincipalId = principal!.Id, WarehouseId = id, Role = "admin" });
                foreach (var code in locations.Concat(["Receiving", "QC", "Staging"])) db.Locations.Add(new Location { Id = id + "|" + code, WarehouseId = id, Code = code, Pickable = locations.Contains(code) });
            }
            else
            {
                warehouseName = JsonSerializer.Deserialize<OrganizationProfile>(row!.PayloadJson, OperationalSettings.Json)!.WarehouseName;
                id = await db.Warehouses.Where(w => w.CompanyId == "demo" && w.Id != "transit").OrderBy(w => w.Id).Select(w => w.Id).FirstAsync(ct);
            }
            if (row is null) { row = new SupportingRecord { Id = "settings:company:demo", Kind = "settings-company" }; db.SupportingRecords.Add(row); }
            row.PayloadJson = JsonSerializer.Serialize(new OrganizationProfile(name, warehouseName), OperationalSettings.Json); row.Version++;
            db.Audit.Add(new AuditRecord { TransactionId = ReferenceId.New(), WarehouseId = id, PrincipalId = principal!.Id, Action = addingWarehouse ? "organization-setup" : "company-settings", DetailJson = JsonSerializer.Serialize(new { companyName = name, warehouseName, locations, reason = input.Reason }), PostedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            return Results.Ok(new { warehouseName, version = row.Version });
        }).RequireAuthorization();
    }
}
