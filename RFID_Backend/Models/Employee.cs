using System.ComponentModel.DataAnnotations;

namespace RFID_Backend.Models
{
    public class Employee
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string EmpId { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        public string ContactDetails { get; set; } = string.Empty;

        public string Department { get; set; } = string.Empty;
        public string Division { get; set; } = string.Empty;
        public string Designation { get; set; } = string.Empty;
        
        public string Status { get; set; } = "Active"; // Active, Inactive

        public string Role { get; set; } = "Employee"; // System Role (Admin / Employee)
        public string Password { get; set; } = "12345"; // Secured pass

        public int? DivisionManagerId { get; set; } // Tracks which DM oversees this employee
    }
}
