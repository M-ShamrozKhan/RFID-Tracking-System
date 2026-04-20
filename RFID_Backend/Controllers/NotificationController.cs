using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFID_Backend.Data;
using RFID_Backend.Models;

namespace RFID_Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public NotificationController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetNotifications()
        {
            var notes = await _context.Notifications
                .OrderByDescending(n => n.Timestamp)
                .Take(50)
                .ToListAsync();
            return Ok(notes);
        }

        [HttpPost("mark-read")]
        public async Task<IActionResult> MarkAllRead()
        {
            var unread = await _context.Notifications.Where(n => !n.IsRead).ToListAsync();
            foreach (var n in unread)
            {
                n.IsRead = true;
            }
            await _context.SaveChangesAsync();
            return Ok();
        }

        [HttpDelete("clear")]
        public async Task<IActionResult> ClearAll()
        {
            _context.Notifications.RemoveRange(_context.Notifications);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}
