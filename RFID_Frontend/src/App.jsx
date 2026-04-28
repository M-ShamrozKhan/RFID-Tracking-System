import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import MyTeam from './pages/MyTeam';
import Assets from './pages/Assets';
import GatePasses from './pages/GatePasses';
import AuditLogs from './pages/AuditLogs';
import RBAC from './pages/RBAC';
import Login from './pages/Login';
import ValidateAsset from './pages/ValidateAsset';
import AssetTimeline from './pages/AssetTimeline';
import Reports from './pages/Reports';
import './index.css';

const MenuIcon = () => (
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
);

function NavLink({ to, icon, label, isCollapsed }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link to={to} title={isCollapsed ? label : ''} style={{
      textDecoration: 'none',
      padding: '12px 14px',
      color: isActive ? 'var(--primary-color)' : 'var(--text-muted)',
      borderRadius: '8px',
      background: isActive ? 'var(--info-bg)' : 'transparent',
      fontWeight: isActive ? '600' : '500',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    }}>
      <span style={{ fontSize: '1.2rem', minWidth: '24px', display: 'flex', justifyContent: 'center' }}>{icon}</span>
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}

function SubNavLink({ to, label }) {
  const location = useLocation();
  const isActive = location.pathname.includes(to) || (to === '/gatepasses/requests' && location.pathname === '/gatepasses');
  
  return (
    <Link to={to} style={{
      textDecoration: 'none',
      padding: '10px 14px 10px 45px', 
      color: isActive ? 'var(--primary-color)' : 'var(--text-muted)',
      borderRadius: '8px',
      background: isActive ? 'var(--info-bg)' : 'transparent',
      fontWeight: isActive ? '700' : '600',
      transition: 'all 0.2s',
      display: 'block',
      fontSize: '0.85rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', width: '5px', height: '5px', borderRadius: '50%', background: isActive ? 'var(--primary-color)' : '#cbd5e1', transition: '0.2s' }}></div>
      {label}
    </Link>
  );
}

function AppLayout() {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [userPermissions, setUserPermissions] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const hasAccess = (node) => userPermissions.includes(`${node}_VIEW`) || userPermissions.includes(`${node}_EDIT`) || userRole === 'SuperAdmin';

  
  // Alert Integration
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const overlayRef = useRef(null);
  const connectionRef = useRef(null);

  // Accordion State
  const [isGatePassMenuOpen, setIsGatePassMenuOpen] = useState(location.pathname.includes('/gatepasses'));

  const fetchNotifications = async () => {
    try {
        const res = await axios.get('/api/Notification');
        setNotifications(res.data.map(n => ({ id: n.id, text: n.message, time: new Date(n.timestamp), read: n.isRead })));
    } catch (e) { console.error("Global Alert Fetch Error", e); }
  };

  useEffect(() => {
     // Close overlay on outside click
     const handleClickOutside = (e) => { if (overlayRef.current && !overlayRef.current.contains(e.target)) setShowNotifications(false); };
     document.addEventListener("mousedown", handleClickOutside);
     return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
     if (!isAuthenticated) return;

     // Fetch initial data on login
     fetchNotifications();

     // Connect to Global Hub
     const connection = new signalR.HubConnectionBuilder()
         .withUrl(`/alerthub`)
         .withAutomaticReconnect()
         .build();

     connection.on('ReceiveAlert', (msg) => {
         console.log("🔔 [ALERT RECEIVED]:", msg);
         fetchNotifications(); 
     });

     connection.start()
        .then(() => {
            console.log("🛰️ [SIGNAL-R]: Global Alert Hub Connected.");
            connectionRef.current = connection;
        })
        .catch(err => console.error("🛰️ [SIGNAL-R]: Connection Failed:", err));

     return () => {
         if (connection) connection.stop();
     };
  }, [isAuthenticated]);

  useEffect(() => {
     // Recover Session
     const storedRole = localStorage.getItem('rfid_auth');
     const storedName = localStorage.getItem('rfid_user_name');
     const storedPerms = localStorage.getItem('rfid_permissions');
     
     if (storedRole && storedRole !== 'undefined') {
         setIsAuthenticated(true);
         setUserRole(storedRole);
         setUserName(storedName || 'System Admin'); 
         setUserPermissions(storedPerms ? JSON.parse(storedPerms) : []);
         fetchNotifications(); // Fetch persistent alerts for authorized users
     } else {
         setIsAuthenticated(false);
     }
  }, []);

  const handleMarkRead = async () => {
      setShowNotifications(!showNotifications);
      if (!showNotifications) {
          try {
              await axios.post('/api/Notification/mark-read');
              setNotifications(notifications.map(n => ({...n, read: true})));
          } catch(e) {}
      }
  };

  const handleClearNotifications = async () => {
      try {
          await axios.delete('/api/Notification/clear');
          setNotifications([]);
      } catch(e) {}
  };

  const handleLogout = () => {
      localStorage.removeItem('rfid_auth');
      localStorage.removeItem('rfid_permissions');
      setIsAuthenticated(false);
      setUserRole('');
      setUserPermissions([]);
  };

  if (!isAuthenticated) return <Login onLogin={(authStatus, sysRole, sysName, sysPerms) => { 
      setIsAuthenticated(authStatus); 
      setUserRole(sysRole); 
      setUserName(sysName); 
      setUserPermissions(sysPerms);
  }} />;

  return (
      <div style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
        
        <aside style={{ 
          width: isCollapsed ? '80px' : '260px', 
          background: 'var(--bg-sidebar)', 
          borderRight: '1px solid #f1f5f9',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', marginBottom: '2.5rem', padding: '0 4px' }}>
            {!isCollapsed && (
              <h2 style={{ color: 'var(--text-main)', margin: '0', fontSize: '1.3rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
                <span style={{ color: 'var(--primary-color)' }}>RFID</span> Sys
              </h2>
            )}
            
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '4px', outline: 'none' }}
              title="Toggle Menu"
            >
              <MenuIcon />
            </button>
          </div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {hasAccess('DASHBOARD') && <NavLink to="/" icon="📊" label="Dashboard" isCollapsed={isCollapsed} />}
            
            {hasAccess('EMPLOYEES') && (
              <NavLink to="/employees" icon="👥" label="Employees" isCollapsed={isCollapsed} />
            )}
            
            {hasAccess('MYTEAM') && (
              <NavLink to="/my-team" icon="👥" label="My Team" isCollapsed={isCollapsed} />
            )}
            
            {hasAccess('ASSETS') && (
                 <NavLink to="/assets" icon="💻" label="Laptops & Assets" isCollapsed={isCollapsed} />
            )}
            {hasAccess('VALIDATE_ASSET') && (
                 <NavLink to="/validate-asset" icon="🔍" label="Validate Asset" isCollapsed={isCollapsed} />
            )}
            {hasAccess('ASSET_TIMELINE') && (
                 <NavLink to="/timeline" icon="⏱️" label="Asset Timeline" isCollapsed={isCollapsed} />
            )}

            {hasAccess('RBAC') && (
              <NavLink to="/rbac" icon="🛡️" label="Role Permissions" isCollapsed={isCollapsed} />
            )}
            
            {hasAccess('REPORTS') && (
              <NavLink to="/reports" icon="📊" label="Reports & Analytics" isCollapsed={isCollapsed} />
            )}

            {/* Keeping direct access to Audit Logs for admins if needed, or merging it into Reports */}
            {hasAccess('RBAC') && (
              <NavLink to="/audits" icon="📜" label="Audit Logs" isCollapsed={isCollapsed} />
            )}

            {hasAccess('GATEPASSES') && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <Link 
                    to="/gatepasses"
                    onClick={(e) => {
                        setIsGatePassMenuOpen(!isGatePassMenuOpen);
                    }}
                    style={{
                        textDecoration: 'none',
                        padding: '12px 14px',
                        color: location.pathname.includes('/gatepasses') ? 'var(--primary-color)' : 'var(--text-muted)',
                        borderRadius: '8px',
                        background: location.pathname.includes('/gatepasses') ? 'var(--info-bg)' : 'transparent',
                        fontWeight: location.pathname.includes('/gatepasses') ? '700' : '500',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', minWidth: '24px', display: 'flex', justifyContent: 'center' }}>🎟️</span>
                        {!isCollapsed && <span>Gate Passes</span>}
                    </div>
                    {!isCollapsed && hasAccess('RFID_CONFIG') && (
                        <span style={{ fontSize: '0.7rem', transform: isGatePassMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', color: 'var(--primary-color)' }}>▼</span>
                    )}
                </Link>
                
                {/* Collapsible Sub-Menu */}
                <div style={{
                    maxHeight: (!isCollapsed && isGatePassMenuOpen) ? '200px' : '0px',
                    opacity: (!isCollapsed && isGatePassMenuOpen) ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', marginBottom: '8px' }}>
                        <SubNavLink to="/gatepasses/requests" label="Requests & History" />
                        {hasAccess('GATEPASSES') && (
                            <SubNavLink to="/gatepasses/approvals" label="Pending Approvals" />
                        )}
                        {hasAccess('RFID_CONFIG') && (
                            <SubNavLink to="/gatepasses/automation" label="Gate Control" />
                        )}
                    </div>
                </div>
            </div>
            )}
          </nav>
          
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column' }}>
             <button onClick={handleLogout} className="btn-outline" style={{ justifyContent: 'center', color: 'var(--danger-text)', borderColor: 'transparent', padding: isCollapsed ? '12px' : '8px 16px', fontSize: '1rem' }} title="Log out">
                🚪 {!isCollapsed && <span style={{marginLeft: '8px', fontSize: '0.95rem', fontWeight: '600'}}>Log out ({userRole})</span>}
             </button>
          </div>
        </aside>

        <main style={{ flex: 1, padding: '0', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          
          <header style={{ 
            height: '70px', 
            background: 'white', 
            borderBottom: '1px solid var(--border-color)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end', 
            padding: '0 40px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                
                {/* 🔔 GLOBAL ALERT CENTER */}
                {(userRole === 'SuperAdmin' || userRole === 'Admin' || userRole === 'SecurityAdmin' || userRole === 'DivisionalManager') && (
                    <div style={{ position: 'relative' }} ref={overlayRef}>
                        <button 
                            onClick={handleMarkRead} 
                            style={{ border: 'none', background: '#f8fafc', width: '40px', height: '40px', borderRadius: '10px', fontSize: '1.2rem', cursor: 'pointer', position: 'relative', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Global Alert Center"
                        >
                            🔔
                            {unreadCount > 0 && (
                                <span style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: '900', padding: '2px 5px', borderRadius: '12px', transform: 'translate(20%, -20%)', border: '2px solid white' }}>
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div style={{ position: 'absolute', top: '120%', right: 0, width: '380px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 50, overflow: 'hidden' }}>
                                <div style={{ padding: '15px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '900', color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>SECURITY ALERT HUB</span>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span onClick={handleClearNotifications} style={{ fontSize: '0.7rem', color: '#ef4444', cursor: 'pointer', textDecoration: 'underline' }}>Clear All</span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', background: '#e2e8f0', padding: '4px 8px', borderRadius: '6px' }}>{notifications.length} Logs</span>
                                    </div>
                                </div>
                                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600' }}>Operations Nominal. No alerts triggered.</div>
                                    ) : notifications.map(n => (
                                        <div key={n.id} style={{ padding: '15px 20px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', background: n.read ? 'transparent' : 'rgba(79, 70, 229, 0.03)' }}>
                                            <div style={{ fontWeight: '800', color: n.text.includes('🚨') || n.text.includes('Unauthorized') || n.text.includes('UNAUTHORIZED') ? '#ef4444' : '#f59e0b', marginBottom: '8px', lineHeight: '1.4' }}>{n.text}</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{n.time.toLocaleTimeString()}</span>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#3b82f6', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>Email Dispatched</span>
                                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px' }}>SMS Sent</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ height: '30px', width: '2px', background: '#f1f5f9' }}></div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>{userName}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{userRole}</div>
                </div>
                <div style={{ width: '40px', height: '40px', background: 'var(--info-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                    👤
                </div>
            </div>
          </header>

          <div style={{ flex: 1, padding: '2.5rem 4rem', overflowY: 'auto' }}>
            <div style={{ width: '100%' }}>
                <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/my-team" element={<MyTeam />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/validate-asset" element={<ValidateAsset />} />
                <Route path="/timeline" element={<AssetTimeline />} />
                <Route path="/gatepasses" element={<GatePasses />} />
                <Route path="/gatepasses/:tab" element={<GatePasses />} />
                <Route path="/audits" element={<AuditLogs />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/rbac" element={<RBAC />} />
                </Routes>
            </div>
          </div>
        </main>

      </div>
  );
}

export default AppLayout;
