import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import Pagination, { type PaginationMeta } from '../components/Pagination';
import { Bell, FileText, Check } from 'lucide-react';

const LOGS_PAGE_SIZE = 10;

const emptyPagination = (pageSize: number): PaginationMeta => ({
  page: 1,
  pageSize,
  total: 0,
  totalPages: 0,
});

export const NotificationsLogs: React.FC = () => {
  const { token, user } = useAuth();
  const { notifTrigger, showToast } = useSocket();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPagination, setLogsPagination] = useState<PaginationMeta>(emptyPagination(LOGS_PAGE_SIZE));
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');

  const loadNotifications = async () => {
    if (!token) return;
    const resNotifs = await fetch('http://localhost:5001/api/reports/notifications', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resNotifs.ok) setNotifications(await resNotifs.json());
  };

  const loadActivityLogs = async (page: number) => {
    if (!token || !isManager) return;
    try {
      setLogsLoading(true);
      const resLogs = await fetch(
        `http://localhost:5001/api/reports/logs?page=${page}&limit=${LOGS_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resLogs.ok) {
        const data = await resLogs.json();
        setActivityLogs(data.items ?? []);
        setLogsPagination(data.pagination ?? emptyPagination(LOGS_PAGE_SIZE));
      }
    } catch (err) {
      console.error('Error loading activity logs', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (!token) return;
      setLoading(true);
      try {
        await loadNotifications();
      } catch (err) {
        console.error('Error loading notifications', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token, notifTrigger]);

  useEffect(() => {
    if (!token || !isManager || loading) return;
    loadActivityLogs(logsPage);
  }, [token, isManager, loading, logsPage, notifTrigger]);

  const handleMarkAsRead = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/reports/notifications/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Notifications marked as read');
        await loadNotifications();
      }
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading logs and notifications...
      </div>
    );
  }

  return (
    <div className="main-content">
      <Header title="Notifications & Activity Logs" />
      <div className="page-body">
        
        <div style={{ display: 'grid', gridTemplateColumns: isManager ? '1fr 1fr' : '1fr', gap: 32 }}>
          
          {/* Notifications Card */}
          <div className="table-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={20} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>Your Personal Alerts</span>
              </div>
              {notifications.some(n => !n.is_read) && (
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={handleMarkAsRead}>
                  <Check size={12} /> Mark Read
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notifications.map((n) => (
                <div key={n.id} style={{
                  padding: 16,
                  backgroundColor: n.is_read ? 'var(--bg-accent)' : 'var(--bg-tertiary)',
                  border: n.is_read ? '1px solid var(--border-color)' : '1px solid var(--accent-primary)',
                  borderRadius: 8,
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: 14 }}>{n.title}</strong>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{n.message}</p>
                  <span className={`badge ${
                    n.type === 'OVERDUE_RETURN' ? 'badge-danger' :
                    n.type === 'BOOKING_CONFIRMED' ? 'badge-success' :
                    'badge-info'
                  }`} style={{ fontSize: 8, marginTop: 10 }}>{n.type.replace(/_/g, ' ')}</span>
                </div>
              ))}
              {notifications.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No alerts logged.</div>
              )}
            </div>
          </div>

          {/* Activity Logs (Manager only) */}
          {isManager && (
            <div className="table-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <FileText size={20} style={{ color: 'var(--warning)' }} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>Asset Activity Log Trail</span>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxHeight: 600,
                overflowY: 'auto',
                paddingRight: 8,
                opacity: logsLoading ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}>
                {activityLogs.map((log) => (
                  <div key={log.id} style={{
                    padding: 12,
                    backgroundColor: 'var(--bg-accent)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    fontSize: 13
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4 }}>
                      <span>Operator: <strong>{log.user_name || 'System'}</strong> ({log.user_email || 'cron'})</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div>
                      Action: <span style={{ color: 'var(--info)', fontWeight: 600 }}>{log.action.replace(/_/g, ' ')}</span>
                    </div>
                    {log.target_table && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Resource Target: {log.target_table} ({log.target_id})
                      </div>
                    )}
                    {log.new_values && (
                      <pre style={{
                        marginTop: 6,
                        padding: 6,
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)',
                        overflowX: 'auto'
                      }}>
                        {JSON.stringify(log.new_values, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                {!logsLoading && activityLogs.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No asset activity logs found.</div>
                )}
              </div>

              <Pagination
                pagination={logsPagination}
                onPageChange={setLogsPage}
                loading={logsLoading}
              />
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
export default NotificationsLogs;
