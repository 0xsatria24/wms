using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Access;

public sealed class AccessService(WmsDb db)
{
    public async Task<Principal?> Principal(ClaimsPrincipal claims, CancellationToken ct = default)
    {
        var subject = claims.FindFirstValue("sub") ?? claims.FindFirstValue("client_id");
        var issuer = claims.FindFirstValue("iss");
        if (subject is null || issuer is null)
            return null;
        return await db.Principals.SingleOrDefaultAsync(p => p.Subject == subject && p.Issuer == issuer, ct);
    }
    public async Task<ActingPrincipal> Resolve(ClaimsPrincipal claims, string warehouse, CancellationToken ct = default)
    {
        var principal = await Principal(claims, ct);
        Require(principal?.Status == "active", "denied", 403);
        var wh = await db.Warehouses.SingleOrDefaultAsync(w => w.CompanyId == "demo" && (w.Id == warehouse || w.Name == warehouse) && w.Id != "transit", ct);
        Require(wh is not null, "scope", 403);
        var grant = await db.AccessGrants.SingleOrDefaultAsync(g => g.PrincipalId == principal!.Id && g.WarehouseId == wh!.Id, ct);
        Require(grant is not null, "denied", 403);
        return new ActingPrincipal(principal!.Id, wh!.Id, grant!.Role);
    }
    public async Task<object> User(Principal principal, CancellationToken ct = default)
    {
        var grants = await db.AccessGrants.Where(g => g.PrincipalId == principal.Id).Join(db.Warehouses, g => g.WarehouseId, w => w.Id, (g, w) => new { g.Role, Warehouse = w.Name }).ToListAsync(ct);
        return new
        {
            id = principal.Id,
            name = principal.Name,
            email = principal.Email,
            verified = principal.Verified,
            status = principal.Status,
            role = grants.FirstOrDefault()?.Role ?? "viewer",
            warehouses = grants.Select(g => g.Warehouse).ToArray(),
            adminWarehouses = grants.Where(g => g.Role == "admin").Select(g => g.Warehouse).ToArray()
        };
    }
}
