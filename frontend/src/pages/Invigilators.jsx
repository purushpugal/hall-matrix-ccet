import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { downloadInvigilatorsTemplate } from '../utils/templateGenerator';

export const Invigilators = () => {
  const [invs, setInvs] = useState([]);
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchInvigilators = async () => {
    try {
      const data = await api.get('/invigilators');
      setInvs(data.invigilators || []);
    } catch (err) {
      showToast(err.message || 'Failed to load invigilators roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvigilators();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !dept) {
      showToast('Name and Department are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/invigilators/add', { name, dept });
      showToast('Faculty invigilator registered successfully', 'success');
      setName('');
      setDept('');
      fetchInvigilators();
    } catch (err) {
      showToast(err.message || 'Failed to add invigilator', 'error');
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
      setSelectedIds(invs.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected invigilator(s)?`)) return;

    setSubmitting(true);
    try {
      const res = await api.post('/invigilators/bulk-delete', { ids: selectedIds });
      if (res.success) {
        showToast(`Deleted ${res.deletedCount || selectedIds.length} invigilator(s)`, 'success');
        setSelectedIds([]);
        fetchInvigilators();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete invigilators', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invigilator?')) return;

    try {
      await api.post(`/invigilators/delete/${id}`);
      showToast('Invigilator removed from roster', 'success');
      fetchInvigilators();
    } catch (err) {
      showToast(err.message || 'Failed to delete invigilator', 'error');
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
      const res = await api.postFormData('/invigilators/upload', formData);
      showToast(res.message || 'Invigilators list uploaded successfully', 'success');
      setFile(null);
      e.target.reset();
      fetchInvigilators();
    } catch (err) {
      showToast(err.message || 'Roster upload failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Invigilator Roster</h2>
        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Add Form */}
      <div className="card">
        <h3>➕ Add Invigilator</h3>
        <form onSubmit={handleAdd} className="form-inline">
          <div className="form-group">
            <input
              type="text"
              placeholder="Faculty Name (e.g. Dr. John Doe)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="Department (e.g. ECE)"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      {/* Roster Upload */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>📊 Upload Invigilators Roster (Excel)</h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={downloadInvigilatorsTemplate}
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

      {/* List Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>👨‍🏫 Faculty List</h3>
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
            Loading roster...
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
                      checked={invs.length > 0 && invs.every((i) => selectedIds.includes(i.id))}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th>Faculty Name</th>
                  <th>Department</th>
                  <th style={{ width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {invs.length > 0 ? (
                  invs.map((inv) => (
                    <tr key={inv.id} style={{ background: selectedIds.includes(inv.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(inv.id)}
                          onChange={() => handleToggleSelect(inv.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ fontWeight: '600', color: '#ffffff' }}>{inv.name}</td>
                      <td>{inv.dept}</td>
                      <td>
                        <button
                          onClick={() => handleDelete(inv.id)}
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
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                      No invigilators listed.
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
