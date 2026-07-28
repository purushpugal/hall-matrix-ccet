import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export const Departments = () => {
  const { degreeName } = useParams();
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const fetchDepartments = async () => {
    try {
      const data = await api.get(`/departments?degree=${encodeURIComponent(degreeName)}`);
      setDepartments(data.departments || []);
    } catch (err) {
      showToast(err.message || 'Failed to load departments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [degreeName]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name) {
      showToast('Please enter a department name', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/departments/add', { name, degree: degreeName });
      showToast('Department added successfully', 'success');
      setName('');
      fetchDepartments();
    } catch (err) {
      showToast(err.message || 'Failed to add department', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return;

    try {
      await api.post(`/departments/delete/${id}`);
      showToast('Department deleted successfully', 'success');
      fetchDepartments();
    } catch (err) {
      showToast(err.message || 'Failed to delete department', 'error');
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '5px' }}>
            <Link to="/students" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Degrees</Link> / {degreeName}
          </div>
          <h2>🏢 {degreeName} - Departments</h2>
        </div>
        <Link to="/students" className="btn btn-secondary">
          ← Back to Degrees
        </Link>
      </div>

      <div className="card">
        <h3>➕ Add Department to {degreeName}</h3>
        <form onSubmit={handleAdd} className="form-inline">
          <div className="form-group">
            <input
              type="text"
              placeholder="Department Name (e.g. CSE, ECE)"
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
        <h3>📋 Department List</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Loading departments...
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th style={{ width: '200px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {departments.length > 0 ? (
                  departments.map((dept) => (
                    <tr key={dept.id}>
                      <td>
                        <Link to={`/students/degree/${encodeURIComponent(degreeName)}/dept/${encodeURIComponent(dept.name)}`} style={{ fontWeight: '600', color: 'var(--accent-indigo)', textDecoration: 'none' }}>
                          📁 {dept.name}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/students/degree/${encodeURIComponent(degreeName)}/dept/${encodeURIComponent(dept.name)}`} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px', marginRight: '10px' }}>
                          View Batches
                        </Link>
                        <button
                          onClick={() => handleDelete(dept.id)}
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
                      No departments found in {degreeName}. Please add a department.
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
