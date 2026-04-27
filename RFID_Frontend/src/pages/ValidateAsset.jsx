import React, { useState } from 'react';
import axios from 'axios';

const API_URL = '/api/Asset';

function ValidateAsset() {
    const [searchCode, setSearchCode] = useState('');
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // Collapsible states
    const [isAssetOpen, setIsAssetOpen] = useState(true);
    const [isEmployeeOpen, setIsEmployeeOpen] = useState(true);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchCode.trim()) return;

        setLoading(true);
        setErrorMsg('');
        setResult(null);

        try {
            const cleanSearchCode = searchCode.trim();
            const res = await axios.get(`${API_URL}/validate/${cleanSearchCode}`);
            setResult(res.data);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setErrorMsg('Asset not found in the system. Check the Asset ID or RFID Tag.');
            } else {
                setErrorMsg('A server error occurred while validating the asset.');
            }
        }
        setLoading(false);
    };

    return (
        <div>
            <div style={{ marginBottom: '30px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Asset Validation Gateway</h1>
                <p style={{ color: 'var(--text-muted)' }}>Scan an RFID Tag or manually enter an Asset ID to retrieve its full logistical profile.</p>
            </div>

            <div className="glass-panel" style={{ background: '#fafafa', padding: '25px', borderRadius: '12px', marginBottom: '30px' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '15px' }}>
                    <input 
                        type="text" 
                        placeholder="Scan or Type Asset ID / RFID Tag..." 
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        style={{ flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '0 30px', fontWeight: '800' }}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>
                {errorMsg && <div style={{ marginTop: '15px', color: '#ef4444', fontWeight: '700' }}>⚠️ {errorMsg}</div>}
            </div>

            {result && result.assetInfo && (
                <div className="glass-panel" style={{ 
                    marginBottom: '30px', 
                    padding: '15px 25px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    borderLeft: `10px solid ${(result.assetInfo.locationStatus || 'Inside').includes('Inside') ? '#10b981' : '#ef4444'}`,
                    background: (result.assetInfo.locationStatus || 'Inside').includes('Inside') ? '#f0fdf4' : '#fef2f2'
                }}>
                    <div>
                        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '5px' }}>CURRENT ASSET LOCATION</span>
                        <h2 style={{ margin: 0, color: (result.assetInfo.locationStatus || 'Inside').includes('Inside') ? '#166534' : '#991b1b', fontWeight: '900', letterSpacing: '1px' }}>
                            {(result.assetInfo.locationStatus || 'Inside (Office)').toUpperCase()}
                        </h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Verified at: {new Date().toLocaleTimeString()}</span>
                        <div style={{ 
                            marginTop: '5px',
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: (result.assetInfo.locationStatus || 'Inside').includes('Inside') ? '#10b981' : '#ef4444',
                            boxShadow: `0 0 10px ${(result.assetInfo.locationStatus || 'Inside').includes('Inside') ? '#10b981' : '#ef4444'}`
                        }}></div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                
                {/* 1. ASSET DETAIL COLLAPSIBLE */}
                <div className="glass-panel" style={{ borderLeft: '5px solid #0ea5e9' }}>
                    <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', cursor: 'pointer' }}
                        onClick={() => setIsAssetOpen(!isAssetOpen)}
                    >
                        <h3 style={{ color: '#0ea5e9', margin: 0 }}>Asset Detail</h3>
                        <span style={{ fontSize: '0.8rem', color: '#0ea5e9' }}>{isAssetOpen ? '▼ Hide' : '▶ Show'}</span>
                    </div>
                    
                    {isAssetOpen && (
                        <div className="form-grid-multi" style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div className="floating-group">
                                <input readOnly disabled value={result?.assetInfo ? `${result.assetInfo.assetId} (${String(result.assetInfo.currentStatus).toUpperCase()})` : ''} className="floating-input" style={{ background: '#f8fafc', fontWeight: '800' }} />
                                <label className="floating-label">Asset Info</label>
                            </div>
                            <div className="floating-group">
                                <input readOnly disabled value={result?.assetInfo?.rfidTagId || ''} className="floating-input" style={{ background: '#f8fafc', fontWeight: '800' }} />
                                <label className="floating-label">RFID Tag</label>
                            </div>
                            <div className="floating-group">
                                <input readOnly disabled value={result?.assetInfo ? `${result.assetInfo.brandModel || 'N/A'} - S/N: ${result.assetInfo.serialNumber || 'N/A'}` : ''} className="floating-input" style={{ background: '#f8fafc' }} />
                                <label className="floating-label">Hardware</label>
                            </div>
                            <div className="floating-group">
                                <input readOnly disabled value={result?.employeeInfo ? `${result.employeeInfo.name} (${result.employeeInfo.empId})` : (result ? 'UNASSIGNED' : '')} className="floating-input" style={{ background: '#f8fafc', color: (result && !result.employeeInfo) ? '#ef4444' : 'inherit' }} />
                                <label className="floating-label">Assigned To</label>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. EMPLOYEE COLLAPSIBLE */}
                <div className="glass-panel" style={{ borderLeft: '5px solid #8b5cf6' }}>
                    <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', cursor: 'pointer' }}
                        onClick={() => setIsEmployeeOpen(!isEmployeeOpen)}
                    >
                        <h3 style={{ color: '#8b5cf6', margin: 0 }}>Employee</h3>
                        <span style={{ fontSize: '0.8rem', color: '#8b5cf6' }}>{isEmployeeOpen ? '▼ Hide' : '▶ Show'}</span>
                    </div>

                    {isEmployeeOpen && (
                        <div className="form-grid-multi" style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div className="floating-group">
                                <input readOnly disabled value={result?.employeeInfo?.empId || ''} className="floating-input" style={{ background: '#f8fafc', fontWeight: '800' }} />
                                <label className="floating-label">Emp. ID</label>
                            </div>
                            <div className="floating-group">
                                <input readOnly disabled value={result?.employeeInfo ? `${result.employeeInfo.name}` : ''} className="floating-input" style={{ background: '#f8fafc', fontWeight: '800' }} />
                                <label className="floating-label">Name & Contact</label>
                            </div>
                            <div className="floating-group">
                                <input readOnly disabled value={result?.employeeInfo ? `${result.employeeInfo.designation || 'N/A'} / ${result.employeeInfo.division || 'N/A'}` : ''} className="floating-input" style={{ background: '#f8fafc' }} />
                                <label className="floating-label">Role & Div.</label>
                            </div>
                        </div>
                    )}
                </div>

                {/* LAST GATE PASS RECORD (ONLY SHOW IF DATA EXISTS TO AVOID CLUTTER) */}
                {result?.lastGatePass && (
                <div className="glass-panel" style={{ borderLeft: '5px solid #f59e0b', gridColumn: '1 / -1' }}>
                        <h3 style={{ color: '#f59e0b', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginTop: 0 }}>LOGISTICAL TRANSIT (LAST GATE PASS REQUEST)</h3>
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <div style={{ fontWeight: '900', color: '#1e293b', fontSize: '1.2rem' }}>Ticket #{result.lastGatePass.id}</div>
                                <div style={{ padding: '5px 12px', borderRadius: '6px', fontWeight: '800', background: result.lastGatePass.status === 'Approved' ? '#10b981' : (result.lastGatePass.status === 'Rejected' ? '#ef4444' : '#f59e0b'), color: 'white' }}>
                                    {String(result.lastGatePass.status).toUpperCase()}
                                </div>
                            </div>
                            
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.8rem' }}>
                                        <th style={{ padding: '10px' }}>Request Timestamp</th>
                                        <th style={{ padding: '10px' }}>Valid From</th>
                                        <th style={{ padding: '10px' }}>Valid Till</th>
                                        <th style={{ padding: '10px' }}>Pass Type</th>
                                        <th style={{ padding: '10px' }}>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '15px', fontWeight: '600' }}>{new Date(result.lastGatePass.createdAt).toLocaleString()}</td>
                                        <td style={{ padding: '15px', fontWeight: '600' }}>{new Date(result.lastGatePass.validFrom).toLocaleString()}</td>
                                        <td style={{ padding: '15px', fontWeight: '600', color: '#ef4444' }}>{new Date(result.lastGatePass.validTill).toLocaleString()}</td>
                                        <td style={{ padding: '15px', fontWeight: '800' }}>{result.lastGatePass.returnable === "True" ? "RETURNABLE" : "NON-RETURNABLE"}</td>
                                        <td style={{ padding: '15px', fontStyle: 'italic', color: '#64748b' }}>{result.lastGatePass.reason}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                </div>
                )}
            </div>
        </div>
    );
}

export default ValidateAsset;
