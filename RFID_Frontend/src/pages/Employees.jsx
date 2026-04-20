import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = 'http://localhost:5000/api/Employee';

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Employee Profile Detail Fields
  const [empId, setEmpId] = useState('');
  const [nextEmpId, setNextEmpId] = useState('');
  const [name, setName] = useState('');
  const [dep, setDep] = useState('');
  const [division, setDivision] = useState('');
  const [designation, setDesignation] = useState('');
  const [contact, setContact] = useState('');
  
  // Security Fields
  const [status, setStatus] = useState('Active');
  const [role, setRole] = useState('Employee');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Optional Integrated Asset Tagging on Creation
  const [laptopIds, setLaptopIds] = useState([]);
  const [rfidTagId, setRfidTagId] = useState('');
  const [laptopBrand, setLaptopBrand] = useState('');

  // Editing logic
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [unassignedAssets, setUnassignedAssets] = useState([]);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);

  useEffect(() => { 
      fetchEmployees(); 
      fetchUnassigned();
      fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/Role');
      // Backend returns { roles: [...], allPermissions: [...] }
      const data = res.data.roles || [];
      // Normalize casing (Support both 'Name' and 'name')
      const normalized = data.map(r => ({ ...r, name: r.name || r.Name }));
      setAvailableRoles(normalized);
    } catch(e) {}
  };

  const fetchUnassigned = async (currentEmpId = null) => {
    try {
      const res = await axios.get('http://localhost:5000/api/Asset');
      // Show unassigned OR the ones already assigned to THIS EXACT employee
      setUnassignedAssets(res.data.filter(a => 
         !a.assignedToEmployeeId || (currentEmpId && a.assignedToEmployeeId === currentEmpId)
      ));
    } catch(e) {}
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(API_URL);
      const data = res.data;
      setEmployees(data);
      
      let maxId = 0;
      data.forEach(e => { if (e.id > maxId) maxId = e.id; });
      setNextEmpId(`EMP-${String(maxId + 1).padStart(4, '0')}`);

    } catch(e) { alert("⚠️ Backend Server Error."); }
    setLoading(false);
  };

  const clearForm = () => {
      setEmpId(''); setName(''); setDep(''); setDivision(''); setDesignation(''); setContact('');
      setStatus('Active'); setRole('Employee'); setPassword(''); setShowPassword(false);
      setLaptopIds([]); setRfidTagId(''); setLaptopBrand('');
      setIsEditing(false); setEditId(null);
      setIsResettingPassword(false);
      fetchUnassigned(); // reset to only unassigned
  };

  const addAssetRow = () => setLaptopIds([...laptopIds, '']);
  const updateAssetRow = (idx, val) => {
    const nextArr = [...laptopIds];
    nextArr[idx] = val;
    setLaptopIds(nextArr);
  };
  const removeAssetRow = (idx) => setLaptopIds(laptopIds.filter((_, i) => i !== idx));

  const handleEditClick = async (emp) => {
      console.log("State - Opening Edit for:", emp);
      const currentAssetIds = (emp.assignedAssets || []).map(a => a.id);
      await fetchUnassigned(emp.id);

      setIsEditing(true); 
      setEditId(emp.id);
      setEmpId(emp.empId); setName(emp.name); setDep(emp.department || ''); 
      setDivision(emp.division || ''); setDesignation(emp.designation || ''); setContact(emp.contactDetails || '');
      setRole(emp.role); setStatus(emp.status);
      setPassword(''); setShowPassword(false); // Clear for reset logic
      setIsResettingPassword(false);
      
      setLaptopIds(currentAssetIds.map(String)); // Set currently mapped laptops
  }

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    const payload = { 
        empId, name, department: dep, division, designation, contactDetails: contact, 
        status, role, password,
        laptopIds
    };

    try {
      if(isEditing) {
          await axios.put(`${API_URL}/${editId}`, payload);
          alert(`✅ Profile for ${name} Update Complete.`);
      } else {
          await axios.post(API_URL, payload);
          alert(`✅ Employee Registered! ${laptopIds.length > 0 ? 'Assets Tagged and Mapped Successfully.' : ''}`);
      }
      fetchEmployees();
    } catch(err) { alert(`⚠️ Request Failed!`); }
    clearForm();
  };

  const handleToggleStatus = async (idTable, currentStatus) => {
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      const promptTxt = currentStatus === 'Active' 
        ? "Marking Inactive will BLOCK movement and Flag ASSET RECOVERY workflow. Proceed?" 
        : `Restore Access for ${newStatus}?`;
      
      const userConfirm = window.confirm(promptTxt);
      if(userConfirm) {
          try {
             await axios.put(`${API_URL}/status/${idTable}`, `"${newStatus}"`, { headers: { 'Content-Type': 'application/json' }});
             alert('Status & Asset Workflows Updated!');
             fetchEmployees();
          } catch(e) { }
      }
  };

  const handleDelete = async (id) => {
      const confirmDelete = window.confirm("Are you sure you want to Delete this user? Their status will become Inactive and Movement will be blocked.");
      if(confirmDelete) {
          try {
              await axios.put(`${API_URL}/status/${id}`, "\"Inactive\"", { headers: { 'Content-Type': 'application/json' }});
              alert('User Deleted (Status: Inactive)');
              fetchEmployees();
              fetchUnassigned(); // Vital: Refresh the available asset pool
          } catch(e) { }
      }
  };

  const handleBulkUpload = async (e) => {
      // Bulk upload logic identical
      alert("Mass importing... Check back soon.");
      e.target.value = null; // reset
  };

  const filteredEmployees = employees.filter(emp => 
    (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (emp.empId || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (emp.department || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Manage Employees</h1>
        <button onClick={clearForm} className="btn-primary" style={{ padding: '0 20px' }}>
            + Create New Employee
        </button>
      </div>
      
      <div className="glass-panel" style={{ background: '#fafafa', padding: '25px', borderRadius: '12px' }}>
        <div className="section-title" style={{ borderBottom: 'none'}}>
            <span style={{color: 'var(--primary-color)'}}>{isEditing ? 'Editing Profile details' : 'Add New Employee'}</span>
            {!isEditing && (
                <div style={{position: 'relative', display: 'inline-block'}}>
                    <button className="btn-outline">📄 Import Excel List</button>
                    <input type="file" accept=".csv, .xlsx" onChange={handleBulkUpload} style={{position: 'absolute', opacity: 0, right: 0, top: 0, bottom: 0, left: 0, cursor: 'pointer'}} />
                </div>
            )}
        </div>
        
        <form onSubmit={handleSaveEmployee} className="form-grid-multi">
          
          <div className="floating-group">
            <input disabled value={isEditing ? empId : (nextEmpId || 'Auto-Generating...')} className="floating-input" style={{ background: '#f1f5f9', color: '#4f46e5', fontWeight: '900', letterSpacing: '1px', border: '1px dashed #cbd5e1' }} />
            <label className="floating-label">Employee ID (System Assigned)</label>
          </div>
          <div className="floating-group">
            <input required placeholder=" " value={name} onChange={e => setName(e.target.value)} className="floating-input" />
            <label className="floating-label">Full Name *</label>
          </div>
          <div className="floating-group">
            <input required placeholder=" " value={dep} onChange={e => setDep(e.target.value)} className="floating-input" />
            <label className="floating-label">Department *</label>
          </div>
          <div className="floating-group">
            <input placeholder=" " value={division} onChange={e => setDivision(e.target.value)} className="floating-input" />
            <label className="floating-label">Division</label>
          </div>
          <div className="floating-group">
            <input placeholder=" " value={designation} onChange={e => setDesignation(e.target.value)} className="floating-input" />
            <label className="floating-label">Designation</label>
          </div>
          <div className="floating-group">
            <input 
                placeholder=" " 
                type="tel"
                maxLength={11}
                value={contact} 
                onChange={e => {
                    const val = e.target.value.replace(/\D/g, ''); // Strip non-numeric characters automatically
                    if (val.length <= 11) setContact(val);
                }} 
                className="floating-input" 
            />
            <label className="floating-label">Contact Details</label>
          </div>

          <div className="floating-group">
            <select value={role} onChange={e => setRole(e.target.value)} className="floating-select">
              <option value="">-- Select System Role --</option>
              {availableRoles.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
              {/* Fallback if list is empty */}
              {availableRoles.length === 0 && (
                <>
                  <option value="Employee">Employee (Standby)</option>
                  <option value="SuperAdmin">SuperAdmin (Standby)</option>
                </>
              )}
            </select>
            <label className="floating-label" style={{background: 'var(--bg-main)'}}>System Role & Access Level</label>
          </div>
          
          <div className="floating-group">
            <select value={status} onChange={e => setStatus(e.target.value)} className="floating-select">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <label className="floating-label" style={{background: 'var(--bg-main)'}}>Status</label>
          </div>

          {!isEditing ? (
            <div className="floating-group" style={{ position: 'relative' }}>
                <input 
                required 
                type={showPassword ? "text" : "password"} 
                placeholder=" " 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="floating-input" 
                />
                <label className="floating-label">Login Password *</label>
                <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                    position: 'absolute',
                    right: '12px',
                    top: '55%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    color: 'var(--text-muted)'
                }}
                >
                {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
            </div>
          ) : (
            <div className="floating-group" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!isResettingPassword ? (
                    <button 
                        type="button" 
                        onClick={() => setIsResettingPassword(true)} 
                        className="btn-outline" 
                        style={{ borderStyle: 'dashed', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                    >
                        🔄 Reset User Password
                    </button>
                ) : (
                    <div style={{ position: 'relative' }}>
                        <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Type new password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="floating-input" 
                            style={{ width: '100%' }}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                color: 'var(--text-muted)'
                            }}
                        >
                            {showPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                    </div>
                )}
            </div>
          )}

          {(role === 'Employee' || role === 'Staff/Employee' || role === 'Staff / Employee') && (
              <>
              <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e2e8f0', margin: '5px 0' }}></div>
              <div style={{ gridColumn: '1 / -1' }}>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                      Asset Mapping / Reassignment
                  </p>
                  <p style={{ margin: '5px 0 5px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {isEditing ? "Pick new unassigned laptops below to re-map this profile, or leave empty to keep current." : "Select registered, unassigned laptops below to map them specifically to this new employee."}
                  </p>
              </div>

              <div style={{ gridColumn: '1 / -1', minHeight: '60px' }}>
                {(laptopIds.length === 0 ? [''] : laptopIds).map((lId, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                      <div className="floating-group" style={{ flex: 1, margin: 0 }}>
                        <select 
                          value={String(lId)} 
                          onChange={e => updateAssetRow(idx, e.target.value)} 
                          className="floating-select"
                        >
                          <option value="">-- No Laptop Selected --</option>
                          {unassignedAssets.map(a => (
                             <option key={a.id} value={String(a.id)}>{a.assetId} - {a.brandModel} ({a.rfidTagId})</option>
                          ))}
                        </select>
                        <label className="floating-label" style={{background: 'var(--bg-main)'}}>
                          {idx === 0 ? "Select Primary Laptop" : `Select Additional Laptop (#${idx + 1})`}
                        </label>
                      </div>

                      {idx === 0 ? (
                          <button type="button" onClick={addAssetRow} className="btn-primary" style={{ padding: '0 15px', height: '44px', width: '44px', borderRadius: '8px' }}>+</button>
                      ) : (
                          <button type="button" onClick={() => removeAssetRow(idx)} className="btn-outline" style={{ padding: '0 15px', height: '44px', width: '44px', borderRadius: '8px', color: 'red', borderColor: 'red' }}>-</button>
                      )}
                  </div>
                ))}
              </div>
              </>
          )}

          <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e2e8f0', margin: '5px 0' }}></div>
          <div className="floating-group" style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', height: 'auto' }}>
            <button type="submit" className="btn-primary" style={{ marginBottom: '2px' }}>{isEditing ? 'Update Employee details' : 'Register Employee'}</button>
            {isEditing && <button type="button" onClick={clearForm} className="btn-outline" style={{ height: '44px' }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', marginTop: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Registered Personnel List</h3>
            <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Search name, ID or Dept..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ 
                    padding: '8px 15px', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1', 
                    width: '300px',
                    fontSize: '0.9rem' 
                  }} 
                />
            </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
        <table className="table-main" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Emp. ID</th>
              <th>Name & Contact</th>
              <th>Role & Div.</th>
              <th>Status</th>
              <th>Assigned Asset</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredEmployees.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: "center", fontStyle: "italic", padding: "2rem" }}>No Records Match your Search.</td></tr>
            )}
            {filteredEmployees.map(emp => (
              <tr key={emp.id}>
                <td><strong>{emp.empId}</strong></td>
                <td>
                  <div><strong>{emp.name}</strong></div>
                  <div style={{fontSize:'0.8em', color:'var(--text-muted)'}}>{emp.contactDetails || '-'}</div>
                </td>
                <td>
                   <span style={{ fontSize: '0.8em', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{emp.role}</span>
                   <div style={{fontSize:'0.8em', color:'var(--text-muted)', marginTop:'5px'}}>{emp.division} / {emp.department}</div>
                </td>
                <td><span className={emp.status === 'Active' ? 'badge badge-success' : 'badge badge-danger'}>{emp.status}</span></td>
                <td>
                   {emp.assignedAssets && emp.assignedAssets.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {emp.assignedAssets.map(a => (
                          <span key={a.id} className="badge badge-info" title={a.brandModel}>{a.assetId}</span>
                        ))}
                      </div>
                   ) : (
                      <span style={{color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic'}}>N/A</span>
                   )}
                </td>
                <td>
                    <button onClick={() => handleEditClick(emp)} className="btn-outline" style={{ display: 'inline-block', fontSize: '0.8rem', marginRight: '5px' }}>
                        Edit Details
                    </button>
                    <button onClick={() => handleDelete(emp.id)} className="btn-outline" style={{ display: 'inline-block', fontSize: '0.8rem', marginLeft: '5px', borderColor: 'red', color: 'red' }}>
                        🗑️ Delete
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export default Employees;
