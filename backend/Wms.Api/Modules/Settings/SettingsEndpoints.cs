using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Modules.Access;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Settings;

public static class SettingsEndpoints
{
    public static void MapSettings(this WebApplication app)
    {
        app.MapGet("/api/preferences", async (HttpContext context, AccessService access, WmsDb db, CancellationToken ct) =>
        {
            var principal = await access.Principal(context.User, ct);
            Require(principal?.Status == "active", "denied", 403);
            var (value, version) = await OperationalSettings.Read(db, "preferences", principal!.Id, new UserPreferences(), ct);
            if (value.DefaultWarehouse != "" && !await Granted(db, principal.Id, value.DefaultWarehouse, ct)) value = value with { DefaultWarehouse = "" };
            return Results.Ok(Preferences(value, version));
        }).RequireAuthorization();

        app.MapPost("/api/preferences", async (PreferencesInput input, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) =>
        {
            var principal = await access.Principal(context.User, ct);
            Require(principal?.Status == "active", "denied", 403);
            Require(input.Language is "en" or "id" && input.Theme is "light" or "dark" && input.PageSize is 10 or 25 or 50
                && input.StartPage is "workspace" or "stock" or "receiving" or "orders" or "picking" or "pending", "required", 400);
            Require(input.DefaultWarehouse is not null && input.DefaultWarehouse.Length <= 200, "required", 400);
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await RecoveryState.RequireWritable(db, ct);
            Require(input.DefaultWarehouse == "" || await Granted(db, principal!.Id, input.DefaultWarehouse, ct), "scope", 403);
            var value = new UserPreferences(input.Language, input.Theme, input.DefaultWarehouse!, input.StartPage, input.PageSize);
            var version = await Save(db, "preferences", principal!.Id, "", principal.Id, input.Version, value, "", ct);
            await tx.CommitAsync(ct);
            return Results.Ok(Preferences(value, version));
        }).RequireAuthorization();

        app.MapGet("/api/workspaces/{warehouse}/settings", async (string warehouse, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) =>
        {
            var actor = await access.Resolve(context.User, warehouse, ct);
            return Results.Ok(await ReadWarehouse(db, actor, ct));
        }).RequireAuthorization();

        app.MapPost("/api/workspaces/{warehouse}/settings/warehouse", async (string warehouse, WarehouseInput input, HttpContext context, AccessService access, WmsDb db, IHubContext<WorkspaceHub> hub, CancellationToken ct) =>
        {
            var actor = await access.Resolve(context.User, warehouse, ct);
            Require(actor.Role == "admin", "denied", 403);
            Require(input.Address is not null && input.Address.Length <= 1000 && input.TimeZone is "Asia/Bangkok" or "Asia/Jakarta" or "Asia/Makassar" or "Asia/Jayapura" or "UTC", "required", 400);
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await RecoveryState.RequireWritable(db, ct);
            await Save(db, "warehouse", actor.WarehouseId, actor.WarehouseId, actor.Id, input.Version, new WarehouseDetails(input.Address!.Trim(), input.TimeZone), input.Reason, ct);
            await tx.CommitAsync(ct);
            await hub.Clients.All.SendAsync("WorkspaceChanged", new { kind = "settings-changed" }, ct);
            return Results.Ok(await ReadWarehouse(db, actor, ct));
        }).RequireAuthorization();

        app.MapPost("/api/workspaces/{warehouse}/settings/approvals", async (string warehouse, ApprovalsInput input, HttpContext context, AccessService access, WmsDb db, IHubContext<WorkspaceHub> hub, CancellationToken ct) =>
        {
            var actor = await access.Resolve(context.User, warehouse, ct);
            Require(actor.Role == "admin", "denied", 403);
            Require(input.OrderReview is "admin" or "supervisor" && input.CountReview is "admin" or "supervisor", "required", 400);
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await RecoveryState.RequireWritable(db, ct);
            // Commands hold these same location locks through commit, so a policy change cannot overtake an approval.
            await db.Locations.FromSqlInterpolated($"SELECT * FROM \"Locations\" WHERE \"WarehouseId\" = {actor.WarehouseId} ORDER BY \"Id\" FOR UPDATE").ToListAsync(ct);
            await Save(db, "approvals", actor.WarehouseId, actor.WarehouseId, actor.Id, input.Version, new ApprovalSettings(input.OrderReview, input.CountReview), input.Reason, ct);
            await tx.CommitAsync(ct);
            await hub.Clients.All.SendAsync("WorkspaceChanged", new { kind = "settings-changed" }, ct);
            return Results.Ok(await ReadWarehouse(db, actor, ct));
        }).RequireAuthorization();
    }

    private static Task<bool> Granted(WmsDb db, string principal, string warehouse, CancellationToken ct) => db.AccessGrants.AnyAsync(g => g.PrincipalId == principal && db.Warehouses.Any(w => w.Id == g.WarehouseId && w.Name == warehouse && w.CompanyId == "demo" && w.Id != "transit"), ct);
    private static object Preferences(UserPreferences value, long version) => new { value.Language, value.Theme, value.DefaultWarehouse, value.StartPage, value.PageSize, version };

    private static async Task<object> ReadWarehouse(WmsDb db, ActingPrincipal actor, CancellationToken ct)
    {
        var (details, version) = await OperationalSettings.Read(db, "warehouse", actor.WarehouseId, new WarehouseDetails(), ct);
        var (approvals, approvalVersion) = await OperationalSettings.Read(db, "approvals", actor.WarehouseId, new ApprovalSettings(), ct);
        var name = await db.Warehouses.Where(w => w.Id == actor.WarehouseId).Select(w => w.Name).SingleAsync(ct);
        return new
        {
            warehouse = new { id = actor.WarehouseId, name, details.Address, details.TimeZone, version },
            approvals = new { approvals.OrderReview, approvals.CountReview, version = approvalVersion },
            locations = await db.Locations.Where(l => l.WarehouseId == actor.WarehouseId).OrderBy(l => l.Code).Select(l => new { l.Code, l.Pickable, l.Frozen }).ToArrayAsync(ct),
            canConfigure = actor.Role == "admin", canAddLocation = actor.Role is "admin" or "supervisor"
        };
    }

    private static async Task<long> Save<T>(WmsDb db, string kind, string owner, string warehouse, string principal, long expectedVersion, T value, string reason, CancellationToken ct)
    {
        if (warehouse != "") Require(!string.IsNullOrWhiteSpace(reason) && reason.Length <= 2000, "reason", 400);
        var id = OperationalSettings.Id(kind, owner);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({id}, 0))", ct);
        Require(await db.Principals.AnyAsync(p => p.Id == principal && p.Status == "active", ct), "denied", 403);
        if (warehouse != "") Require(await db.AccessGrants.AnyAsync(g => g.PrincipalId == principal && g.WarehouseId == warehouse && g.Role == "admin", ct), "denied", 403);
        var row = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == id, ct);
        Require((row?.Version ?? 0) == expectedVersion, "conflict");
        var before = row?.PayloadJson;
        if (row is null) { row = new SupportingRecord { Id = id, WarehouseId = warehouse, Kind = $"settings-{kind}" }; db.SupportingRecords.Add(row); }
        row.PayloadJson = JsonSerializer.Serialize(value, OperationalSettings.Json);
        row.Version++;
        if (warehouse != "") db.Audit.Add(new AuditRecord { TransactionId = ReferenceId.New(), WarehouseId = warehouse, PrincipalId = principal, Action = $"settings-{kind}", DetailJson = JsonSerializer.Serialize(new { before, after = value, reason, version = row.Version }), PostedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
        return row.Version;
    }

    public sealed record PreferencesInput(long Version, string Language, string Theme, string DefaultWarehouse, string StartPage, int PageSize);
    public sealed record WarehouseInput(long Version, string Address, string TimeZone, string Reason);
    public sealed record ApprovalsInput(long Version, string OrderReview, string CountReview, string Reason);
}
