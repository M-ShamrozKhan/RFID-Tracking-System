using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using RFID_Backend.Data;
using RFID_Backend.Hubs;
using RFID_Backend.Models;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GateController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<AlertHub> _hubContext;

        public GateController(ApplicationDbContext context, IHubContext<AlertHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public class RfidScanRequest
        {
            public string RfidTagId { get; set; } = string.Empty;
            public string GateId { get; set; } = string.Empty;
            public string Direction { get; set; } = "Out"; 
        }

        [HttpPost("scan")]
        public async Task<IActionResult> RfidScan([FromBody] RfidScanRequest request)
        {
            var log = new MovementLog { 
                RfidTagId = request.RfidTagId, 
                GateId = request.GateId ?? "Gate 1", 
                Direction = request.Direction,
                Timestamp = DateTime.UtcNow
            };

            var asset = await _context.Assets.Include(a => a.AssignedEmployee)
                                            .FirstOrDefaultAsync(a => a.RfidTagId == request.RfidTagId);

            if (asset != null) log.AssetId = asset.Id;

            // Scenario 1: Unregistered Tag
            if (asset == null) {
                var msg = $"🚨 SECURITY ALERT: Unauthorized access attempt! Tag [{request.RfidTagId}] is not registered in the system.";
                return await SaveAndPushAlert(msg, "Unregistered Tag", log, true);
            }

            // Scenario 2: Inactive Personnel
            if (asset.AssignedEmployee != null && asset.AssignedEmployee.Status == "Inactive") {
                var msg = $"🚨 SECURITY ALERT: Blocked! Movement attempted by an 'Inactive' Employee ({asset.AssignedEmployee.Name}).";
                return await SaveAndPushAlert(msg, "Inactive User Block", log, true);
            }

            string dashboardMsg = "";

            if (request.Direction == "Out")
            {
                var activePass = await _context.GatePasses
                    .Where(gp => gp.AssetId == asset.Id && gp.Status == "Approved")
                    .OrderByDescending(gp => gp.CreatedAt)
                    .FirstOrDefaultAsync();

                // EXIT VALIDATION
                if (activePass == null) {
                    var msg = $"🚨 SECURITY ALERT: {asset.AssignedEmployee?.Name ?? "Unknown"} - No approved gate pass found. Please generate a pass before exit. (LPT: {asset.AssetId})";
                    return await SaveAndPushAlert(msg, "Missing Pass", log, true);
                }

                if (DateTime.UtcNow > activePass.ValidTill) {
                    var msg = $"🚨 SECURITY ALERT: {asset.AssignedEmployee?.Name ?? "Unknown"} - Attempting exit with an EXPIRED gate pass. (LPT: {asset.AssetId})";
                    return await SaveAndPushAlert(msg, "Expired Pass Attempt", log, true);
                }

                if (DateTime.UtcNow < activePass.ValidFrom) {
                    var msg = $"🚨 SECURITY ALERT: {asset.AssignedEmployee?.Name ?? "Unknown"} - Attempting exit BEFORE scheduled approval time. (LPT: {asset.AssetId})";
                    return await SaveAndPushAlert(msg, "Early Exit Attempt", log, true);
                }

                asset.CurrentStatus = "Outside";
                log.Reason = "Authorized Departure";
                dashboardMsg = $"✅ Success: {asset.AssignedEmployee?.Name}'s Laptop ({asset.AssetId}) scanned OUT.";
            }
            else // Direction IN
            {
                asset.CurrentStatus = "Inside";
                var activePass = await _context.GatePasses
                    .Where(gp => gp.AssetId == asset.Id && gp.Status == "Approved")
                    .OrderByDescending(gp => gp.CreatedAt)
                    .FirstOrDefaultAsync();
                
                string timingStatus = "AUTHORIZED RETURN";

                if (activePass != null) {
                    if (DateTime.UtcNow > activePass.ValidTill) {
                        timingStatus = "LATE RETURN";
                        var alertMsg = $"⚠️ LOGISTICS ALERT: {asset.AssignedEmployee?.Name} returned the asset ({asset.AssetId}) LATER than scheduled.";
                        _context.Notifications.Add(new Notification { Message = alertMsg, Type = "Info", Timestamp = DateTime.UtcNow });
                        await _hubContext.Clients.All.SendAsync("ReceiveAlert", alertMsg);
                    } 
                    else if (DateTime.UtcNow < activePass.ValidFrom) 
                    {
                        timingStatus = "EARLY RETURN";
                        var alertMsg = $"ℹ️ INFO: {asset.AssignedEmployee?.Name} returned the asset ({asset.AssetId}) EARLIER than anticipated.";
                        _context.Notifications.Add(new Notification { Message = alertMsg, Type = "Info", Timestamp = DateTime.UtcNow });
                        await _hubContext.Clients.All.SendAsync("ReceiveAlert", alertMsg);
                    }
                    else {
                        timingStatus = "ON-TIME RETURN";
                    }
                    activePass.Status = "Closed";
                }

                log.Reason = timingStatus;
                dashboardMsg = $"📥 Success: Laptop {asset.AssetId} scanned IN safely. ({timingStatus})";
            }

            log.IsAuthorized = true;
            _context.MovementLogs.Add(log);
            await _context.SaveChangesAsync();
            await _hubContext.Clients.All.SendAsync("ReceiveUpdate", dashboardMsg);
            return Ok(new { Message = dashboardMsg, NewStatus = asset.CurrentStatus });
        }

        private async Task<IActionResult> SaveAndPushAlert(string message, string reason, MovementLog log, bool isError)
        {
            log.IsAuthorized = false;
            log.Reason = reason;
            _context.MovementLogs.Add(log);

            var note = new Notification { 
                Message = message, 
                Type = isError ? "Alert" : "Info", 
                Timestamp = DateTime.UtcNow 
            };
            _context.Notifications.Add(note);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("ReceiveAlert", message);
            
            if (isError) return BadRequest(new { Error = message });
            return Ok(new { Message = message });
        }
    }
}
