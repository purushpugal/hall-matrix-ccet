import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export const StudentView = () => {
  const { tenant_id } = useParams();
  const { showToast } = useToast();
  
  const [tenantName, setTenantName] = useState('Hall Matrix');
  const [regno, setRegno] = useState('');
  const [result, setResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchTenantMetadata = async () => {
      try {
        const tid = tenant_id ? tenant_id.toLowerCase() : 'ccet';
        const data = await api.get(`/t/${tid}/student-view`);
        if (data.tenant) {
          setTenantName(data.tenant.name);
        }
      } catch (err) {
        showToast('Organization database not found', 'error');
        setTenantName('Hall Matrix');
      } finally {
        setLoading(false);
      }
    };

    fetchTenantMetadata();
  }, [tenant_id, showToast]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!regno.trim()) {
      showToast('Please enter a register number', 'info');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setResult(null);

    try {
      const tid = tenant_id ? tenant_id.toLowerCase() : 'ccet';
      const data = await api.post(`/t/${tid}/student-view`, { regno: regno.trim() });
      if (data.student || (data.allocations && data.allocations.length > 0)) {
        setResult(data);
        showToast('Student details & seat allocation located!', 'success');
      } else {
        setSearchError('No student details or seating allocation found for this registration number.');
      }
    } catch (err) {
      setSearchError(err.message || 'Seating details lookup error');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Layout publicTenantName={tenantName}>
      <div className="page-header">
        <div>
          <h2>Student Seat Lookup</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>
            College instance: {tenantName}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
          Connecting to organization database...
        </div>
      ) : (
        <>
          {/* Lookup Input Card */}
          <div className="card">
            <h3 style={{ marginBottom: '10px' }}>🔍 Search Seating Layout</h3>
            <form onSubmit={handleSearch} style={{ marginTop: '15px' }}>
              <label style={{ display: 'block', fontWeight: '500', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '14px' }}>
                Enter Register Number
              </label>
              <div className="student-search-box">
                <input
                  type="text"
                  placeholder="e.g. 950001"
                  value={regno}
                  onChange={(e) => setRegno(e.target.value)}
                  required
                  disabled={searching}
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>
          </div>

          {/* Error display */}
          {searchError && (
            <div className="card" style={{ borderLeft: '4px solid var(--accent-rose)' }}>
              <p style={{ color: 'var(--accent-rose)', fontWeight: '500' }}>
                ⚠️ {searchError}
              </p>
            </div>
          )}

          {/* Search Result details display */}
          {result && (
            <div>
              {/* Student Profile Card */}
              <div className="card" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#818cf8', fontWeight: '700' }}>Student Profile</span>
                    <h2 style={{ fontSize: '24px', margin: '4px 0', color: '#ffffff' }}>{result.student?.name || 'Student Profile'}</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
                      Reg No: <strong style={{ color: '#ffffff' }}>{result.student?.regno}</strong> • Dept: <strong style={{ color: '#ffffff' }}>{result.student?.dept}</strong> • Batch: <strong style={{ color: '#ffffff' }}>{result.student?.batch}</strong> {result.student?.degree ? `• Degree: ${result.student.degree}` : ''}
                    </p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', padding: '10px 18px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#818cf8' }}>{result.allocations?.length || 0}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Connected Exams</div>
                  </div>
                </div>
              </div>

              {/* Connected Subjects & Seating Table */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>📘 Connected Subjects & Allocated Seats</h3>

                {(!result.allocations || result.allocations.length === 0) ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    No active exam hall seating allocations confirmed yet for this student.
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                          <th style={{ padding: '12px 16px' }}>Date & Session</th>
                          <th style={{ padding: '12px 16px' }}>Subject Code & Name</th>
                          <th style={{ padding: '12px 16px' }}>Hall No</th>
                          <th style={{ padding: '12px 16px' }}>Seat Label</th>
                          <th style={{ padding: '12px 16px' }}>Invigilator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.allocations.map((a, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ fontWeight: '700', color: '#ffffff' }}>{a.exam_date}</div>
                              <span style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: a.session === 'FN' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: a.session === 'FN' ? '#3b82f6' : '#f59e0b',
                                fontWeight: '700'
                              }}>
                                {a.session} Session
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <div style={{ fontWeight: '700', color: '#6366f1' }}>{a.subject_code}</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{a.subject_name || 'N/A'}</div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: '#818cf8',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                fontWeight: '800'
                              }}>
                                {a.hall_no}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: '#10b981',
                                padding: '4px 12px',
                                borderRadius: '6px',
                                fontWeight: '800'
                              }}>
                                {a.seat_label}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
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
          )}
        </>
      )}
    </Layout>
  );
};
