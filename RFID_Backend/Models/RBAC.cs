using System.ComponentModel.DataAnnotations;

namespace RFID_Backend.Models
{
    public class Role
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public string Name { get; set; } = string.Empty; // SuperAdmin, HR, etc.
        public string Description { get; set; } = string.Empty;
        public bool IsAssetAssignable { get; set; } = false;
    }

    public class Permission
    {
        [Key]
        public int Id { get; set; }
        [Required]
        public string Name { get; set; } = string.Empty; // Approve Gate Pass
        [Required]
        public string Code { get; set; } = string.Empty; // APPROVE_GATE_PASS
    }

    public class RolePermission
    {
        [Key]
        public int Id { get; set; }
        public int RoleId { get; set; }
        public int PermissionId { get; set; }

        public Role? Role { get; set; }
        public Permission? Permission { get; set; }
    }
}
