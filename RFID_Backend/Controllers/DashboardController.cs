using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;
using RFID_Backend.Models;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DashboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var now = DateTime.UtcNow;
            var assets = await _context.Assets
                .Include(a => a.AssignedEmployee)
                .ToListAsync();
            
            var passes = await _context.GatePasses
                .Include(p => p.Asset)
                .Include(p => p.Employee)
                .ToListAsync();

            // 1. Inside Facilities
            var insideAssets = assets.Where(a => a.CurrentStatus == "Inside" && a.AssignedToEmployeeId != null).ToList();

            // 2. Outside (With active pass)
            var outsideAssets = assets.Where(a => a.CurrentStatus == "Outside").ToList();

            // 3. Overdue
            var overdueAssets = passes.Where(p => 
                p.Status == "Approved" && 
                p.ValidTill < now && 
                p.Asset != null && 
                p.Asset.CurrentStatus == "Outside"
            ).ToList();

            var allLogs = await _context.MovementLogs.OrderByDescending(l => l.Timestamp).ToListAsync();
            var logsFeed = allLogs.Take(50).ToList();
            var unauthorizedCount = allLogs.Count(l => !l.IsAuthorized);

            return Ok(new {
                InsideCount = insideAssets.Count,
                OutsideCount = outsideAssets.Count,
                OverdueCount = overdueAssets.Count,
                UnauthorizedCount = unauthorizedCount,
                
                Drilldown = new {
                    Inside = insideAssets.Select(a => {
                        var lastLog = allLogs.FirstOrDefault(l => l.RfidTagId == a.RfidTagId);
                        var lastPass = passes.Where(p => p.AssetId == a.Id).OrderByDescending(p => p.CreatedAt).FirstOrDefault();
                        return new {
                            EmployeeSysId = a.AssignedEmployee?.EmpId ?? "N/A",
                            EmployeeName = a.AssignedEmployee?.Name ?? "N/A",
                            Department = a.AssignedEmployee?.Department ?? "N/A",
                            Division = a.AssignedEmployee?.Division ?? "N/A",
                            AssetId = a.AssetId,
                            SerialNumber = a.SerialNumber,
                            RfidTagId = a.RfidTagId,
                            LastGateName = lastLog?.GateId ?? "Manual Entry",
                            LastMovementTime = lastLog?.Timestamp,
                            GatePassStatus = lastPass?.Status ?? "Not Required",
                            CurrentStatus = a.CurrentStatus
                        };
                    }),
                    Outside = outsideAssets.Select(a => {
                        var activePass = passes.FirstOrDefault(p => p.AssetId == a.Id && p.Status == "Approved");
                        var lastLog = allLogs.FirstOrDefault(l => l.RfidTagId == a.RfidTagId && l.Direction == "Out");
                        return new {
                            EmployeeSysId = a.AssignedEmployee?.EmpId ?? "N/A",
                            EmployeeName = a.AssignedEmployee?.Name ?? "N/A",
                            Department = a.AssignedEmployee?.Department ?? "N/A",
                            Division = a.AssignedEmployee?.Division ?? "N/A",
                            ContactNumber = a.AssignedEmployee?.ContactDetails ?? "N/A",
                            AssetId = a.AssetId,
                            SerialNumber = a.SerialNumber,
                            RfidTagId = a.RfidTagId,
                            ExitGateName = lastLog?.GateId ?? "Manual Entry",
                            ExitTime = lastLog?.Timestamp,
                            GatePassValidTill = activePass?.ValidTill,
                            ApprovedBy = "Manager",
                            ApprovalDate = activePass?.ValidFrom,
                            CurrentStatus = a.CurrentStatus
                        };
                    }),
                    Overdue = overdueAssets.Select(p => {
                        var lastLog = allLogs.FirstOrDefault(l => l.RfidTagId == p.Asset?.RfidTagId && l.Direction == "Out");
                        var overdueDurationHours = (now - p.ValidTill).TotalHours;
                        string riskLevel = overdueDurationHours > 24 ? "Critical" : (overdueDurationHours > 4 ? "Medium Risk" : "Warning");
                        return new {
                            EmployeeSysId = p.Employee?.EmpId ?? "N/A",
                            EmployeeName = p.Employee?.Name ?? "N/A",
                            Department = p.Employee?.Department ?? "N/A",
                            Division = p.Employee?.Division ?? "N/A",
                            AssetId = p.Asset?.AssetId,
                            SerialNumber = p.Asset?.SerialNumber,
                            ExitGate = lastLog?.GateId ?? "Manual Entry",
                            ExitTime = lastLog?.Timestamp,
                            GatePassExpiryTime = p.ValidTill,
                            OverdueDurationHours = overdueDurationHours,
                            RiskLevel = riskLevel,
                            ApprovedBy = "Manager",
                            AlertTriggered = "Yes",
                            EscalationStatus = "Pending Review"
                        };
                    }),
                    Unauthorized = allLogs.Where(l => !l.IsAuthorized).Select(l => {
                        var matchingAsset = assets.FirstOrDefault(a => a.RfidTagId == l.RfidTagId);
                        return new {
                            EmployeeSysId = matchingAsset?.AssignedEmployee?.EmpId ?? "Unknown ID",
                            EmployeeName = matchingAsset?.AssignedEmployee?.Name ?? "Unmapped Person",
                            Department = matchingAsset?.AssignedEmployee?.Department ?? "N/A",
                            AssetId = matchingAsset?.AssetId ?? "Untagged Hardware",
                            RfidTagId = l.RfidTagId,
                            GateLocation = l.GateId,
                            AttemptType = l.Direction == "Out" ? "Unauthorized Exit" : "Unauthorized Entry",
                            AttemptTime = l.Timestamp,
                            Reason = l.Reason,
                            SecurityActionTaken = "Auto Blocked / Facility Alarm",
                            Status = "Pending Review",
                            CctvRef = $"CAM-{l.GateId.Replace(" ", "-")}"
                        };
                    })
                },
                RecentLogs = logsFeed.Select(l => $"[GATE: {l.GateId}] {(l.IsAuthorized ? "✅ OK" : "🚨 ALERT")}: Asset {l.RfidTagId} moved {l.Direction} at {l.Timestamp:HH:mm:ss}")
            });
        }
    }
}
