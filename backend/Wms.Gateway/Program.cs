using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using Wms.Gateway;

var builder = Host.CreateApplicationBuilder(args);
using var host = builder.Build();
var config = builder.Configuration;
var logger = host.Services.GetService(typeof(ILoggerFactory)) as ILoggerFactory;
var log = logger!.CreateLogger("RfidGateway");
var spool = new ObservationSpool(config["Gateway:Spool"] ?? "data/observations.sqlite");
await spool.Initialize(CancellationToken.None);
log.LogInformation("RFID SDK adapter is not configured. No reader observations will be invented. SQLite delivery spool is available.");
var endpoint = config["Gateway:ApiEndpoint"];
var tokenEndpoint = config["Gateway:TokenEndpoint"];
if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var api) || api.Scheme != "https" || !Uri.TryCreate(tokenEndpoint, UriKind.Absolute, out var tokenUri) || tokenUri.Scheme != "https")
{
    log.LogInformation("Gateway delivery is unconfigured. Pending observations remain in SQLite.");
    await host.RunAsync();
    return;
}
using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
using var stopping = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stopping.Cancel(); };
while (!stopping.IsCancellationRequested)
{
    try
    {
        var batch = await spool.Pending(stopping.Token);
        if (batch.Count > 0)
        {
            using var tokenResponse = await client.PostAsync(tokenUri, new FormUrlEncodedContent(new Dictionary<string, string> { { "grant_type", "client_credentials" }, { "client_id", config["Gateway:ClientId"] ?? "" }, { "client_secret", config["Gateway:ClientSecret"] ?? "" }, { "scope", config["Gateway:Scope"] ?? "wms.observations" } }), stopping.Token);
            tokenResponse.EnsureSuccessStatusCode();
            using var token = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(stopping.Token));
            var bearer = token.RootElement.GetProperty("access_token").GetString();
            foreach (var observation in batch)
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, api);
                request.Headers.Authorization = new("Bearer", bearer);
                request.Content = new StringContent(observation.Payload, System.Text.Encoding.UTF8, "application/json");
                using var response = await client.SendAsync(request, stopping.Token);
                if (response.IsSuccessStatusCode)
                    await spool.Acknowledge(observation.Id, false, stopping.Token);
                else if ((int)response.StatusCode == 409)
                    await spool.Acknowledge(observation.Id, true, stopping.Token);
            }
        }
    }
    catch (OperationCanceledException) when (stopping.IsCancellationRequested) { break; }
    catch (Exception error) { log.LogWarning("Observation delivery failed ({ExceptionType}); original IDs and payloads remain queued.", error.GetType().Name); }
    try
    {
        await Task.Delay(TimeSpan.FromSeconds(3), stopping.Token);
    }
    catch (OperationCanceledException) { break; }
}
