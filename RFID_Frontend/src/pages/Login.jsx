import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
        const res = await axios.post(`http://localhost:5000/api/Employee/login`, { username, password });
        const userData = res.data;
        
        localStorage.setItem('rfid_auth', userData.role);
        localStorage.setItem('rfid_emp_id', userData.id);
        localStorage.setItem('rfid_user_name', userData.name); 
        localStorage.setItem('rfid_permissions', JSON.stringify(userData.permissions || []));
        onLogin(true, userData.role, userData.name, userData.permissions || []);
        navigate('/'); 
        
    } catch(err) {
        if(err.response) {
            alert(`❌ Login Failed: ${err.response.data}`);
        } else {
            alert('❌ Network Error: Is the Backend Server Running?');
        }
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
      
      <div className="glass-panel" style={{ width: '420px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '40px 35px' }}>
        <h1 style={{ color: 'var(--text-main)', margin: '0 0 5px 0', fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
             <span style={{ color: 'var(--primary-color)' }}>RFID</span> System
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 30px 0', fontSize: '0.9rem', fontWeight: '500' }}>Please log in to your account</p>
        
        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          <div className="input-group">
            <label className="input-label">Username (Employee ID)</label>
            <input required className="input-style" placeholder="E.g. admin" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          
          <div className="input-group">
            <label className="input-label">Password</label>
            <input required type="password" className="input-style" placeholder="****" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          <button type="submit" className="btn-primary" style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}>
            Log in
          </button>
        
        </form>
      </div>

    </div>
  );
}

export default Login;
