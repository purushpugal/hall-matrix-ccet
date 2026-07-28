import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { AiChatBox } from '../components/AiChatBox';
import { api } from '../utils/api';

export const StudentLogin = () => {
  const [tenantId, setTenantId] = useState('ccet');
  const [regno, setRegno] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantId || !regno) {
      showToast('Please enter both Organization Code and Register Number', 'error');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/auth/student-login', {
        tenant_id: tenantId.trim(),
        regno: regno.trim()
      });

      if (data.success) {
        showToast('Welcome to Student Portal!', 'success');
        navigate('/student/dashboard');
      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Login failed. Please check your Register Number.', 'error');
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
            onClick={() => navigate('/login')}
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
            🔑 Admin Login
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'default'
            }}
          >
            🎓 Student Portal
          </button>
        </div>

        <div className="logo" style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}>🎓</div>
        <h2>Student Exam Portal</h2>
        <p className="subtitle">Check Your Exam Seating Schedule</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Organization Code</label>
            <input
              type="text"
              placeholder="e.g. ccet"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Register Number</label>
            <input
              type="text"
              placeholder="Enter your Register Number"
              value={regno}
              onChange={(e) => setRegno(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }} disabled={loading}>
            {loading ? 'Verifying...' : 'Access My Exam Portal'}
          </button>
        </form>

        <div className="footer-text" style={{ marginTop: '20px' }}>
          Are you an administrator? <Link to="/login" style={{ color: '#6366f1', fontWeight: '700' }}>Admin Login</Link>
        </div>
      </div>
      <AiChatBox />
    </div>
  );
};
