using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Wms.Shared;

public sealed record CommandRequest(string Type, string Warehouse, long? ExpectedVersion, JsonElement Payload, DateTimeOffset? OccurredAt = null, string? PrincipalId = null);
public sealed record CommandResult(string Id, string Message, string Type, DateTimeOffset Stamp);
public sealed record ActingPrincipal(string Id, string WarehouseId, string Role);
public sealed class BusinessException(string code, int status = 409) : Exception(code)
{
    public int Status { get; } = status;
}
public static class Rules
{
    public static void Require([System.Diagnostics.CodeAnalysis.DoesNotReturnIf(false)] bool value, string code, int status = 409)
    {
        if (!value)
            throw new BusinessException(code, status);
    }
    public static string Text(this JsonElement p, string key) => p.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
    public static decimal Quantity(this JsonElement p, string key = "qty", bool zero = false)
    {
        var text = p.Text(key);
        Require(decimal.TryParse(text, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var q) && q >= 0 && (zero || q > 0) && q < 1_000_000_000_000m && decimal.Round(q, 6) == q, "quantity", 400);
        return q;
    }
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string Canonical(JsonElement value)
    {
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer))
            Write(value, writer, "");
        return Encoding.UTF8.GetString(buffer.ToArray());
        static void Write(JsonElement element, Utf8JsonWriter writer, string key)
        {
            if (element.ValueKind == JsonValueKind.Object)
            {
                writer.WriteStartObject();
                foreach (var property in element.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal))
                {
                    writer.WritePropertyName(property.Name);
                    Write(property.Value, writer, property.Name);
                }
                writer.WriteEndObject();
            }
            else if (element.ValueKind == JsonValueKind.Array)
            {
                writer.WriteStartArray();
                foreach (var item in element.EnumerateArray())
                    Write(item, writer, key);
                writer.WriteEndArray();
            }
            else if (element.ValueKind == JsonValueKind.String && (key is "qty" or "good" or "bad") && decimal.TryParse(element.GetString(), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var quantity))
                writer.WriteStringValue(Number(quantity));
            else
                element.WriteTo(writer);
        }
    }
    public static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
    public static void Supervisor(ActingPrincipal actor) => Require(actor.Role is "admin" or "supervisor", "denied", 403);
}
