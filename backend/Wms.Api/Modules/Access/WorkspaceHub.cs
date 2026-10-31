using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Wms.Modules.Access;

[Authorize]
public sealed class WorkspaceHub(AccessService access) : Hub
{
    public async Task JoinWorkspace(string warehouse)
    {
        var actor = await access.Resolve(Context.User!, warehouse, Context.ConnectionAborted);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"warehouse:{actor.WarehouseId}");
    }
}
