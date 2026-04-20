import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
        const res = await axios.get('http://localhost:5000/api/Audit');
        setLogs(res.data);
    } catch(e) { console.error("Logs fetch failed", e); }
    setLoading(false);
  };

  const handleExport = () => {
    if(logs.length === 0) return;

    const excelData = logs.map(log => ({
        "Log ID": log.id,
        "RFID Tag": log.rfidTagId,
        "Gate": log.gate,
        "Direction": log.direction,
        "Status": log.isAuthorized ? "Safe" : "Alarm",
        "System Log Reason": log.reason,
        "Time": log.time
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit_Logs");
    XLSX.writeFile(wb, "RFID_Daily_Audit_Report.xlsx");
  };

  return (
    <div>
      <h1 className="page-title">Hardware Audit Logs</h1>
      
      <div className="glass-panel" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        <div className="section-title" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', padding: '20px' }}>
           <span style={{color: 'var(--primary-color)'}}>RFID Antenna Scans History</span>
           
           <button onClick={handleExport} className="btn-outline" style={{ borderColor: 'var(--success-text)', color: 'var(--success-text)', fontWeight: 'bold' }}>
               📥 Download Excel Report
           </button>
        </div>
        
        <table className="table-main" style={{ marginTop: '0px' }}>
          <thead>
            <tr>
              <th>Log ID</th>
              <th>RFID Tag No.</th>
              <th>Gate Passed</th>
              <th>Direction</th>
              <th>Action</th>
              <th>System Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ background: !log.isAuthorized ? '#fffafb' : 'transparent' }}>
                <td><strong>{log.id}</strong></td>
                <td><code className="chip">{log.rfidTagId}</code></td>
                <td>{log.gate}</td>
                <td>
                   <span className={log.direction === 'In' ? 'badge badge-info' : 'badge badge-warning'}>
                      {log.direction} Scan
                    </span>
                </td>
                <td>
                  {log.isAuthorized ? (
                    <span style={{color: 'var(--success-text)', fontWeight: '600'}}>✅ Authorized</span>
                  ) : (
                    <span style={{color: 'var(--danger-text)', fontWeight: '800'}}>🚨 UNAUTHORIZED</span>
                  )}
                </td>
                <td style={{ color: log.isAuthorized ? 'var(--text-muted)' : 'var(--danger-text)' }}>
                  <div style={{display:'flex', flexDirection:'column', gap: '4px'}}>
                    <span style={{fontWeight: !log.isAuthorized ? 'bold': '500'}}>{log.reason}</span>
                    <span style={{fontSize:'0.8em', color: 'var(--text-muted)' }}>{log.time}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AuditLogs;
