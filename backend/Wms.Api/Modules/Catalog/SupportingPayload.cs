using System.Text;
using System.Text.Json;
using Wms.Shared;
using Wms.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Wms.Modules.Catalog;

internal static class SupportingPayload
{
    public const int MaxBytes = 16384;

    public static void RequireBounded(string json) => Rules.Require(Encoding.UTF8.GetByteCount(json) <= MaxBytes, "supporting-payload-size", 400);

    public static async Task RequireStoredBound(WmsDb db, string json, CancellationToken ct)
    {
        RequireBounded(json);
        var size = await db.Database.SqlQuery<int>($"SELECT octet_length({json}::jsonb::text) AS \"Value\"").SingleAsync(ct);
        Rules.Require(size <= MaxBytes, "supporting-payload-size", 400);
    }

    public static void RequireShape(JsonElement payload, params string[] fields)
    {
        Rules.Require(payload.ValueKind == JsonValueKind.Object, "required", 400);
        RequireBounded(payload.GetRawText());
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var field in payload.EnumerateObject())
            Rules.Require(seen.Add(field.Name) && fields.Contains(field.Name)
                && (field.Value.ValueKind == JsonValueKind.String || field.Name == "version" && field.Value.ValueKind == JsonValueKind.Number && field.Value.TryGetInt64(out _)), "supporting-payload", 400);
    }
}
