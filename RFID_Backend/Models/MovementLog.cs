using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RFID_Backend.Models
{
    public class MovementLog
    {
        [Key]
        public int Id { get; set; }

        public string RfidTagId { get; set; } = string.Empty;
        
        // Agar tag kisi Asset/Employee k sth mapped hay tau record hojaega warna unknown mein ajaye ga
        public int? AssetId { get; set; }
        [ForeignKey("AssetId")]
        public Asset? Asset { get; set; }

        public string GateId { get; set; } = "Gate 1";
        public string Direction { get; set; } = "Out"; // In, Out
        
        public bool IsAuthorized { get; set; }
        public string Reason { get; set; } = "Approved"; // e.g. "Inactive Employee", "No Pass"
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
