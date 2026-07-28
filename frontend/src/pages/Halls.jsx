import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { downloadHallsTemplate } from '../utils/templateGenerator';

export const Halls = () => {
  const [halls, setHalls] = useState([]);
  const [hallNo, setHallNo] = useState('');
  const [capacity, setCapacity] = useState('');
  const [block, setBlock] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchHalls = async () => {
    try {
      const data = await api.get('/halls');
      setHalls(data.halls || []);
    } catch (err) {
      showToast(err.message || 'Failed to load halls', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHalls();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!hallNo || !capacity) {
      showToast('Hall Number and Capacity are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/halls/add', { hall_no: hallNo, capacity: parseInt(capacity), block });
      showToast('Hall registered successfully', 'success');
      setHallNo('');
      setCapacity('');
      setBlock('');
      fetchHalls();
    } catch (err) {
      showToast(err.message || 'Failed to register hall', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [selectedIds, setSelectedIds] = useState([]);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(halls.map((h) => h.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected hall(s)?`)) return;

    setSubmitting(true);
    try {
      const res = await api.post('/halls/bulk-delete', { ids: selectedIds });
      if (res.success) {
        showToast(`Deleted ${res.deletedCount || selectedIds.length} hall(s)`, 'success');
        setSelectedIds([]);
        fetchHalls();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete halls', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this hall?')) return;

    try {
      await api.post(`/halls/delete/${id}`);
      showToast('Hall removed successfully', 'success');
      fetchHalls();
    } catch (err) {
      showToast(err.message || 'Failed to delete hall', 'error');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      showToast('Please choose an Excel file', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setSubmitting(true);
    try {
      const res = await api.postFormData('/halls/upload', formData);
      showToast(res.message || 'Halls config uploaded successfully', 'success');
      setFile(null);
      e.target.reset();
      fetchHalls();
    } catch (err) {
      showToast(err.message || 'Halls sheet upload failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Halls Inventory</h2>
        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Add Hall Form */}
      <div className="card">
        <h3>➕ Add Exam Hall</h3>
        <form onSubmit={handleAdd} className="form-inline">
          <div className="form-group">
            <input
              type="text"
              placeholder="Hall No (e.g. 101)"
              value={hallNo}
              onChange={(e) => setHallNo(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <input
              type="number"
              placeholder="Capacity (e.g. 24)"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="Block / Sector (e.g. Main Block)"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      {/* Sheet Upload */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>📊 Upload Halls Configuration (Excel)</h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={downloadHallsTemplate}
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              fontSize: '13px',
              padding: '6px 14px'
            }}
          >
            📥 Download Sample Template (.csv/.xlsx)
          </button>
        </div>
        <form onSubmit={handleUpload} className="file-upload-form">
          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files[0])}
              required
              disabled={submitting}
            />
            <div className="file-input-label">
              📁 {file ? file.name : 'Choose Excel Sheet (.xlsx)'}
            </div>
          </div>
          <button type="submit" className="btn btn-success" disabled={submitting}>
            {submitting ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </div>

      {/* Halls Listing Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>🏫 Configured Classrooms</h3>
          {selectedIds.length > 0 && (
            <button
              className="btn"
              onClick={handleBulkDelete}
              disabled={submitting}
              style={{
                background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)'
              }}
            >
              🗑️ Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Loading halls registry...
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={halls.length > 0 && halls.every((h) => selectedIds.includes(h.id))}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th>Hall No</th>
                  <th>Capacity</th>
                  <th>Block Sector</th>
                  <th style={{ width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {halls.length > 0 ? (
                  halls.map((hall) => (
                    <tr key={hall.id} style={{ background: selectedIds.includes(hall.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(hall.id)}
                          onChange={() => handleToggleSelect(hall.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ fontWeight: '700', color: '#6366f1' }}>{hall.hall_no}</td>
                      <td>{hall.capacity} seats</td>
                      <td>{hall.block || 'N/A'}</td>
                      <td>
                        <button
                          onClick={() => handleDelete(hall.id)}
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                      No classrooms registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};
