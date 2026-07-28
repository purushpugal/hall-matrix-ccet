import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export const Allocation = () => {
  const [subjectCodes, setSubjectCodes] = useState('');
  const [examDate, setExamDate] = useState('');
  const [session, setSession] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savedAllocations, setSavedAllocations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const navigate = useNavigate();
  const { showToast } = useToast();

  const fetchSavedAllocations = async () => {
    try {
      const data = await api.get('/allocation/list');
      if (data.success) {
        setSavedAllocations(data.allocations || []);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load saved allocations', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchSavedAllocations();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!subjectCodes || !examDate || !session) {
      showToast('All parameters are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.post('/allocation/generate', {
        subject_codes: subjectCodes,
        exam_date: examDate,
        session,
      });

      if (!data.preview || data.preview.length === 0) {
        showToast('No students found or allocation requirements could not be met.', 'error');
      } else {
        showToast('Seat allocation preview generated!', 'success');
        navigate('/allocation/preview', { state: { preview: data.preview, examDate, session } });
      }
    } catch (err) {
      showToast(err.message || 'Error generating seat allocation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewSavedDetail = async (item) => {
    try {
      const data = await api.get(`/allocation/view-detail?exam_date=${encodeURIComponent(item.exam_date)}&session=${encodeURIComponent(item.session)}`);
      if (data.success && data.preview && data.preview.length > 0) {
        navigate('/allocation/preview', {
          state: { preview: data.preview, examDate: item.exam_date, session: item.session }
        });
      } else {
        showToast('No allocation layout detail found', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Failed to load allocation detail', 'error');
    }
  };

  const handleDeleteSaved = async (item) => {
    if (!window.confirm(`Are you sure you want to delete allocation for ${item.exam_date} (${item.session})?`)) return;

    try {
      const res = await api.post('/allocation/delete', { exam_date: item.exam_date, session: item.session });
      if (res.success) {
        showToast(`Deleted allocation for ${item.exam_date} (${item.session})`, 'success');
        fetchSavedAllocations();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete allocation', 'error');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Exam Seating Allocations</h2>
        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      <div className="card">
        <h3>🧮 Schedule New Exam Seating</h3>
        <form onSubmit={handleGenerate} className="form-inline">
          <div className="form-group" style={{ flex: 1.5 }}>
            <input
              type="text"
              placeholder="Comma separated subject codes (e.g. CS101,CS102)"
              value={subjectCodes}
              onChange={(e) => setSubjectCodes(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          
          <div className="form-group">
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <select
              value={session}
              onChange={(e) => setSession(e.target.value)}
              required
              disabled={submitting}
            >
              <option value="" disabled hidden>Select Session</option>
              <option value="FN">Forenoon (FN)</option>
              <option value="AN">Afternoon (AN)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Generating...' : 'Generate Preview'}
          </button>
        </form>
      </div>

      {/* List of Saved Allocations */}
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>📅 Active Confirmed Exam Allocations (Admin History)</h3>
        {loadingList ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            Loading saved allocation history...
          </div>
        ) : savedAllocations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No confirmed exam seating allocations found. Generate and confirm a seating grid above to display here!
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                  <th style={{ padding: '14px 16px' }}>Exam Date & Session</th>
                  <th style={{ padding: '14px 16px' }}>Subject Codes</th>
                  <th style={{ padding: '14px 16px' }}>Departments</th>
                  <th style={{ padding: '14px 16px' }}>Coverage</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedAllocations.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#ffffff' }}>{item.exam_date}</div>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: item.session === 'FN' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: item.session === 'FN' ? '#3b82f6' : '#f59e0b',
                        fontWeight: '700'
                      }}>
                        {item.session} Session
                      </span>
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
                        {item.subject_codes || 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {item.departments || 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#ffffff', fontSize: '13px' }}>
                        👥 {item.student_count} Students
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        🏫 {item.hall_count} Halls
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        className="btn"
                        onClick={() => handleViewSavedDetail(item)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginRight: '8px'
                        }}
                      >
                        👁️ View Seating Grid
                      </button>
                      <button
                        className="btn"
                        onClick={() => handleDeleteSaved(item)}
                        style={{
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#f43f5e',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Downloads */}
      <div className="card" style={{ borderLeft: '4px solid var(--accent-indigo)' }}>
        <h3>📄 Export Active Allocation Reports</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
          Download the latest confirmed seating layout or summary PDF report.
        </p>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <a
            href={window.location.origin.includes('localhost') ? "http://localhost:3000/api/allocation/pdf-hall" : "/api/allocation/pdf-hall"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-success"
            style={{ textDecoration: 'none' }}
          >
            🪑 Download Seating Grid PDF
          </a>

          <a
            href={window.location.origin.includes('localhost') ? "http://localhost:3000/api/allocation/pdf-summary" : "/api/allocation/pdf-summary"}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ textDecoration: 'none', background: 'var(--secondary-gradient)' }}
          >
            📊 Download Summary PDF
          </a>
        </div>
      </div>
    </Layout>
  );
};
