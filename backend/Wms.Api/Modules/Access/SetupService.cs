using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using static Wms.Shared.Rules;

namespace Wms.Modules.Access;

public sealed record SetupIdentity(string Issuer, string Subject, string Email, string Name);
public sealed record SetupTicket(string Fingerprint, DateTimeOffset ExpiresAt, string Nonce, SetupIdentity? Identity = null);

public sealed class SetupService(WmsDb db, IConfiguration config, IDataProtectionProvider protection)
{
    public const string Cookie = "Wms.Setup";
    public const string Flow = "wms-setup";
    readonly IDataProtector protector = protection.CreateProtector("Wms.Setup.v1");
    string Hash => config["Setup:CodeHash"] ?? "";
    DateTimeOffset Expiry => DateTimeOffset.TryParse(config["Setup:ExpiresAt"], out var expiry) ? expiry : DateTimeOffset.MinValue;
    public BootstrapWarehouse InitialWarehouse() => new(
        (config["Setup:Warehouse:Id"] ?? "").Trim(),
        (config["Setup:Warehouse:Name"] ?? "").Trim(),
        config.GetSection("Setup:Warehouse:StorageLocations").GetChildren().Select(c => (c.Value ?? "").Trim()).ToArray());
    bool WarehouseConfigured {
        get {
            var warehouse = InitialWarehouse();
            return System.Text.RegularExpressions.Regex.IsMatch(warehouse.Id, "^[a-zA-Z0-9_-]{1,64}$") && warehouse.Id != "transit" && warehouse.Name.Length is > 0 and <= 200
                && warehouse.StorageLocations.Length is > 0 and <= 1000 && warehouse.StorageLocations.Distinct().Count() == warehouse.StorageLocations.Length
                && warehouse.StorageLocations.All(code => code.Length is > 0 and <= 100 && !code.Contains('|') && code is not "Receiving" and not "QC" and not "Staging");
        }
    }
    public bool Enabled => config.GetValue<bool>("Setup:Enabled") && Hash.Length == 64 && Hash.All(Uri.IsHexDigit) && Expiry > DateTimeOffset.UtcNow && WarehouseConfigured;

    public async Task<string> State(CancellationToken ct)
    {
        var settings = await db.Settings.AnyAsync(ct);
        var warehouses = await db.Warehouses.AnyAsync(ct);
        var principals = await db.Principals.AnyAsync(ct);
        if (settings && await db.Warehouses.AnyAsync(w => w.Id != "transit", ct)) return "completed";
        if (settings || warehouses || principals) return "blocked";
        return Enabled ? "required" : "unavailable";
    }

    public SetupTicket? Read(HttpContext context)
    {
        if (!Enabled || !context.Request.Cookies.TryGetValue(Cookie, out var cookie)) return null;
        try {
            var ticket = JsonSerializer.Deserialize<SetupTicket>(protector.Unprotect(cookie));
            return ticket is not null && ticket.Fingerprint == Hash && ticket.ExpiresAt > DateTimeOffset.UtcNow && ticket.ExpiresAt <= Expiry ? ticket : null;
        } catch (CryptographicException) { return null; } catch (JsonException) { return null; }
    }

    public void Activate(HttpContext context, string code)
    {
        Require(Enabled && code.Length <= 512 && CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(code)), Convert.FromHexString(Hash)), "setup-code", 403);
        var expiry = DateTimeOffset.UtcNow.AddMinutes(30);
        Write(context, new(Hash, expiry < Expiry ? expiry : Expiry, Convert.ToHexString(RandomNumberGenerator.GetBytes(32))));
    }

    public void Write(HttpContext context, SetupTicket ticket) => context.Response.Cookies.Append(Cookie, protector.Protect(JsonSerializer.Serialize(ticket)), new CookieOptions {
        // OIDC form_post callbacks are cross-site; the protected nonce still binds the setup flow.
        HttpOnly = true, Secure = true, SameSite = SameSiteMode.None, Path = "/", Expires = ticket.ExpiresAt, IsEssential = true
    });

    public static async Task EnrollmentLock(WmsDb db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"production-bootstrap"}, 0))", ct);
        Require(await db.Settings.AnyAsync(ct) && await db.Warehouses.AnyAsync(w => w.Id != "transit", ct), "setup-required", 409);
    }
}
