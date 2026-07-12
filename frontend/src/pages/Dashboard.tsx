import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import Pagination, { type PaginationMeta } from '../components/Pagination';
import { Plus, Calendar, Wrench, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DASHBOARD_ACTIVITY_PAGE_SIZE = 5;

const emptyPagination = (pageSize: number): PaginationMeta => ({
  page: 1,
  pageSize,
  total: 0,
  totalPages: 0,
});

export const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const { kpiTrigger, showToast } = useSocket();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPagination, setActivityPagination] = useState<PaginationMeta>(
    emptyPagination(DASHBOARD_ACTIVITY_PAGE_SIZE)
  );
  const [activityLoading, setActivityLoading] = useState(false);
  const navigate = useNavigate();

  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user?.role ?? '');

  // Quick Action Modal states
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  // Form Fields
  const [assetForm, setAssetForm] = useState({ name: '', categoryId: '', serialNumber: '', acquisitionCost: 0, condition: 'New', location: '', isSharedBookable: false });
  const [bookingForm, setBookingForm] = useState({ assetId: '', startTime: '', endTime: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ assetId: '', description: '', priority: 'MEDIUM' });

  // Dropdown options
  const [categories, setCategories] = useState<any[]>([]);
  const [bookableAssets, setBookableAssets] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5001/api/reports/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Error fetching dashboard analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async (page: number) => {
    if (!token || !isManager) return;
    try {
      setActivityLoading(true);
      const res = await fetch(
        `http://localhost:5001/api/reports/logs?page=${page}&limit=${DASHBOARD_ACTIVITY_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const result = await res.json();
        setActivityLogs(result.items ?? []);
        setActivityPagination(result.pagination ?? emptyPagination(DASHBOARD_ACTIVITY_PAGE_SIZE));
      }
    } catch (err) {
      console.error('Error fetching activity logs', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchFormOptions = async () => {
    if (!token) return;
    try {
      // 1. Categories
      const resCats = await fetch('http://localhost:5001/api/org/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resCats.ok) setCategories(await resCats.json());

      // 2. All Assets & Bookable Assets
      const resAssets = await fetch('http://localhost:5001/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAssets.ok) {
        const assets = await resAssets.json();
        setAllAssets(assets);
        setBookableAssets(assets.filter((a: any) => a.is_shared_bookable && a.status === 'AVAILABLE'));
      }
    } catch (err) {
      console.error('Error fetching form details', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token, kpiTrigger]);

  useEffect(() => {
    if (!loading && isManager) {
      fetchActivityLogs(activityPage);
    }
  }, [loading, isManager, activityPage, token, kpiTrigger]);

  useEffect(() => {
    if (token) fetchFormOptions();
  }, [token, showAssetModal, showBookingModal, showMaintenanceModal]);

  const handleRegisterAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5001/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(assetForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to register asset');
      }

      showToast('Asset successfully registered');
      setShowAssetModal(false);
      setAssetForm({ name: '', categoryId: '', serialNumber: '', acquisitionCost: 0, condition: 'New', location: '', isSharedBookable: false });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBookResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5001/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bookingForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to book slot');
      }

      showToast('Booking slot confirmed successfully');
      setShowBookingModal(false);
      setBookingForm({ assetId: '', startTime: '', endTime: '' });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRaiseMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5001/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(maintenanceForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to raise request');
      }

      showToast('Maintenance request successfully raised');
      setShowMaintenanceModal(false);
      setMaintenanceForm({ assetId: '', description: '', priority: 'MEDIUM' });
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading ERP Snapshot...
      </div>
    );
  }

  const { kpi } = data;
  const recentActivity = isManager ? activityLogs : (data.recentActivity ?? []);

  return (
    <div className="main-content">
      <Header title="Dashboard Overview" />
      <div className="page-body">
        
        {/* Overdue Return Notification Highlight */}
        {kpi.overdue_returns > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 24px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 32
          }}>
            <AlertCircle size={20} />
            <span>{kpi.overdue_returns} asset allocations are currently past their expected return date. Action required!</span>
            <button 
              onClick={() => navigate('/allocations')} 
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
            >
              Review Overdues
            </button>
          </div>
        )}

        {/* KPI Grid */}
        <div className="kpi-grid">
          <div className="kpi-card success">
            <span className="kpi-label">Assets Available</span>
            <span className="kpi-value">{kpi.assets_available}</span>
          </div>
          <div className="kpi-card info">
            <span className="kpi-label">Assets Allocated</span>
            <span className="kpi-value">{kpi.assets_allocated}</span>
          </div>
          <div className="kpi-card warning">
            <span className="kpi-label">Maintenance Today</span>
            <span className="kpi-value">{kpi.assets_under_maintenance}</span>
          </div>
          <div className="kpi-card info">
            <span className="kpi-label">Active Bookings</span>
            <span className="kpi-value">{kpi.active_bookings}</span>
          </div>
          <div className="kpi-card warning">
            <span className="kpi-label">Pending Transfers</span>
            <span className="kpi-value">{kpi.pending_transfers}</span>
          </div>
          <div className="kpi-card danger">
            <span className="kpi-label">Overdue Returns</span>
            <span className="kpi-value">{kpi.overdue_returns}</span>
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div className="action-strip">
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-secondary)' }}>Quick Operations Panel</span>
          <div className="action-strip-buttons">
            {['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (
              <button className="btn btn-primary" onClick={() => setShowAssetModal(true)}>
                <Plus size={16} /> Register Asset
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowBookingModal(true)}>
              <Calendar size={16} /> Book Resource
            </button>
            <button className="btn btn-secondary" onClick={() => setShowMaintenanceModal(true)}>
              <Wrench size={16} /> Raise Request
            </button>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="table-card">
          <div className="table-header">
            <span style={{ fontWeight: 700, fontSize: 16 }}>Recent Asset Activity</span>
            <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => navigate('/notifications')}>
              View Full Logs
            </button>
          </div>
          <div className="table-wrapper" style={{ opacity: activityLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Table</th>
                  <th>Entity ID</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((log: any) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{log.user_name || 'System'}</td>
                    <td>
                      <span className="badge badge-info">{log.action.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{log.target_table || 'N/A'}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{log.target_id || 'N/A'}</td>
                  </tr>
                ))}
                {!activityLoading && recentActivity.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                      No recent activities recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isManager && (
            <div style={{ padding: '0 24px 24px' }}>
              <Pagination
                pagination={activityPagination}
                onPageChange={setActivityPage}
                loading={activityLoading}
              />
            </div>
          )}
        </div>

      </div>

      {/* QUICK ACTION MODALS */}
      {/* 1. Register Asset Modal */}
      {showAssetModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Register New Asset Tag</span>
              <button onClick={() => setShowAssetModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleRegisterAssetSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Asset Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dell Latitude 5420"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Asset Category</label>
                  <select
                    className="form-control"
                    value={assetForm.categoryId}
                    onChange={(e) => setAssetForm({ ...assetForm, categoryId: e.target.value })}
                    required
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SN-DELL-1234"
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Acquisition Cost (USD)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={assetForm.acquisitionCost}
                      onChange={(e) => setAssetForm({ ...assetForm, acquisitionCost: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Condition</label>
                    <select
                      className="form-control"
                      value={assetForm.condition}
                      onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                      required
                    >
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Location / Room</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Bengaluru Office / Floor 4"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <input
                    type="checkbox"
                    id="isSharedBookable"
                    checked={assetForm.isSharedBookable}
                    onChange={(e) => setAssetForm({ ...assetForm, isSharedBookable: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <label htmlFor="isSharedBookable" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    This is a shared resource that can be booked (rooms, projectors, vehicles, etc.)
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssetModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Book Resource Modal */}
      {showBookingModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Book Shared Resource Slot</span>
              <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleBookResourceSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Available Resource</label>
                  <select
                    className="form-control"
                    value={bookingForm.assetId}
                    onChange={(e) => setBookingForm({ ...bookingForm, assetId: e.target.value })}
                    required
                  >
                    <option value="">Select Resource...</option>
                    {bookableAssets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag}) - {a.location}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={bookingForm.startTime}
                    onChange={(e) => setBookingForm({ ...bookingForm, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={bookingForm.endTime}
                    onChange={(e) => setBookingForm({ ...bookingForm, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBookingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Raise Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Raise Asset Repair / Maintenance Request</span>
              <button onClick={() => setShowMaintenanceModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleRaiseMaintenanceSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Target Asset</label>
                  <select
                    className="form-control"
                    value={maintenanceForm.assetId}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, assetId: e.target.value })}
                    required
                  >
                    <option value="">Select Asset...</option>
                    {allAssets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag}) - {a.status}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select
                    className="form-control"
                    value={maintenanceForm.priority}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
                    required
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Issue Description</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Please describe the malfunction details..."
                    value={maintenanceForm.description}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMaintenanceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default Dashboard;
