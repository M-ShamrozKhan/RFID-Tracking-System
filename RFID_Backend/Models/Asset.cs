using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RFID_Backend.Models
{
    public class Asset
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string AssetId { get; set; } = string.Empty;

        [Required]
        public string RfidTagId { get; set; } = string.Empty;

        public string SerialNumber { get; set; } = string.Empty;
        public string BrandModel { get; set; } = string.Empty;
        public string PurchaseDetails { get; set; } = string.Empty;
        public string WarrantyInfo { get; set; } = string.Empty;

        public int? AssignedToEmployeeId { get; set; }
        [ForeignKey("AssignedToEmployeeId")]
        public Employee? AssignedEmployee { get; set; }

        public string CurrentStatus { get; set; } = "Inside"; // Inside, Outside, Overdue
    }
}
