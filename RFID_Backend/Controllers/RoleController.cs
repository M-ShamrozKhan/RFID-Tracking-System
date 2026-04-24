using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;
using RFID_Backend.Models;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RoleController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public RoleController(ApplicationDbContext context)
        {
            _context = context;
        }

        // POST: api/Role/reset-db (EMERGENCY RECOVERY)
        [HttpPost("reset-db")]
        public async Task<IActionResult> ResetDb()
        {
            try {
                await _context.Database.EnsureDeletedAsync();
                await _context.Database.EnsureCreatedAsync();
                // Manually trigger the seed logic (already in Program.cs but this ensures it runs)
                return Ok(new { message = "Database Reinitialized & Seeded Successfully!" });
            } catch(Exception ex) {
                return StatusCode(500, new { message = "Reset failed", error = ex.Message });
            }
        }

        // GET: api/Role (Get all roles with their current permissions)
        [HttpGet]
        public async Task<IActionResult> GetRoles()
        {
            try {
                var roles = await _context.Roles.ToListAsync();
                var allPermissions = await _context.Permissions.ToListAsync();
                var mappings = await _context.RolePermissions.ToListAsync();

                var result = roles.Select(r => new {
                    r.Id,
                    r.Name,
                    r.IsAssetAssignable,
                    assignedPermissionIds = mappings.Where(m => m.RoleId == r.Id).Select(m => m.PermissionId).ToList()
                });

                return Ok(new { roles = result, allPermissions });
            } catch(Exception ex) {
                return StatusCode(500, new { message = "Failed to fetch roles", error = ex.Message });
            }
        }

        // POST: api/Role/update (Update permissions map for a role)
        [HttpPost("update")]
        public async Task<IActionResult> UpdateRolePermissions([FromBody] UpdateRoleDto dto)
        {
            // Remove existing mappings
            var existing = await _context.RolePermissions.Where(m => m.RoleId == dto.RoleId).ToListAsync();
            _context.RolePermissions.RemoveRange(existing);

            // Add new ones
            foreach(var pId in dto.PermissionIds)
            {
                _context.RolePermissions.Add(new RolePermission { RoleId = dto.RoleId, PermissionId = pId });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Role Permissions Updated Successfully" });
        }

        // POST: api/Role/create
        [HttpPost("create")]
        public async Task<IActionResult> CreateRole([FromBody] Role role)
        {
            try {
                if (string.IsNullOrEmpty(role.Name)) return BadRequest(new { message = "Role Name is Required" });
                
                // Case-insensitive check
                if (await _context.Roles.AnyAsync(r => r.Name.ToLower() == role.Name.ToLower())) {
                    return BadRequest(new { message = $"Role '{role.Name}' already exists in the system." });
                }

                _context.Roles.Add(role);
                await _context.SaveChangesAsync();
                return Ok(role);
            } catch(Exception ex) {
                // Return exact inner exception for debugging
                return StatusCode(500, new { 
                    message = "Server database error. You may need to delete rfid.db and restart backend.", 
                    detail = ex.InnerException?.Message ?? ex.Message 
                });
            }
        }

        // POST: api/Role/rename
        [HttpPost("rename")]
        public async Task<IActionResult> RenameRole([FromBody] RenameRoleDto dto)
        {
            try {
                var role = await _context.Roles.FindAsync(dto.RoleId);
                if(role == null) return NotFound(new { message = "Role not found" });
                
                if (string.IsNullOrEmpty(dto.NewName)) return BadRequest(new { message = "New Role Name is Required" });

                // Check if new name exists elsewhere
                if (await _context.Roles.AnyAsync(r => r.Id != dto.RoleId && r.Name.ToLower() == dto.NewName.ToLower())) {
                    return BadRequest(new { message = $"Role '{dto.NewName}' already exists." });
                }

                role.Name = dto.NewName;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Role Renamed Successfully" });
            } catch(Exception ex) {
                return StatusCode(500, new { message = "Rename failed", error = ex.Message });
            }
        }

        // POST: api/Role/toggle-asset-assignable
        [HttpPost("toggle-asset-assignable")]
        public async Task<IActionResult> ToggleAssetAssignable([FromBody] ToggleAssetDto dto)
        {
            try {
                var role = await _context.Roles.FindAsync(dto.RoleId);
                if(role == null) return NotFound(new { message = "Role not found" });
                
                role.IsAssetAssignable = dto.IsEnabled;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Role Capability Updated Successfully" });
            } catch(Exception ex) {
                return StatusCode(500, new { message = "Update failed", error = ex.Message });
            }
        }

        public class UpdateRoleDto {
            public int RoleId { get; set; }
            public List<int> PermissionIds { get; set; } = new();
        }

        public class RenameRoleDto {
            public int RoleId { get; set; }
            public string NewName { get; set; }
        }

        public class ToggleAssetDto {
            public int RoleId { get; set; }
            public bool IsEnabled { get; set; }
        }
    }
}
