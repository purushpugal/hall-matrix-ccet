import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { AiChatBox } from '../components/AiChatBox';

export const Register = () => {
  const [tenantName, setTenantName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantName || !tenantId || !name || !username || !password) {
      showToast('All fields are required', 'error');
      return;
    }

    const tid = tenantId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!tid) {
      showToast('Invalid Organization Code', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        tenant_name: tenantName,
        tenant_id: tid,
        name,
        username,
        password,
        role,
      });
      showToast('Organization and Admin registered successfully! Please log in.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ width: '480px' }}>
        <div className="logo">HM</div>
        <h2>Create Account</h2>
        <p className="subtitle">Register a new organization database</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Organization Name</label>
            <input
              type="text"
              placeholder="e.g. CCET College"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Organization Code (Lowercase URL-friendly)</label>
            <input
              type="text"
              placeholder="e.g. ccet"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              pattern="[a-z0-9_\-]+"
              title="Lowercase letters, numbers, hyphens and underscores only"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Choose a username"
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
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} required disabled={loading}>
              <option value="admin">Admin</option>
              <option value="tutor">Tutor</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Register Organization'}
          </button>
        </form>

        <div className="footer-text">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
      <AiChatBox />
    </div>
  );
};
