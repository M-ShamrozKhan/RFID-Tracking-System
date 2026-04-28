using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;
using RFID_Backend.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

// Configure CORS for React Vite Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
});

// Setup Sqlite Database Context for Instant use
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// Auto-create SQLite Database if it does not exist 
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var context = services.GetRequiredService<ApplicationDbContext>();
    
    // Surgical Sync: If the DB file exists but is missing the RBAC tables, EnsureCreated() fails silently.
    // We must manually check any RBAC table and force a rebuild if it's missing.
    try {
        _ = context.Roles.Any(); // Test if the table exists
    } catch {
        context.Database.EnsureDeleted();
    }
    context.Database.EnsureCreated();

    // Hot-Inject IsAssetAssignable column without wiping database
    try {
        context.Database.ExecuteSqlRaw("ALTER TABLE Roles ADD COLUMN IsAssetAssignable BOOLEAN DEFAULT 0;");
    } catch {
        // Column probably already exists, ignore
    }

    // Hot-Inject DivisionManagerId column without wiping database
    try {
        context.Database.ExecuteSqlRaw("ALTER TABLE Employees ADD COLUMN DivisionManagerId INTEGER;");
    } catch {
        // Column probably already exists, ignore
    }

    // Hot-Inject Timeline Table without wiping database
    try {
        _ = context.AssetAssignmentLogs.Any();
    } catch {
        // Fallback injection for existing SQLite DBs migrating to new schema feature
        context.Database.ExecuteSqlRaw("CREATE TABLE IF NOT EXISTS AssetAssignmentLogs (Id INTEGER PRIMARY KEY AUTOINCREMENT, AssetId INTEGER NOT NULL, EmployeeId INTEGER, Action TEXT NOT NULL, Timestamp TEXT NOT NULL, FOREIGN KEY(AssetId) REFERENCES Assets(Id), FOREIGN KEY(EmployeeId) REFERENCES Employees(Id));");
    }
    context.Database.EnsureCreated();

    // Genesis Baseline Sync: Retrospectively inject initial 'Assigned' states for assets mapped BEFORE the new Timeline engine was implemented.
    var preExistingAssignedAssets = context.Assets.Where(a => a.AssignedToEmployeeId != null).ToList();
    foreach(var asset in preExistingAssignedAssets) {
        bool hasLog = context.AssetAssignmentLogs.Any(log => log.AssetId == asset.Id);
        if(!hasLog) {
            context.AssetAssignmentLogs.Add(new RFID_Backend.Models.AssetAssignmentLog {
                AssetId = asset.Id,
                EmployeeId = asset.AssignedToEmployeeId,
                Action = "Assigned",
                // Push the timestamp artificially to Midnight to designate it as a retroactively backfilled baseline.
                Timestamp = DateTime.UtcNow.Date 
            });
        }
    }
    context.SaveChanges();

    // Module 8: RBAC SEEDING (Surgical Node-Based Approach)
    if (!context.Permissions.Any())
    {
        var nodes = new[] { "EMPLOYEES", "ASSETS", "GATEPASSES", "REPORTS", "DASHBOARD", "RFID_CONFIG", "RBAC" };
        var permissionList = new List<RFID_Backend.Models.Permission>();

        foreach(var node in nodes) {
            permissionList.Add(new RFID_Backend.Models.Permission { Name = $"View {node}", Code = $"{node}_VIEW" });
            permissionList.Add(new RFID_Backend.Models.Permission { Name = $"Edit {node}", Code = $"{node}_EDIT" });
        }

        context.Permissions.AddRange(permissionList);
        context.SaveChanges();
    }

    // Hot-Inject MYTEAM permission for live databases that were created before MYTEAM existed
    if (!context.Permissions.Any(p => p.Code == "MYTEAM_VIEW"))
    {
        context.Permissions.Add(new RFID_Backend.Models.Permission { Name = "View MYTEAM", Code = "MYTEAM_VIEW" });
        context.Permissions.Add(new RFID_Backend.Models.Permission { Name = "Edit MYTEAM", Code = "MYTEAM_EDIT" });
        context.SaveChanges();
    }

    // Hot-Inject VALIDATE_ASSET and ASSET_TIMELINE permissions
    if (!context.Permissions.Any(p => p.Code == "VALIDATE_ASSET_VIEW"))
    {
        context.Permissions.Add(new RFID_Backend.Models.Permission { Name = "View VALIDATE_ASSET", Code = "VALIDATE_ASSET_VIEW" });
        context.Permissions.Add(new RFID_Backend.Models.Permission { Name = "Edit VALIDATE_ASSET", Code = "VALIDATE_ASSET_EDIT" });
        context.Permissions.Add(new RFID_Backend.Models.Permission { Name = "View ASSET_TIMELINE", Code = "ASSET_TIMELINE_VIEW" });
        context.Permissions.Add(new RFID_Backend.Models.Permission { Name = "Edit ASSET_TIMELINE", Code = "ASSET_TIMELINE_EDIT" });
        context.SaveChanges();
    }

    if (!context.Roles.Any())
    {
        var r_super = new RFID_Backend.Models.Role { Name = "SuperAdmin", Description = "Full System Oversight" };
        var r_security = new RFID_Backend.Models.Role { Name = "SecurityAdmin", Description = "Gate & Movement Management" };
        var r_it = new RFID_Backend.Models.Role { Name = "ITAssetAdmin", Description = "Hardware & RFID Control" };
        var r_div = new RFID_Backend.Models.Role { Name = "DivisionalManager", Description = "Department Approvals" };
        var r_hr = new RFID_Backend.Models.Role { Name = "HR", Description = "Personnel Management" };
        var r_guard = new RFID_Backend.Models.Role { Name = "Guard", Description = "Search & Verify Only" };

        context.Roles.AddRange(r_super, r_security, r_it, r_div, r_hr, r_guard);
        context.SaveChanges();

        // SuperAdmin gets EVERYTHING
        var permissionList = context.Permissions.ToList();
        foreach(var p in permissionList) {
            context.RolePermissions.Add(new RFID_Backend.Models.RolePermission { RoleId = r_super.Id, PermissionId = p.Id });
        }

        // Divisional Manager (Approval Power)
        var dmPerms = permissionList.Where(p => p.Code.Contains("GATEPASS") || p.Code.Contains("ASSETS"));
        foreach(var p in dmPerms) {
            context.RolePermissions.Add(new RFID_Backend.Models.RolePermission { RoleId = r_div.Id, PermissionId = p.Id });
        }

        context.SaveChanges();
    }

    // Default Assets Generator (for demo/instant use)
    if (!context.Assets.Any())
    {
        context.Assets.AddRange(
            new RFID_Backend.Models.Asset { AssetId = "LPT-1001", BrandModel = "Dell Latitude 5420", RfidTagId = "RFID-001", CurrentStatus = "Inside" },
            new RFID_Backend.Models.Asset { AssetId = "LPT-1002", BrandModel = "HP EliteBook 840", RfidTagId = "RFID-002", CurrentStatus = "Inside" },
            new RFID_Backend.Models.Asset { AssetId = "LPT-1003", BrandModel = "MacBook Pro M2", RfidTagId = "RFID-003", CurrentStatus = "Inside" }
        );
        context.SaveChanges();
    }

    // Default Super Admin Generator
    if (!context.Employees.Any(e => e.EmpId == "admin"))
    {
        context.Employees.Add(new RFID_Backend.Models.Employee {
            EmpId = "admin", 
            Name = "System Director", 
            Department = "IT Control", 
            Role = "SuperAdmin", 
            Password = "admin", 
            Status = "Active"
        });
        context.SaveChanges();
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();
app.MapHub<AlertHub>("/alerthub");
app.MapFallbackToFile("index.html");

app.Run();
