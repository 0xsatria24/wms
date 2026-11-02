using Microsoft.EntityFrameworkCore;

namespace Wms.Infrastructure;

public sealed class WmsDb(DbContextOptions<WmsDb> options) : DbContext(options)
{
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<Principal> Principals => Set<Principal>();
    public DbSet<AccessGrant> AccessGrants => Set<AccessGrant>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<StockPosition> Positions => Set<StockPosition>();
    public DbSet<OperationalDocument> Documents => Set<OperationalDocument>();
    public DbSet<Allocation> Allocations => Set<Allocation>();
    public DbSet<StockMovement> Movements => Set<StockMovement>();
    public DbSet<StockEntry> Entries => Set<StockEntry>();
    public DbSet<IdempotencyRequest> Requests => Set<IdempotencyRequest>();
    public DbSet<AuditRecord> Audit => Set<AuditRecord>();
    public DbSet<OutboxEvent> Outbox => Set<OutboxEvent>();
    public DbSet<DeliveryAttempt> DeliveryAttempts => Set<DeliveryAttempt>();
    public DbSet<Observation> Observations => Set<Observation>();
    public DbSet<CompanySettings> Settings => Set<CompanySettings>();
    public DbSet<SupportingRecord> SupportingRecords => Set<SupportingRecord>();
    protected override void OnModelCreating(ModelBuilder m)
    {
        m.Entity<Warehouse>().HasIndex(x => new { x.CompanyId, x.Name }).IsUnique();
        m.Entity<Principal>().HasIndex(x => new { x.Issuer, x.Subject }).IsUnique();
        m.Entity<AccessGrant>().HasKey(x => new { x.PrincipalId, x.WarehouseId });
        m.Entity<AccessGrant>().HasOne<Principal>().WithMany().HasForeignKey(x => x.PrincipalId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<AccessGrant>().HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Location>().HasIndex(x => new { x.WarehouseId, x.Code }).IsUnique();
        m.Entity<Location>().HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Item>().HasIndex(x => new { x.CompanyId, x.Sku }).IsUnique();
        m.Entity<Item>().HasIndex(x => new { x.CompanyId, x.Barcode }).IsUnique();
        m.Entity<Item>().HasIndex(x => new { x.CompanyId, x.Name, x.Sku });
        m.Entity<StockPosition>().ToTable("StockPositions", b => b.HasCheckConstraint("CK_Balances", "\"OnHand\" >= 0 AND \"Committed\" >= 0 AND \"Committed\" <= \"OnHand\""));
        m.Entity<StockPosition>().HasIndex(x => new { x.CompanyId, x.OwnerId, x.ItemId, x.LocationId, x.Condition, x.Hold }).IsUnique();
        m.Entity<StockPosition>().HasOne<Item>().WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<StockPosition>().HasOne<Location>().WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<OperationalDocument>().ToTable("OperationalDocuments", b => b.HasCheckConstraint("CK_DocumentQuantities", "\"Quantity\" >= 0 AND \"Actual\" >= 0 AND \"Actual\" <= \"Quantity\""));
        m.Entity<OperationalDocument>().HasOne<Item>().WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<OperationalDocument>().HasIndex(x => new { x.WarehouseId, x.Kind, x.Status });
        m.Entity<OperationalDocument>().HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Allocation>().ToTable("Allocations", b => b.HasCheckConstraint("CK_AllocationQuantity", "\"Quantity\" >= 0"));
        m.Entity<Allocation>().HasIndex(x => new { x.OrderId, x.PositionId }).IsUnique();
        m.Entity<Allocation>().HasOne<OperationalDocument>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<Allocation>().HasOne<StockPosition>().WithMany().HasForeignKey(x => x.PositionId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<StockEntry>().HasOne<StockMovement>().WithMany().HasForeignKey(x => x.MovementId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<StockMovement>().HasIndex(x => new { x.WarehouseId, x.PostedAt });
        m.Entity<StockEntry>().HasOne<StockPosition>().WithMany().HasForeignKey(x => x.PositionId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<IdempotencyRequest>().HasKey(x => x.ScopeKey);
        m.Entity<IdempotencyRequest>().Property(x => x.ResultJson).HasColumnType("jsonb");
        m.Entity<AuditRecord>().Property(x => x.DetailJson).HasColumnType("jsonb");
        m.Entity<OutboxEvent>().Property(x => x.PayloadJson).HasColumnType("jsonb");
        m.Entity<OutboxEvent>().HasIndex(x => new { x.TransportStatus, x.NextAttemptAt });
        m.Entity<OutboxEvent>().HasIndex(x => new { x.BusinessStatus, x.CreatedAt });
        m.Entity<DeliveryAttempt>().HasOne<OutboxEvent>().WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
        m.Entity<CompanySettings>().HasKey(x => x.CompanyId);
        m.Entity<SupportingRecord>().Property(x => x.PayloadJson).HasColumnType("jsonb");
        foreach (var entity in m.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties())
            {
                if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
                {
                    property.SetPrecision(18);
                    property.SetScale(6);
                }
                if (property.Name == "Version")
                    property.IsConcurrencyToken = true;
            }
    }
}
