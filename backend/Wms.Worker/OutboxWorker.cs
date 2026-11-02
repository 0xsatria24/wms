using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Wms.Infrastructure;

namespace Wms.Worker;

public sealed class OutboxWorker(IServiceScopeFactory scopes, IHttpClientFactory clients, IConfiguration configuration, ILogger<OutboxWorker> logger) : BackgroundService
{
    private DateTimeOffset nextAlert;
    private string state = "running";
    private Uri Endpoint()
    {
        if (!Uri.TryCreate(configuration["Erp:Endpoint"], UriKind.Absolute, out var endpoint) || endpoint.Scheme != "https" || !configuration.GetValue<bool>("Erp:SupportsIdempotency") || configuration["Erp:Protocol"] != "wms-v1" ||
            configuration["Erp:StatusEndpoint"] is not { } status || !status.Contains("{eventId}") || !Uri.TryCreate(status.Replace("{eventId}", Guid.Empty.ToString()), UriKind.Absolute, out var statusUri) || statusUri.Scheme != "https")
            throw new InvalidOperationException("ERP delivery requires HTTPS endpoint/status lookup, wms-v1 protocol and idempotency support.");
        return endpoint;
    }

    public async Task ProcessOnce(CancellationToken ct)
    {
        var endpoint = Endpoint();
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
        if (configuration.GetValue<bool>("Erp:DispatchPaused") || await db.SupportingRecords.AnyAsync(r => r.Kind == "outbox-pause", ct)) { state = "paused"; return; }
        await Dispatch(endpoint, ct);
        await Reconcile(configuration["Erp:StatusEndpoint"]!, ct);
        state = "running";
        if (DateTimeOffset.UtcNow >= nextAlert)
        {
            var cutoff = DateTimeOffset.UtcNow.AddMinutes(-Math.Max(1, configuration.GetValue<int?>("Erp:BacklogAlertMinutes") ?? 15));
            var count = await db.Outbox.CountAsync(e => e.BusinessStatus != "accepted" && e.CreatedAt < cutoff, ct);
            if (count > 0) logger.LogError("ERP backlog needs operator attention: {Count} events exceed the configured age threshold.", count);
            nextAlert = DateTimeOffset.UtcNow.AddMinutes(1);
        }
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var enabled = configuration.GetValue<bool?>("Erp:Enabled") ?? !string.IsNullOrEmpty(configuration["Erp:Endpoint"]);
        if (!enabled)
        {
            logger.LogInformation("ERP adapter is unconfigured. Committed outbox events remain queued.");
            while (!stoppingToken.IsCancellationRequested)
            {
                WorkerHeartbeat.Write(configuration["Health:HeartbeatPath"] ?? WorkerHeartbeat.DefaultPath, "disabled");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            return;
        }
        Endpoint();
        var failures = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessOnce(stoppingToken);
                failures = 0;
                WorkerHeartbeat.Write(configuration["Health:HeartbeatPath"] ?? WorkerHeartbeat.DefaultPath, state);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error)
            {
                WorkerHeartbeat.Write(configuration["Health:HeartbeatPath"] ?? WorkerHeartbeat.DefaultPath, "error");
                logger.LogWarning("Outbox processing failed ({ExceptionType}); events remain retryable.", error.GetType().Name);
                if (++failures >= 5) { Environment.ExitCode = 1; throw new InvalidOperationException("Outbox worker failed five consecutive processing attempts.", error); }
            }
            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
    }
    private async Task Reconcile(string template, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
        var now = DateTimeOffset.UtcNow;
        OutboxEvent? item;
        await using (var claim = await db.Database.BeginTransactionAsync(ct))
        {
            item = (await db.Outbox.FromSqlInterpolated($"SELECT * FROM \"Outbox\" WHERE \"TransportStatus\" = 'acknowledged' AND \"BusinessStatus\" NOT IN ('accepted', 'rejected') AND \"NextAttemptAt\" <= {now} AND (\"LeaseUntil\" IS NULL OR \"LeaseUntil\" < {now}) ORDER BY \"NextAttemptAt\", \"Id\" LIMIT 1 FOR UPDATE SKIP LOCKED").ToListAsync(ct)).FirstOrDefault();
            if (item is null) return;
            item.LeaseUntil = now.AddSeconds(30);
            await db.SaveChangesAsync(ct);
            await claim.CommitAsync(ct);
        }
        var outcome = "business-pending";
        int? httpStatus = null;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, template.Replace("{eventId}", item.Id.ToString()));
            var token = configuration["Erp:BearerToken"];
            if (!string.IsNullOrEmpty(token)) request.Headers.Authorization = new("Bearer", token);
            using var response = await clients.CreateClient("erp").SendAsync(request, ct);
            httpStatus = (int)response.StatusCode;
            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
                if (body.ValueKind == JsonValueKind.Object && body.TryGetProperty("businessStatus", out var status) && status.GetString() is "accepted" or "rejected")
                {
                    item.BusinessStatus = status.GetString()!;
                    outcome = item.BusinessStatus;
                }
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { outcome = "status-timeout"; }
        catch (HttpRequestException) { outcome = "status-unavailable"; }
        catch (JsonException) { outcome = "status-unreadable"; }
        item.LeaseUntil = null;
        item.Attempts++;
        item.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(Math.Min(300, Math.Pow(2, Math.Min(item.Attempts, 8))));
        db.DeliveryAttempts.Add(new DeliveryAttempt { EventId = item.Id, At = DateTimeOffset.UtcNow, Outcome = outcome, HttpStatus = httpStatus });
        await db.SaveChangesAsync(ct);
        if (outcome == "accepted")
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_notify('wms_changed', {JsonSerializer.Serialize(new { warehouse = item.WarehouseId, eventId = item.Id })})", ct);
    }
    private async Task Dispatch(Uri endpoint, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
        var now = DateTimeOffset.UtcNow;
        OutboxEvent? item;
        await using (var claim = await db.Database.BeginTransactionAsync(ct))
        {
            var batch = await db.Outbox.FromSqlInterpolated($"SELECT e.* FROM \"Outbox\" e WHERE e.\"TransportStatus\" = 'pending' AND e.\"NextAttemptAt\" <= {now} AND (e.\"LeaseUntil\" IS NULL OR e.\"LeaseUntil\" < {now}) AND NOT EXISTS (SELECT 1 FROM \"Outbox\" earlier WHERE earlier.\"AggregateId\" = e.\"AggregateId\" AND earlier.\"AggregateVersion\" < e.\"AggregateVersion\" AND earlier.\"BusinessStatus\" <> 'accepted') ORDER BY e.\"CreatedAt\", e.\"Id\" LIMIT 1 FOR UPDATE SKIP LOCKED").ToListAsync(ct);
            item = batch.FirstOrDefault();
            if (item is null)
                return;
            item.LeaseUntil = now.AddSeconds(30);
            await db.SaveChangesAsync(ct);
            await claim.CommitAsync(ct);
        }
        string outcome;
        int? httpStatus = null;
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Add("Idempotency-Key", item.Id.ToString());
            request.Content = new StringContent(item.PayloadJson, System.Text.Encoding.UTF8, "application/json");
            var token = configuration["Erp:BearerToken"];
            if (!string.IsNullOrEmpty(token))
                request.Headers.Authorization = new("Bearer", token);
            using var response = await clients.CreateClient("erp").SendAsync(request, ct);
            httpStatus = (int)response.StatusCode;
            if (response.IsSuccessStatusCode)
            {
                item.TransportStatus = "acknowledged";
                var body = await response.Content.ReadFromJsonAsync<JsonElement>(ct);
                item.BusinessStatus = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("businessStatus", out var result) && result.GetString() is "accepted" or "rejected" ? result.GetString()! : "pending-confirmation";
                outcome = item.BusinessStatus;
            }
            else
            {
                item.TransportStatus = (int)response.StatusCode is >= 400 and < 500 and not 408 and not 429 ? "rejected" : "pending";
                if (item.TransportStatus == "rejected") item.BusinessStatus = "rejected";
                outcome = "http-rejected";
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { item.TransportStatus = "pending"; outcome = "timeout-unknown"; }
        catch (HttpRequestException) { item.TransportStatus = "pending"; outcome = "transport-unknown"; }
        catch (JsonException) { item.TransportStatus = "acknowledged"; item.BusinessStatus = "unknown"; outcome = "business-result-unreadable"; }
        item.Attempts++;
        item.LeaseUntil = null;
        item.NextAttemptAt = DateTimeOffset.UtcNow.AddSeconds(Math.Min(300, Math.Pow(2, Math.Min(item.Attempts, 8))));
        db.DeliveryAttempts.Add(new DeliveryAttempt { EventId = item.Id, At = DateTimeOffset.UtcNow, Outcome = outcome, HttpStatus = httpStatus });
        await db.SaveChangesAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_notify('wms_changed', {JsonSerializer.Serialize(new { warehouse = item.WarehouseId, eventId = item.Id })})", ct);
    }
}
