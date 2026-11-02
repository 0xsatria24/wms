using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? container;
    private readonly List<string> createdDatabases = [];
    public string AdminConnection { get; private set; } = "";
    public async Task InitializeAsync()
    {
        AdminConnection = Environment.GetEnvironmentVariable("WMS_TEST_ADMIN") ?? "";
        if (AdminConnection.Length == 0)
        {
            container = new PostgreSqlBuilder("postgres:18.4").WithDatabase("wms_tests").WithUsername("wms_test").WithPassword(Guid.NewGuid().ToString("N")).Build();
            await container.StartAsync();
            AdminConnection = container.GetConnectionString();
        }
        AdminConnection = new NpgsqlConnectionStringBuilder(AdminConnection) { Pooling = false }.ConnectionString;
        await using var connection = new NpgsqlConnection(AdminConnection);
        await connection.OpenAsync();
        await using var version = new NpgsqlCommand("SHOW server_version_num", connection);
        var serverVersion = int.Parse((string)(await version.ExecuteScalarAsync())!);
        Assert.InRange(serverVersion, 180000, 189999);
    }
    public async Task<DbContextOptions<WmsDb>> Database(bool seedDemo = true)
    {
        var name = $"wms_test_{Guid.NewGuid():N}";
        createdDatabases.Add(name);
        var admin = new NpgsqlConnectionStringBuilder(AdminConnection) { Database = "postgres" };
        await using var connection = new NpgsqlConnection(admin.ConnectionString);
        await connection.OpenAsync();
        await using var create = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", connection);
        await create.ExecuteNonQueryAsync();
        var options = new DbContextOptionsBuilder<WmsDb>().UseNpgsql(new NpgsqlConnectionStringBuilder(AdminConnection) { Database = name }.ConnectionString).Options;
        await using var db = new WmsDb(options);
        await db.Database.MigrateAsync();
        if (seedDemo) await Seed.Demo(db);
        return options;
    }
    public async Task DisposeAsync()
    {
        if (container is not null)
        {
            await container.DisposeAsync();
            return;
        }
        var admin = new NpgsqlConnectionStringBuilder(AdminConnection) { Database = "postgres" };
        await using var connection = new NpgsqlConnection(admin.ConnectionString);
        await connection.OpenAsync();
        foreach (var name in createdDatabases)
        {
            if (!System.Text.RegularExpressions.Regex.IsMatch(name, "^wms_test_[a-f0-9]{32}$"))
                throw new InvalidOperationException("Unexpected test database name.");
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
[CollectionDefinition("PostgreSQL")]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>;
