import React from 'react';
import { NavLink, Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ publicTenantName }) => {
  const { user, logout } = useAuth();
  const params = useParams();
  
  // Resolve tenant ID for the public view Link
  const currentTenantId = user?.tenant_id || params.tenant_id || 'ccet';
  const brandName = user?.tenant_name || publicTenantName || 'Hall Matrix';

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="logo">HM</div>
        <span>{brandName}</span>
      </div>

      <nav>
        {user ? (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              Dashboard
            </NavLink>
            <NavLink to="/students" className={({ isActive }) => isActive ? 'active' : ''}>
              🎓 Students
            </NavLink>
            <NavLink to="/subjects" className={({ isActive }) => isActive ? 'active' : ''}>
              📘 Subjects
            </NavLink>
            <NavLink to="/halls" className={({ isActive }) => isActive ? 'active' : ''}>
              🏫 Halls
            </NavLink>
            <NavLink to="/invigilators" className={({ isActive }) => isActive ? 'active' : ''}>
              👨‍🏫 Invigilators
            </NavLink>
            <NavLink to="/allocation" className={({ isActive }) => isActive ? 'active font-semibold' : ''}>
              🧮 Allocation
            </NavLink>
            <a href="#logout" className="logout" onClick={(e) => { e.preventDefault(); logout(); }}>
              Logout
            </a>
          </>
        ) : (
          <>
            <NavLink to="/student/login" className="active">
              🎓 Student Portal
            </NavLink>
            <Link to="/login" className="logout">
              🔑 Admin Login
            </Link>
          </>
        )}
      </nav>
    </div>
  );
};
