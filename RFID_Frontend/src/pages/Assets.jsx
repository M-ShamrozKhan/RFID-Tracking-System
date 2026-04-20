import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/Asset';
const EMP_URL = 'http://localhost:5000/api/Employee';

function Assets() {
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [assetId, setAssetId] = useState('');
  const [rfidTagId, setRfidTagId] = useState('');
  const [brand, setBrand] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDetails, setPurchaseDetails] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [historyData, setHistoryData] = useState(null);

  // Assignment Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssetForAssignment, setSelectedAssetForAssignment] = useState(null);
  const [assignmentEmpId, setAssignmentEmpId] = useState('0');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assRes, empRes] = await Promise.all([ axios.get(API_URL), axios.get(EMP_URL) ]);
      setAssets(assRes.data || []); setEmployees(empRes.data || []);
    } catch(e) { }
    setLoading(false);
  };

  const clearForm = () => {
    setAssetId(''); setRfidTagId(''); setBrand(''); setSerialNumber(''); setPurchaseDetails(''); setWarrantyInfo('');
    setIsEditing(false); setEditId(null);
  }

  const handleEditClick = (asset) => {
    setIsEditing(true); setEditId(asset.id);
    setAssetId(asset.assetId); setRfidTagId(asset.rfidTagId); setBrand(asset.brandModel);
    setSerialNumber(asset.serialNumber || ''); setPurchaseDetails(asset.purchaseDetails || ''); setWarrantyInfo(asset.warrantyInfo || '');
  }

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    const payload = { 
        assetId: assetId || 'AUTO_GEN', 
        rfidTagId, brandModel: brand, 
        serialNumber, purchaseDetails, warrantyInfo, 
        currentStatus: isEditing ? undefined : 'Inside' 
    };
    try {
      if(isEditing) {
        await axios.put(`${API_URL}/${editId}`, payload);
        alert('Asset Updated Successfully!');
      } else {
        await axios.post(API_URL, payload);
        alert('Asset Registered!');
      }
      fetchData();
    } catch(e) { 
        console.error(e.response?.data || e);
        alert('Failed to save asset: ' + (e.response?.data?.title || JSON.stringify(e.response?.data?.errors) || e.message)); 
    }
    clearForm();
  };

  const handleAssignClick = (asset) => {
      setSelectedAssetForAssignment(asset);
      setAssignmentEmpId(asset.assignedEmployee ? asset.assignedEmployee.id.toString() : '0');
      setShowAssignModal(true);
  };

  const submitAssignment = async (e) => {
      e.preventDefault();
      const empId = parseInt(assignmentEmpId);
      try {
          await axios.put(`${API_URL}/assign/${selectedAssetForAssignment.id}`, empId, { headers: { 'Content-Type': 'application/json' }});
          fetchData();
          setShowAssignModal(false);
      } catch(err) { 
          alert("Assignment Failed."); 
      }
  };

  const handleToggleStatus = async (asset) => {
      const newStatus = asset.currentStatus === 'Inactive' ? 'Inside' : 'Inactive';
      if(window.confirm(`Are you sure you want to mark this asset as ${newStatus}?`)) {
          try {
              await axios.put(`${API_URL}/status/${asset.id}`, `"${newStatus}"`, { headers: { 'Content-Type': 'application/json' }});
              fetchData();
          } catch(e) {}
      }
  };

  const fetchHistory = async (asset) => {
      try {
          const res = await axios.get(`${API_URL}/history/${asset.id}`);
          setHistoryData({ asset, logs: res.data });
      } catch(e) { }
  };

  return (
    <div>
      {/* 1. ASSIGNMENT MODAL */}
      {showAssignModal && selectedAssetForAssignment && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="glass-panel" style={{ width: '450px', position: 'relative', background: '#ffffff', padding: '30px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                <button onClick={() => setShowAssignModal(false)} style={{position: 'absolute', top: '15px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)'}}>×</button>
                <div style={{color: 'var(--primary-color)', fontSize: '1.2rem', fontWeight: '800', marginBottom: '5px'}}>
                    Link Hardware Node
                </div>
                <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: '500'}}>
                    Asset: <strong style={{color: '#1e293b'}}>{selectedAssetForAssignment.assetId}</strong> ({selectedAssetForAssignment.brandModel})
                </div>
                
                <form onSubmit={submitAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="floating-group" style={{ marginBottom: '0' }}>
                        <select 
                            className="floating-input" 
                            value={assignmentEmpId} 
                            onChange={(e) => setAssignmentEmpId(e.target.value)}
                            style={{ padding: '15px 12px', background: '#f8fafc', fontWeight: '700', color: '#1e293b' }}
                        >
                            <option value="0">⚠️ Un-assign / Reclaim to IT</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} ({emp.empId} - {emp.department})</option>
                            ))}
                        </select>
                        <label className="floating-label">Mapped Employee Profile</label>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px', fontWeight: '800' }}>Confirm Update</button>
                        <button type="button" onClick={() => setShowAssignModal(false)} className="btn-outline" style={{ flex: 1, padding: '12px' }}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* 2. HISTORY MODAL */}
      {historyData && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="glass-panel" style={{ width: '80%', maxHeight: '80%', overflowY: 'auto', position: 'relative' }}>
                <button onClick={() => setHistoryData(null)} style={{position: 'absolute', top: '15px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-color)'}}>×</button>
                <div className="section-title">Movement Log: {historyData.asset.assetId}</div>
                <div style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '15px'}}>{historyData.asset.brandModel} ({historyData.asset.rfidTagId})</div>
                
                <table className="table-main">
                    <thead>
                        <tr><th>Date/Time</th><th>Gate</th><th>Direction</th><th>Status</th><th>Reason</th></tr>
                    </thead>
                    <tbody>
                        {historyData.logs.length === 0 ? <tr><td colSpan="5" style={{textAlign:'center', padding:'2rem', fontStyle:'italic'}}>No movement recorded.</td></tr> :
                         historyData.logs.map(log => (
                            <tr key={log.id}>
                                <td>{new Date(log.timestamp).toLocaleString()}</td>
                                <td>{log.gateId}</td>
                                <td><span className={log.direction === 'In' ? 'badge badge-success' : 'badge badge-info'}>{log.direction}</span></td>
                                <td><span className={log.isAuthorized ? 'badge badge-success' : 'badge badge-danger'}>{log.isAuthorized ? 'Authorized' : 'Unauthorized'}</span></td>
                                <td>{log.reason}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      <h1 className="page-title">Assets & Laptops Master</h1>
      
      <div className="glass-panel" style={{ background: '#fafafa', padding: '25px', borderRadius: '12px' }}>
        <div className="section-title" style={{color: 'var(--primary-color)', borderBottom: 'none'}}>
            <span>{isEditing ? 'Edit Asset Details' : 'Register New Laptop'}</span>
        </div>
        <form onSubmit={handleSaveAsset} className="form-grid-multi">
          
          {isEditing && (
            <div className="floating-group">
              <input disabled placeholder=" " value={assetId} onChange={e => setAssetId(e.target.value)} className="floating-input" style={{background: '#f1f5f9'}} />
              <label className="floating-label">Asset Tag No. (Auto-Assigned)</label>
            </div>
          )}

          <div className="floating-group">
            <input required placeholder=" " value={rfidTagId} onChange={e => setRfidTagId(e.target.value)} className="floating-input" />
            <label className="floating-label">RFID Tag UID *</label>
          </div>

          <div className="floating-group">
            <input required placeholder=" " value={brand} onChange={e => setBrand(e.target.value)} className="floating-input" />
            <label className="floating-label">Brand & Model *</label>
          </div>
          
          <div className="floating-group">
            <input placeholder=" " value={serialNumber} onChange={e => setSerialNumber(e.target.value)} className="floating-input" />
            <label className="floating-label">Serial Number</label>
          </div>

          <div className="floating-group">
            <input placeholder=" " value={purchaseDetails} onChange={e => setPurchaseDetails(e.target.value)} className="floating-input" />
            <label className="floating-label">Purchase Details</label>
          </div>

          <div className="floating-group">
            <input placeholder=" " value={warrantyInfo} onChange={e => setWarrantyInfo(e.target.value)} className="floating-input" />
            <label className="floating-label">Warranty Info</label>
          </div>

          <div className="floating-group" style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', height: 'auto' }}>
            <button type="submit" className="btn-primary" style={{ marginBottom: '2px' }}>{isEditing ? 'Update Asset' : 'Save Laptop'}</button>
            {isEditing && <button type="button" onClick={clearForm} className="btn-outline" style={{ height: '44px' }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', marginTop: '20px' }}>
        <table className="table-main">
          <thead>
            <tr>
              <th>Asset Info</th>
              <th>RFID Tag</th>
              <th>Hardware</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && assets.length === 0 && (
                <tr><td colSpan="6" style={{textAlign: "center", padding: "2rem", color: "var(--text-muted)"}}>No Laptops Registered Yet.</td></tr>
            )}
            {assets.map(a => (
              <tr key={a.id}>
                <td>
                  <strong>{a.assetId}</strong>
                  <div style={{fontSize:'0.8em', color:'var(--text-muted)'}}>SN: {a.serialNumber || 'N/A'}</div>
                </td>
                <td><code className="chip">{a.rfidTagId}</code></td>
                <td>
                  <div>{a.brandModel}</div>
                  <div style={{fontSize:'0.75em', color:'var(--text-muted)'}}>{a.warrantyInfo ? `Warranty: ${a.warrantyInfo}` : ''}</div>
                </td>
                <td>
                   {a.assignedEmployee ? 
                     <span><strong>{a.assignedEmployee.name}</strong> <span style={{fontSize:'0.75em', color:'var(--text-muted)'}}>(ID: {a.assignedEmployee.id})</span></span> 
                     : 
                     <span style={{color: 'var(--warning-text)', fontStyle: 'italic', fontWeight: '500'}}>Not Assigned</span>
                   }
                </td>
                <td>
                  <span className={a.currentStatus === 'Inside' ? 'badge badge-success' : (a.currentStatus === 'Outside' ? 'badge badge-info' : (a.currentStatus === 'Inactive' ? 'badge badge-danger' : 'badge badge-warning'))}>
                    {a.currentStatus}
                  </span>
                </td>
                <td>
                    <button onClick={() => handleEditClick(a)} className="btn-outline" style={{padding: '4px 8px', fontSize: '0.8rem', marginRight: '5px'}}>
                        Edit
                    </button>
                    <button onClick={() => handleAssignClick(a)} className="btn-outline" style={{padding: '4px 8px', fontSize: '0.8rem', marginRight: '5px'}}>
                        Reassign
                    </button>
                    <button onClick={() => handleToggleStatus(a)} className="btn-outline" style={{padding: '4px 8px', fontSize: '0.8rem', color: a.currentStatus === 'Inactive' ? 'var(--success-text)' : 'var(--danger-text)', borderColor: a.currentStatus === 'Inactive' ? 'var(--success-bg)' : 'var(--danger-bg)', marginRight: '5px'}}>
                        {a.currentStatus === 'Inactive' ? 'Activate' : 'Deactivate'}
                    </button>
                    <button onClick={() => fetchHistory(a)} className="btn-outline" style={{padding: '4px 8px', fontSize: '0.8rem', borderColor: '#4b5563'}}>
                        📜 History
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Assets;
