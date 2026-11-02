using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wms.Infrastructure;
using Wms.Worker;

if (args.Contains("--healthcheck", StringComparer.Ordinal))
{
    Environment.ExitCode = WorkerHeartbeat.Healthy(Environment.GetEnvironmentVariable("Health__HeartbeatPath") ?? WorkerHeartbeat.DefaultPath) ? 0 : 1;
    return;
}
var builder = Host.CreateApplicationBuilder(args);
if (builder.Configuration["deployment-config"] is { } deploymentConfig)
    builder.Configuration.AddJsonFile(Path.GetFullPath(deploymentConfig), optional: false, reloadOnChange: false);
builder.Services.AddWindowsService(options => options.ServiceName = "InventoryWms.Worker");
builder.Services.AddDbContext<WmsDb>(o => o.UseNpgsql(builder.Configuration["ConnectionStrings:Wms"] ?? throw new InvalidOperationException("Configure ConnectionStrings:Wms.")));
builder.Services.AddHttpClient("erp", c => c.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHostedService<OutboxWorker>();
await builder.Build().RunAsync();
