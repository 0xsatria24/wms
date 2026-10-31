using Microsoft.AspNetCore.SignalR;
using Npgsql;
using System.Text.Json;

namespace Wms.Modules.Access;

public sealed class PgNotifications(IConfiguration configuration, IHubContext<WorkspaceHub> hub, ILogger<PgNotifications> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var connection = new NpgsqlConnection(configuration.GetConnectionString("Wms"));
                await connection.OpenAsync(stoppingToken);
                connection.Notification += (_, notification) => { using var value = JsonDocument.Parse(notification.Payload); if (value.RootElement.TryGetProperty("warehouse", out var warehouse)) _ = hub.Clients.Group($"warehouse:{warehouse.GetString()}").SendAsync("WorkspaceChanged", new { kind = "outbox-status" }, stoppingToken); };
                await using var listen = new NpgsqlCommand("LISTEN wms_changed", connection);
                await listen.ExecuteNonQueryAsync(stoppingToken);
                while (!stoppingToken.IsCancellationRequested)
                    await connection.WaitAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (NpgsqlException) { logger.LogWarning("Status notifications disconnected; snapshot refresh remains available."); await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
        }
    }
}
