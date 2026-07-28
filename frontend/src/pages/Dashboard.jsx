import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export const Dashboard = () => {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllocations();
  }, []);

  const fetchAllocations = async () => {
    try {
      const data = await api.get('/allocation/list');
      if (data.success) {
        setAllocations(data.allocations || []);
      }
    } catch (err) {
      // Ignore background error on dashboard load
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>
            Welcome back, {user?.name || 'Admin'}
          </p>
        </div>
        <div style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>
          🏫 {user?.tenant_name || 'College Instance'}
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: '28px' }}>
        <Link to="/students" className="dash-card">
          <div className="icon">🎓</div>
          <h3>Students</h3>
          <p>Manage student records, spreadsheet uploads, and manual creations.</p>
        </Link>

        <Link to="/subjects" className="dash-card">
          <div className="icon">📘</div>
          <h3>Subjects</h3>
          <p>Register exam subject codes and catalog naming descriptions.</p>
        </Link>

        <Link to="/halls" className="dash-card">
          <div className="icon">🏫</div>
          <h3>Halls</h3>
          <p>Configure classroom locations, capacity counts, and block sectors.</p>
        </Link>

        <Link to="/invigilators" className="dash-card">
          <div className="icon">👨‍🏫</div>
          <h3>Invigilators</h3>
          <p>Maintain teacher department profiles for exam invigilation duties.</p>
        </Link>

        <Link to="/allocation" className="dash-card highlight">
          <div className="icon">🧮</div>
          <h3>Allocation</h3>
          <p>Generate optimized seat allocations, review grid splits, and export PDF summaries.</p>
        </Link>

        <Link to={`/t/${user?.tenant_id || 'ccet'}/student-view`} className="dash-card">
          <div className="icon">🔍</div>
          <h3>Student View</h3>
          <p>Access the public portal to lookup seat numbers and classroom halls.</p>
        </Link>
      </div>

      {/* Active Confirmed Exam Allocations Overview */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>📅 Active Scheduled Exam Allocations</h3>
          <Link to="/allocation" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 14px' }}>
            + Schedule / Manage
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Loading active exam schedules...
          </div>
        ) : allocations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '14px' }}>
            📭 No active exam allocations scheduled yet. Click <strong>+ Schedule / Manage</strong> above to generate seating grids!
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px' }}>Date & Session</th>
                  <th style={{ padding: '12px 16px' }}>Subject Codes</th>
                  <th style={{ padding: '12px 16px' }}>Departments</th>
                  <th style={{ padding: '12px 16px' }}>Allocated Count</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#ffffff' }}>
                      {a.exam_date} ({a.session})
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        {a.subject_codes || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {a.departments || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#10b981', fontWeight: '700', fontSize: '13px' }}>
                      👥 {a.student_count} Students in 🏫 {a.hall_count} Halls
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};
