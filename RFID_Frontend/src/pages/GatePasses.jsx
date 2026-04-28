import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = '/api/GatePass';
const ASSET_URL = '/api/Asset';

function GatePasses() {
  const { tab } = useParams();
  const activeTab = tab || 'requests';

  const [passes, setPasses] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allEmployees, setAllEmployees] = useState([]);
  const [adminSelectedEmpId, setAdminSelectedEmpId] = useState('');

  // Form State (Now singular selection dropdown)
  const [selectedAssetId, setSelectedAssetId] = useState(''); 
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 16));
  const [validTill, setValidTill] = useState('');
  const [reason, setReason] = useState('');
  
  // Simulation State
  const [simTagId, setSimTagId] = useState('');
  const [simGate, setSimGate] = useState('Gate 1 (Main Exit)');
  const [isSimulating, setIsSimulating] = useState(false);
  const [scanResult, setScanResult] = useState({ type: '', text: '' });

  // Modal State
  const [rejectModal, setRejectModal] = useState({ isOpen: false, passId: null, reasonText: '' });

  const userRole = localStorage.getItem('rfid_auth') || 'Employee';
  const currentEmpId = parseInt(localStorage.getItem('rfid_emp_id')) || 0; 
  const currentEmpName = localStorage.getItem('rfid_user_name') || 'Personnel';

  useEffect(() => {
    fetchData();
  }, [userRole]);

  const fetchData = async () => {
    try {
      let allPasses = [];
      let allAssetsData = [];
      let allEmployeesData = [];

      try {
        const pRes = await axios.get(API_URL);
        allPasses = pRes.data;
      } catch (err) { console.error("GatePass fetch error:", err); }

      try {
        const aRes = await axios.get(ASSET_URL);
        allAssetsData = aRes.data;
      } catch (err) { console.error("Asset fetch error:", err); }

      try {
        const eRes = await axios.get('/api/Employee');
        allEmployeesData = eRes.data;
      } catch (err) { console.error("Employee fetch error:", err); }

      // Filter based on Role
      if (userRole === 'SuperAdmin' || userRole === 'SecurityAdmin') {
        setPasses(allPasses);
      } else if (userRole === 'DivisionalManager') {
        // Only show their own passes, OR passes from employees mapped to them
        const mySubordinates = allEmployeesData.filter(e => e.divisionManagerId === currentEmpId).map(e => e.id);
        setPasses(allPasses.filter(p => p.employeeId === currentEmpId || mySubordinates.includes(p.employeeId)));
      } else {
        // Employee sees only their own
        setPasses(allPasses.filter(p => p.employeeId === currentEmpId));
      }

      setAllAssets(allAssetsData);
      setAllEmployees(allEmployeesData);

      // We still map 'myAssets' for the pure Employee Dashboard widget
      const currentUserName = (localStorage.getItem('rfid_user_name') || "").toLowerCase().trim();
      const currentEmpIdString = String(localStorage.getItem('rfid_emp_id') || "").trim();
      
      console.log("🛠️ RFID HUB - Scanning for User:", { currentUserName, currentEmpIdString });

      // Step 1: Scan global personnel registry for the EXACT authenticated master profile
      const myProfile = allEmployeesData.find(e => String(e.id || e.Id) === String(currentEmpIdString));

      // Step 2: Extract User's Assigned Devices DIRECTLY from the Employee Profile
      const userHardware = [];
      if (myProfile && myProfile.assignedAssets) {
          myProfile.assignedAssets.forEach(a => {
              userHardware.push({
                  id: a.id || a.Id || a.ID,
                  label: `${a.assetId || a.AssetId || a.AssetID || 'N/A'} - ${a.brandModel || a.BrandModel || 'Device'}`
              });
          });
      }

      setMyAssets(userHardware);
      console.log("✅ RFID HUB - Assets Mapped to User:", userHardware.length, "from Profile:", myProfile?.name);

    } catch (e) { console.error("Fetch Error:", e); }
    setLoading(false);
  };

  const handleRequest = async (e) => {
      e.preventDefault();
      if (!selectedAssetId || !validTill) return alert("Please select an Asset and an Expiry Time");

      const profileIdToUse = (userRole !== 'Staff/Employee' && userRole !== 'Employee' && adminSelectedEmpId) 
                              ? adminSelectedEmpId 
                              : currentEmpId;

      try {
          await axios.post(`${API_URL}/request`, { 
              assetId: parseInt(selectedAssetId), 
              employeeId: parseInt(profileIdToUse), 
              validFrom: new Date(validFrom).toISOString(),
              validTill: new Date(validTill).toISOString(),
              reason: reason,
              status: "Requested",
              approvedBy: "",
              remarks: ""
          });

          alert(`📨 Success: Gate Pass Request submitted for DM Approval.`);
          setSelectedAssetId(''); setValidTill(''); setReason('');
          fetchData();
      } catch (err) { 
          console.error("Payload Rejection:", err.response?.data);
          let errMsg = err.response?.data?.title || "Request Failed! Please ensure the server is responsive.";
          if (err.response?.data?.errors) {
             errMsg += "\n" + JSON.stringify(err.response.data.errors);
          }
          alert(`⚠️ ${errMsg}`); 
      }
  };

  const handleApprove = async (id) => {
    const managerName = `${currentEmpName} (${userRole})`; 
    try {
        await axios.put(`${API_URL}/approve/${id}`, `"${managerName}"`, { headers: { 'Content-Type': 'application/json' }});
        alert('✅ Gate Pass Approved Successfully! Hardware exit is authorized.');
        fetchData();
    } catch(e) { alert("⚠️ Approval failed."); }
  };

  const openRejectModal = (id) => {
    setRejectModal({ isOpen: true, passId: id, reasonText: '' });
  };

  const closeRejectModal = () => {
    setRejectModal({ isOpen: false, passId: null, reasonText: '' });
  };

  const submitReject = async () => {
    if (!rejectModal.reasonText) return alert("Please provide rejection remarks.");
    try {
        await axios.put(`${API_URL}/reject/${rejectModal.passId}`, `"${rejectModal.reasonText}"`, { headers: {'Content-Type': 'application/json'} });
        alert("⛔ Pass Rejected.");
        closeRejectModal();
        fetchData();
    } catch(e) { alert("Action failed."); }
  };

  const handleSimulate = async (dir) => {
    if (!simTagId) return setScanResult({ type: 'error', text: 'Select an Asset to Simulate RFID Scan' });
    setIsSimulating(true);
    setScanResult({ type: '', text: '' });
    try {
        const res = await axios.post(`/api/Gate/scan`, { 
            rfidTagId: simTagId, 
            gateId: simGate, 
            direction: dir 
        });
        setScanResult({ type: 'success', text: res.data.message });
        fetchData();
    } catch(err) {
        setScanResult({ type: 'error', text: err.response?.data?.error || "Movement Blocked / Unauthorized 🚨" });
        fetchData();
    }
    setIsSimulating(false);
  };

  const thStyle = { padding: '18px 16px', textAlign: 'left', borderBottom: '2px solid #f1f5f9', fontSize: '0.8rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const tdStyle = { padding: '18px 16px', borderBottom: '1px solid #f1f5f9' };
  const activeTabStyle = { padding: '12px 28px', borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: 'white', fontWeight: '800', cursor: 'pointer', border: 'none', transition: '0.4s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.25)' };
  const inactiveTabStyle = { padding: '12px 28px', borderRadius: '12px', background: 'transparent', color: '#64748b', fontWeight: '700', cursor: 'pointer', border: '1px solid transparent', transition: '0.3s' };

  if(loading) return <div style={{padding:'2rem', textAlign:'center'}}>Initializing Automated Security Hub...</div>;

  // --- Computed Master Data ---
  const profileIdToUse = (userRole !== 'Staff/Employee' && userRole !== 'Employee' && adminSelectedEmpId) 
                          ? adminSelectedEmpId 
                          : currentEmpId;
                          
  const activeProfile = allEmployees.find(e => String(e.id || e.Id) === String(profileIdToUse));
  
  const activeAssets = activeProfile && activeProfile.assignedAssets 
      ? activeProfile.assignedAssets.map(a => {
          const fullAsset = allAssets.find(x => x.id === (a.id || a.Id));
          return {
              id: a.id || a.Id,
              label: `${a.assetId || a.AssetId || 'N/A'} - ${a.brandModel || a.BrandModel || 'Device'} (${a.rfidTagId || a.RfidTagId || 'No Tag'})`,
              status: fullAsset ? fullAsset.currentStatus : 'Inside'
          };
        }).filter(a => a.status !== 'Inactive')
      : [];
  // -----------------------------

  return (
    <div style={{ maxWidth: (userRole?.toLowerCase() === 'staff/employee' || userRole?.toLowerCase() === 'employee') ? '900px' : '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
        <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', letterSpacing: '-1px' }}>{ (userRole?.toLowerCase() === 'staff/employee' || userRole?.toLowerCase() === 'employee') ? 'MY GATE PASSES' : 'RFID SECURITY HUB'}</h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                { (userRole?.toLowerCase() === 'staff/employee' || userRole?.toLowerCase() === 'employee') ? `Hello ${currentEmpName}! Manage your official tagged devices below.` : 'Automated Hardware Movement & Logistics Control'}
            </p>
        </div>
      </div>

      { (userRole?.toLowerCase() === 'staff/employee' || userRole?.toLowerCase() === 'employee') && (
        <div style={{ background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '20px', padding: '30px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '25px' }}>
           <div style={{ fontSize: '3rem', background: 'white', width: '80px', height: '80px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>💼</div>
           <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#0369a1' }}>My Authorized Inventory</h2>
              <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap' }}>
                 {myAssets.length === 0 ? (
                    <span style={{ color: '#0369a1', fontWeight: '600' }}>No laptops are currently tagged to your profile.</span>
                 ) : myAssets.map(a => (
                    <div key={a.id} style={{ background: 'rgba(255,255,255,0.7)', padding: '8px 15px', borderRadius: '10px', fontWeight: '800', border: '1px solid rgba(3, 105, 161, 0.2)', color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       📱 {a.label}
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div style={{ marginBottom: '50px' }}>
            <div style={{ paddingBottom: '15px', borderBottom: '2px solid #e2e8f0', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900', color: 'var(--text-main)' }}>Gate Pass Request</h2>
                <p style={{ margin: '5px 0 0 0', fontSize: '1.rem', color: 'var(--text-muted)' }}>Generate a complete digital gate pass protocol. Only approved passes will permit hardware exit at the RFID Gateway.</p>
            </div>

            <form onSubmit={handleRequest} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', alignItems: 'end' }}>
                
                {/* ADMIN OVERRIDE ROW */}
                {(userRole?.toLowerCase() !== 'staff/employee' && userRole?.toLowerCase() !== 'employee') && (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '15px', borderBottom: '1px dashed #cbd5e1' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#4f46e5' }}>🔓 Admin Override: Select Employee Profile</label>
                        <select 
                            value={adminSelectedEmpId} 
                            onChange={e => setAdminSelectedEmpId(e.target.value)} 
                            style={{ padding: '16px', borderRadius: '8px', border: '2px solid #818cf8', fontSize: '1rem', background: '#eef2ff', color: '#4f46e5', fontWeight: '700' }}
                        >
                            <option value="">-- Employee ID / Default Self ({currentEmpName}) --</option>
                            {allEmployees.filter(emp => userRole === 'DivisionalManager' ? emp.divisionManagerId === currentEmpId : true).map(emp => {
                                const id = emp.id || emp.Id;
                                const actualEmpId = emp.empId || emp.EmpId || `ID-${id}`;
                                const actualName = emp.name || emp.Name || "Unknown Employee";
                                return (
                                  <option key={id} value={id}>({actualEmpId}) {actualName} - {emp.department || emp.Department}</option>
                                );
                            })}
                        </select>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Select an Employee System ID. The matching assigned hardware will dynamically load below.</p>
                    </div>
                )}

                {/* Full Width Row 1: Assign Asset */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>Select Assigned Asset for Movement *</label>
                    <select required value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)} style={{ padding: '16px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '1rem', background: '#f8fafc', color: '#0f172a', fontWeight: '600' }}>
                        <option value="">-- Choose from tagged devices --</option>
                        {activeAssets.length === 0 ? (
                           <option disabled value="">⚠️ No Hardware Assigned (Contact Admin)</option>
                        ) : activeAssets.map(a => (
                           <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                    </select>
                </div>

                {/* Auto Flow Grid Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>Exit Date & Time *</label>
                    <input required type="datetime-local" value={validFrom} onChange={e => setValidFrom(e.target.value)} style={{ padding: '16px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '1rem', background: '#f8fafc' }} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ef4444' }}>Return Date & Time *</label>
                    <input required type="datetime-local" value={validTill} onChange={e => setValidTill(e.target.value)} style={{ padding: '16px', borderRadius: '8px', border: '2px solid #fca5a5', fontSize: '1rem', background: '#fef2f2', color: '#991b1b' }} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>Movement Reason / Client / Location *</label>
                    <textarea required placeholder="e.g. Scheduled client demo at Site A, or transferring to WFH location..." value={reason} onChange={e => setReason(e.target.value)} style={{ padding: '16px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '1rem', background: '#f8fafc', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                    <button type="submit" className="btn-primary" style={{ padding: '18px 40px', fontSize: '1.1rem', fontWeight: '900', letterSpacing: '1px', width: '100%' }}>
                        SUBMIT OFFICIAL REQUEST
                    </button>
                    {(userRole === 'Staff/Employee' || userRole === 'Employee') && (
                        <div style={{ marginTop: '15px', fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                            Logging Request As: <strong style={{color: '#64748b'}}>{currentEmpName}</strong> (ID: {currentEmpId})
                        </div>
                    )}
                </div>
            </form>
        </div>
      )}

      {activeTab === 'automation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', marginBottom: '30px' }}>
            {/* Dark Terminal Control */}
            <div style={{ background: '#0f172a', borderRadius: '32px', padding: '45px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                <div style={{ position: 'absolute', top: 30, right: 30, opacity: 0.1, fontSize: '6rem', fontWeight: '900', userSelect: 'none' }}>G-01</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#94a3b8', letterSpacing: '3px', fontWeight: '800' }}>VIRTUAL RFID ANTENNA SYSTEM</h3>
                </div>
                
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '25px', fontWeight: '500' }}>
                   This console simulates the physical RFID readers installed at the premises gates. Use this to test the automated movement rules without hardware.
                </p>

                {scanResult.text && (
                    <div style={{ padding: '15px 20px', borderRadius: '12px', marginBottom: '25px', border: `1px solid ${scanResult.type === 'error' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, background: scanResult.type === 'error' ? 'rgba(244, 63, 94, 0.05)' : 'rgba(16, 185, 129, 0.05)', color: scanResult.type === 'error' ? '#fda4af' : '#6ee7b7', fontWeight: '700', fontSize: '0.9rem' }}>
                        {scanResult.text}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '35px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center', transition: '0.3s' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '20px', filter: 'drop-shadow(0 0 15px rgba(244, 63, 94, 0.4))' }}>📤</div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>EXIT GATE SENSOR</h4>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '30px', height: '40px' }}>Logs movement 'Outside' and validates digital gate passes.</p>
                        <button disabled={isSimulating} onClick={() => handleSimulate('Out')} style={{ padding: '14px', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', width: '100%', boxShadow: '0 8px 20px rgba(244, 63, 94, 0.3)' }}>TRIGGER SCAN</button>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '35px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center', transition: '0.3s' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '20px', filter: 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.4))' }}>📥</div>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>ENTRY GATE SENSOR</h4>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '30px', height: '40px' }}>Detects returning hardware and 'Auto-Closes' active passes.</p>
                        <button disabled={isSimulating} onClick={() => handleSimulate('In')} style={{ padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', width: '100%', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)' }}>TRIGGER SCAN</button>
                    </div>
                </div>

                <div style={{ marginTop: '40px', padding: '20px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '15px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                   <div style={{ fontWeight: '800', color: '#818cf8', marginBottom: '5px', fontSize: '0.85rem' }}>LOGISTICS PROTOCOL:</div>
                   <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                      Exit scans require an <strong>Approved</strong> pass. Entry scans automatically transition hardware status to <strong>Inside</strong> and retire pass credentials.
                   </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'white', borderRadius: '28px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                    <h4 style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Active Statistics</h4>
                    <div style={{ display: 'grid', gap: '15px' }}>
                        <div style={{ padding: '15px', borderRadius: '15px', background: '#f8fafc', borderLeft: '5px solid #4f46e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569' }}>Total Activity</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>{passes.length}</span>
                        </div>
                        <div style={{ padding: '15px', borderRadius: '15px', background: '#f8fafc', borderLeft: '5px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569' }}>Inside Premise</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>{allAssets.filter(a => (a.currentStatus || 'Inside') !== 'Outside').length}</span>
                        </div>
                        <div style={{ padding: '15px', borderRadius: '15px', background: '#f8fafc', borderLeft: '5px solid #f43f5e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569' }}>Outside Assets</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>{allAssets.filter(a => (a.currentStatus || 'Inside') === 'Outside').length}</span>
                        </div>
                    </div>
                </div>
                
                <div style={{ background: 'white', borderRadius: '28px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                    <h4 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Simulation Tool</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>RFID Tag Target</label>
                        <select value={simTagId} onChange={e => setSimTagId(e.target.value)} style={{ padding: '12px', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#f8fafc', fontWeight: '700', fontSize: '0.9rem' }}>
                            <option value="">-- Select Hardware Tag --</option>
                            {allAssets.map(a => {
                                const tag = a.rfidTagId || a.RfidTagId;
                                const label = a.assetId || a.AssetId || 'UNTAGGED';
                                if(!tag) return null;
                                return <option key={a.id || a.Id} value={tag}>{label} ({tag})</option>;
                            })}
                        </select>
                    </div>
                </div>
            </div>
        </div>
      )}

      {(activeTab === 'requests' || activeTab === 'approvals') && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.08)' }}>
            <div style={{ padding: '25px 30px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>
                    {activeTab === 'approvals' ? 'PENDING MANAGEMENT QUEUE' : 'GATE PASS HISTORY'}
                </h3>
                <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>Showing {passes.length} Records</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Identity & ID</th>
                            <th style={thStyle}>Hardware Purpose</th>
                            <th style={thStyle}>Timeline</th>
                            <th style={thStyle}>Live Status</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {passes.length === 0 && (
                            <tr><td colSpan="5" style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📭</div>
                                <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>No Data Packets Found</div>
                                <div style={{ fontSize: '0.9rem' }}>The live movement registry is currently empty for this view.</div>
                            </td></tr>
                        )}
                        {passes.filter(p => {
                            if (activeTab === 'approvals') return p.status === 'Requested';
                            if (userRole === 'Staff/Employee' || userRole === 'Employee') return p.employeeId === parseInt(localStorage.getItem('rfid_emp_id'));
                            return true;
                        }).map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }} className="registry-row">
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: p.status === 'Approved' ? '#ecfdf5' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: p.status === 'Approved' ? '#10b981' : '#3b82f6', fontWeight: '900', position: 'relative' }}>
                                            {p.personnelName ? p.personnelName.charAt(0).toUpperCase() : '👤'}
                                            {p.status === 'Approved' && (
                                                <div style={{ position: 'absolute', top: -3, right: -3, width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', border: '2px solid white', animation: 'pulse 1.5s infinite' }}></div>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '800', color: '#1e293b' }}>{p.personnelName || 'Unknown Identity'}</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#4f46e5' }}>GP-{String(p.id).padStart(4, '0')}</div>
                                        </div>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>Asset: {p.taggedDevice || 'N/A'}</div>
                                    {p.reason && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', fontStyle: 'italic', paddingLeft: '10px', borderLeft: '2px solid #e2e8f0' }}>"{p.reason}"</div>}
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: '800', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                                            EXIT: {new Date(p.validFrom).toLocaleDateString()} {new Date(p.validFrom).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                        <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></div>
                                            RTN: {new Date(p.validTill).toLocaleDateString()} {new Date(p.validTill).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ 
                                        padding: '6px 12px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '900', width: 'fit-content',
                                        background: p.status === 'Approved' ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : p.status === 'Rejected' ? '#fef2f2' : p.status === 'Closed' ? '#f1f5f9' : '#eff6ff',
                                        color: p.status === 'Approved' ? '#059669' : p.status === 'Rejected' ? '#ef4444' : p.status === 'Closed' ? '#64748b' : '#3b82f6',
                                        textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}>
                                        {p.status === 'Approved' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }}></div>}
                                        {p.status}
                                    </div>
                                    {p.remarks && <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '6px' }}>Notes: {p.remarks}</div>}
                                </td>
                                <td style={tdStyle}>
                                    {p.status === 'Requested' && (userRole === 'SuperAdmin' || userRole === 'DivisionalManager' || userRole === 'Admin') ? (
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleApprove(p.id)} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '0.8rem', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' }}>Approve</button>
                                            <button onClick={() => openRejectModal(p.id)} style={{ padding: '8px 16px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '0.8rem' }}>Reject</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {p.status === 'Approved' ? <div style={{ color: '#10b981', fontWeight: '800', fontSize: '0.85rem' }}>✓ {p.approvedBy}</div> :
                                             p.status === 'Closed' ? <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>Retired Archive</div> :
                                             <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Authenticated</div>}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '24px', padding: '35px', width: '90%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>⛔</div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#1e293b' }}>Deny Gate Pass</h3>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Provide remarks for the rejection.</p>
                    </div>
                </div>
                
                <textarea 
                    autoFocus
                    placeholder="E.g. Reason invalid, missing client approval, etc..."
                    value={rejectModal.reasonText} 
                    onChange={e => setRejectModal({...rejectModal, reasonText: e.target.value})} 
                    style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '0.95rem', background: '#f8fafc', minHeight: '100px', resize: 'none', marginBottom: '25px', color: '#1e293b', boxSizing: 'border-box' }} 
                />
                
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={closeRejectModal} style={{ padding: '12px 24px', background: 'transparent', border: 'none', color: '#64748b', fontWeight: '800', cursor: 'pointer', borderRadius: '10px', fontSize: '0.9rem' }}>Cancel</button>
                    <button onClick={submitReject} style={{ padding: '12px 24px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)', fontSize: '0.9rem' }}>Confirm Reject</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default GatePasses;
