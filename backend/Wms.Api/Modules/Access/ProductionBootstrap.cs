using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Access;

public sealed record BootstrapWarehouse(string Id, string Name, string[] StorageLocations);
public sealed record BootstrapRequest(string Issuer, string Subject, string Email, string Name, BootstrapWarehouse[] Warehouses, bool PartialAllowed = false);

public static class ProductionBootstrap
{
    public static async Task Run(WmsDb db, BootstrapRequest input, CancellationToken ct = default)
    {
        input = input with { Warehouses = input.Warehouses?.Select(w => w with { Id = (w.Id ?? "").Trim(), Name = (w.Name ?? "").Trim(), StorageLocations = w.StorageLocations?.Select(c => (c ?? "").Trim()).ToArray() ?? [] }).ToArray() ?? [] };
        Require(Uri.TryCreate(input.Issuer, UriKind.Absolute, out var issuer) && issuer.Scheme == "https" && !string.IsNullOrWhiteSpace(input.Subject), "bootstrap-identity", 400);
        Require(System.Net.Mail.MailAddress.TryCreate(input.Email, out var email) && email.Address == input.Email && !string.IsNullOrWhiteSpace(input.Name), "bootstrap-identity", 400);
        Require(input.Warehouses is { Length: > 0 and <= 100 } && input.Warehouses.Select(w => w.Id).Distinct().Count() == input.Warehouses.Length, "bootstrap-warehouses", 400);
        foreach (var wh in input.Warehouses)
        {
            Require(System.Text.RegularExpressions.Regex.IsMatch(wh.Id, "^[a-zA-Z0-9_-]{1,64}$") && wh.Id != "transit" && !string.IsNullOrWhiteSpace(wh.Name) && wh.Name.Length <= 200, "bootstrap-warehouse", 400);
            Require(wh.StorageLocations is { Length: > 0 and <= 1000 } && wh.StorageLocations.Distinct().Count() == wh.StorageLocations.Length, "bootstrap-locations", 400);
            Require(wh.StorageLocations.All(code => !string.IsNullOrWhiteSpace(code) && code.Length <= 100 && !code.Contains('|') && code is not "Receiving" and not "QC" and not "Staging"), "bootstrap-locations", 400);
        }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"production-bootstrap"}, 0))", ct);
        Require(!await db.Warehouses.AnyAsync(ct) && !await db.Principals.AnyAsync(ct) && !await db.Settings.AnyAsync(ct), "bootstrap-already-initialized");
        var admin = new Principal { Id = Guid.NewGuid().ToString("N"), Issuer = input.Issuer, Subject = input.Subject, Email = input.Email.ToLowerInvariant(), Name = input.Name, Status = "active", Verified = true };
        db.Principals.Add(admin);
        db.Settings.Add(new CompanySettings { PartialAllowed = input.PartialAllowed });
        db.Warehouses.Add(new Warehouse { Id = "transit", Name = "Transfer transit" });
        foreach (var wh in input.Warehouses)
        {
            db.Warehouses.Add(new Warehouse { Id = wh.Id, Name = wh.Name.Trim() });
            db.AccessGrants.Add(new AccessGrant { PrincipalId = admin.Id, WarehouseId = wh.Id, Role = "admin" });
            foreach (var code in wh.StorageLocations.Concat(["Receiving", "QC", "Staging"]))
                db.Locations.Add(new Location { Id = $"{wh.Id}|{code}", WarehouseId = wh.Id, Code = code, Pickable = wh.StorageLocations.Contains(code) });
            db.Audit.Add(new AuditRecord { TransactionId = ReferenceId.New(), WarehouseId = wh.Id, PrincipalId = admin.Id, Action = "production-bootstrap", DetailJson = "{}", PostedAt = DateTimeOffset.UtcNow });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
