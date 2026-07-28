import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AiChatBox } from '../components/AiChatBox';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      showToast('Please enter both username and password', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await login(username, password);
      showToast('Logged in successfully', 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast(err.message || 'Invalid username or password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        {/* Role Switcher Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary-gradient)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'default'
            }}
          >
            🔑 Admin Login
          </button>
          <button
            onClick={() => navigate('/student/login')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🎓 Student Portal
          </button>
        </div>

        <div className="logo">HM</div>
        <h2>Admin Sign In</h2>
        <p className="subtitle">Hall Allocation Management System</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="footer-text" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
          <div>
            🎓 Student looking for exam seating? <Link to="/student/login" style={{ color: '#10b981', fontWeight: '700' }}>Go to Student Login</Link>
          </div>
          <div>
            New organization? <Link to="/register">Create an account</Link>
          </div>
        </div>
      </div>
      <AiChatBox />
    </div>
  );
};
