import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/Asset';

function AssetTimeline() {
    const [searchCode, setSearchCode] = useState('');
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchCode.trim()) return;

        setLoading(true);
        setErrorMsg('');
        setResult(null);

        try {
            const cleanSearchCode = searchCode.trim();
            const res = await axios.get(`${API_URL}/timeline/${cleanSearchCode}`);
            setResult(res.data);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setErrorMsg('Asset not found in the system. Check the Asset ID or RFID Tag.');
            } else {
                setErrorMsg('A server error occurred while retrieving the timeline.');
            }
        }
        setLoading(false);
    };

    return (
        <div>
            <div style={{ marginBottom: '30px' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Asset Ownership Timeline</h1>
                <p style={{ color: 'var(--text-muted)' }}>Scan an RFID Tag or enter an Asset ID to retrieve its full assignment and ownership history.</p>
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
                        {loading ? 'Searching...' : 'Search History'}
                    </button>
                </form>
                {errorMsg && <div style={{ marginTop: '15px', color: '#ef4444', fontWeight: '700' }}>⚠️ {errorMsg}</div>}
            </div>

            {result && (
                <div className="glass-panel" style={{ background: 'white', padding: '30px', borderRadius: '12px' }}>
                    <h3 style={{ color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px', marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Asset: {result.assetId}</span> 
                        <span style={{color: '#64748b'}}>{result.brandModel}</span>
                    </h3>

                    <div style={{ marginTop: '20px' }}>
                        {result.timeline && result.timeline.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {result.timeline.map((entry, index) => (
                                    <div key={index} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '15px 20px', 
                                        background: entry.action === 'Assigned' ? '#eff6ff' : '#f1f5f9', 
                                        borderLeft: entry.action === 'Assigned' ? '5px solid #3b82f6' : '5px solid #94a3b8',
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ width: '200px', fontWeight: '700', color: '#64748b' }}>
                                            {new Date(entry.timestamp).toLocaleString()}
                                        </div>
                                        <div style={{ width: '150px' }}>
                                            <span style={{ 
                                                padding: '4px 8px', 
                                                borderRadius: '4px', 
                                                fontWeight: '800', 
                                                fontSize: '0.8rem', 
                                                background: entry.action === 'Assigned' ? '#3b82f6' : '#94a3b8', 
                                                color: 'white' 
                                            }}>
                                                {entry.action.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1, fontWeight: '700', color: '#1e293b', fontSize: '1.1rem' }}>
                                            {entry.action === 'Assigned' ? (
                                                <span>To: <span style={{color: '#8b5cf6'}}>{entry.employeeName} ({entry.employeeId})</span> - {entry.department}</span>
                                            ) : (
                                                <span style={{color: '#64748b'}}>Removed from employee profile</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontWeight: '600', background: '#f8fafc', borderRadius: '8px' }}>
                                📁 No historical assignment records have been logged yet for this asset.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AssetTimeline;
