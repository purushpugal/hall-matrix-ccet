import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { AiChatBox } from '../components/AiChatBox';
import { api } from '../utils/api';

export const StudentDashboard = () => {
  const [student, setStudent] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const meData = await api.get('/auth/student-me');

      if (!meData || !meData.student) {
        navigate('/student/login');
        return;
      }

      setStudent(meData.student);

      const allocData = await api.get('/student/my-allocations');

      if (allocData && allocData.allocations) {
        setAllocations(allocData.allocations);
      }
    } catch (err) {
      showToast('Failed to load student dashboard', 'error');
      navigate('/student/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/student-logout');
      showToast('Logged out of Student Portal', 'info');
      navigate('/student/login');
    } catch (err) {
      showToast('Logout failed', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--bg-app)',
        color: 'var(--text-muted)'
      }}>
        Loading your exam schedule...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-main)', padding: '24px' }}>
      {/* Top Navbar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 28px',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: '1px solid var(--card-border)',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: '800'
          }}>
            🎓
          </div>
          <div>
            <h2 style={{ fontSize: '18px', margin: 0, color: '#ffffff' }}>{student?.tenant_name || 'Hall Matrix'}</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Student Examination Portal</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn"
          style={{
            background: 'rgba(244, 63, 94, 0.15)',
            color: '#f43f5e',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            padding: '8px 18px',
            borderRadius: '10px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          🚪 Logout
        </button>
      </header>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Student Profile Card */}
        <div className="card" style={{ marginBottom: '28px', padding: '28px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#10b981', fontWeight: '700' }}>Logged In Student</span>
              <h1 style={{ fontSize: '26px', margin: '4px 0', color: '#ffffff' }}>{student?.name ? `${student.name} (${student.regno})` : `Reg No: ${student?.regno}`}</h1>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
                Reg No: <strong style={{ color: '#ffffff' }}>{student?.regno}</strong> • Department: <strong style={{ color: '#ffffff' }}>{student?.dept || 'N/A'}</strong> {student?.batch ? `• Batch: ${student.batch}` : ''} {student?.degree ? `• Degree: ${student.degree}` : ''}
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>{allocations.length}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Scheduled Exams</div>
            </div>
          </div>
        </div>

        {/* Exam Schedule Table / Cards */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📅 Your Allocated Exam Schedule
          </h3>

          {allocations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
              <p style={{ fontSize: '16px', margin: '0 0 6px 0' }}>No seating allocations found for your Register Number yet.</p>
              <span style={{ fontSize: '13px' }}>Once your administrator schedules and confirms exam halls, your seats will appear here!</span>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                    <th style={{ padding: '14px 16px' }}>Date & Session</th>
                    <th style={{ padding: '14px 16px' }}>Subject Code / Name</th>
                    <th style={{ padding: '14px 16px' }}>Hall No</th>
                    <th style={{ padding: '14px 16px' }}>Seat Label</th>
                    <th style={{ padding: '14px 16px' }}>Invigilator</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#ffffff' }}>{a.exam_date}</div>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: a.session === 'FN' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: a.session === 'FN' ? '#3b82f6' : '#f59e0b',
                          fontWeight: '700'
                        }}>
                          {a.session} Session
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '700', color: '#6366f1' }}>{a.subject_code}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{a.subject_name || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '15px'
                        }}>
                          {a.hall_no}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#10b981',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '15px'
                        }}>
                          {a.seat_label}
                        </span>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                        {a.invigilator || 'Assigned Staff'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Floating AI Chatbot for Student */}
      <AiChatBox />
    </div>
  );
};
