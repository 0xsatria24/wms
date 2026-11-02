using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Wms.Infrastructure;

public sealed record WarehouseDetails(string Address = "", string TimeZone = "Asia/Bangkok");
public sealed record ApprovalSettings(string OrderReview = "supervisor", string CountReview = "supervisor");
public sealed record UserPreferences(string Language = "en", string Theme = "light", string DefaultWarehouse = "", string StartPage = "workspace", int PageSize = 10);

public static class OperationalSettings
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string Id(string kind, string owner) => $"settings:{kind}:{owner}";

    public static async Task<(T Value, long Version)> Read<T>(WmsDb db, string kind, string owner, T fallback, CancellationToken ct = default)
    {
        var id = Id(kind, owner);
        var record = await db.SupportingRecords.AsNoTracking().SingleOrDefaultAsync(r => r.Id == id && r.CompanyId == "demo" && r.Kind == $"settings-{kind}", ct);
        return record is null ? (fallback, 0) : (JsonSerializer.Deserialize<T>(record.PayloadJson, Json) ?? fallback, record.Version);
    }
}
