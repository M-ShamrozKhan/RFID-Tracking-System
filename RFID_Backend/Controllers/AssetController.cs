using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;
using RFID_Backend.Models;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AssetController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AssetController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/Asset (Laptops with Employee data)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Asset>>> GetAssets()
        {
            return await _context.Assets.Include(a => a.AssignedEmployee).ToListAsync();
        }

        // POST: api/Asset (Naya Laptop add karne+ RFID link karne k liye)
        [HttpPost]
        public async Task<ActionResult<Asset>> PostAsset(Asset asset)
        {
            var lastAsset = await _context.Assets.OrderByDescending(a => a.Id).FirstOrDefaultAsync();
            int nextId = lastAsset != null ? lastAsset.Id + 1 : 1;
            asset.AssetId = "LPT-" + nextId.ToString("D4");

            _context.Assets.Add(asset);
            await _context.SaveChangesAsync();

            // Log the initial creation/registration in timeline
            _context.AssetAssignmentLogs.Add(new AssetAssignmentLog {
                AssetId = asset.Id,
                Action = "Asset Registered",
                Timestamp = DateTime.UtcNow,
                EmployeeId = null
            });
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAssets), new { id = asset.Id }, asset);
        }

        // PUT: api/Asset/5 (Edit Asset Details)
        [HttpPut("{id}")]
        public async Task<IActionResult> EditAsset(int id, [FromBody] Asset updatedAsset)
        {
            var asset = await _context.Assets.FindAsync(id);
            if (asset == null) return NotFound();

            asset.RfidTagId = updatedAsset.RfidTagId;
            asset.SerialNumber = updatedAsset.SerialNumber;
            asset.BrandModel = updatedAsset.BrandModel;
            asset.PurchaseDetails = updatedAsset.PurchaseDetails;
            asset.WarrantyInfo = updatedAsset.WarrantyInfo;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/Asset/status/5 (Laptop Status update / Deactivate)
        [HttpPut("status/{id}")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] string status)
        {
            var asset = await _context.Assets.FindAsync(id);
            if (asset == null) return NotFound();

            asset.CurrentStatus = status;

            // Logic: Auto-unassign if asset is deactivated
            if (status == "Inactive" && asset.AssignedToEmployeeId != null) 
            {
                // Create Log Entry before unassigning
                var log = new AssetAssignmentLog {
                    AssetId = asset.Id,
                    EmployeeId = null,
                    Action = "System Auto-Unassigned (Asset Deactivated)",
                    Timestamp = DateTime.UtcNow
                };
                _context.AssetAssignmentLogs.Add(log);

                asset.AssignedToEmployeeId = null;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/Asset/assign/5 (Laptop ko Employee k sth jorny k liye)
        [HttpPut("assign/{assetId}")]
        public async Task<IActionResult> AssignLaptop(int assetId, [FromBody] int employeeId)
        {
            var asset = await _context.Assets.FindAsync(assetId);
            if (asset == null) return NotFound();

            string actionText = "";
            if (employeeId == 0) {
                asset.AssignedToEmployeeId = null;
                actionText = "Unassigned";
            } else {
                actionText = asset.AssignedToEmployeeId == null ? "First Assignment" : "Reassigned";
                asset.AssignedToEmployeeId = employeeId;
            }

            // Create Log Entry
            var log = new AssetAssignmentLog {
                AssetId = asset.Id,
                EmployeeId = employeeId == 0 ? null : (int?)employeeId,
                Action = actionText,
                Timestamp = DateTime.UtcNow
            };

            _context.AssetAssignmentLogs.Add(log);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/Asset/timeline/{assetCode}
        [HttpGet("timeline/{assetCode}")]
        public async Task<IActionResult> GetAssetTimeline(string assetCode)
        {
            var cleanCode = assetCode.Trim().ToLower();
            
            var asset = await _context.Assets.FirstOrDefaultAsync(a => 
                (a.AssetId != null && a.AssetId.ToLower() == cleanCode) || 
                (a.RfidTagId != null && a.RfidTagId.ToLower() == cleanCode) ||
                (a.AssetId != null && a.AssetId.ToLower().Contains(cleanCode)) ||
                (a.RfidTagId != null && a.RfidTagId.ToLower().Contains(cleanCode))
            );

            if (asset == null) return NotFound(new { message = "Asset not found." });

            var timeline = await _context.AssetAssignmentLogs
                .Include(log => log.Employee)
                .Where(log => log.AssetId == asset.Id)
                .OrderByDescending(log => log.Timestamp)
                .Select(log => new {
                    action = log.Action,
                    timestamp = log.Timestamp,
                    employeeId = log.Employee != null ? log.Employee.EmpId : null,
                    employeeName = log.Employee != null ? log.Employee.Name : null,
                    department = log.Employee != null ? log.Employee.Department : null
                })
                .ToListAsync<object>();

            // If no timeline records but it IS currently assigned, synthesize an entry
            if (!timeline.Any() && asset.AssignedToEmployeeId != null)
            {
                var currentEmp = await _context.Employees.FindAsync(asset.AssignedToEmployeeId);
                if (currentEmp != null)
                {
                    timeline.Add(new {
                        action = "Current Assignment",
                        timestamp = DateTime.UtcNow, // Or a fixed date if we don't know
                        employeeId = currentEmp.EmpId,
                        employeeName = currentEmp.Name,
                        department = currentEmp.Department
                    });
                }
            }

            return Ok(new {
                assetId = asset.AssetId,
                brandModel = asset.BrandModel,
                timeline = timeline
            });
        }

        // GET: api/Asset/history/5
        [HttpGet("history/{id}")]
        public async Task<IActionResult> GetAssetHistory(int id)
        {
            var history = await _context.MovementLogs
                .Where(m => m.AssetId == id)
                .OrderByDescending(m => m.Timestamp)
                .ToListAsync();
            return Ok(history);
        }

        // GET: api/Asset/validate/{assetCode}
        [HttpGet("validate/{assetCode}")]
        public async Task<IActionResult> ValidateAsset(string assetCode)
        {
            var cleanCode = assetCode.Trim().ToLower();
            
            // Debugging Evaluation Block
            var allAssets = await _context.Assets.Include(a => a.AssignedEmployee).ToListAsync();
            var asset = allAssets.FirstOrDefault(a => 
                (a.AssetId != null && a.AssetId.ToLower().Contains(cleanCode)) || 
                (a.RfidTagId != null && a.RfidTagId.ToLower().Contains(cleanCode))
            );

            if (asset == null) return NotFound(new { message = "Asset not found in the system." });

            var lastRequest = await _context.GatePasses
                .Where(p => p.AssetId == asset.Id)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();

            var employeeData = asset.AssignedEmployee != null ? new {
                empId = asset.AssignedEmployee.EmpId,
                name = asset.AssignedEmployee.Name,
                department = asset.AssignedEmployee.Department,
                division = asset.AssignedEmployee.Division,
                status = asset.AssignedEmployee.Status,
                designation = asset.AssignedEmployee.Designation
            } : null;

            // Logic for In/Out Status
            var now = DateTime.UtcNow;
            var activeGatePass = await _context.GatePasses
                .Where(p => p.AssetId == asset.Id && p.Status == "Approved" && p.ValidFrom <= now && p.ValidTill >= now)
                .FirstOrDefaultAsync();

            string locationStatus = activeGatePass != null ? "Outside (On GatePass)" : "Inside (Office)";

            return Ok(new {
                AssetInfo = new {
                    assetId = asset.AssetId,
                    rfidTagId = asset.RfidTagId,
                    serialNumber = asset.SerialNumber,
                    brandModel = asset.BrandModel,
                    currentStatus = asset.CurrentStatus,
                    locationStatus = locationStatus // New field
                },
                EmployeeInfo = employeeData,
                LastGatePass = lastRequest != null ? new {
                    id = lastRequest.Id,
                    status = lastRequest.Status,
                    createdAt = lastRequest.CreatedAt,
                    validFrom = lastRequest.ValidFrom,
                    validTill = lastRequest.ValidTill,
                    reason = lastRequest.Reason
                } : null
            });
        }
    }
}
