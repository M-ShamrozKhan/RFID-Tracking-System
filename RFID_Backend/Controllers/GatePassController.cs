using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;
using RFID_Backend.Models;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GatePassController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public GatePassController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/GatePass
        [HttpGet]
        public async Task<IActionResult> GetPasses()
        {
            try 
            {
                var passes = await _context.GatePasses
                    .Include(g => g.Asset)
                    .Include(g => g.Employee)
                    .OrderByDescending(g => g.CreatedAt)
                    .ToListAsync();
                
                var result = passes.Select(p => new {
                    p.Id,
                    taggedDevice = p.Asset?.AssetId ?? "N/A",
                    personnelName = p.Employee?.Name ?? "N/A",
                    p.EmployeeId,
                    p.AssetId, // Serializes to "assetId" (Safe)
                    p.ValidFrom,
                    p.ValidTill,
                    p.Reason,
                    p.Status,
                    p.ApprovedBy,
                    p.Remarks
                });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { title = "DB_READ_ERROR", errors = ex.InnerException?.Message ?? ex.Message });
            }
        }

        // POST: api/GatePass/request (Employee portal se ya HR gatepass k liye bhejey ga)
        [HttpPost("request")]
        public async Task<IActionResult> RequestPass([FromBody] GatePass gatePass)
        {
            try
            {
                gatePass.Status = "Requested";
                gatePass.Remarks = string.Empty;
                gatePass.CreatedAt = DateTime.UtcNow;
                
                _context.GatePasses.Add(gatePass);
                await _context.SaveChangesAsync();
                return Ok(new { Message = "✅ Gate Pass Requested successfully. Waiting for Manager Approval.", PassId = gatePass.Id });
            }
            catch (Exception ex)
            {
                return BadRequest(new { title = "DB_ERROR", errors = ex.InnerException?.Message ?? ex.Message });
            }
        }

        // PUT: api/GatePass/approve/5 (Manager portal par ok krey ga)
        [HttpPut("approve/{id}")]
        public async Task<IActionResult> ApprovePass(int id, [FromBody] string managerName)
        {
            var gp = await _context.GatePasses.FindAsync(id);
            if (gp == null) return NotFound();

            gp.Status = "Approved";
            gp.ApprovedBy = managerName;
            gp.Remarks = "Approved by Manager";
            await _context.SaveChangesAsync();

            return Ok(new { Message = $"✅ Success: Gate Pass {id} was Approved by Manager {managerName}." });
        }

        // PUT: api/GatePass/reject/5 (Manager can reject with a reason)
        [HttpPut("reject/{id}")]
        public async Task<IActionResult> RejectPass(int id, [FromBody] string reason)
        {
            var gp = await _context.GatePasses.FindAsync(id);
            if (gp == null) return NotFound();

            gp.Status = "Rejected";
            gp.Remarks = reason; 
            await _context.SaveChangesAsync();

            return Ok(new { Message = "⛔ Pass Rejected with Remarks." });
        }
    }
}
