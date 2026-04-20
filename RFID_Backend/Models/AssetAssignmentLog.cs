using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RFID_Backend.Models
{
    public class AssetAssignmentLog
    {
        [Key]
        public int Id { get; set; }

        public int AssetId { get; set; }
        [ForeignKey("AssetId")]
        public Asset? Asset { get; set; }

        // Nullable because it can be unassigned (Action = "Unassigned")
        public int? EmployeeId { get; set; }
        [ForeignKey("EmployeeId")]
        public Employee? Employee { get; set; }

        public string Action { get; set; } = string.Empty; // "Assigned" or "Unassigned"
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
