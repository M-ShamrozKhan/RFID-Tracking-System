import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ROLE_URL = '/api/Role';

function RBAC() {
  const [data, setData] = useState({ roles: [], allPermissions: [] });
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editRoleName, setEditRoleName] = useState("");

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

  const handleToggleAssetCapability = async (roleId, isEnabled) => {
    try {
        await axios.post(`${ROLE_URL}/toggle-asset-assignable`, { RoleId: roleId, IsEnabled: isEnabled });
        fetchRBAC(); // Refresh UI
    } catch(e) { alert("⚠️ Toggle Failed!"); }
  };

  const handleRenameRole = async (roleId) => {
    if(!editRoleName.trim()) return setEditingRoleId(null);
    try {
        await axios.post(`${ROLE_URL}/rename`, { RoleId: roleId, NewName: editRoleName });
        alert("✅ Role Renamed Successfully");
        setEditingRoleId(null);
        fetchRBAC();
    } catch(e) { 
        alert(`⚠️ ${e.response?.data?.message || "Rename failed."}`);
    }
  };

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
                        onClick={() => {
                            handleRoleClick(r);
                            setEditingRoleId(null); // Close any pending edits
                        }}
                        style={{
                            padding: '15px 20px',
                            textAlign: 'left',
                            background: selectedRole?.id === r.id ? '#eff6ff' : 'white',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            fontWeight: selectedRole?.id === r.id ? '700' : '400',
                            color: selectedRole?.id === r.id ? 'var(--primary-color)' : 'var(--text-color)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}
                    >
                        <span>{r.name}</span>
                        {selectedRole?.id === r.id && <span style={{fontSize: '0.8rem'}}>●</span>}
                    </button>
                ))}
            </div>
        </div>
        </div>

        {/* Permission Matrix Side */}
        <div className="glass-panel" style={{minHeight: '400px', padding: '30px', border: '1px solid #e2e8f0', borderRadius:'12px', background: 'white'}}>
            {selectedRole ? (
                <>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9'}}>
                        <div style={{flex: 1}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                                {editingRoleId === selectedRole.id ? (
                                    <input 
                                        autoFocus
                                        value={editRoleName}
                                        onChange={e => setEditRoleName(e.target.value)}
                                        onBlur={() => handleRenameRole(selectedRole.id)}
                                        onKeyDown={e => e.key === 'Enter' && handleRenameRole(selectedRole.id)}
                                        style={{fontSize: '1.5rem', fontWeight: '800', border: '1px solid var(--primary-color)', borderRadius: '6px', padding: '2px 10px', width: '300px'}}
                                    />
                                ) : (
                                    <h2 style={{margin: 0, color: 'var(--text-main)', fontSize: '1.8rem', fontWeight: '900'}}>
                                        {selectedRole.name} 
                                        <span 
                                            onClick={() => { setEditingRoleId(selectedRole.id); setEditRoleName(selectedRole.name); }}
                                            style={{marginLeft: '15px', fontSize: '1rem', cursor: 'pointer', opacity: 0.4}}
                                        >✏️ Edit Name</span>
                                    </h2>
                                )}
                            </div>
                            
                            <div style={{marginTop: '10px', display: 'flex', alignItems: 'center', gap: '20px'}}>
                                <label style={{
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    background: selectedRole.isAssetAssignable ? '#ecfdf5' : '#f8fafc',
                                    color: selectedRole.isAssetAssignable ? '#065f46' : '#64748b',
                                    padding: '8px 15px', 
                                    borderRadius: '30px', 
                                    fontSize: '0.85rem', 
                                    fontWeight: '700',
                                    border: '1px solid',
                                    borderColor: selectedRole.isAssetAssignable ? '#a7f3d0' : '#e2e8f0',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedRole.isAssetAssignable} 
                                        onChange={(e) => handleToggleAssetCapability(selectedRole.id, e.target.checked)}
                                    />
                                    Enable Asset Assignment for this Role
                                </label>
                                <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Manage node-level capabilities for this profile.</span>
                            </div>
                        </div>
                        <button onClick={handleSave} className="btn-primary" style={{padding: '12px 30px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'}}>Save Changes</button>
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
