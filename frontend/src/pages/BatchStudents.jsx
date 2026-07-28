import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';

export const BatchStudents = () => {
  const { degreeName, deptName, batchName } = useParams();
  const [students, setStudents] = useState([]);
  const [regno, setRegno] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchStudents = async () => {
    try {
      const data = await api.get(`/students?degree=${encodeURIComponent(degreeName)}&dept=${encodeURIComponent(deptName)}&batch=${encodeURIComponent(batchName)}`);
      setStudents(data.students || []);
    } catch (err) {
      showToast(err.message || 'Failed to load students list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [degreeName, deptName, batchName]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!regno || !subjectCode) {
      showToast('Please fill all fields', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/students/add', { 
        regno, 
        degree: degreeName,
        dept: deptName, 
        subject_code: subjectCode,
        batch: batchName
      });
      showToast('Student added successfully', 'success');
      setRegno('');
      setSubjectCode('');
      fetchStudents();
    } catch (err) {
      showToast(err.message || 'Failed to add student', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student?')) return;

    try {
      await api.post(`/students/delete/${id}`);
      showToast('Student deleted successfully', 'success');
      fetchStudents();
    } catch (err) {
      showToast(err.message || 'Failed to delete student', 'error');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      showToast('Please choose an Excel file first', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setSubmitting(true);
    try {
      await api.post(`/students/upload?degree=${encodeURIComponent(degreeName)}&dept=${encodeURIComponent(deptName)}&batch=${encodeURIComponent(batchName)}`, formData);
      showToast('Students spreadsheet uploaded successfully', 'success');
      setFile(null);
      // Reset input element value
      e.target.reset();
      fetchStudents();
    } catch (err) {
      showToast(err.message || 'Spreadsheet upload failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '5px' }}>
            <Link to="/students" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Degrees</Link> / 
            <Link to={`/students/degree/${encodeURIComponent(degreeName)}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}> {degreeName}</Link> / 
            <Link to={`/students/degree/${encodeURIComponent(degreeName)}/dept/${encodeURIComponent(deptName)}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}> {deptName}</Link> / 
            {' '}{batchName}
          </div>
          <h2>🧑‍🎓 {deptName} - {batchName} Students</h2>
        </div>
        <Link to={`/students/degree/${encodeURIComponent(degreeName)}/dept/${encodeURIComponent(deptName)}`} className="btn btn-secondary">
          ← Back to Batches
        </Link>
      </div>

      <div className="card">
        <h3>➕ Add Student to {batchName}</h3>
        <form onSubmit={handleAdd} className="form-inline">
          <div className="form-group">
            <input
              type="text"
              placeholder="Register No (e.g. 920324205001)"
              value={regno}
              onChange={(e) => setRegno(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder="Subject Code (e.g. CS101)"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
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
        <h3>📊 Upload {batchName} Students (Excel)</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '15px' }}>
          Uploading will automatically assign the degree <strong>{degreeName}</strong>, department <strong>{deptName}</strong> and batch <strong>{batchName}</strong> to all rows, unless specified in the sheet.
        </p>
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

      <div className="card">
        <h3>📋 Student List ({students.length})</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Loading students directory...
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Register No</th>
                  <th>Subject Code</th>
                  <th style={{ width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.regno}</td>
                      <td>{student.subject_code}</td>
                      <td>
                        <button
                          onClick={() => handleDelete(student.id)}
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
                      No student records found in {batchName}.
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
