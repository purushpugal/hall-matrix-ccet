import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Degrees } from './pages/Degrees';
import { Departments } from './pages/Departments';
import { Batches } from './pages/Batches';
import { BatchStudents } from './pages/BatchStudents';
import { AllStudents } from './pages/AllStudents';
import { Subjects } from './pages/Subjects';
import { Halls } from './pages/Halls';
import { Invigilators } from './pages/Invigilators';
import { Allocation } from './pages/Allocation';
import { AllocationPreview } from './pages/AllocationPreview';
import { StudentView } from './pages/StudentView';
import { StudentLogin } from './pages/StudentLogin';
import { StudentDashboard } from './pages/StudentDashboard';

// Protected Route wrapper component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--bg-app)',
        color: 'var(--text-muted)',
        fontSize: '18px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent-indigo)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 15px'
          }} />
          Loading Session Matrix...
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public route helper for registration
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public Auth Routes - Admin Login strictly requires entering credentials */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={
        <PublicRoute>
          <Register />
        </PublicRoute>
      } />

      {/* Student Portal Routes */}
      <Route path="/student/login" element={<StudentLogin />} />
      <Route path="/student/dashboard" element={<StudentDashboard />} />

      {/* Private Dashboard Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/students" element={
        <ProtectedRoute>
          <AllStudents />
        </ProtectedRoute>
      } />
      <Route path="/students/all" element={<Navigate to="/students" replace />} />
      <Route path="/students/degree/*" element={<Navigate to="/students" replace />} />
      <Route path="/subjects" element={
        <ProtectedRoute>
          <Subjects />
        </ProtectedRoute>
      } />
      <Route path="/halls" element={
        <ProtectedRoute>
          <Halls />
        </ProtectedRoute>
      } />
      <Route path="/invigilators" element={
        <ProtectedRoute>
          <Invigilators />
        </ProtectedRoute>
      } />
      <Route path="/allocation" element={
        <ProtectedRoute>
          <Allocation />
        </ProtectedRoute>
      } />
      <Route path="/allocation/preview" element={
        <ProtectedRoute>
          <AllocationPreview />
        </ProtectedRoute>
      } />

      {/* Public Student Seating search portal */}
      <Route path="/t/:tenant_id/student-view" element={<StudentView />} />

      {/* Redirect wildcards */}
      <Route path="/" element={<Navigate to="/student/login" replace />} />
      <Route path="*" element={<Navigate to="/student/login" replace />} />
    </Routes>
  );
}

export default App;
