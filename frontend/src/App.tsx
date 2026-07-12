import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrgSetup from './pages/OrgSetup';
import AssetDirectory from './pages/AssetDirectory';
import AllocationTransfer from './pages/AllocationTransfer';
import ResourceBooking from './pages/ResourceBooking';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import NotificationsLogs from './pages/NotificationsLogs';
import './styles/index.css';

// Guard for authenticated pages
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading Session...</div>;
  }
  
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const AppContent: React.FC = () => {
  const { token } = useAuth();

  return (
    <BrowserRouter>
      {token ? (
        <SocketProvider>
          <div className="app-container">
            <Sidebar />
            <Routes>
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/setup" element={<PrivateRoute><OrgSetup /></PrivateRoute>} />
              <Route path="/assets" element={<PrivateRoute><AssetDirectory /></PrivateRoute>} />
              <Route path="/allocations" element={<PrivateRoute><AllocationTransfer /></PrivateRoute>} />
              <Route path="/bookings" element={<PrivateRoute><ResourceBooking /></PrivateRoute>} />
              <Route path="/maintenance" element={<PrivateRoute><Maintenance /></PrivateRoute>} />
              <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
              <Route path="/notifications" element={<PrivateRoute><NotificationsLogs /></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </SocketProvider>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
