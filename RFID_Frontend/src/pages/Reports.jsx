import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Reports() {
    const [loading, setLoading] = useState(false);
    
    // Quick Report Stats
    const [stats, setStats] = useState({
        movements: 0,
        unauthorized: 0,
        overdue: 0
    });

    // Custom Builder State
    const [dataSource, setDataSource] = useState('Movements');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [customData, setCustomData] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const userRole = localStorage.getItem('rfid_auth') || 'Employee';
    const currentEmpId = parseInt(localStorage.getItem('rfid_emp_id')) || 0;

    useEffect(() => {
        loadQuickStats();
    }, [userRole]);

    const getAllowedEmpIds = async () => {
        if (userRole === 'DivisionalManager') {
            try {
                const empRes = await axios.get('/api/Employee');
                const myEmp = empRes.data.find(e => e.id === currentEmpId || e.Id === currentEmpId);
                if (myEmp) {
                    const myTeam = empRes.data.filter(e => e.divisionManagerId === myEmp.id || e.id === myEmp.id);
                    return myTeam.map(e => e.id).join(',');
                }
            } catch (err) {
                console.error("Error fetching team", err);
            }
        }
        return '';
    };

    const loadQuickStats = async () => {
        setLoading(true);
        try {
            const allowedIds = await getAllowedEmpIds();
            const queryParams = allowedIds ? `?allowedEmpIds=${allowedIds}` : '';

            const [movRes, unauthRes, overdueRes] = await Promise.all([
                axios.get(`/api/Report/movements${queryParams}`),
                axios.get(`/api/Report/unauthorized${queryParams}`),
                axios.get(`/api/Report/overdue${queryParams}`)
            ]);

            setStats({
                movements: movRes.data.length,
                unauthorized: unauthRes.data.length,
                overdue: overdueRes.data.length
            });
        } catch (err) {
            console.error("Failed to load quick stats", err);
        }
        setLoading(false);
    };

    const handleGenerateCustom = async (e) => {
        e?.preventDefault();
        setIsGenerating(true);
        try {
            const allowedIds = await getAllowedEmpIds();
            let url = '';
            
            if (dataSource === 'Movements') {
                url = `/api/Report/movements?`;
                if (fromDate) url += `fromDate=${new Date(fromDate).toISOString()}&`;
                if (toDate) {
                    const tDate = new Date(toDate);
                    tDate.setHours(23, 59, 59, 999);
                    url += `toDate=${tDate.toISOString()}&`;
                }
            } else if (dataSource === 'GatePasses') {
                url = `/api/GatePass?`;
            } else if (dataSource === 'Assets') {
                url = `/api/Asset?`;
            }

            if (allowedIds) {
                url += `&allowedEmpIds=${allowedIds}`;
            }

            const res = await axios.get(url.replace('?&', '?').replace(/&$/, ''));
            
            // Further client side filtering for GatePasses if needed
            let data = res.data;
            if ((dataSource === 'GatePasses' || dataSource === 'Assets') && (fromDate || toDate)) {
                data = data.filter(item => {
                    const dateToCheck = new Date(item.createdAt || item.validFrom || item.timestamp || new Date());
                    if (fromDate && dateToCheck < new Date(fromDate)) return false;
                    if (toDate) {
                        const tDate = new Date(toDate);
                        tDate.setHours(23, 59, 59, 999);
                        if (dateToCheck > tDate) return false;
                    }
                    return true;
                });
            }

            setCustomData(data);
        } catch (err) {
            console.error("Failed to generate custom report", err);
            alert("Error generating report.");
        }
        setIsGenerating(false);
    };

    const exportToCSV = () => {
        if (customData.length === 0) return alert("No data to export!");
        
        // Dynamic headers based on data source
        let csvContent = "data:text/csv;charset=utf-8,";
        let headers = [];

        if (dataSource === 'Movements') {
            headers = ["Log ID", "Date Time", "Asset Tag", "Employee", "Department", "Authorized", "Reason"];
            csvContent += headers.join(",") + "\n";
            customData.forEach(r => {
                const row = [
                    r.id, 
                    `"${new Date(r.timestamp).toLocaleString()}"`, 
                    r.asset?.rfidTagId || 'N/A', 
                    `"${r.asset?.assignedEmployee?.name || 'Unknown'}"`,
                    `"${r.asset?.assignedEmployee?.department || 'N/A'}"`,
                    r.isAuthorized ? "Yes" : "No",
                    `"${r.reason || ''}"`
                ];
                csvContent += row.join(",") + "\n";
            });
        } else if (dataSource === 'GatePasses') {
            headers = ["Pass ID", "Status", "Asset Tag", "Employee", "Valid From", "Valid Till", "Approved By"];
            csvContent += headers.join(",") + "\n";
            customData.forEach(r => {
                const row = [
                    `GP-${r.id}`, 
                    r.status, 
                    r.asset?.rfidTagId || r.taggedDevice || 'N/A', 
                    `"${r.asset?.assignedEmployee?.name || r.personnelName || 'Unknown'}"`,
                    `"${new Date(r.validFrom).toLocaleString()}"`,
                    `"${new Date(r.validTill).toLocaleString()}"`,
                    `"${r.approvedBy || 'Pending'}"`
                ];
                csvContent += row.join(",") + "\n";
            });
        } else if (dataSource === 'Assets') {
            headers = ["Asset ID", "RFID Tag", "Brand/Model", "Current Status", "Assigned Employee", "Department"];
            csvContent += headers.join(",") + "\n";
            customData.forEach(r => {
                const row = [
                    r.assetId, 
                    r.rfidTagId, 
                    `"${r.brandModel}"`, 
                    r.currentStatus,
                    `"${r.assignedEmployee?.name || 'Unassigned'}"`,
                    `"${r.assignedEmployee?.department || 'N/A'}"`
                ];
                csvContent += row.join(",") + "\n";
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `RFID_${dataSource}_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        if (customData.length === 0) return alert("No data to export!");

        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        
        let tableHeaders = "";
        let tableRows = "";

        if (dataSource === 'Movements') {
            tableHeaders = `<th>Log ID</th><th>Date & Time</th><th>Asset Tag</th><th>Employee</th><th>Authorized</th><th>Status / Reason</th>`;
            tableRows = customData.map(r => `
                <tr>
                    <td>${r.id}</td>
                    <td>${new Date(r.timestamp).toLocaleString()}</td>
                    <td>${r.asset?.rfidTagId || 'N/A'}</td>
                    <td>${r.asset?.assignedEmployee?.name || 'Unknown'}<br><small>${r.asset?.assignedEmployee?.department || ''}</small></td>
                    <td><span style="color: ${r.isAuthorized ? '#059669' : '#dc2626'}">${r.isAuthorized ? 'YES' : 'NO'}</span></td>
                    <td>${r.reason}</td>
                </tr>
            `).join('');
        } else if (dataSource === 'GatePasses') {
            tableHeaders = `<th>Pass ID</th><th>Status</th><th>Asset</th><th>Employee</th><th>Valid Time Window</th><th>Approval</th>`;
            tableRows = customData.map(r => `
                <tr>
                    <td>GP-${r.id}</td>
                    <td><b>${r.status}</b></td>
                    <td>${r.asset?.brandModel || 'N/A'}<br><small>${r.asset?.rfidTagId || r.taggedDevice || ''}</small></td>
                    <td>${r.asset?.assignedEmployee?.name || r.personnelName || 'Unknown'}</td>
                    <td>${new Date(r.validFrom).toLocaleString()} <br>to<br> ${new Date(r.validTill).toLocaleString()}</td>
                    <td>${r.approvedBy || 'Pending'}</td>
                </tr>
            `).join('');
        } else if (dataSource === 'Assets') {
            tableHeaders = `<th>Asset ID</th><th>RFID Tag</th><th>Brand & Model</th><th>Current Location</th><th>Assigned To</th>`;
            tableRows = customData.map(r => `
                <tr>
                    <td>${r.assetId}</td>
                    <td>${r.rfidTagId}</td>
                    <td>${r.brandModel}</td>
                    <td><b>${r.currentStatus}</b></td>
                    <td>${r.assignedEmployee?.name || 'Unassigned'}<br><small>${r.assignedEmployee?.department || ''}</small></td>
                </tr>
            `).join('');
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>RFID Export - ${dataSource} Report</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
                    .header h1 { margin: 0; color: #0f172a; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
                    .header p { color: #64748b; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
                    th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
                    th { background-color: #f8fafc; font-weight: bold; color: #0f172a; text-transform: uppercase; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    @media print {
                        body { padding: 0; }
                        @page { margin: 1cm; size: landscape; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${dataSource.toUpperCase()} REPORT</h1>
                    <p>Generated on: ${new Date().toLocaleString()} | Scope: ${userRole === 'DivisionalManager' ? 'My Division' : 'Global Enterprise'}</p>
                    ${(fromDate || toDate) ? `<p>Date Filter: ${fromDate || 'Start'} to ${toDate || 'End'}</p>` : ''}
                </div>
                <table>
                    <thead><tr>${tableHeaders}</tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 250);
    };

    // UI Styles
    const widgetStyle = (color) => ({
        padding: '25px', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0', 
        borderLeft: `6px solid ${color}`, boxShadow: '0 4px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column'
    });

    const thStyle = { padding: '16px', textAlign: 'left', borderBottom: '2px solid #f1f5f9', fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' };
    const tdStyle = { padding: '16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' };

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading Report Data...</div>;

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: '900', color: '#1e293b' }}>Reports & Analytics</h1>
                <p style={{ margin: '5px 0 0 0', color: '#64748b', fontSize: '1rem', fontWeight: '500' }}>
                    Generate fixed metric reports or build custom queries for audit and logistics purposes.
                </p>
            </div>

            {/* TOP SECTION: QUICK REPORTS */}
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '15px' }}>Standard Quick Reports</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <div style={widgetStyle('#ef4444')}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Missing / Overdue</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1e293b', margin: '10px 0' }}>{stats.overdue}</div>
                    <button onClick={() => { setDataSource('GatePasses'); handleGenerateCustom(); }} style={{ padding: '8px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginTop: 'auto' }}>View Overdue Passes</button>
                </div>
                
                <div style={widgetStyle('#f59e0b')}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Unauthorized Alerts</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1e293b', margin: '10px 0' }}>{stats.unauthorized}</div>
                    <button onClick={() => { setDataSource('Movements'); handleGenerateCustom(); }} style={{ padding: '8px', background: '#fef3c7', color: '#b45309', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginTop: 'auto' }}>View Alerts</button>
                </div>

                <div style={widgetStyle('#3b82f6')}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Movements</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1e293b', margin: '10px 0' }}>{stats.movements}</div>
                    <button onClick={() => { setDataSource('Movements'); handleGenerateCustom(); }} style={{ padding: '8px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginTop: 'auto' }}>View Full Audit Feed</button>
                </div>
            </div>

            {/* BOTTOM SECTION: CUSTOM BUILDER */}
            <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '15px' }}>Custom Query Builder</h3>
            <div style={{ background: 'white', borderRadius: '24px', padding: '30px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <form onSubmit={handleGenerateCustom} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>Data Source</label>
                        <select value={dataSource} onChange={e => setDataSource(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}>
                            <option value="Movements">Movement Audit Feed</option>
                            <option value="GatePasses">Gate Passes / Logistics</option>
                            <option value="Assets">Hardware Assets / Inventory</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>From Date (Optional)</label>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b' }}>To Date (Optional)</label>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="submit" disabled={isGenerating} style={{ width: '100%', padding: '14px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}>
                            {isGenerating ? 'Querying...' : 'Generate Report'}
                        </button>
                    </div>
                </form>

                {/* DATA TABLE */}
                {customData.length > 0 ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#f8fafc', padding: '15px', borderRadius: '12px' }}>
                            <div style={{ fontWeight: '700', color: '#475569' }}>Found {customData.length} Records</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={exportToCSV} style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', color: '#0f172a' }}>📄 Export CSV</button>
                                <button onClick={exportToPDF} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>🖨️ Export PDF</button>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr>
                                        {dataSource === 'Movements' && (<><th style={thStyle}>Date & Time</th><th style={thStyle}>Asset/Tag</th><th style={thStyle}>Employee</th><th style={thStyle}>Authorized</th><th style={thStyle}>Status</th></>)}
                                        {dataSource === 'GatePasses' && (<><th style={thStyle}>Pass ID</th><th style={thStyle}>Status</th><th style={thStyle}>Asset</th><th style={thStyle}>Employee</th><th style={thStyle}>Time Window</th></>)}
                                        {dataSource === 'Assets' && (<><th style={thStyle}>Asset ID</th><th style={thStyle}>Brand/Model</th><th style={thStyle}>Status</th><th style={thStyle}>Employee</th></>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {customData.map((row, idx) => (
                                        <tr key={idx}>
                                            {dataSource === 'Movements' && (
                                                <>
                                                    <td style={tdStyle}>{new Date(row.timestamp).toLocaleString()}</td>
                                                    <td style={tdStyle}><b>{row.asset?.rfidTagId || 'N/A'}</b></td>
                                                    <td style={tdStyle}>{row.asset?.assignedEmployee?.name || 'Unknown'}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: row.isAuthorized ? '#d1fae5' : '#fee2e2', color: row.isAuthorized ? '#059669' : '#b91c1c' }}>
                                                            {row.isAuthorized ? 'YES' : 'NO'}
                                                        </span>
                                                    </td>
                                                    <td style={tdStyle}>{row.reason}</td>
                                                </>
                                            )}
                                            {dataSource === 'GatePasses' && (
                                                <>
                                                    <td style={tdStyle}>GP-{row.id}</td>
                                                    <td style={tdStyle}><b>{row.status}</b></td>
                                                    <td style={tdStyle}>{row.asset?.rfidTagId || row.taggedDevice}</td>
                                                    <td style={tdStyle}>{row.asset?.assignedEmployee?.name || row.personnelName}</td>
                                                    <td style={tdStyle}><span style={{fontSize:'0.8rem'}}>{new Date(row.validFrom).toLocaleString()}</span></td>
                                                </>
                                            )}
                                            {dataSource === 'Assets' && (
                                                <>
                                                    <td style={tdStyle}><b>{row.assetId}</b></td>
                                                    <td style={tdStyle}>{row.brandModel}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', background: row.currentStatus.includes('Inside') ? '#d1fae5' : '#dbeafe', color: row.currentStatus.includes('Inside') ? '#059669' : '#1d4ed8' }}>
                                                            {row.currentStatus}
                                                        </span>
                                                    </td>
                                                    <td style={tdStyle}>{row.assignedEmployee?.name || 'Unassigned'}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', fontWeight: '600' }}>
                        Select criteria and click Generate to view report data.
                    </div>
                )}
            </div>
        </div>
    );
}

export default Reports;
