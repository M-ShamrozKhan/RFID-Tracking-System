import React, { useState, useEffect } from 'react';
import axios from 'axios';

function MyTeam() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [allEmployeesMaster, setAllEmployeesMaster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // SuperAdmin specific states
  const [teamsOverview, setTeamsOverview] = useState([]);
  const [selectedTeamManagerId, setSelectedTeamManagerId] = useState(null);
  
  // Gate Passes Modal State
  const [showPassesModal, setShowPassesModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberPasses, setMemberPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);

  const currentEmpId = parseInt(localStorage.getItem('rfid_emp_id')) || 0;
  const userRole = localStorage.getItem('rfid_auth') || 'Employee';

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const res = await axios.get('/api/Employee');
      const allEmployees = res.data;
      setAllEmployeesMaster(allEmployees);

      if (userRole === 'SuperAdmin' || userRole === 'Admin') {
          // Group by divisionManagerId
          const grouped = {};
          allEmployees.forEach(emp => {
              const mgrId = emp.divisionManagerId || 0;
              if (!grouped[mgrId]) {
                  grouped[mgrId] = { 
                      managerId: mgrId, 
                      count: 0, 
                      managerName: 'Direct Reports / Unassigned',
                      department: 'Various Divisions'
                  };
                  if (mgrId !== 0) {
                      const mgrObj = allEmployees.find(m => m.id === mgrId);
                      if (mgrObj) {
                          grouped[mgrId].managerName = mgrObj.name;
                          grouped[mgrId].department = mgrObj.department || 'N/A';
                      }
                  }
              }
              grouped[mgrId].count++;
          });
          
          setTeamsOverview(Object.values(grouped).sort((a,b) => b.count - a.count));
      } else {
          // Standard view for DivisionalManager
          const team = allEmployees.filter(e => e.divisionManagerId === currentEmpId);
          setTeamMembers(team);
      }
    } catch(e) { 
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
      if (selectedTeamManagerId !== null) {
          const team = allEmployeesMaster.filter(e => (e.divisionManagerId || 0) === selectedTeamManagerId);
          setTeamMembers(team);
      }
  }, [selectedTeamManagerId, allEmployeesMaster]);

  const openPassesModal = async (member) => {
    setSelectedMember(member);
    setShowPassesModal(true);
    setLoadingPasses(true);
    try {
      const res = await axios.get('/api/GatePass');
      const passes = res.data.filter(p => p.employeeId === member.id);
      setMemberPasses(passes);
    } catch(e) {
      console.error(e);
    }
    setLoadingPasses(false);
  };

  const filteredTeam = teamMembers.filter(emp => 
    (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (emp.empId || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOverview = teamsOverview.filter(t => 
    (t.managerName || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.department || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isMasterView = (userRole === 'SuperAdmin' || userRole === 'Admin') && selectedTeamManagerId === null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div>
           <h1 className="page-title" style={{ margin: 0 }}>
               {isMasterView ? 'Enterprise Teams Overview' : 'My Team Overview'}
           </h1>
           <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)' }}>
               {isMasterView ? 'Monitor all functional teams and their respective division managers.' : 'Monitor assigned personnel and their hardware movement requests.'}
           </p>
        </div>
        {!isMasterView && (userRole === 'SuperAdmin' || userRole === 'Admin') && (
            <button 
                onClick={() => { setSelectedTeamManagerId(null); setSearchTerm(''); }} 
                className="btn-primary" 
                style={{ padding: '10px 20px', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', boxShadow: 'none' }}
            >
                ← Back to Teams List
            </button>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '0', border: '1px solid var(--border-color)', borderRadius: '12px', marginTop: '20px', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                {isMasterView ? `Functional Teams (${filteredOverview.length})` : `Team Members (${teamMembers.length})`}
            </h3>
            <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder={isMasterView ? "🔍 Search Manager or Dept..." : "🔍 Search name or ID..."} 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ 
                    padding: '8px 15px', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1', 
                    width: '250px',
                    fontSize: '0.9rem' 
                  }} 
                />
            </div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
        <table className="table-main" style={{ margin: 0 }}>
          <thead>
            {isMasterView ? (
                <tr>
                    <th>Division Manager</th>
                    <th>Core Department</th>
                    <th>Team Size</th>
                    <th>Actions</th>
                </tr>
            ) : (
                <tr>
                  <th>Emp. ID</th>
                  <th>Name & Contact</th>
                  <th>Dept & Div</th>
                  <th>Status</th>
                  <th>Assigned Hardware</th>
                  <th>Gate Passes</th>
                </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
                <tr><td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>Loading...</td></tr>
            ) : isMasterView ? (
                filteredOverview.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: "center", fontStyle: "italic", padding: "2rem", color: 'var(--text-muted)' }}>No teams found.</td></tr>
                ) : (
                    filteredOverview.map(team => (
                        <tr key={team.managerId}>
                            <td>
                                <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '1.05rem' }}>{team.managerName}</div>
                                {team.managerId !== 0 && <div style={{fontSize:'0.8em', color:'var(--text-muted)'}}>Manager ID: {team.managerId}</div>}
                            </td>
                            <td>
                                <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem' }}>
                                    {team.department}
                                </span>
                            </td>
                            <td>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#3b82f6' }}>{team.count}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Personnel</div>
                            </td>
                            <td>
                                <button 
                                    onClick={() => { setSelectedTeamManagerId(team.managerId); setSearchTerm(''); }} 
                                    className="btn-primary" 
                                    style={{ padding: '8px 20px', borderRadius: '8px', fontWeight: '700' }}
                                >
                                    🔍 View Team
                                </button>
                            </td>
                        </tr>
                    ))
                )
            ) : (
                filteredTeam.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: "center", fontStyle: "italic", padding: "2rem", color: 'var(--text-muted)' }}>No team members assigned to this division yet.</td></tr>
                ) : (
                    filteredTeam.map(emp => (
                      <tr key={emp.id}>
                        <td><strong>{emp.empId}</strong></td>
                        <td>
                          <div style={{ fontWeight: '800', color: '#1e293b' }}>{emp.name}</div>
                          <div style={{fontSize:'0.8em', color:'var(--text-muted)'}}>{emp.contactDetails || '-'}</div>
                        </td>
                        <td>
                           <div style={{ fontWeight: '600' }}>{emp.department}</div>
                           <div style={{fontSize:'0.8em', color:'var(--text-muted)', marginTop:'2px'}}>{emp.division}</div>
                        </td>
                        <td><span className={emp.status === 'Active' ? 'badge badge-success' : 'badge badge-danger'}>{emp.status}</span></td>
                        <td>
                           {emp.assignedAssets && emp.assignedAssets.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {emp.assignedAssets.map(a => (
                                  <span key={a.id} className="badge badge-info" title={a.brandModel} style={{ width: 'fit-content' }}>💻 {a.assetId}</span>
                                ))}
                              </div>
                           ) : (
                              <span style={{color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic'}}>N/A</span>
                           )}
                        </td>
                        <td>
                            <button onClick={() => openPassesModal(emp)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}>
                                👀 View Requests
                            </button>
                        </td>
                      </tr>
                    ))
                )
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* GATE PASSES MODAL */}
      {showPassesModal && selectedMember && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="glass-panel" style={{ width: '90%', maxWidth: '900px', maxHeight: '85vh', position: 'relative', background: '#ffffff', padding: '0', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ padding: '20px 25px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', fontWeight: '900' }}>Gate Pass History</h3>
                        <div style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: '600', marginTop: '4px' }}>Employee: {selectedMember.name} ({selectedMember.empId})</div>
                    </div>
                    <button onClick={() => setShowPassesModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
                </div>
                
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#f1f5f9' }}>
                    {loadingPasses ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Fetching records...</div>
                    ) : memberPasses.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: 'white', borderRadius: '12px' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📭</div>
                            No gate pass requests found for this employee.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {memberPasses.map(p => (
                                <div key={p.id} style={{ background: 'white', borderRadius: '12px', padding: '15px 20px', border: '1px solid #e2e8f0', display: 'flex', gap: '20px', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ 
                                        width: '50px', height: '50px', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '900',
                                        background: p.status === 'Approved' ? '#ecfdf5' : p.status === 'Rejected' ? '#fef2f2' : p.status === 'Closed' ? '#f1f5f9' : '#eff6ff',
                                        color: p.status === 'Approved' ? '#10b981' : p.status === 'Rejected' ? '#ef4444' : p.status === 'Closed' ? '#64748b' : '#3b82f6',
                                    }}>
                                        {p.status === 'Approved' ? '✓' : p.status === 'Rejected' ? '✕' : p.status === 'Closed' ? '🔒' : '⏳'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                            <strong style={{ color: '#1e293b', fontSize: '1.05rem' }}>Asset: {p.taggedDevice || 'N/A'}</strong>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', color: '#64748b' }}>GP-{String(p.id).padStart(4, '0')}</span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px', fontStyle: 'italic' }}>
                                            "{p.reason}"
                                        </div>
                                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.8rem', fontWeight: '600' }}>
                                            <span style={{ color: '#10b981' }}>OUT: {new Date(p.validFrom).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                            <span style={{ color: '#ef4444' }}>IN: {new Date(p.validTill).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                        </div>
                                        {p.remarks && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>Notes: {p.remarks}</div>}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                        <div style={{ fontWeight: '800', fontSize: '0.85rem', color: p.status === 'Approved' ? '#10b981' : p.status === 'Rejected' ? '#ef4444' : p.status === 'Closed' ? '#64748b' : '#3b82f6', textTransform: 'uppercase' }}>
                                            {p.status}
                                        </div>
                                        {p.approvedBy && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>by {p.approvedBy}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default MyTeam;
