using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Wms.Infrastructure;

public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<WmsDb>
{
    public WmsDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<WmsDb>().UseNpgsql(Environment.GetEnvironmentVariable("WMS_DATABASE") ?? "Host=127.0.0.1;Port=55432;Database=wms_dev;Username=wms_dev").Options);
}
