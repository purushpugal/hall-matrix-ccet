import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { downloadSubjectsTemplate } from '../utils/templateGenerator';

export const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [batch, setBatch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchSubjects = async () => {
    try {
      const data = await api.get('/subjects');
      setSubjects(data.subjects || []);
    } catch (err) {
      showToast(err.message || 'Failed to load subjects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(subjects.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected subject(s)?`)) return;

    setSubmitting(true);
    try {
      const res = await api.post('/subjects/bulk-delete', { ids: selectedIds });
      if (res.success) {
        showToast(`Deleted ${res.deletedCount || selectedIds.length} subject(s)`, 'success');
        setSelectedIds([]);
        fetchSubjects();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete subjects', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!subjectCode || !subjectName) {
      showToast('Please fill subject code and name', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/subjects/add', {
        subject_code: subjectCode.trim(),
        subject_name: subjectName.trim(),
        batch: batch.trim() || null
      });
      showToast('Subject added successfully', 'success');
      setSubjectCode('');
      setSubjectName('');
      setBatch('');
      fetchSubjects();
    } catch (err) {
      showToast(err.message || 'Failed to add subject', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject?')) return;

    try {
      await api.post(`/subjects/delete/${id}`);
      showToast('Subject deleted successfully', 'success');
      fetchSubjects();
    } catch (err) {
      showToast(err.message || 'Failed to delete subject', 'error');
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
      const res = await api.postFormData('/subjects/upload', formData);
      showToast(res.message || 'Subjects list uploaded successfully', 'success');
      setFile(null);
      e.target.reset();
      fetchSubjects();
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>Subject Catalog</h2>
        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Add Subject */}
      <div className="card">
        <h3>➕ Add Subject</h3>
        <form onSubmit={handleAdd} className="form-inline" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
            <input
              type="text"
              placeholder="Subject Code (e.g. CS101)"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-group" style={{ flex: 2, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Subject Name (e.g. Computer Science I)"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
            <input
              type="text"
              placeholder="Assign Batch (e.g. 2022-2026)"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Subject'}
          </button>
        </form>
      </div>

      {/* Excel Upload */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>📊 Upload Subjects (Excel)</h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={downloadSubjectsTemplate}
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
              accept=".xlsx, .xls"
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

      {/* Grid of existing entries */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>📘 Registered Subjects</h3>
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
            Loading subjects catalog...
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
                      checked={subjects.length > 0 && subjects.every((s) => selectedIds.includes(s.id))}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  <th style={{ width: '20%' }}>Subject Code</th>
                  <th>Subject Name</th>
                  <th style={{ width: '20%' }}>Assigned Batch</th>
                  <th style={{ width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {subjects.length > 0 ? (
                  subjects.map((sub) => (
                    <tr key={sub.id} style={{ background: selectedIds.includes(sub.id) ? 'rgba(99, 102, 241, 0.08)' : 'transparent' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sub.id)}
                          onChange={() => handleToggleSelect(sub.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ fontWeight: '700', color: '#6366f1' }}>{sub.subject_code}</td>
                      <td>{sub.subject_name}</td>
                      <td>
                        <span style={{
                          background: 'rgba(255,255,255,0.06)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: 'var(--text-muted)'
                        }}>
                          {sub.batch || 'All Batches'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(sub.id)}
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
                      No subjects registered yet.
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
