using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;
using RFID_Backend.Models;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EmployeeController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public EmployeeController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/Employee (Saray employees dekhne k liye + List of Assigned Assets)
        [HttpGet]
        public async Task<IActionResult> GetEmployees()
        {
            var employees = await _context.Employees.ToListAsync();
            var allAssets = await _context.Assets.ToListAsync();

            var result = employees.Select(e => new {
                id = e.Id, 
                empId = e.EmpId, 
                name = e.Name, 
                department = e.Department, 
                division = e.Division, 
                designation = e.Designation, 
                contactDetails = e.ContactDetails, 
                status = e.Status, 
                role = e.Role, 
                password = e.Password,
                divisionManagerId = e.DivisionManagerId,
                divisionManagerName = e.DivisionManagerId != null ? employees.FirstOrDefault(dm => dm.Id == e.DivisionManagerId)?.Name : "N/A",
                assignedAssets = allAssets.Where(a => a.AssignedToEmployeeId == e.Id)
                                          .Select(a => new { a.Id, a.AssetId, a.BrandModel, a.RfidTagId }).ToList()
            });

            return Ok(result);
        }

        // POST: api/Employee
        [HttpPost]
        public async Task<ActionResult<Employee>> PostEmployee([FromBody] EmployeeAssetDto dto)
        {
            var lastEmployee = await _context.Employees.OrderByDescending(e => e.Id).FirstOrDefaultAsync();
            int nextId = lastEmployee != null ? lastEmployee.Id + 1 : 1;
            string generatedEmpId = "EMP-" + nextId.ToString("D4");

            var employee = new Employee {
                EmpId = generatedEmpId, 
                Name = dto.Name, Department = dto.Department,
                Division = dto.Division ?? string.Empty, Designation = dto.Designation ?? string.Empty,
                ContactDetails = dto.ContactDetails ?? string.Empty, Status = dto.Status,
                Role = dto.Role, Password = dto.Password,
                DivisionManagerId = dto.DivisionManagerId
            };

            _context.Employees.Add(employee);
            await _context.SaveChangesAsync();

            // Assign multiple assets if selected
            if (dto.LaptopIds != null && dto.LaptopIds.Any())
            {
                foreach(var idStr in dto.LaptopIds)
                {
                    if (int.TryParse(idStr, out int assetDbId)) {
                        var asset = await _context.Assets.FindAsync(assetDbId);
                        if (asset != null) {
                            asset.AssignedToEmployeeId = employee.Id;
                        }
                    }
                }
                await _context.SaveChangesAsync();
            }

            return CreatedAtAction(nameof(GetEmployees), new { id = employee.Id }, employee);
        }

        // PUT: api/Employee/5 (Edit Profile + Multiple Asset Update)
        [HttpPut("{id}")]
        public async Task<IActionResult> EditEmployee(int id, [FromBody] EmployeeAssetDto updatedEmp)
        {
            var employee = await _context.Employees.FindAsync(id);
            if (employee == null) return NotFound();

            employee.Name = updatedEmp.Name;
            employee.Department = updatedEmp.Department;
            employee.Division = updatedEmp.Division ?? string.Empty;
            employee.Designation = updatedEmp.Designation ?? string.Empty;
            employee.ContactDetails = updatedEmp.ContactDetails ?? string.Empty;
            employee.Role = updatedEmp.Role;
            employee.Status = updatedEmp.Status;
            employee.DivisionManagerId = updatedEmp.DivisionManagerId;
            
            // SECURITY: Update password only if provided (supports Reset workflow)
            if (!string.IsNullOrEmpty(updatedEmp.Password)) {
                employee.Password = updatedEmp.Password;
            }
            
            // Re-manage Mapping: First unassign current ones
            var currentAssets = await _context.Assets.Where(a => a.AssignedToEmployeeId == id).ToListAsync();
            foreach(var a in currentAssets) a.AssignedToEmployeeId = null;

            // Then Assign the new batch
            if (updatedEmp.LaptopIds != null && updatedEmp.LaptopIds.Any()) {
                foreach(var laptopId in updatedEmp.LaptopIds) {
                    if (int.TryParse(laptopId, out int assetDbId)) {
                        var asset = await _context.Assets.FindAsync(assetDbId);
                        if (asset != null) asset.AssignedToEmployeeId = id;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/Employee/status/5 (Employee Blocking & Asset Recovery Workflow)
        [HttpPut("status/{id}")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] string status)
        {
            var employee = await _context.Employees.FindAsync(id);
            if (employee == null) return NotFound();

            employee.Status = status; 
            
            // Logics Rule: If blocked/deleted, perform Asset recovery
            if (status == "Inactive")
            {
                var assets = await _context.Assets.Where(a => a.AssignedToEmployeeId == id).ToListAsync();
                foreach(var a in assets) {
                    // Log the System-level Asset Recovery
                    _context.MovementLogs.Add(new MovementLog { 
                        AssetId = a.Id, 
                        RfidTagId = a.RfidTagId, 
                        Timestamp = DateTime.UtcNow, 
                        Direction = "In", 
                        Reason = "Employee Deactivated / Asset Recovered Automatically",
                        IsAuthorized = true
                    });

                    a.AssignedToEmployeeId = null; // Unassign from user
                    a.CurrentStatus = "Inside"; // Reset to Available
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto payload)
        {
            var user = await _context.Employees.FirstOrDefaultAsync(u => u.EmpId.ToLower() == payload.Username.ToLower());
            
            if (user == null) return Unauthorized("Employee ID not found");
            if (user.Password != payload.Password) return Unauthorized("Password Incorrect");
            if (user.Status == "Inactive") return Unauthorized("Your Account has been Blocked from System.");

            // Module 8: Dynamically inject granted RBAC Permissions based on User's Role config
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == user.Role);
            var permissions = new List<string>();
            if (role != null) {
                var permIds = await _context.RolePermissions.Where(rp => rp.RoleId == role.Id).Select(rp => rp.PermissionId).ToListAsync();
                permissions = await _context.Permissions.Where(p => permIds.Contains(p.Id)).Select(p => p.Code).ToListAsync();
            }

            // Success, send the logged in user's token, Role, AND node-level Permissions
            return Ok(new { id = user.Id, empId = user.EmpId, name = user.Name, role = user.Role, permissions = permissions });
        }

        // NEW: Bulk Import from Excel
        [HttpPost("bulk")]
        public async Task<IActionResult> BulkImport([FromBody] List<Employee> importedList)
        {
            if (importedList == null || !importedList.Any()) return BadRequest("List is empty.");

            var lastEmployee = await _context.Employees.OrderByDescending(e => e.Id).FirstOrDefaultAsync();
            int nextId = lastEmployee != null ? lastEmployee.Id + 1 : 1;

            foreach(var emp in importedList) {
                emp.EmpId = "EMP-" + nextId.ToString("D4");
                emp.Status = emp.Status ?? "Active";
                emp.Role = emp.Role ?? "Employee";
                emp.Password = emp.Password ?? "12345";
                
                _context.Employees.Add(emp);
                nextId++;
            }

            await _context.SaveChangesAsync();
            return Ok(new { count = importedList.Count });
        }
    }

    // Required schema binders
    public class EmployeeAssetDto 
    {
        public string EmpId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string Division { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        public string ContactDetails { get; set; } = string.Empty;
        public string Role { get; set; } = "Employee";
        public string Status { get; set; } = "Active";
        public string Password { get; set; } = "12345";
        public int? DivisionManagerId { get; set; }
        
        // SUPPORT FOR MULTIPLE ASSET IDS
        public List<string>? LaptopIds { get; set; }
        public string? RfidTagId { get; set; }
        public string? LaptopBrand { get; set; }
    }

    // Required schema binder
    public class LoginDto 
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
