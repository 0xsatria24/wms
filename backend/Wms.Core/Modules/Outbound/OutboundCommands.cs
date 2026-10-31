using Microsoft.EntityFrameworkCore;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Inventory;

public sealed partial class CommandProcessor
{
    private async Task Outbound(CancellationToken ct)
    {
        var p = command.Payload;
        if (command.Type == "return-stock")
        {
            var task = Doc(p.Text("task"), "return-stock");
            var o = Doc(task.Source, "order", false);
            Scan(task.ItemId);
            var q = p.Quantity();
            var destination = p.Text("destination");
            VerifyLocation(destination);
            Require(destination is "A-01" or "A-02", "scan-location", 400);
            var from = Position(task.ItemId, "Staging");
            var to = Position(task.ItemId, destination);
            var allocation = Alloc(o, from);
            Require(q <= task.Quantity - task.Actual && q <= allocation.Quantity, "remainder");
            Change(from, -q, task.Id);
            Change(to, q, task.Id);
            from.Committed -= q;
            allocation.Quantity -= q;
            task.Actual += q;
            o.Returned += q;
            return;
        }
        var order = Doc(p.Text("order"), "order");
        Require(order.Status != "cancelled", "order");
        switch (command.Type)
        {
            case "approve-order":
                Supervisor(actor);
                Require(order.Creator != actor.Id && order.Status == "pending-approval", "approval", 403);
                order.Status = "approved";
                break;
            case "release-order":
                Supervisor(actor);
                Require(order.Status == "approved", "approval");
                order.Status = "released";
                break;
            case "reject-order":
                Supervisor(actor);
                Require(order.Creator != actor.Id && order.Status == "pending-approval", "approval", 403);
                Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                order.Status = "rejected";
                order.Reason = p.Text("reason");
                break;
            case "reserve":
                {
                    Require(order.Status == "released", "approval");
                    var q = p.Quantity();
                    var source = Position(order.ItemId, p.Text("location"));
                    var outstanding = order.Quantity - order.Shipped - allocations.Where(a => a.OrderId == order.Id).Sum(a => a.Quantity);
                    Require(q <= outstanding, "remainder");
                    Require(q == outstanding || await db.Settings.Where(s => s.CompanyId == "demo").Select(s => s.PartialAllowed).SingleAsync(ct), "partial-policy");
                    Require(q <= Available(source), "shortage");
                    source.Committed += q;
                    Alloc(order, source).Quantity += q;
                    db.Entry(order).Property(o => o.Version).IsModified = true;
                    break;
                }
            case "pick":
                {
                    Require(order.Status == "released", "approval");
                    var q = p.Quantity();
                    Scan(order.ItemId);
                    VerifyLocation(p.Text("location"));
                    var source = Position(order.ItemId, p.Text("location"));
                    var target = Position(order.ItemId, "Staging");
                    var fromAlloc = Alloc(order, source);
                    var toAlloc = Alloc(order, target);
                    Require(fromAlloc.Status == "active" && q <= fromAlloc.Quantity && q <= source.OnHand, "remainder");
                    Require(q == fromAlloc.Quantity || !string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                    Change(source, -q, order.Id);
                    Change(target, q, order.Id);
                    source.Committed -= q;
                    target.Committed += q;
                    fromAlloc.Quantity -= q;
                    toAlloc.Quantity += q;
                    order.Picked += q;
                    break;
                }
            case "ship":
                {
                    Require(p.TryGetProperty("packingVerified", out var verified) && verified.ValueKind == System.Text.Json.JsonValueKind.True, "packing-verification", 400);
                    var q = p.Quantity();
                    Scan(order.ItemId);
                    var source = Position(order.ItemId, "Staging");
                    var allocation = Alloc(order, source);
                    Require(allocation.Status == "active" && q <= allocation.Quantity && q <= source.OnHand, "remainder");
                    Require(q == order.Quantity - order.Shipped || await db.Settings.Where(s => s.CompanyId == "demo").Select(s => s.PartialAllowed).SingleAsync(ct), "partial-policy");
                    Change(source, -q, order.Id);
                    source.Committed -= q;
                    allocation.Quantity -= q;
                    order.Shipped += q;
                    break;
                }
            case "cancel":
                {
                    Supervisor(actor);
                    Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                    foreach (var allocation in allocations.Where(a => a.OrderId == order.Id && a.Quantity > 0))
                    {
                        var position = positions.Single(p => p.Id == allocation.PositionId);
                        var location = locations.Single(l => l.Id == position.LocationId);
                        Require(!location.Frozen, "frozen");
                        if (location.Code == "Staging")
                            AddDoc("return-stock", order.ItemId, allocation.Quantity, order.Id).Status = "ready";
                        else
                        {
                            position.Committed -= allocation.Quantity;
                            allocation.Quantity = 0;
                            allocation.Status = "closed";
                        }
                    }
                    order.Status = "cancelled";
                    order.Reason = p.Text("reason");
                    break;
                }
        }
    }
}
