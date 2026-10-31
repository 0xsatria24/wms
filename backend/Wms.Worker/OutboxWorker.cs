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
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var configured = Uri.TryCreate(configuration["Erp:Endpoint"], UriKind.Absolute, out var endpoint) && endpoint.Scheme == "https" && configuration.GetValue<bool>("Erp:SupportsIdempotency") && configuration["Erp:Protocol"] == "wms-v1";
        if (!configured)
        {
            logger.LogInformation("ERP adapter is unconfigured. Committed outbox events remain queued.");
            await Task.Delay(Timeout.Infinite, stoppingToken);
            return;
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Dispatch(endpoint!, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogWarning("Outbox processing failed ({ExceptionType}); events remain retryable.", error.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        }
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
                item.BusinessStatus = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("businessStatus", out var result) && result.GetString() == "accepted" ? "accepted" : "pending-confirmation";
                outcome = item.BusinessStatus;
            }
            else
            {
                item.TransportStatus = "pending";
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
