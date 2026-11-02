using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed class RecoveryTests(PostgresFixture postgres)
{
    [Fact]
    public async Task DeliveryJournalCarriesOriginalRequestIdentityForRecovery()
    {
        await using var db = new WmsDb(await postgres.Database());
        var key = Guid.NewGuid().ToString();
        var result = await new Wms.Modules.Inventory.CommandProcessor(db).Handle(new("admin", "main", "admin"), new("receive", "main", 0, System.Text.Json.JsonSerializer.SerializeToElement(new { document = "PO-SIM-100", scan = "SKU-A", qty = "1" })), key, CancellationToken.None);
        var events = await db.Outbox.Where(e => e.Kind == "receive").ToListAsync();
        using var payload = System.Text.Json.JsonDocument.Parse(events.Single(e => e.PayloadJson.Contains(result.Id, StringComparison.Ordinal)).PayloadJson);
        Assert.Equal(key, payload.RootElement.GetProperty("requestIdempotencyKey").GetString());
        Assert.Equal("admin", payload.RootElement.GetProperty("requestPrincipalId").GetString());
        Assert.Equal((await db.Requests.SingleAsync(r => r.ScopeKey == $"demo:admin:receive:{key}")).PayloadHash, payload.RootElement.GetProperty("requestPayloadHash").GetString());
    }

    [Fact]
    public async Task DumpRestorePreservesBalancesLedgerRequestKeysAndEventIds()
    {
        var source = await postgres.Database();
        var target = await postgres.Database(seedDemo: false);
        await using var sourceDb = new WmsDb(source);
        var eventId = Guid.NewGuid();
        var requestKey = $"demo:admin:restore-test:{Guid.NewGuid()}";
        sourceDb.Outbox.Add(new OutboxEvent { Id = eventId, WarehouseId = "main", AggregateId = "recovery-proof", Kind = "receive", PayloadJson = "{}", CreatedAt = DateTimeOffset.UtcNow, NextAttemptAt = DateTimeOffset.UtcNow });
        sourceDb.Requests.Add(new IdempotencyRequest { ScopeKey = requestKey, PrincipalId = "admin", WarehouseId = "main", PayloadHash = "recovery-proof", ResultJson = "{}", CreatedAt = DateTimeOffset.UtcNow });
        await sourceDb.SaveChangesAsync();
        var balances = await sourceDb.Positions.SumAsync(p => p.OnHand);
        var ledgerCount = await sourceDb.Entries.CountAsync();
        var directory = Path.Combine(Path.GetTempPath(), $"wms-recovery-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var dump = Path.Combine(directory, "snapshot.dump");
        try
        {
            await Tool("pg_dump", sourceDb.Database.GetConnectionString()!, directory, dump, restoring: false);
            await using var restored = new WmsDb(target);
            await Tool("pg_restore", restored.Database.GetConnectionString()!, directory, dump, restoring: true);
            Assert.Equal(balances, await restored.Positions.SumAsync(p => p.OnHand));
            Assert.Equal(ledgerCount, await restored.Entries.CountAsync());
            Assert.True(await restored.Requests.AnyAsync(r => r.ScopeKey == requestKey));
            Assert.True(await restored.Outbox.AnyAsync(e => e.Id == eventId));
            restored.SupportingRecords.Add(new SupportingRecord { Id = "outbox-recovery-hold", Kind = "outbox-pause", PayloadJson = "{}" });
            await restored.SaveChangesAsync();
            Assert.True(await restored.SupportingRecords.AnyAsync(r => r.Kind == "outbox-pause"));
            var blocked = await Assert.ThrowsAsync<Wms.Shared.BusinessException>(() => new Wms.Modules.Inventory.CommandProcessor(restored).Handle(new("admin", "main", "admin"), new("receive", "main", 0, System.Text.Json.JsonSerializer.SerializeToElement(new { document = "PO-SIM-100", scan = "SKU-A", qty = "1" })), Guid.NewGuid().ToString(), CancellationToken.None));
            Assert.Equal("recovery-hold", blocked.Message);
            var release = await File.ReadAllTextAsync(Path.Combine(ProjectRoot(), "scripts", "release-recovery-hold.sh"));
            var marker = "<<'SQL'\n";
            var begin = release.IndexOf(marker, StringComparison.Ordinal) + marker.Length;
            var end = release.IndexOf("\nSQL", begin, StringComparison.Ordinal);
            Assert.True(begin >= marker.Length && end > begin);
            var sql = release[begin..end].Replace(":'reference'", "@reference", StringComparison.Ordinal);
            await using var connection = new NpgsqlConnection(restored.Database.GetConnectionString());
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("reference", "isolated-recovery-drill");
            await command.ExecuteNonQueryAsync();
            Assert.False(await restored.SupportingRecords.AnyAsync(r => r.Kind == "outbox-pause"));
            Assert.True(await restored.Audit.AnyAsync(a => a.Action == "outbox-recovery-release"));
        }
        finally
        {
            if (File.Exists(dump)) File.Delete(dump);
            Directory.Delete(directory);
        }
    }

    private static string ProjectRoot([System.Runtime.CompilerServices.CallerFilePath] string file = "") => Path.GetFullPath(Path.Combine(Path.GetDirectoryName(file)!, "..", ".."));

    private static async Task Tool(string tool, string connection, string directory, string dump, bool restoring)
    {
        var database = new NpgsqlConnectionStringBuilder(connection);
        Assert.Matches(new Regex("^wms_test_[a-f0-9]{32}$"), database.Database!);
        var docker = Environment.GetEnvironmentVariable("WMS_PG_DOCKER") == "true";
        var binary = Environment.GetEnvironmentVariable("WMS_PG_BIN") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PostgreSQL", "18", "bin");
        var start = new ProcessStartInfo(docker ? "docker" : Path.Combine(binary, tool + (OperatingSystem.IsWindows() ? ".exe" : ""))) { RedirectStandardError = true, RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true };
        start.Environment["PGPASSWORD"] = database.Password;
        if (docker)
            foreach (var arg in new[] { "run", "--rm", "--network", "host", "--volume", $"{directory}:/backup", "-e", "PGPASSWORD", "postgres:18.4", tool }) start.ArgumentList.Add(arg);
        foreach (var arg in new[] { "--host", database.Host!, "--port", database.Port.ToString(), "--username", database.Username!, "--dbname", database.Database!, "--no-owner", "--no-acl" }) start.ArgumentList.Add(arg);
        if (restoring)
        {
            foreach (var arg in new[] { "--clean", "--if-exists", "--exit-on-error", docker ? "/backup/snapshot.dump" : dump }) start.ArgumentList.Add(arg);
        }
        else
        {
            foreach (var arg in new[] { "--format", "custom", "--file", docker ? "/backup/snapshot.dump" : dump }) start.ArgumentList.Add(arg);
        }
        using var process = Process.Start(start)!;
        var errors = process.StandardError.ReadToEndAsync();
        var output = process.StandardOutput.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        await output;
        Assert.True(process.ExitCode == 0, await errors);
    }
}
