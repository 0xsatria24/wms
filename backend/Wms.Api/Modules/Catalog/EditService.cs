using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Catalog;

public sealed record EditRequest(string Type, string Warehouse, JsonElement Payload);
public sealed class EditService(WmsDb db, IHostEnvironment environment)
{
    public async Task Apply(ActingPrincipal actor, EditRequest request, CancellationToken ct)
    {
        Require(actor.Role is "admin" or "supervisor" or "operator", "denied", 403);
        var p = request.Payload;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await RecoveryState.RequireWritable(db, ct);
        if (request.Type is "master" or "delete-master" or "packages" or "labelHistory" or "create-order")
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"edit:demo:catalog"}, 0))", ct);
        if (request.Type is "create-user" or "delete-user" or "access")
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"edit:demo:users"}, 0))", ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({$"edit:demo:{request.Type}"}, 0))", ct);
        Require(await db.Principals.AnyAsync(u => u.Id == actor.Id && u.Status == "active", ct) && await db.AccessGrants.AnyAsync(g => g.PrincipalId == actor.Id && g.WarehouseId == actor.WarehouseId && g.Role == actor.Role, ct), "denied", 403);
        object? deletedItem = null;
        object? userSnapshot = null;
        string? userTargetId = null;
        if (request.Type == "master")
        {
            Supervisor(actor);
            var sku = p.Text("sku");
            Require(!string.IsNullOrWhiteSpace(sku) && !string.IsNullOrWhiteSpace(p.Text("name")) && !string.IsNullOrWhiteSpace(p.Text("barcode")) && !string.IsNullOrWhiteSpace(p.Text("unit")), "required", 400);
            Require(System.Text.RegularExpressions.Regex.IsMatch(p.Text("barcode"), "^[\\x20-\\x7E]+$"), "barcode-format", 400);
            var factor = p.Quantity("factor");
            var existing = await db.Items.SingleOrDefaultAsync(i => i.CompanyId == "demo" && i.Sku == sku, ct);
            Require(!await db.Items.AnyAsync(i => i.CompanyId == "demo" && i.Sku != sku && i.Barcode == p.Text("barcode"), ct), "duplicate", 409);
            if (existing is null)
            {
                existing = new Item { Id = $"demo|{sku}", Sku = sku, Name = p.Text("name"), Barcode = p.Text("barcode"), Unit = p.Text("unit") };
                db.Items.Add(existing);
            }
            else
            {
                Require(p.TryGetProperty("version", out var version) && version.GetInt64() == existing.Version, "conflict");
                Require(existing.Unit == p.Text("unit"), "base-unit-history");
                if (existing.Barcode != p.Text("barcode"))
                {
                    Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                    db.SupportingRecords.Add(new SupportingRecord { Id = $"labelHistory|{Guid.NewGuid():N}", WarehouseId = actor.WarehouseId, Kind = "labelHistory", PayloadJson = JsonSerializer.Serialize(new { sku, previous = existing.Barcode, code = p.Text("barcode"), reason = p.Text("reason"), action = "replace", user = actor.Id, stamp = DateTimeOffset.UtcNow }) });
                }
            }
            var active = p.TryGetProperty("active", out var activeValue) && activeValue.GetBoolean();
            Require(active || !string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
            var image = p.TryGetProperty("image", out var imageValue) && imageValue.ValueKind == JsonValueKind.String ? imageValue.GetString() : null;
            if (existing.Image is not null && image == $"/api/items/{Uri.EscapeDataString(sku)}/image?warehouse={Uri.EscapeDataString(actor.WarehouseId)}")
                image = existing.Image;
            if (image is not null)
            {
                Require(image.Length <= 7_000_000 && image.Contains(','), "image", 400);
                byte[] bytes;
                try
                {
                    bytes = Convert.FromBase64String(image[(image.IndexOf(',') + 1)..]);
                }
                catch (FormatException) { throw new BusinessException("image", 400); }
                Require(bytes.Length is > 0 and <= 5_242_880, "image", 400);
                Require(bytes.Length > 12 && ((bytes[0] == 0xFF && bytes[1] == 0xD8) || (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) || (System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP")), "image", 400);
            }
            existing.Name = p.Text("name");
            existing.Barcode = p.Text("barcode");
            existing.Category = p.Text("category");
            existing.Dimensions = p.Text("dimensions");
            existing.Weight = p.Text("weight");
            existing.ConversionFactor = factor;
            existing.Active = active;
            existing.Image = image;
            existing.Version++;
        }
        else if (request.Type == "delete-master")
        {
            Supervisor(actor);
            Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
            var sku = p.Text("sku");
            var locked = await db.Items.FromSqlInterpolated($"SELECT * FROM \"Items\" WHERE \"CompanyId\" = 'demo' AND \"Sku\" = {sku} FOR UPDATE").ToListAsync(ct);
            var item = locked.SingleOrDefault();
            Require(item is not null, "source", 404);
            Require(p.TryGetProperty("version", out var expected) && expected.TryGetInt64(out var version) && version == item!.Version, "conflict");
            Require(!await db.Positions.AnyAsync(position => position.ItemId == item!.Id, ct)
                && !await db.Documents.AnyAsync(document => document.ItemId == item!.Id, ct), "item-in-use");
            var references = await db.SupportingRecords.Where(record => record.Kind == "packages" || record.Kind == "labelHistory").Select(record => record.PayloadJson).ToListAsync(ct);
            Require(!references.Any(json => ReferencesSku(JsonSerializer.Deserialize<JsonElement>(json), sku)), "item-in-use");
            deletedItem = new
            {
                item!.Id,
                item.Sku,
                item.Name,
                item.Barcode,
                item.Unit,
                item.Version
            };
            db.Items.Remove(item);
        }
        else if (request.Type == "create-user")
        {
            Require(actor.Role == "admin", "denied", 403);
            var name = p.Text("name").Trim();
            var email = p.Text("email").Trim().ToLowerInvariant();
            Require(name.Length is > 0 and < 200 && email.Length is > 3 and < 254 && System.Net.Mail.MailAddress.TryCreate(email, out var address) && address.Address == email, "required", 400);
            Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
            Require(!await db.Principals.AnyAsync(u => u.Email.ToLower() == email, ct), "user-duplicate", 409);
            var id = Guid.NewGuid().ToString("N");
            db.Principals.Add(new Principal { Id = id, Subject = $"request:{id}", Issuer = "access-request", Name = name, Email = email, Verified = false, Status = "pending" });
            userTargetId = id;
            userSnapshot = new
            {
                Name = name,
                Email = email,
                Status = "pending"
            };
        }
        else if (request.Type == "delete-user")
        {
            Require(actor.Role == "admin", "denied", 403);
            var id = p.Text("id");
            Require(id != actor.Id, "self-user", 403);
            Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
            var target = await db.Principals.SingleOrDefaultAsync(u => u.Id == id, ct);
            Require(target is not null, "source", 404);
            Require(target!.Status != "deleted", "account-unavailable");
            var grants = await db.AccessGrants.Where(g => g.PrincipalId == id).ToListAsync(ct);
            var allowed = await db.AccessGrants.Where(g => g.PrincipalId == actor.Id && g.Role == "admin").Select(g => g.WarehouseId).ToArrayAsync(ct);
            Require(grants.All(g => allowed.Contains(g.WarehouseId)), "user-scope", 403);
            userTargetId = id;
            userSnapshot = new
            {
                target.Name,
                target.Email,
                PreviousStatus = target.Status,
                Grants = grants.Select(g => new { g.WarehouseId, g.Role }).ToArray()
            };
            target.Status = "deleted";
            db.AccessGrants.RemoveRange(grants);
        }
        else if (request.Type == "access")
        {
            Require(actor.Role == "admin", "denied", 403);
            var id = p.Text("id");
            Require(id != actor.Id, "approval", 403);
            Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
            var target = await db.Principals.SingleOrDefaultAsync(u => u.Id == id, ct);
            Require(target is not null, "source", 404);
            Require(target!.Status != "deleted", "account-unavailable");
            var status = p.Text("status");
            Require(status is "active" or "rejected" or "revoked", "required", 400);
            Require(status != "active" || target!.Verified, "email-verification", 400);
            var role = p.Text("role");
            Require(role is "admin" or "supervisor" or "operator" or "viewer", "required", 400);
            var requested = p.GetProperty("warehouses").EnumerateArray().Select(x => x.GetString() ?? "").ToArray();
            var allowed = await db.AccessGrants.Where(g => g.PrincipalId == actor.Id && g.Role == "admin").Join(db.Warehouses, g => g.WarehouseId, w => w.Id, (g, w) => w).ToListAsync(ct);
            Require(requested.Length > 0 && requested.All(name => allowed.Any(w => w.Name == name)), "scope", 403);
            target!.Status = status;
            var existingGrants = await db.AccessGrants.Where(g => g.PrincipalId == id).ToListAsync(ct);
            Require(existingGrants.All(g => allowed.Any(w => w.Id == g.WarehouseId)), "user-scope", 403);
            var desired = requested.Select(name => allowed.Single(w => w.Name == name).Id).ToArray();
            foreach (var grant in existingGrants)
            {
                if (desired.Contains(grant.WarehouseId))
                    grant.Role = role;
                else
                    db.AccessGrants.Remove(grant);
            }
            foreach (var wh in desired.Where(wh => !existingGrants.Any(g => g.WarehouseId == wh)))
                db.AccessGrants.Add(new AccessGrant { PrincipalId = id, WarehouseId = wh, Role = role });
        }
        else if (request.Type == "create-order")
        {
            Require(actor.Role != "viewer", "denied", 403);
            var item = await db.Items.SingleOrDefaultAsync(i => i.CompanyId == "demo" && i.Sku == p.Text("sku") && i.Active, ct);
            Require(item is not null, "scan-item", 400);
            var id = p.Text("id");
            Require(id.Length is > 0 and < 100 && !await db.Documents.AnyAsync(d => d.Id == id, ct), "duplicate");
            db.Documents.Add(new OperationalDocument { Id = id, Kind = "order", ItemId = item!.Id, WarehouseId = actor.WarehouseId, Quantity = p.Quantity(), Creator = actor.Id, Status = "draft" });
        }
        else if (request.Type == "submit-order")
        {
            var doc = await db.Documents.SingleOrDefaultAsync(d => d.Id == p.Text("id") && d.WarehouseId == actor.WarehouseId && d.Kind == "order", ct);
            Require(doc is not null && doc.Status == "draft" && (doc.Creator == actor.Id || actor.Role is "admin" or "supervisor"), "denied", 403);
            Require(p.GetProperty("version").GetInt64() == doc!.Version, "conflict");
            doc.Status = "pending-approval";
            doc.Version++;
        }
        else if (request.Type == "partial-policy")
        {
            Require(environment.IsDevelopment() && actor.Role == "admin", "policy-not-configured", 403);
            var settings = await db.Settings.SingleAsync(ct);
            settings.PartialAllowed = p.GetProperty("enabled").GetBoolean();
        }
        else if (request.Type == "locationMaster")
        {
            Supervisor(actor);
            var code = p.Text("name").Trim();
            Require(code.Length is > 0 and <= 100 && !code.Contains('|'), "required", 400);
            Require(!await db.Locations.AnyAsync(l => l.WarehouseId == actor.WarehouseId && l.Code.ToLower() == code.ToLower(), ct), "location-duplicate", 409);
            db.Locations.Add(new Location { Id = $"{actor.WarehouseId}|{code}", WarehouseId = actor.WarehouseId, Code = code, Pickable = !p.TryGetProperty("pickable", out var pickable) || pickable.GetBoolean() });
        }
        else if (new[] { "packages", "labelHistory", "followups", "unitMaster", "devices" }.Contains(request.Type))
        {
            if (request.Type is not "followups" and not "labelHistory")
                Supervisor(actor);
            if (request.Type == "devices")
                Require(!string.IsNullOrWhiteSpace(p.Text("id")) && p.Text("id").Length <= 100, "required", 400);
            if (request.Type == "unitMaster")
            {
                Require(p.Text("name").Trim().Length is > 0 and <= 100, "required", 400);
                p.Quantity("factor");
            }
            var id = request.Type == "packages" ? $"package|{p.Text("id")}" : request.Type == "devices" ? $"device|{p.Text("id")}" : $"{request.Type}|{Guid.NewGuid():N}";
            var record = await db.SupportingRecords.SingleOrDefaultAsync(r => r.Id == id && r.WarehouseId == actor.WarehouseId, ct);
            if (request.Type == "packages")
            {
                Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                var lines = p.GetProperty("items").EnumerateArray().ToArray();
                Require(lines.Length <= 100, "required", 400);
                foreach (var line in lines)
                {
                    Require(await db.Items.AnyAsync(i => i.Sku == line.Text("sku") && i.CompanyId == "demo", ct), "scan-item", 400);
                    line.Quantity(zero: true);
                }
                if (record is not null)
                {
                    var old = JsonSerializer.Deserialize<JsonElement>(record.PayloadJson);
                    Require(p.GetProperty("version").GetInt64() == old.GetProperty("version").GetInt64() + 1, "conflict");
                }
            }
            if (record is null)
            {
                record = new SupportingRecord { Id = id, WarehouseId = actor.WarehouseId, Kind = request.Type };
                db.SupportingRecords.Add(record);
            }
            record.PayloadJson = p.GetRawText();
            record.Version++;
        }
        else
            throw new BusinessException("unsupported", 400);
        db.Audit.Add(new AuditRecord { TransactionId = $"EDIT-{Guid.NewGuid():N}", WarehouseId = actor.WarehouseId, PrincipalId = actor.Id, Action = request.Type, DetailJson = JsonSerializer.Serialize(new { request.Type, Target = userTargetId ?? p.Text("id"), Sku = p.Text("sku"), Role = p.Text("role"), Status = p.Text("status"), Reason = p.Text("reason"), DeletedItem = deletedItem, User = userSnapshot, Warehouses = p.TryGetProperty("warehouses", out var auditWarehouses) ? auditWarehouses : (JsonElement?)null }), PostedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private static bool ReferencesSku(JsonElement value, string sku) => value.ValueKind switch
    {
        JsonValueKind.Object => value.EnumerateObject().Any(property =>
            property.Name.Equals("sku", StringComparison.OrdinalIgnoreCase) && property.Value.ValueKind == JsonValueKind.String && property.Value.GetString() == sku
            || ReferencesSku(property.Value, sku)),
        JsonValueKind.Array => value.EnumerateArray().Any(element => ReferencesSku(element, sku)),
        _ => false
    };
}
