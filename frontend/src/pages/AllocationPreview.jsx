import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export const AllocationPreview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const state = location.state || {};
  const { preview, examDate, session } = state;

  useEffect(() => {
    if (!preview || preview.length === 0) {
      showToast('No active allocation preview found. Please configure and generate.', 'info');
      navigate('/allocation');
    }
  }, [preview, navigate, showToast]);

  if (!preview || preview.length === 0) {
    return null;
  }

  // Group allocations by hall_no
  const halls = {};
  preview.forEach((p) => {
    if (!p || !p.hall_no || !p.seat_label) return;
    if (!halls[p.hall_no]) halls[p.hall_no] = [];
    halls[p.hall_no].push(p);
  });

  const columns = ['A', 'B', 'C', 'D'];

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      // Send the preview state in body (the backend will process and insert)
      await api.post('/allocation/confirm', { preview });
      showToast('Allocation confirmed and saved successfully!', 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast(err.message || 'Failed to confirm allocation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <div className="page-header">
        <div>
          <h2>Allocation Preview</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>
            Date: {examDate} | Session: {session}
          </p>
        </div>
        <Link to="/allocation" className="btn btn-secondary">
          ← Reconfigure
        </Link>
      </div>

      {Object.keys(halls).map((hallNo) => {
        const seats = halls[hallNo];
        
        // Map seats by label for constant time lookup
        const seatMap = {};
        seats.forEach((s) => {
          seatMap[s.seat_label] = s;
        });

        // Determine max row index
        const maxRow = Math.max(
          ...seats.map((s) => parseInt(s.seat_label.slice(1)) || 1)
        );

        return (
          <div className="hall-card" key={hallNo}>
            <div className="hall-title">
              <span>🏫 Hall: {hallNo}</span>
              <span className="invigilator">Invigilator: {seats[0]?.invigilator || 'Unassigned'}</span>
            </div>

            {/* Render 4 column grid header */}
            <div className="seat-grid" style={{ marginBottom: '16px' }}>
              {columns.map((col) => (
                <div className="seat-col-header" key={col}>
                  {col}
                </div>
              ))}
            </div>

            {/* Render rows */}
            {Array.from({ length: maxRow }, (_, rowIndex) => {
              const r = rowIndex + 1;
              return (
                <div className="seat-grid" key={r} style={{ marginBottom: '12px' }}>
                  {columns.map((c) => {
                    const seatKey = c + r;
                    const s = seatMap[seatKey];
                    
                    return (
                      <div className="seat-box" key={c}>
                        {s ? (
                          <>
                            <div className="seat-no">{seatKey}</div>
                            <div className="seat-regno">
                              {String(s.regno).replace(/\.0$/, '')}
                            </div>
                            <div className="seat-dept">Dept: {s.dept}</div>
                            <div className="seat-sub">{s.subject_code}</div>
                          </>
                        ) : (
                          <div className="seat-empty">{seatKey} (Empty)</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ textAlign: 'center', marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleConfirm}
          className="btn btn-primary"
          style={{ padding: '16px 36px', fontSize: '18px', minWidth: '320px', background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', border: 'none', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)' }}
          disabled={submitting}
        >
          {submitting ? 'Saving to Student Portals...' : '💾 Confirm & Save Schedule to Student Portals'}
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          ✨ Once saved, students can enter their Register Number on the Student Portal to view their Hall No & Seat Assignment.
        </span>
      </div>
    </div>
  );
};
