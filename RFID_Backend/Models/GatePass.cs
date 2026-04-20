using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RFID_Backend.Models
{
    public class GatePass
    {
        [Key]
        public int Id { get; set; }

        public int AssetId { get; set; }
        [ForeignKey("AssetId")]
        public Asset? Asset { get; set; }

        public int EmployeeId { get; set; }
        [ForeignKey("EmployeeId")]
        public Employee? Employee { get; set; }

        public string ApprovedBy { get; set; } = string.Empty; // Kis Manager ne pass dya?
        
        public DateTime ValidFrom { get; set; }
        public DateTime ValidTill { get; set; }
        
        public string Reason { get; set; } = string.Empty; // Added: Why is the laptop going out?
        public string Status { get; set; } = "Requested"; 
        public string Remarks { get; set; } = string.Empty; // Manager's comments on Approve/Reject
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
