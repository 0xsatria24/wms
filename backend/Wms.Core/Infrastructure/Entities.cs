namespace Wms.Infrastructure;

public sealed class Warehouse
{
    public string Id { get; set; } = "";
    public string CompanyId { get; set; } = "demo";
    public string Name { get; set; } = "";
}
public sealed class Principal
{
    public string Id { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Issuer { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public bool Verified
    {
        get; set;
    }
    public string Status { get; set; } = "pending";
}
public sealed class AccessGrant
{
    public string PrincipalId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string Role { get; set; } = "operator";
}
public sealed class Location
{
    public string Id { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string Code { get; set; } = "";
    public bool Pickable
    {
        get; set;
    }
    public bool Frozen
    {
        get; set;
    }
    public long Version
    {
        get; set;
    }
}
public sealed class Item
{
    public string Id { get; set; } = "";
    public string CompanyId { get; set; } = "demo";
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string Barcode { get; set; } = "";
    public string Category { get; set; } = "General goods";
    public string Unit { get; set; } = "units";
    public decimal ConversionFactor { get; set; } = 1m;
    public string Dimensions { get; set; } = "";
    public string Weight { get; set; } = "";
    public bool Active { get; set; } = true;
    public string? Image
    {
        get; set;
    }
    public long Version
    {
        get; set;
    }
}
public sealed class StockPosition
{
    public string Id { get; set; } = "";
    public string CompanyId { get; set; } = "demo";
    public string OwnerId { get; set; } = "demo-own";
    public string ItemId { get; set; } = "";
    public string LocationId { get; set; } = "";
    public string Condition { get; set; } = "good";
    public string Hold { get; set; } = "";
    public decimal OnHand
    {
        get; set;
    }
    public decimal Committed
    {
        get; set;
    }
    public long Version
    {
        get; set;
    }
}
public sealed class OperationalDocument
{
    public string Id { get; set; } = "";
    public string CompanyId { get; set; } = "demo";
    public string Kind { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string? TargetWarehouseId
    {
        get; set;
    }
    public string ItemId { get; set; } = "";
    public string Source { get; set; } = "";
    public string Creator { get; set; } = "";
    public string Status { get; set; } = "draft";
    public decimal Quantity
    {
        get; set;
    }
    public decimal Actual
    {
        get; set;
    }
    public decimal Picked
    {
        get; set;
    }
    public decimal Shipped
    {
        get; set;
    }
    public decimal Returned
    {
        get; set;
    }
    public string LocationId { get; set; } = "";
    public decimal? Expected
    {
        get; set;
    }
    public decimal? Counted
    {
        get; set;
    }
    public string Counter { get; set; } = "";
    public string Reason { get; set; } = "";
    public long Version
    {
        get; set;
    }
}
public sealed class Allocation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OrderId { get; set; } = "";
    public string PositionId { get; set; } = "";
    public decimal Quantity
    {
        get; set;
    }
    public string Status { get; set; } = "active";
}
public sealed class StockMovement
{
    public string Id { get; set; } = "";
    public string CompanyId { get; set; } = "demo";
    public string WarehouseId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Source { get; set; } = "";
    public string Actor { get; set; } = "";
    public string Reason { get; set; } = "";
    public DateTimeOffset OccurredAt
    {
        get; set;
    }
    public DateTimeOffset PostedAt
    {
        get; set;
    }
}
public sealed class StockEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string MovementId { get; set; } = "";
    public string PositionId { get; set; } = "";
    public decimal QuantityDelta
    {
        get; set;
    }
    public string Unit { get; set; } = "units";
    public decimal ConversionFactor { get; set; } = 1m;
}
public sealed class IdempotencyRequest
{
    public string ScopeKey { get; set; } = "";
    public string PrincipalId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string PayloadHash { get; set; } = "";
    public string ResultJson { get; set; } = "";
    public DateTimeOffset CreatedAt
    {
        get; set;
    }
}
public sealed class AuditRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TransactionId { get; set; } = "";
    public string WarehouseId { get; set; } = "";
    public string PrincipalId { get; set; } = "";
    public string Action { get; set; } = "";
    public string DetailJson { get; set; } = "{}";
    public DateTimeOffset PostedAt
    {
        get; set;
    }
}
public sealed class OutboxEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CompanyId { get; set; } = "demo";
    public string WarehouseId { get; set; } = "";
    public string AggregateId { get; set; } = "";
    public long AggregateVersion
    {
        get; set;
    }
    public string Kind { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public string TransportStatus { get; set; } = "pending";
    public string BusinessStatus { get; set; } = "unknown";
    public int Attempts
    {
        get; set;
    }
    public DateTimeOffset CreatedAt
    {
        get; set;
    }
    public DateTimeOffset NextAttemptAt
    {
        get; set;
    }
    public DateTimeOffset? LeaseUntil
    {
        get; set;
    }
}
public sealed class DeliveryAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EventId
    {
        get; set;
    }
    public DateTimeOffset At
    {
        get; set;
    }
    public string Outcome { get; set; } = "";
    public int? HttpStatus
    {
        get; set;
    }
}
public sealed class Observation
{
    public Guid Id
    {
        get; set;
    }
    public string WarehouseId { get; set; } = "";
    public string ReaderId { get; set; } = "";
    public string SessionId { get; set; } = "";
    public string TagCode { get; set; } = "";
    public string PayloadHash { get; set; } = "";
    public DateTimeOffset ObservedAt
    {
        get; set;
    }
    public DateTimeOffset ReceivedAt
    {
        get; set;
    }
}
public sealed class CompanySettings
{
    public string CompanyId { get; set; } = "demo";
    public bool PartialAllowed
    {
        get; set;
    }
}
public sealed class SupportingRecord
{
    public string Id { get; set; } = "";
    public string CompanyId { get; set; } = "demo";
    public string WarehouseId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public long Version
    {
        get; set;
    }
}
