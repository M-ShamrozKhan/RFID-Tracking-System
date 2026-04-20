using Microsoft.EntityFrameworkCore;
using RFID_Backend.Models;

namespace RFID_Backend.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<Employee> Employees { get; set; }
        public DbSet<Asset> Assets { get; set; }
        public DbSet<GatePass> GatePasses { get; set; }
        public DbSet<MovementLog> MovementLogs { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<AssetAssignmentLog> AssetAssignmentLogs { get; set; }

        public DbSet<Role> Roles { get; set; }
        public DbSet<Permission> Permissions { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            // Unique Constraints
            modelBuilder.Entity<Employee>().HasIndex(e => e.EmpId).IsUnique();
            modelBuilder.Entity<Asset>().HasIndex(a => a.AssetId).IsUnique();
            modelBuilder.Entity<Asset>().HasIndex(a => a.RfidTagId).IsUnique();
        }
    }
}
