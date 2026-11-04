using System.Text.Json;
using Wms.Infrastructure;
using Wms.Modules.Access;

namespace Wms.Modules.Workflow;

public static class WorkflowEndpoints
{
    public static void MapWorkflowEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/workspaces/{warehouse}/workflow").RequireAuthorization();
        group.MapGet("", async (string warehouse, [AsParameters] WorkflowQuery input, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) => Results.Ok(await new WorkflowService(db).Read(await access.Resolve(context.User, warehouse, ct), input, ct)));
        group.MapGet("/drafts", async (string warehouse, int? page, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) => Results.Ok(await new WorkflowService(db).Drafts(await access.Resolve(context.User, warehouse, ct), page ?? 1, ct)));
        group.MapGet("/drafts/{id}", async (string warehouse, string id, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) => Results.Ok(await new WorkflowService(db).ReadDraft(await access.Resolve(context.User, warehouse, ct), id, ct)));
        group.MapPost("/drafts/{id}", async (string warehouse, string id, WorkflowEdit input, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) => Results.Ok(await new WorkflowService(db).SaveDraft(await access.Resolve(context.User, warehouse, ct), id, input, ct)));
        group.MapPost("/proposals/{id}", async (string warehouse, string id, JsonElement data, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) => Results.Ok(await new WorkflowService(db).Propose(await access.Resolve(context.User, warehouse, ct), id, data, ct)));
        group.MapPost("/proposals/{id}/review", async (string warehouse, string id, WorkflowEdit input, HttpContext context, AccessService access, WmsDb db, CancellationToken ct) => Results.Ok(await new WorkflowService(db).ReviewProposal(await access.Resolve(context.User, warehouse, ct), id, input, ct)));
    }
}
