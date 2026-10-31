using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wms.Infrastructure;
using Wms.Worker;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddDbContext<WmsDb>(o => o.UseNpgsql(builder.Configuration["ConnectionStrings:Wms"] ?? throw new InvalidOperationException("Configure ConnectionStrings:Wms.")));
builder.Services.AddHttpClient("erp", c => c.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddHostedService<OutboxWorker>();
await builder.Build().RunAsync();
