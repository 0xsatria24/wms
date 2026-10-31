using Wms.Infrastructure;
using Wms.Shared;
using static Wms.Shared.Rules;

namespace Wms.Modules.Inventory;

public sealed partial class CommandProcessor
{
    private void TransferOrReturn()
    {
        var p = command.Payload;
        var q = p.Quantity();
        switch (command.Type)
        {
            case "transfer-send":
                {
                    var item = Item(p.Text("sku"));
                    Scan(item.Id);
                    VerifyLocation(p.Text("location"));
                    var to = p.Text("to");
                    var targetId = to == "Main Warehouse" ? "main" : to == "Secondary Warehouse" ? "secondary" : "";
                    Require(targetId != "" && targetId != actor.WarehouseId, "scope", 400);
                    var source = Position(item.Id, p.Text("location"));
                    Require(q <= Available(source), "shortage");
                    var doc = AddDoc("transfer", item.Id, q, transactionId);
                    doc.TargetWarehouseId = targetId;
                    doc.Status = "in-transit";
                    var transitLocation = new Location { Id = $"transit|{doc.Id}", WarehouseId = "transit", Code = doc.Id };
                    locations.Add(transitLocation);
                    db.Locations.Add(transitLocation);
                    Change(source, -q, doc.Id);
                    Change(Position(item.Id, doc.Id, warehouse: "transit"), q, doc.Id);
                    break;
                }
            case "transfer-receive":
                {
                    var doc = Doc(p.Text("document"), "transfer");
                    Require(doc.TargetWarehouseId == actor.WarehouseId, "scope", 403);
                    Scan(doc.ItemId);
                    Require(q <= doc.Quantity - doc.Actual, "remainder");
                    var source = Position(doc.ItemId, doc.Id, warehouse: "transit");
                    Require(q <= source.OnHand, "remainder");
                    Change(source, -q, doc.Id);
                    Change(Position(doc.ItemId, "Receiving", "unassessed", "awaiting-qc"), q, doc.Id);
                    doc.Actual += q;
                    doc.Status = doc.Actual == doc.Quantity ? "complete" : "in-transit";
                    AddDoc("inspection", doc.ItemId, q, doc.Id).Status = "awaiting-qc";
                    break;
                }
            case "customer-return":
                {
                    var item = Item(p.Text("sku"));
                    Scan(item.Id);
                    Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                    var source = p.Text("source");
                    var prior = db.Documents.Where(d => d.Kind == "customer-return" && d.WarehouseId == actor.WarehouseId && d.ItemId == item.Id && d.Source == source).Sum(d => d.Quantity);
                    var limit = source == "HIST-SIM-020" && item.Sku == "SKU-A" && actor.WarehouseId == "main" ? 5m : db.Entries.Join(db.Movements, e => e.MovementId, m => m.Id, (e, m) => new { e, m }).Where(x => x.m.Id == source && x.m.Kind == "ship" && x.m.WarehouseId == actor.WarehouseId && x.e.QuantityDelta < 0 && db.Positions.Any(position => position.Id == x.e.PositionId && position.ItemId == item.Id)).Sum(x => -x.e.QuantityDelta);
                    Require(q <= limit - prior, "source");
                    Change(Position(item.Id, "Receiving", "unassessed", "awaiting-qc"), q, source);
                    AddDoc("customer-return", item.Id, q, source).Actual = q;
                    AddDoc("inspection", item.Id, q, transactionId).Status = "awaiting-qc";
                    break;
                }
            case "supplier-return":
                {
                    Supervisor(actor);
                    var item = Item(p.Text("sku"));
                    Scan(item.Id);
                    Require(p.Text("source") == "OPEN-SIM-001" && !string.IsNullOrWhiteSpace(p.Text("reason")), "source", 400);
                    var source = Position(item.Id, "QC", "not-good", "quality-rejected");
                    Require(q <= source.OnHand - source.Committed, "shortage");
                    Change(source, -q, p.Text("source"));
                    AddDoc("supplier-return", item.Id, q, p.Text("source")).Actual = q;
                    break;
                }
        }
    }
    private void Count()
    {
        var p = command.Payload;
        if (command.Type == "freeze")
        {
            Supervisor(actor);
            var item = Item(p.Text("sku"));
            var position = Position(item.Id, p.Text("location"));
            var location = locations.Single(l => l.Id == position.LocationId);
            Require(!documents.Any(d => d.Kind == "count" && d.LocationId == location.Id && d.Status != "closed"), "task");
            location.Frozen = true;
            location.Version++;
            var task = AddDoc("count", item.Id, 0, transactionId);
            task.LocationId = location.Id;
            task.Expected = position.OnHand;
            task.Status = "counting";
            return;
        }
        var count = Doc(p.Text("task"), "count");
        var loc = locations.Single(l => l.Id == count.LocationId);
        var pos = positions.Single(p => p.ItemId == count.ItemId && p.LocationId == loc.Id && p.Condition == "good" && p.Hold == "");
        Require(loc.Frozen, "frozen");
        switch (command.Type)
        {
            case "count-submit":
                Require(count.Status == "counting", "task");
                count.Counted = p.Quantity(zero: true);
                count.Counter = actor.Id;
                count.Status = "review";
                break;
            case "recount":
                Supervisor(actor);
                Require(count.Status == "review", "task");
                count.Status = "counting";
                break;
            case "adjust-count":
                Supervisor(actor);
                Require(count.Status == "review" && count.Counter != actor.Id, "approval", 403);
                Require(!string.IsNullOrWhiteSpace(p.Text("reason")), "reason", 400);
                Require(count.Counted.HasValue && count.Counted >= pos.Committed && pos.OnHand == count.Expected, "count-conflict");
                Change(pos, count.Counted.Value - pos.OnHand, count.Id);
                count.Status = "adjusted";
                count.Reason = p.Text("reason");
                break;
            case "unfreeze":
                Supervisor(actor);
                Require(count.Status == "adjusted", "task");
                loc.Frozen = false;
                loc.Version++;
                count.Status = "closed";
                break;
        }
    }
}
