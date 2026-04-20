import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ROLE_URL = 'http://localhost:5000/api/Role';

function RBAC() {
  const [data, setData] = useState({ roles: [], allPermissions: [] });
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRBAC();
  }, []);

  const fetchRBAC = async () => {
    try {
      const res = await axios.get(ROLE_URL);
      setData(res.data);
      if (res.data.roles.length > 0 && !selectedRole) {
        handleRoleClick(res.data.roles[0]);
      }
    } catch(e) { }
    setLoading(false);
  };

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setSelectedPermissions(role.assignedPermissionIds || []);
  };

  const togglePermission = (node, type) => {
    const code = `${node}_${type}`;
    const p = data.allPermissions.find(p => p.code === code);
    if (!p) return;

    if (selectedPermissions.includes(p.id)) {
      setSelectedPermissions(selectedPermissions.filter(id => id !== p.id));
    } else {
      setSelectedPermissions([...selectedPermissions, p.id]);
    }
  };

  const handleSave = async () => {
    if(!selectedRole) return;
    try {
      await axios.post(`${ROLE_URL}/update`, { 
        RoleId: selectedRole.id, 
        PermissionIds: selectedPermissions 
      });
      alert(`✅ Permissions for ${selectedRole.name} Updated!`);
      // Update local cache
      const updatedRoles = data.roles.map(r => 
        r.id === selectedRole.id ? { ...r, assignedPermissionIds: selectedPermissions } : r
      );
      setData({ ...data, roles: updatedRoles });
    } catch(e) { alert("⚠️ Update Failed!"); }
  };

  const [newRoleName, setNewRoleName] = useState('');
  const nodes = ["EMPLOYEES", "ASSETS", "GATEPASSES", "REPORTS", "DASHBOARD", "RFID_CONFIG"];

  const handleCreateRole = async () => {
    if(!newRoleName.trim()) return;
    try {
        const res = await axios.post(`${ROLE_URL}/create`, { Name: newRoleName });
        alert(`✅ Role "${newRoleName}" Created!`);
        setNewRoleName('');
        // Refresh and select the new role
        const refreshRes = await axios.get(ROLE_URL);
        setData(refreshRes.data);
        const newRole = refreshRes.data.roles.find(r => r.name === newRoleName);
        if(newRole) handleRoleClick(newRole);
    } catch(e) { 
        console.error(e);
        const msg = e.response?.data?.message || "Role creation failed.";
        const detail = e.response?.data?.detail ? `\nDetail: ${e.response.data.detail}` : "";
        alert(`⚠️ ${msg}${detail}`); 
    }
  };

  if(loading) return <div style={{padding:'2rem', textAlign:'center'}}>Loading Authorization Matrix...</div>;

  return (
    <div className="container" style={{maxWidth: '1200px', margin: '0 auto'}}>
      <h1 className="page-title">ROLES & PERMISSIONS</h1>
      <p style={{color: 'var(--text-muted)', marginBottom: '30px'}}>Configure granular 'View' and 'Edit' rights for system nodes based on organizational roles.</p>

      <div style={{display: 'grid', gridTemplateColumns: '300px 1fr', gap: '30px', alignItems: 'start'}}>
        
        {/* Role List Side */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
            
            <div className="glass-panel" style={{padding: '20px', border: '1px solid #e2e8f0', borderRadius:'12px', background: 'white'}}>
                <h4 style={{margin: '0 0 15px 0', fontSize: '0.9rem', color: 'var(--text-muted)'}}>ADD NEW ROLE</h4>
                <div style={{display: 'flex', gap: '10px'}}>
                    <input 
                        type="text" 
                        placeholder="Role Name (e.g. Auditor)" 
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        style={{padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', flex: 1, fontSize: '0.85rem'}} 
                    />
                    <button 
                        onClick={handleCreateRole}
                        className="btn-primary" 
                        style={{height: '38px', padding: '0 15px', fontSize: '0.85rem'}}
                    >
                        ➕ Add
                    </button>
                </div>
            </div>

            <div className="glass-panel" style={{padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius:'12px'}}>
                <div style={{padding: '15px 20px', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold'}}>System Roles</div>
                <div style={{display: 'flex', flexDirection: 'column', background: 'white'}}>
                    {(!data.roles || data.roles.length === 0) && (
                        <div style={{padding: '20px', textAlign: 'center', color: 'var(--text-muted)'}}>No Roles Found. Check Backend Seeding!</div>
                    )}
                    {(data.roles || []).map(r => (
                    <button 
                        key={r.id} 
                        onClick={() => handleRoleClick(r)}
                        style={{
                            padding: '15px 20px',
                            textAlign: 'left',
                            background: selectedRole?.id === r.id ? '#eff6ff' : 'white',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            fontWeight: selectedRole?.id === r.id ? 'bold' : 'normal',
                            color: selectedRole?.id === r.id ? 'var(--primary-color)' : 'var(--text-color)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                            <span>{r.name}</span>
                            {selectedRole?.id === r.id && <span>→</span>}
                        </div>
                    </button>
                ))}
            </div>
        </div>
        </div>

        {/* Permission Matrix Side */}
        <div className="glass-panel" style={{minHeight: '400px', padding: '30px', border: '1px solid #e2e8f0', borderRadius:'12px', background: 'white'}}>
            {selectedRole ? (
                <>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'25px'}}>
                        <div>
                            <h2 style={{margin: 0, color: 'var(--primary-color)'}}>{selectedRole.name} Access Rights</h2>
                            <p style={{margin: '5px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)'}}>Manage node-level capabilities for this profile.</p>
                        </div>
                        <button onClick={handleSave} className="btn-primary" style={{padding: '10px 25px', borderRadius: '8px'}}>Save Changes</button>
                    </div>

                    <table className="table-main" style={{marginTop: '20px'}}>
                        <thead>
                            <tr style={{background: '#f8fafc'}}>
                                <th style={{width: '40%'}}>System Node / Module</th>
                                <th style={{textAlign: 'center', width: '30%'}}>View Rights</th>
                                <th style={{textAlign: 'center', width: '30%'}}>Edit / Action Rights</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nodes.map(node => {
                                const viewPerm = (data.allPermissions || []).find(p => p.code === `${node}_VIEW`);
                                const editPerm = (data.allPermissions || []).find(p => p.code === `${node}_EDIT`);
                                return (
                                    <tr key={node}>
                                        <td style={{fontWeight: 600, color: '#334155'}}>{node.replace('_', ' ')}</td>
                                        <td style={{textAlign: 'center'}}>
                                            <input 
                                                type="checkbox" 
                                                disabled={!viewPerm}
                                                checked={selectedPermissions.includes(viewPerm?.id)} 
                                                onChange={() => togglePermission(node, 'VIEW')}
                                                style={{width: '20px', height: '20px', cursor: 'pointer'}}
                                            />
                                        </td>
                                        <td style={{textAlign: 'center'}}>
                                            <input 
                                                type="checkbox" 
                                                disabled={!editPerm}
                                                checked={selectedPermissions.includes(editPerm?.id)} 
                                                onChange={() => togglePermission(node, 'EDIT')}
                                                style={{width: '20px', height: '20px', cursor: 'pointer'}}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </>
            ) : (
                <div style={{textAlign: 'center', color: 'var(--text-muted)', paddingTop: '100px'}}>Select a system role from the left to configure the authorization matrix.</div>
            )}
        </div>

      </div>
    </div>
  );
}

export default RBAC;
