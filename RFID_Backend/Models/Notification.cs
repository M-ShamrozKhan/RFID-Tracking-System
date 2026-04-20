using System.ComponentModel.DataAnnotations;

namespace RFID_Backend.Models
{
    public class Notification
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public string Message { get; set; } = string.Empty;
        
        [Required]
        public string Type { get; set; } = "Alert"; // Alert, Warning, Info
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        
        public bool IsRead { get; set; } = false;

        // Role restriction (Optional: null for everyone authorized, or specific role)
        public string? TargetRole { get; set; } 
    }
}
