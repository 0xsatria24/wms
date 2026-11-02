using System.Text.Json;

namespace Wms.Worker;

public static class WorkerHeartbeat
{
    public static string DefaultPath => Path.Combine(Path.GetTempPath(), "wms-worker-heartbeat.json");
    public static void Write(string path, string status)
    {
        var temporary = path + $".{Environment.ProcessId}.tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(new { status, updatedAt = DateTimeOffset.UtcNow }));
        File.Move(temporary, path, overwrite: true);
    }
    public static bool Healthy(string path)
    {
        try
        {
            using var value = JsonDocument.Parse(File.ReadAllText(path));
            var status = value.RootElement.GetProperty("status").GetString();
            var updated = value.RootElement.GetProperty("updatedAt").GetDateTimeOffset();
            return status is "running" or "paused" or "disabled" && updated > DateTimeOffset.UtcNow.AddSeconds(-60) && updated < DateTimeOffset.UtcNow.AddSeconds(5);
        }
        catch (IOException) { return false; }
        catch (JsonException) { return false; }
        catch (KeyNotFoundException) { return false; }
        catch (InvalidOperationException) { return false; }
        catch (FormatException) { return false; }
    }
}
