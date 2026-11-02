using Wms.Worker;
using Xunit;

namespace Wms.Tests;

public sealed class WorkerHeartbeatTests
{
    [Fact]
    public void WorkerHealthRejectsMissingStaleAndFailedHeartbeats()
    {
        var path = Path.Combine(Path.GetTempPath(), $"wms-heartbeat-{Guid.NewGuid():N}.json");
        try
        {
            Assert.False(WorkerHeartbeat.Healthy(path));
            WorkerHeartbeat.Write(path, "paused");
            Assert.True(WorkerHeartbeat.Healthy(path));
            WorkerHeartbeat.Write(path, "error");
            Assert.False(WorkerHeartbeat.Healthy(path));
            File.WriteAllText(path, "{\"status\":\"running\",\"updatedAt\":\"2000-01-01T00:00:00Z\"}");
            Assert.False(WorkerHeartbeat.Healthy(path));
        }
        finally { if (File.Exists(path)) File.Delete(path); }
    }
}
