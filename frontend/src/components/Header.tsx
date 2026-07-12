import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Bell, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { token } = useAuth();
  const { connected, notifTrigger } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!token) return;
      try {
        const res = await fetch('http://localhost:5001/api/reports/notifications/unread-count', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error('Error fetching notifications count', err);
      }
    };
    
    fetchUnreadCount();
  }, [token, notifTrigger]);

  return (
    <header className="header-navbar">
      <h1 className="page-title">{title}</h1>

      <div className="header-actions">
        {/* Real-time sync status indicator */}
        <div className={`ws-status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? <Wifi size={14} style={{ color: 'var(--success)' }} /> : <WifiOff size={14} style={{ color: 'var(--danger)' }} />}
          <span className="indicator" />
          <span>{connected ? 'Sync Connected' : 'Sync Disconnected'}</span>
        </div>

        {/* Notifications bell */}
        <div className="notification-bell" onClick={() => navigate('/notifications')}>
          <Bell size={20} />
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </div>
      </div>
    </header>
  );
};
export default Header;
