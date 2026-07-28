import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';

export const Batches = () => {
  const { degreeName, deptName } = useParams();

  // The 4 default batches specified by the user requirement
  const batches = [
    { id: 1, name: 'Batch 1', label: '1st Year' },
    { id: 2, name: 'Batch 2', label: '2nd Year' },
    { id: 3, name: 'Batch 3', label: '3rd Year' },
    { id: 4, name: 'Batch 4', label: '4th Year' },
  ];

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '5px' }}>
            <Link to="/students" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Degrees</Link> / 
            <Link to={`/students/degree/${encodeURIComponent(degreeName)}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}> {degreeName}</Link> / 
            {' '}{deptName}
          </div>
          <h2>📚 {deptName} - Batches</h2>
        </div>
        <Link to={`/students/degree/${encodeURIComponent(degreeName)}`} className="btn btn-secondary">
          ← Back to Departments
        </Link>
      </div>

      <div className="card">
        <h3>Select a Batch</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px', 
          marginTop: '20px' 
        }}>
          {batches.map((batch) => (
            <Link 
              key={batch.id} 
              to={`/students/degree/${encodeURIComponent(degreeName)}/dept/${encodeURIComponent(deptName)}/batch/${encodeURIComponent(batch.name)}`}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '30px 20px',
                textAlign: 'center',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.borderColor = 'var(--accent-indigo)';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎓</div>
              <h4 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{batch.name}</h4>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{batch.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};
