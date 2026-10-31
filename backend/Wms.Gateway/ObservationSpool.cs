using Microsoft.Data.Sqlite;
using System.Text.Json;

namespace Wms.Gateway;

public sealed record ReaderObservation(Guid Id, string Warehouse, string ReaderId, string SessionId, string TagCode, DateTimeOffset ObservedAt);
public interface IRfidReader
{
    IAsyncEnumerable<ReaderObservation> Read(CancellationToken cancellationToken);
}
public sealed class ObservationSpool(string filename)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private string ConnectionString => new SqliteConnectionStringBuilder { DataSource = filename }.ToString();
    public async Task Initialize(CancellationToken ct)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(filename))!);
        await using var db = new SqliteConnection(ConnectionString);
        await db.OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY,payload TEXT NOT NULL,delivered_at TEXT NULL,blocked INTEGER NOT NULL DEFAULT 0);";
        await command.ExecuteNonQueryAsync(ct);
    }
    public async Task Capture(ReaderObservation observation, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(observation, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        await gate.WaitAsync(ct);
        try
        {
            await using var db = new SqliteConnection(ConnectionString);
            await db.OpenAsync(ct);
            await using var command = db.CreateCommand();
            command.CommandText = "INSERT INTO observations(id,payload) VALUES($id,$payload) ON CONFLICT(id) DO NOTHING;";
            command.Parameters.AddWithValue("$id", observation.Id.ToString());
            command.Parameters.AddWithValue("$payload", payload);
            await command.ExecuteNonQueryAsync(ct);
            command.CommandText = "SELECT payload FROM observations WHERE id=$id";
            var existing = (string)(await command.ExecuteScalarAsync(ct))!;
            if (existing != payload)
                throw new InvalidOperationException("Observation ID was reused with a different payload.");
        }
        finally { gate.Release(); }
    }
    public async Task<IReadOnlyList<(string Id, string Payload)>> Pending(CancellationToken ct)
    {
        await using var db = new SqliteConnection(ConnectionString);
        await db.OpenAsync(ct);
        await using var command = db.CreateCommand();
        command.CommandText = "SELECT id,payload FROM observations WHERE delivered_at IS NULL AND blocked=0 ORDER BY rowid LIMIT 100";
        await using var rows = await command.ExecuteReaderAsync(ct);
        var result = new List<(string, string)>();
        while (await rows.ReadAsync(ct))
            result.Add((rows.GetString(0), rows.GetString(1)));
        return result;
    }
    public async Task Acknowledge(string id, bool blocked, CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            await using var db = new SqliteConnection(ConnectionString);
            await db.OpenAsync(ct);
            await using var command = db.CreateCommand();
            command.CommandText = blocked ? "UPDATE observations SET blocked=1 WHERE id=$id" : "UPDATE observations SET delivered_at=$at WHERE id=$id";
            command.Parameters.AddWithValue("$id", id);
            if (!blocked)
                command.Parameters.AddWithValue("$at", DateTimeOffset.UtcNow.ToString("O"));
            await command.ExecuteNonQueryAsync(ct);
        }
        finally { gate.Release(); }
    }
}
