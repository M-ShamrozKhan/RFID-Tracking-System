using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ReportController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ReportController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/Report/movements (Full audit feed filterable by dates)
        [HttpGet("movements")]
        public async Task<IActionResult> GetMovements([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] string? allowedEmpIds)
        {
            var query = _context.MovementLogs.Include(m => m.Asset).ThenInclude(a => a.AssignedEmployee).AsQueryable();

            if (fromDate.HasValue) query = query.Where(m => m.Timestamp >= fromDate.Value);
            if (toDate.HasValue) query = query.Where(m => m.Timestamp <= toDate.Value);

            if (!string.IsNullOrEmpty(allowedEmpIds))
            {
                var empIds = allowedEmpIds.Split(',').Select(int.Parse).ToList();
                query = query.Where(m => m.Asset != null && m.Asset.AssignedToEmployeeId.HasValue && empIds.Contains(m.Asset.AssignedToEmployeeId.Value));
            }

            var result = await query.OrderByDescending(m => m.Timestamp).ToListAsync();
            return Ok(result);
        }

        // GET: api/Report/unauthorized (Dashboard k unauthorized attempts section k lye)
        [HttpGet("unauthorized")]
        public async Task<IActionResult> GetUnauthorized([FromQuery] string? allowedEmpIds)
        {
            var query = _context.MovementLogs
                .Include(m => m.Asset).ThenInclude(a => a.AssignedEmployee)
                .Where(m => m.IsAuthorized == false);

            if (!string.IsNullOrEmpty(allowedEmpIds))
            {
                var empIds = allowedEmpIds.Split(',').Select(int.Parse).ToList();
                query = query.Where(m => m.Asset != null && m.Asset.AssignedToEmployeeId.HasValue && empIds.Contains(m.Asset.AssignedToEmployeeId.Value));
            }

            var logs = await query.OrderByDescending(m => m.Timestamp).ToListAsync();
            return Ok(logs);
        }

        // GET: api/Report/overdue (Un logon ka record jink pas pass tha par wapsi nahi ai or validity khatam hogae)
        [HttpGet("overdue")]
        public async Task<IActionResult> GetOverduePasses([FromQuery] string? allowedEmpIds)
        {
            var query = _context.GatePasses
                .Include(gp => gp.Asset).ThenInclude(a => a.AssignedEmployee)
                .Where(gp => gp.Status == "Approved" 
                          && gp.ValidTill < DateTime.UtcNow 
                          && gp.Asset != null && gp.Asset.CurrentStatus == "Outside");

            if (!string.IsNullOrEmpty(allowedEmpIds))
            {
                var empIds = allowedEmpIds.Split(',').Select(int.Parse).ToList();
                query = query.Where(gp => gp.Asset != null && gp.Asset.AssignedToEmployeeId.HasValue && empIds.Contains(gp.Asset.AssignedToEmployeeId.Value));
            }

            var overdue = await query.ToListAsync();
            return Ok(overdue);
        }
    }
}
