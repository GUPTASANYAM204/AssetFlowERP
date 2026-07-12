import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Settings, 
  Package, 
  RefreshCw, 
  CalendarRange, 
  Wrench, 
  ClipboardCheck, 
  BarChart3, 
  Bell, 
  LogOut 
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  
  if (!user) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <LayoutDashboard size={24} style={{ color: 'var(--accent-primary)' }} />
        <span>Asset<span>Flow</span></span>
      </div>

      <nav className="sidebar-menu">
        <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        {user.role === 'ADMIN' && (
          <NavLink to="/setup" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Organization Setup</span>
          </NavLink>
        )}

        <NavLink to="/assets" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Package size={18} />
          <span>Assets Directory</span>
        </NavLink>

        <NavLink to="/allocations" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <RefreshCw size={18} />
          <span>Allocation & Transfer</span>
        </NavLink>

        <NavLink to="/bookings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <CalendarRange size={18} />
          <span>Resource Booking</span>
        </NavLink>

        <NavLink to="/maintenance" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Wrench size={18} />
          <span>Maintenance</span>
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <BarChart3 size={18} />
          <span>Reports & Analytics</span>
        </NavLink>

        <NavLink to="/notifications" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Bell size={18} />
          <span>Notifications & Logs</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-badge">
          <div className="avatar">
            {user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{user.role.replace('_', ' ')}</div>
          </div>
        </div>
        <button 
          onClick={logout} 
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};
export default Sidebar;
