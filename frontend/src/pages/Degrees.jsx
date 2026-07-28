import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export const Degrees = () => {
  const [degrees, setDegrees] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const fetchDegrees = async () => {
    try {
      const data = await api.get('/degrees');
      setDegrees(data.degrees || []);
    } catch (err) {
      showToast(err.message || 'Failed to load degrees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDegrees();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name) {
      showToast('Please enter a degree name', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/degrees/add', { name });
      showToast('Degree added successfully', 'success');
      setName('');
      fetchDegrees();
    } catch (err) {
      showToast(err.message || 'Failed to add degree', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this degree?')) return;

    try {
      await api.post(`/degrees/delete/${id}`);
      showToast('Degree deleted successfully', 'success');
      fetchDegrees();
    } catch (err) {
      showToast(err.message || 'Failed to delete degree', 'error');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <h2>🎓 Student Management</h2>
        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Sub Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <Link to="/students" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          📁 Hierarchy View (Degree → Dept → Batch)
        </Link>
        <Link to="/students/all" className="btn btn-secondary" style={{ opacity: 0.8, textDecoration: 'none' }}>
          📋 All Students Roster
        </Link>
      </div>

      <div className="card">
        <h3>➕ Add Degree</h3>
        <form onSubmit={handleAdd} className="form-inline">
          <div className="form-group">
            <input
              type="text"
              placeholder="Degree Name (e.g. UG, PG)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>📋 Degree List</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Loading degrees...
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Degree Name</th>
                  <th style={{ width: '200px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {degrees.length > 0 ? (
                  degrees.map((degree) => (
                    <tr key={degree.id}>
                      <td>
                        <Link to={`/students/degree/${encodeURIComponent(degree.name)}`} style={{ fontWeight: '600', color: 'var(--accent-indigo)', textDecoration: 'none' }}>
                          📁 {degree.name}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/students/degree/${encodeURIComponent(degree.name)}`} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px', marginRight: '10px' }}>
                          View Departments
                        </Link>
                        <button
                          onClick={() => handleDelete(degree.id)}
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
                    <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                      No degrees found. Please add a degree.
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
