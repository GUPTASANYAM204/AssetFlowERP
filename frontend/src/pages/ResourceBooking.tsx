import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { CalendarRange, Plus, X } from 'lucide-react';

export const ResourceBooking: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast, kpiTrigger } = useSocket();

  // Load Data
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookableAssets, setBookableAssets] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showBookModal, setShowBookModal] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [bookedForDeptId, setBookedForDeptId] = useState('');
  // Date and optional time fields (time always optional)
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');
  const [startTimeOptional, setStartTimeOptional] = useState(''); // HH:MM
  const [endTimeOptional, setEndTimeOptional] = useState(''); // HH:MM

  // Selected Resource timeline list
  const [selectedAssetForTimeline, setSelectedAssetForTimeline] = useState('All');

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      // 1. Fetch bookings
      const resBook = await fetch('http://localhost:5001/api/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resBook.ok) setBookings(await resBook.json());

      // 2. Fetch shared bookable assets
      const resAssets = await fetch('http://localhost:5001/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAssets.ok) {
        const list = await resAssets.json();
        setBookableAssets(list.filter((a: any) => a.is_shared_bookable));
      }

      // 3. Fetch departments
      const resDepts = await fetch('http://localhost:5001/api/org/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resDepts.ok) setDepartments(await resDepts.json());

    } catch (err) {
      console.error('Error loading booking data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, kpiTrigger]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const localDateTimeISO = (dateStr: string, timeStr?: string, endOfDay = false) => {
        // dateStr expected YYYY-MM-DD, timeStr expected HH:MM
        const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
        let hh = 0;
        let mm = 0;
        if (timeStr) {
          const parts = timeStr.split(':').map((v) => parseInt(v, 10));
          hh = parts[0] || 0;
          mm = parts[1] || 0;
        } else if (endOfDay) {
          hh = 23; mm = 59;
        }
        const dt = new Date(y, m - 1, d, hh, mm, endOfDay && !timeStr ? 59 : 0);
        return dt.toISOString();
      };

      // Build payload: require dates but time fields optional — server expects ISO strings
      const payloadStart = localDateTimeISO(startDate, startTimeOptional, false);
      const payloadEnd = localDateTimeISO(endDate, endTimeOptional, true);

      const payload = {
        assetId,
        bookedForDepartmentId: bookedForDeptId || null,
        startTime: payloadStart,
        endTime: payloadEnd,
      };

      const res = await fetch('http://localhost:5001/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Booking overlap conflict detected');
      }

      showToast('Booking slot confirmed successfully');
      setShowBookModal(false);
      setAssetId('');
      setBookedForDeptId('');
      setStartDate('');
      setEndDate('');
      setStartTimeOptional('');
      setEndTimeOptional('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const res = await fetch(`http://localhost:5001/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Cancellation failed');
      }

      showToast('Booking successfully cancelled');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredBookings = selectedAssetForTimeline === 'All'
    ? bookings
    : bookings.filter(b => b.asset_id === selectedAssetForTimeline);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading resource booking records...
      </div>
    );
  }

  return (
    <div className="main-content">
      <Header title="Shared Resource Booking" />
      <div className="page-body">
        
        {/* Strip: Filter Left, Create Right */}
        <div className="action-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Resource Schedule Scope:</span>
            <select 
              className="form-control" 
              value={selectedAssetForTimeline}
              onChange={(e) => setSelectedAssetForTimeline(e.target.value)}
              style={{ width: 280, height: 38, padding: '4px 12px' }}
            >
              <option value="All">All Shared Resources</option>
              {bookableAssets.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary" onClick={() => setShowBookModal(true)}>
            <Plus size={16} /> Book a Slot
          </button>
        </div>

        {/* Timeline Schedule Cards representation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.8fr', gap: 32 }}>
          
          {/* List of bookable items status summary */}
          <div className="table-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Available Bookable Pool</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookableAssets.map((asset) => {
                // Find if currently booked (Ongoing)
                const isOngoing = bookings.some(b => b.asset_id === asset.id && b.status === 'ONGOING');
                return (
                  <div key={asset.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)'
                  }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>{asset.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tag: {asset.asset_tag} | {asset.location}</div>
                    </div>
                    <span className={`badge ${asset.status === 'UNDER_MAINTENANCE' ? 'badge-danger' : isOngoing ? 'badge-warning' : 'badge-success'}`}>
                      {asset.status === 'UNDER_MAINTENANCE' ? 'MAINTENANCE' : isOngoing ? 'BUSY' : 'FREE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bookings Schedule Table */}
          <div className="table-card">
            <div className="table-header">
              <span style={{ fontWeight: 700, fontSize: 16 }}>Reserved Time Slots</span>
            </div>
            <div className="table-wrapper">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Tag</th>
                    <th>Booked By</th>
                    <th>Date & Time Slot</th>
                    <th>Dept Purpose</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.asset_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{b.asset_tag}</td>
                      <td>{b.booked_by_name}</td>
                      <td style={{ fontSize: 13 }}>
                        <div>{new Date(b.start_time).toLocaleDateString()}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{b.department_name || '--'}</td>
                      <td>
                        <span className={`badge ${
                          b.status === 'UPCOMING' ? 'badge-info' :
                          b.status === 'ONGOING' ? 'badge-warning' :
                          b.status === 'COMPLETED' ? 'badge-success' :
                          'badge-danger'
                        }`}>{b.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {b.status === 'UPCOMING' && (b.booked_by === user!.id || ['ADMIN', 'ASSET_MANAGER'].includes(user!.role)) && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: 11, color: 'var(--danger)' }}
                            onClick={() => handleCancelBooking(b.id)}
                          >
                            <X size={12} /> Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredBookings.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No bookings scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* BOOK SLOT MODAL */}
      {showBookModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Book Shared Resource Slot</span>
              <button onClick={() => setShowBookModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleBookSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Resource item</label>
                  <select 
                    className="form-control" 
                    value={assetId} 
                    onChange={(e) => setAssetId(e.target.value)}
                    required
                  >
                    <option value="">Select Resource...</option>
                    {bookableAssets.filter(a => a.status === 'AVAILABLE').map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag}) - {a.location}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Book on Behalf of Department (Optional)</label>
                  <select 
                    className="form-control" 
                    value={bookedForDeptId} 
                    onChange={(e) => setBookedForDeptId(e.target.value)}
                  >
                    <option value="">None (Personal booking)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Time (optional)</label>
                  <input
                    type="time"
                    className="form-control"
                    value={startTimeOptional}
                    onChange={(e) => setStartTimeOptional(e.target.value)}
                    placeholder="HH:MM"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Time (optional)</label>
                  <input
                    type="time"
                    className="form-control"
                    value={endTimeOptional}
                    onChange={(e) => setEndTimeOptional(e.target.value)}
                    placeholder="HH:MM"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBookModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Reservation</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default ResourceBooking;
