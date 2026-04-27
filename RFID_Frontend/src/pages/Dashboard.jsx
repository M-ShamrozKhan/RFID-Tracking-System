import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as signalR from '@microsoft/signalr';

const API_URL = '/api'; 

function Dashboard() {
  const [stats, setStats] = useState({ insideCount: 0, outsideCount: 0, overdueCount: 0, unauthorizedCount: 0 });
  const [drilldownData, setDrilldownData] = useState([]);
  const [drilldownType, setDrilldownType] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDiv, setFilterDiv] = useState('');
  const [filterGate, setFilterGate] = useState('');
  const [filterEmpName, setFilterEmpName] = useState('');
  const [filterAssetId, setFilterAssetId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const userRole = localStorage.getItem('rfid_auth') || 'Employee';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds for real-time consistency

    const connection = new signalR.HubConnectionBuilder()
        .withUrl(`/alerthub`)
        .withAutomaticReconnect()
        .build();

    connection.start().catch();
    connection.on('ReceiveUpdate', () => fetchData());
    connection.on('ReceiveAlert', () => fetchData());

    return () => { clearInterval(interval); connection.stop(); };
  }, []);

  const fetchData = async () => {
    try {
        const empId = parseInt(localStorage.getItem('rfid_emp_id')) || 0;
        const res = await axios.get(`${API_URL}/Dashboard/summary?role=${userRole}&empId=${empId}`);
        setStats(res.data);
        setRecentLogs(res.data.recentLogs || []);
        if (drilldownType) setDrilldownData(res.data.drilldown[drilldownType.toLowerCase()] || []);
        setLoading(false);
    } catch (e) { console.error("Dash Fetch Error:", e); }
  };

  const widgetClick = (type) => {
     if(drilldownType === type) { setDrilldownType(null); setDrilldownData([]); }
     else {
        setDrilldownType(type);
        setDrilldownData(stats.drilldown[type.toLowerCase()] || []);
        setFilterSearch(''); setFilterDept(''); setFilterDiv(''); setFilterGate('');
        setFilterEmpName(''); setFilterAssetId(''); setFilterDateFrom(''); setFilterDateTo('');
     }
  };

  const exportToPDF = () => {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html><head><title>Export: ${drilldownType} Drilldown</title>
        <style>
            body { font-family: sans-serif; padding: 20px; font-size: 10px; }
            h2 { text-transform: uppercase; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: bold; }
        </style></head><body>
        <h2>RFID SYSTEM - ${drilldownType} LOGISTICS EXPORT</h2>
        <table>
            <thead>
                <tr>
                    ${Object.keys(filteredData[0] || {}).map(k => `<th>${k.replace(/([A-Z])/g, ' $1').toUpperCase()}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${filteredData.map(row => `<tr>${Object.values(row).map(val => `<td>${val ?? 'N/A'}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>
        <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body></html>
      `);
  };

  const exportToCSV = (data) => {
     if (!data || data.length === 0) return alert("No active data to export");
     let csvContent = "data:text/csv;charset=utf-8,";
     const headers = Object.keys(data[0]);
     csvContent += headers.join(",") + "\n";
     data.forEach(rowObject => {
        let rowData = headers.map(h => `"${(rowObject[h] ?? '').toString().replace(/"/g, '""')}"`).join(",");
        csvContent += rowData + "\r\n";
     });
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `SOC_Audit_${drilldownType}_${new Date().toISOString().split('T')[0]}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  // Filter Computation
  const filteredData = drilldownData.filter(d => {
      if (filterSearch && !JSON.stringify(d).toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (filterDept && d.department !== filterDept) return false;
      if (filterDiv && d.division !== filterDiv) return false;
      if (filterEmpName && !(d.employeeName || '').toLowerCase().includes(filterEmpName.toLowerCase())) return false;
      if (filterAssetId && !(d.assetId || '').toLowerCase().includes(filterAssetId.toLowerCase())) return false;
      
      const gateMatch = d.lastGateName || d.exitGateName || d.exitGate || d.gateLocation;
      if (filterGate && gateMatch !== filterGate) return false;

      const dateMatch = d.lastMovementTime || d.exitTime || d.attemptTime;
      if (filterDateFrom && dateMatch && new Date(dateMatch) < new Date(filterDateFrom)) return false;
      
      // Ensure dateTo correctly handles end of the day bounds
      if (filterDateTo && dateMatch) {
          const toDateObj = new Date(filterDateTo);
          toDateObj.setHours(23,59,59,999);
          if (new Date(dateMatch) > toDateObj) return false;
      }

      return true;
  });

  // Extract unique elements for dropdowns
  const uniqueDepts = [...new Set(drilldownData.map(d => d.department))].filter(Boolean);
  const uniqueDivs = [...new Set(drilldownData.map(d => d.division))].filter(Boolean);
  const uniqueGates = [...new Set(drilldownData.map(d => d.lastGateName || d.exitGateName || d.exitGate || d.gateLocation))].filter(Boolean).filter(d => d !== 'N/A' && d !== 'Manual Entry');

  // High-Density Metric Grid Styling
  const widgetStyle = (type, color) => ({
      padding: '25px', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer',
      transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden', boxShadow: drilldownType === type ? '0 10px 25px -5px rgba(0,0,0,0.1)' : 'none',
      transform: drilldownType === type ? 'translateY(-5px)' : 'none', borderLeft: (drilldownType === type || true) ? `6px solid ${color}` : '1px solid #e2e8f0'
  });

  if(loading) return <div style={{padding: '3rem', textAlign: 'center'}}>Syncing Live Command Feed...</div>;

  return (
    <div>
      <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: '900', letterSpacing: '-1.5px', color: '#1e293b' }}>SECURITY OPERATIONS CENTER</h1>
          <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '1.1rem', fontWeight: '500' }}>Real-time hardware movement auditing and logistics metrics.</p>
      </div>
      
      {/* 4 STRATEGIC COMMAND CENTER WIDGETS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', marginBottom: '3.5rem' }}>
           <div onClick={() => widgetClick('Inside')} style={widgetStyle('Inside', '#10b981')}>
              <div style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>🏢 Inside Facility</div>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#1e293b', margin: '10px 0' }}>{stats.insideCount}</div>
              <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '800' }}>Active Hardware Registered</div>
           </div>

           <div onClick={() => widgetClick('Outside')} style={widgetStyle('Outside', '#3b82f6')}>
              <div style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>📦 Out of Premises</div>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#1e293b', margin: '10px 0' }}>{stats.outsideCount}</div>
              <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: '800' }}>Authorized Outside Movement</div>
           </div>

           <div onClick={() => widgetClick('Overdue')} style={widgetStyle('Overdue', '#f59e0b')}>
              <div style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>⏳ Overdue Returns</div>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#1e293b', margin: '10px 0' }}>{stats.overdueCount}</div>
              <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '800' }}>Pending Re-entry Scans</div>
           </div>

           <div onClick={() => widgetClick('Unauthorized')} style={widgetStyle('Unauthorized', '#ef4444')}>
              <div style={{ fontSize: '0.85rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>🚨 Alerts Triggered</div>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: '#1e293b', margin: '10px 0' }}>{stats.unauthorizedCount}</div>
              <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: '800' }}>Unauthorized Movements</div>
           </div>
      </div>

      {/* COMMAND CENTER DRILLDOWN LAYER */}
      {drilldownType && (
        <div style={{ background: 'white', borderRadius: '32px', padding: '40px', border: '1px solid #e2e8f0', marginBottom: '3.5rem', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#1e293b' }}>Logistic Breakdown: {drilldownType.toUpperCase()} {drilldownType === 'Inside' ? 'FACILITY' : 'INVENTORY'}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => exportToCSV(filteredData)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📊 Export Excel 
                    </button>
                    <button onClick={exportToPDF} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📄 Export PDF 
                    </button>
                    <button onClick={() => setDrilldownType(null)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>Close Review</button>
                </div>
            </div>

            <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>EMPLOYEE NAME</span>
                        <input type="text" placeholder="Search by name..." value={filterEmpName} onChange={e => setFilterEmpName(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>ASSET ID</span>
                        <input type="text" placeholder="Search by Asset ID..." value={filterAssetId} onChange={e => setFilterAssetId(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>DEPARTMENT</span>
                        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <option value="">All Departments</option>
                            {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>DIVISION</span>
                        <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <option value="">All Divisions</option>
                            {uniqueDivs.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>GATE</span>
                        <select value={filterGate} onChange={e => setFilterGate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                            <option value="">All Gates</option>
                            {uniqueGates.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>DATE RANGE (FROM)</span>
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>DATE RANGE (TO)</span>
                        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 2, minWidth: '300px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>GENERIC SEARCH (TAGS / SN)</span>
                        <input type="text" placeholder="Global search across all fields..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                    </div>
                </div>
            </div>
            
            {drilldownType === 'Inside' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
               <thead>
                 <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>EMP. ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>NAME</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>DEPT & DIV</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>ASSET ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>SR. NO</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>RFID TAG</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>LAST GATE</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>MOVEMENT TIME</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>G. PASS STATUS</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>MAPPED SINCE</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #f1f5f9' }}>ASSET STATUS</th>
                 </tr>
               </thead>
               <tbody>
                  {filteredData.length === 0 ? (
                    <tr><td colSpan="11" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '700' }}>No active records match the selected filters.</td></tr>
                  ) : filteredData.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s', background: i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.5)', fontSize: '0.85rem' }}>
                       <td style={{ padding: '15px', fontWeight: '700', color: '#64748b' }}>{item.employeeSysId}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.employeeName || item.name || 'Unmapped User'}</td>
                       <td style={{ padding: '15px' }}>{item.department !== 'N/A' ? `${item.department} / ${item.division}` : item.division}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#0ea5e9' }}>{item.assetId}</td>
                       <td style={{ padding: '15px', color: '#64748b' }}>{item.serialNumber || 'N/A'}</td>
                       <td style={{ padding: '15px' }}><span style={{ background: '#e2e8f0', padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }}>{item.rfidTagId}</span></td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#f59e0b' }}>{item.lastGateName || 'N/A'}</td>
                       <td style={{ padding: '15px', color: '#64748b' }}>{item.lastMovementTime ? new Date(item.lastMovementTime).toLocaleString() : 'No Entry'}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: item.gatePassStatus === 'Approved' ? '#10b981' : '#94a3b8' }}>{String(item.gatePassStatus || 'Not Required').toUpperCase()}</td>
                       <td style={{ padding: '15px', color: '#64748b' }}>{item.assignedDate || 'Active Mapping'}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: item.currentStatus === 'Outside' ? '#3b82f6' : '#10b981' }}>{String(item.currentStatus || 'Inside').toUpperCase()}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
            )}

            {drilldownType === 'Outside' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
               <thead>
                 <tr style={{ background: '#eff6ff' }}>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>EMP. ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>NAME</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>DEPT & DIV</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>CONTACT</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>ASSET ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>SR. NO / TAG</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>EXIT GATE</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>EXIT TIME</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>VALID TILL</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>REMAINING (AUTO)</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>APPROVED BY/ON</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#3b82f6', borderBottom: '2px solid #bfdbfe' }}>STATUS</th>
                 </tr>
               </thead>
               <tbody>
                  {filteredData.length === 0 ? (
                    <tr><td colSpan="12" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '700' }}>No active records match the selected filters.</td></tr>
                  ) : filteredData.map((item, i) => {
                      const remain = item.gatePassValidTill ? (new Date(item.gatePassValidTill) - new Date()) / 3600000 : 0;
                      return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s', background: i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.5)', fontSize: '0.85rem' }}>
                       <td style={{ padding: '15px', fontWeight: '700', color: '#64748b' }}>{item.employeeSysId}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.employeeName}</td>
                       <td style={{ padding: '15px' }}>{item.department !== 'N/A' ? `${item.department} / ${item.division}` : item.division}</td>
                       <td style={{ padding: '15px', fontWeight: '700', color: '#10b981' }}>{item.contactNumber}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#0ea5e9' }}>{item.assetId}</td>
                       <td style={{ padding: '15px', color: '#64748b' }}>{item.serialNumber} <br/><span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#e2e8f0', padding: '2px 4px', borderRadius: '4px' }}>{item.rfidTagId}</span></td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#f59e0b' }}>{item.exitGateName || 'N/A'}</td>
                       <td style={{ padding: '15px', color: '#64748b' }}>{item.exitTime ? new Date(item.exitTime).toLocaleString() : 'No Exit Log'}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.gatePassValidTill ? new Date(item.gatePassValidTill).toLocaleString() : 'N/A'}</td>
                       <td style={{ padding: '15px', fontWeight: '900', color: remain < 0 ? '#ef4444' : (remain < 4 ? '#f59e0b' : '#10b981') }}>
                           {remain < 0 ? 'EXPIRED' : `${Math.floor(remain)}h ${Math.floor((remain % 1) * 60)}m left`}
                       </td>
                       <td style={{ padding: '15px' }}>{item.approvedBy}<br/><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.approvalDate ? new Date(item.approvalDate).toLocaleString() : ''}</span></td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#3b82f6' }}>{String(item.currentStatus).toUpperCase()}</td>
                    </tr>
                  )})}
               </tbody>
            </table>
            )}

            {drilldownType === 'Overdue' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
               <thead>
                 <tr style={{ background: '#fef3c7' }}>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>EMP. ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>NAME</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>DEPT & DIV</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>ASSET ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>SR. NO</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>EXIT GATE & TIME</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>PASS EXPIRY</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '900', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>OVERDUE DURATION</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>RISK LEVEL</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>APPROVED BY</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>ESCALATION STATUS</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#b45309', borderBottom: '2px solid #fde68a' }}>ALERT SYSTEM</th>
                 </tr>
               </thead>
               <tbody>
                  {filteredData.length === 0 ? (
                    <tr><td colSpan="12" style={{ padding: '40px', textAlign: 'center', color: '#f59e0b', fontWeight: '700' }}>No overdue items found.</td></tr>
                  ) : filteredData.map((item, i) => {
                      const colorMap = {'Critical': '#ef4444', 'Medium Risk': '#f59e0b', 'Warning': '#facc15'};
                      const rowColor = colorMap[item.riskLevel] || '#f59e0b';
                      return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s', background: i % 2 === 0 ? 'transparent' : 'rgba(248,250,252,0.5)', fontSize: '0.85rem' }}>
                       <td style={{ padding: '15px', fontWeight: '700', color: rowColor }}>{item.employeeSysId}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.employeeName}</td>
                       <td style={{ padding: '15px' }}>{item.department !== 'N/A' ? `${item.department} / ${item.division}` : item.division}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#0ea5e9' }}>{item.assetId}</td>
                       <td style={{ padding: '15px', color: '#64748b' }}>{item.serialNumber}</td>
                       <td style={{ padding: '15px' }}><div style={{ fontWeight: '800', color: '#f59e0b' }}>{item.exitGate}</div><div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.exitTime ? new Date(item.exitTime).toLocaleString() : 'N/A'}</div></td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.gatePassExpiryTime ? new Date(item.gatePassExpiryTime).toLocaleString() : 'N/A'}</td>
                       <td style={{ padding: '15px', fontWeight: '900', color: rowColor, fontSize: '0.9rem' }}>
                           {Number(item.overdueDurationHours).toFixed(1)} HRS ({Math.floor(item.overdueDurationHours / 24)} Days)
                       </td>
                       <td style={{ padding: '15px' }}><span style={{ backgroundColor: rowColor, color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '0.75rem' }}>{item.riskLevel}</span></td>
                       <td style={{ padding: '15px', fontWeight: '700' }}>{item.approvedBy}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#ef4444' }}>{item.escalationStatus}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#ef4444' }}>TRIGGERED: {item.alertTriggered}</td>
                    </tr>
                  )})}
               </tbody>
            </table>
            )}

            {drilldownType === 'Unauthorized' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1500px' }}>
               <thead>
                 <tr style={{ background: '#fef2f2' }}>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>EMP. ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>NAME</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>ASSET ID</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>RFID TAG</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>CRITICAL LOCATION (GATE)</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>ATTEMPT TYPE</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>TIME DETECTED</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '900', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>SYSTEM REASON</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>SECURITY ACTION YIELDED</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>STATUS</th>
                    <th style={{ padding: '15px', textAlign: 'left', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase', color: '#ef4444', borderBottom: '2px solid #fecaca' }}>CCTV REF</th>
                 </tr>
               </thead>
               <tbody>
                  {filteredData.length === 0 ? (
                    <tr><td colSpan="11" style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: '700' }}>System is secure. No unauthorized movement recorded.</td></tr>
                  ) : filteredData.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #fecaca', transition: '0.2s', background: i % 2 === 0 ? 'transparent' : 'rgba(254,242,242,0.5)', fontSize: '0.85rem' }}>
                       <td style={{ padding: '15px', fontWeight: '700', color: '#64748b' }}>{item.employeeSysId}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.employeeName}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#0ea5e9' }}>{item.assetId}</td>
                       <td style={{ padding: '15px' }}><span style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: '800', padding: '4px 8px', borderRadius: '4px' }}>{item.rfidTagId}</span></td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.gateLocation}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#ef4444' }}>{String(item.attemptType).toUpperCase()}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#1e293b' }}>{item.attemptTime ? new Date(item.attemptTime).toLocaleString() : 'Unknown'}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#ef4444', letterSpacing: '-0.2px' }}>{item.reason}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#10b981' }}>{item.securityActionTaken}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#f59e0b' }}>{item.status}</td>
                       <td style={{ padding: '15px', fontWeight: '800', color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}>{item.cctvRef}</td>
                    </tr>
                  ))}
               </tbody>
            </table>
            )}
        </div>
      )}

      {/* LIVE SECURITY COMMAND FEED */}
      <div style={{ background: '#0f172a', borderRadius: '32px', padding: '45px', color: 'white', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 30, right: 30, color: 'rgba(255,255,255,0.03)', fontSize: '5rem', fontWeight: '900' }}>LOGS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 10px #3b82f6' }}></div>
              <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#94a3b8', letterSpacing: '3px', fontWeight: '800', textTransform: 'uppercase' }}>Live Security Data Packet Feed</h1>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '240px', overflowY: 'auto', padding: '10px' }}>
             {recentLogs.length === 0 ? <p style={{ color: '#475569', textAlign: 'center', marginTop: '80px' }}>Awaiting initial hardware detection packets...</p> : 
               recentLogs.map((log, i) => (
                 <div key={i} style={{ 
                    padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', borderLeft: log.includes('Unauthorized') ? '4px solid #ef4444' : '4px solid #3b82f6',
                    fontSize: '0.9rem', color: '#e2e8f0', fontFamily: 'monospace', opacity: (recentLogs.length - i) / recentLogs.length + 0.3
                 }}>
                    {log}
                 </div>
               ))
             }
          </div>
      </div>
    </div>
  );
}

export default Dashboard;
