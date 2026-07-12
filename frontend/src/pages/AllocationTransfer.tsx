import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { RefreshCw, Check, X, AlertTriangle, Clock, ListFilter } from 'lucide-react';

export const AllocationTransfer: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast, kpiTrigger } = useSocket();

  // Load Data
  const [allocations, setAllocations] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter tab for requests log
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Form states
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [allocationTarget, setAllocationTarget] = useState<'user' | 'dept'>('user');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');

  // Selected Asset holdings check & choice
  const [conflictHolder, setConflictHolder] = useState<any | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [actionType, setActionType] = useState<'allocate' | 'request'>('allocate');
  const [assetHistory, setAssetHistory] = useState<any>({ allocations: [], maintenance: [], transfers: [] });

  // Return Modal states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAssetId, setReturnAssetId] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnCondition, setReturnCondition] = useState('Good');

  // Transfer Approve/Reject Modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState('');
  const [transferAction, setTransferAction] = useState<boolean>(true);
  const [approvalNotes, setApprovalNotes] = useState('');

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [resAlloc, resTrans, resAssets, resEmps, resDepts] = await Promise.all([
        fetch('http://localhost:5001/api/allocations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5001/api/allocations/transfers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5001/api/assets', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5001/api/org/employees', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5001/api/org/departments', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (resAlloc.ok) setAllocations(await resAlloc.json());
      if (resTrans.ok) setTransfers(await resTrans.json());
      if (resAssets.ok) setAssets(await resAssets.json());
      if (resEmps.ok) setEmployees(await resEmps.json());
      if (resDepts.ok) setDepartments(await resDepts.json());
    } catch (err) {
      console.error('Error loading allocation data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, kpiTrigger]);

  // Check selected asset status to flag holdings conflict & load history
  useEffect(() => {
    if (!selectedAssetId) {
      setConflictHolder(null);
      setAssetHistory({ allocations: [], maintenance: [], transfers: [] });
      return;
    }
    const asset = assets.find(a => a.id === selectedAssetId);
    if (asset && asset.status === 'ALLOCATED') {
      setConflictHolder({
        name: asset.holder_name || asset.department_name || 'Another employee',
        holderId: asset.current_holder_id,
        deptId: asset.department_id
      });
      // Force request mode if the asset is currently allocated
      setActionType('request');
    } else {
      setConflictHolder(null);
      // Default to request if standard user, otherwise default to allocate
      if (user && !['ADMIN', 'ASSET_MANAGER'].includes(user.role)) {
        setActionType('request');
      } else {
        setActionType('allocate');
      }
    }

    if (token) {
      fetch(`http://localhost:5001/api/assets/${selectedAssetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.history) {
            setAssetHistory(data.history);
          } else {
            setAssetHistory({ allocations: [], maintenance: [], transfers: [] });
          }
        })
        .catch(() => setAssetHistory({ allocations: [], maintenance: [], transfers: [] }));
    }
  }, [selectedAssetId, assets, token, user]);

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        assetId: selectedAssetId,
        userId: allocationTarget === 'user' ? targetUserId || null : null,
        departmentId: allocationTarget === 'dept' ? targetDeptId || null : null,
        expectedReturnAt: expectedReturn || null,
      };

      const res = await fetch('http://localhost:5001/api/allocations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.errors && Array.isArray(err.errors)) {
          const detailMsgs = err.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
          throw new Error(`Validation failed:\n${detailMsgs}`);
        }
        throw new Error(err.message || 'Allocation failed');
      }

      showToast('Asset allocated successfully');
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransferRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        assetId: selectedAssetId,
        toUserId: allocationTarget === 'user' ? targetUserId || null : null,
        toDepartmentId: allocationTarget === 'dept' ? targetDeptId || null : null,
        reason: transferReason,
      };

      const res = await fetch('http://localhost:5001/api/allocations/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.errors && Array.isArray(err.errors)) {
          const detailMsgs = err.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
          throw new Error(`Validation failed:\n${detailMsgs}`);
        }
        throw new Error(err.message || 'Transfer request failed');
      }

      showToast('Transfer/Allocation request submitted successfully. Awaiting Manager approval.');
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5001/api/allocations/return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assetId: returnAssetId,
          checkInNotes: returnNotes,
          condition: returnCondition,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.errors && Array.isArray(err.errors)) {
          const detailMsgs = err.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
          throw new Error(`Validation failed:\n${detailMsgs}`);
        }
        throw new Error(err.message || 'Check-in failed');
      }

      showToast('Asset successfully returned and checked-in');
      setShowReturnModal(false);
      setReturnNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleProcessTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:5001/api/allocations/transfers/${selectedTransferId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          approved: transferAction,
          approvalNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.errors && Array.isArray(err.errors)) {
          const detailMsgs = err.errors.map((e: any) => `${e.field}: ${e.message}`).join('\n');
          throw new Error(`Validation failed:\n${detailMsgs}`);
        }
        throw new Error(err.message || 'Operation failed');
      }

      showToast(`Transfer request successfully ${transferAction ? 'APPROVED' : 'REJECTED'}`);
      setShowApproveModal(false);
      setApprovalNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const resetForm = () => {
    setSelectedAssetId('');
    setTargetUserId('');
    setTargetDeptId('');
    setExpectedReturn('');
    setTransferReason('');
    setConflictHolder(null);
    setAssetHistory({ allocations: [], maintenance: [], transfers: [] });
  };

  const getTimelineItems = () => {
    const items: any[] = [];
    if (!assetHistory) return items;

    // 1. Allocations
    if (assetHistory.allocations) {
      assetHistory.allocations.forEach((h: any) => {
        items.push({
          id: `alloc-${h.id}`,
          date: new Date(h.allocated_at),
          type: 'ALLOCATION',
          text: `Allocated to ${h.user_name || h.department_name || 'N/A'} (by ${h.allocated_by_name || 'System'})`,
          status: h.status,
          badgeClass: h.status === 'ACTIVE' ? 'badge-info' : h.status === 'OVERDUE' ? 'badge-danger' : 'badge-success'
        });
        if (h.returned_at) {
          items.push({
            id: `return-${h.id}`,
            date: new Date(h.returned_at),
            type: 'RETURN',
            text: `Returned by ${h.user_name || h.department_name || 'N/A'} — condition: ${h.condition || 'Good'} (Notes: ${h.check_in_notes || 'None'})`,
            status: 'RETURNED',
            badgeClass: 'badge-success'
          });
        }
      });
    }

    // 2. Transfers/Requests
    if (assetHistory.transfers) {
      assetHistory.transfers.forEach((tr: any) => {
        let fromText = tr.from_user_name || tr.from_department_name || 'AVAILABLE';
        let toText = tr.to_user_name || tr.to_department_name || 'N/A';
        items.push({
          id: `trans-${tr.id}`,
          date: new Date(tr.created_at),
          type: 'REQUEST',
          text: `Request raised: Transfer from ${fromText} to ${toText} by ${tr.requested_by_name || 'N/A'} (Reason: "${tr.reason}")`,
          status: tr.status,
          badgeClass: tr.status === 'APPROVED' ? 'badge-success' : tr.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
        });
      });
    }

    // 3. Maintenance
    if (assetHistory.maintenance) {
      assetHistory.maintenance.forEach((m: any) => {
        items.push({
          id: `maint-${m.id}`,
          date: new Date(m.created_at),
          type: 'MAINTENANCE',
          text: `Maintenance raised by ${m.raised_by_name || 'N/A'}: "${m.description}"`,
          status: m.status,
          badgeClass: m.status === 'RESOLVED' ? 'badge-success' : 'badge-danger'
        });
      });
    }

    // Sort descending by date
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading allocation dashboard...
      </div>
    );
  }

  const timelineItems = getTimelineItems();

  // Filter transfers list for the tabbed requests card
  const filteredTransfers = transfers.filter(tr => {
    if (requestFilter === 'ALL') return true;
    if (requestFilter === 'PENDING') return tr.status === 'PENDING';
    if (requestFilter === 'APPROVED') return tr.status === 'APPROVED';
    if (requestFilter === 'REJECTED') return tr.status === 'REJECTED';
    return true;
  });

  return (
    <div className="main-content">
      <Header title="Allocations & Transfers" />
      <div className="page-body">
        
        {/* Main Grid: Form Left, Active Allocations/Timeline Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 32, alignItems: 'start' }}>
          
          {/* Form Card */}
          <div className="table-card" style={{ padding: 24 }}>
            <span style={{ fontWeight: 700, fontSize: 16, display: 'block', marginBottom: 20 }}>
              {conflictHolder 
                ? 'Mandatory Asset Transfer' 
                : actionType === 'allocate' 
                  ? 'Allocate Physical Asset' 
                  : 'Raise Allocation Request'}
            </span>

            {/* Hold Conflict Alarm Block */}
            {conflictHolder && (
              <div style={{
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px 20px',
                color: 'var(--danger)',
                fontSize: 13,
                marginBottom: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <AlertTriangle size={16} />
                  <span>Already Allocated to {conflictHolder.name}</span>
                </div>
                <span>Direct re-allocation is blocked. Complete the transfer request details below instead.</span>
              </div>
            )}

            <form onSubmit={conflictHolder || actionType === 'request' ? handleTransferRequestSubmit : handleAllocateSubmit}>
              <div className="form-group">
                <label className="form-label">Asset to Allocate</label>
                <select 
                  className="form-control" 
                  value={selectedAssetId} 
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  required
                >
                  <option value="">Select Asset...</option>
                  {assets.filter(a => !a.is_shared_bookable).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.asset_tag}) - {a.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operation Mode toggle (only if asset is AVAILABLE and user is ADMIN/ASSET_MANAGER) */}
              {selectedAssetId && !conflictHolder && ['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (
                <div className="form-group">
                  <label className="form-label">Operation Mode</label>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="actionType" 
                        checked={actionType === 'allocate'} 
                        onChange={() => setActionType('allocate')} 
                        style={{ width: 16, height: 16 }} 
                      />
                      Direct Allocate
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="actionType" 
                        checked={actionType === 'request'} 
                        onChange={() => setActionType('request')} 
                        style={{ width: 16, height: 16 }} 
                      />
                      Raise Request
                    </label>
                  </div>
                </div>
              )}

              {selectedAssetId && (
                <>
                  <div className="form-group">
                    <label className="form-label">Allocate/Request Target</label>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" checked={allocationTarget === 'user'} onChange={() => setAllocationTarget('user')} style={{ width: 16, height: 16 }} />
                        Employee
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" checked={allocationTarget === 'dept'} onChange={() => setAllocationTarget('dept')} style={{ width: 16, height: 16 }} />
                        Department
                      </label>
                    </div>

                    {allocationTarget === 'user' ? (
                      <select className="form-control" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required>
                        <option value="">Select Employee...</option>
                        {employees
                          .filter(emp => !conflictHolder || emp.id !== conflictHolder.holderId)
                          .map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.department_name || 'No Dept'})</option>
                          ))}
                      </select>
                    ) : (
                      <select className="form-control" value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)} required>
                        <option value="">Select Department...</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {!conflictHolder && actionType === 'allocate' ? (
                    <div className="form-group">
                      <label className="form-label">Expected Return Date (Optional)</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={expectedReturn} 
                        onChange={(e) => setExpectedReturn(e.target.value)} 
                      />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Reason for Request</label>
                      <textarea 
                        className="form-control" 
                        rows={4} 
                        placeholder="Provide justification why this asset needs to be requested/transferred..." 
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className={`btn btn-block ${conflictHolder || actionType === 'request' ? 'btn-success' : 'btn-primary'}`}
                    disabled={!['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (!conflictHolder && actionType === 'allocate')}
                  >
                    {conflictHolder 
                      ? 'Submit Transfer Request' 
                      : actionType === 'request' 
                        ? 'Submit Allocation Request' 
                        : 'Confirm Allocation'}
                  </button>
                  {!['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (!conflictHolder && actionType === 'allocate') && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                      Only Administrators & Asset Managers can allocate assets directly. Please switch to Request mode.
                    </p>
                  )}
                </>
              )}
            </form>
          </div>

          {/* Right Column Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Active Allocations Table */}
            <div className="table-card">
              <div className="table-header">
                <span style={{ fontWeight: 700, fontSize: 16 }}>Active Physical Allocations</span>
              </div>
              <div className="table-wrapper">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Asset</th>
                      <th>Allocated To</th>
                      <th>Date Assigned</th>
                      <th>Status</th>
                      {['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && <th style={{ textAlign: 'right' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((alloc) => (
                      <tr key={alloc.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{alloc.asset_tag}</td>
                        <td style={{ fontWeight: 600 }}>{alloc.asset_name}</td>
                        <td>
                          {alloc.user_name ? (
                            <span>👤 {alloc.user_name}</span>
                          ) : (
                            <span>🏢 {alloc.department_name}</span>
                          )}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(alloc.allocated_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${alloc.status === 'OVERDUE' ? 'badge-danger' : 'badge-success'}`}>
                            {alloc.status}
                          </span>
                        </td>
                        {['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: 12 }}
                              onClick={() => { setReturnAssetId(alloc.asset_id); setReturnCondition(alloc.condition || 'Good'); setShowReturnModal(true); }}
                            >
                              Return Asset
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {allocations.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                          No active physical allocations.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dynamic Asset History Card (Renders separately on the right to preserve layout vertical alignment) */}
            {selectedAssetId && timelineItems.length > 0 && (
              <div className="table-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--text-primary)' }}>
                  <Clock size={16} />
                  <span>Selected Asset Timeline Log</span>
                </div>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  {timelineItems.map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        fontSize: 13,
                        borderBottom: idx < timelineItems.length - 1 ? '1px solid var(--border-color)' : 'none',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                        {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                      <span style={{ flexGrow: 1 }}>{item.text}</span>
                      <span className={`badge ${item.badgeClass}`} style={{ flexShrink: 0, fontSize: 10 }}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Requests & Transfers Log Card with Filter Tabs */}
        <div className="table-card" style={{ marginTop: 32 }}>
          <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ListFilter size={18} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Allocation & Transfer Requests Log</span>
            </div>
            
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 8 }}>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => {
                const count = f === 'ALL' 
                  ? transfers.length 
                  : transfers.filter(t => t.status === f).length;
                return (
                  <button
                    key={f}
                    onClick={() => setRequestFilter(f)}
                    className={`btn ${requestFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {f} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Resource</th>
                  <th>From holding</th>
                  <th>Transfer to</th>
                  <th>Requested By</th>
                  <th>Status</th>
                  <th>Notes</th>
                  {['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user!.role) && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((tr) => {
                  const isPending = tr.status === 'PENDING';
                  return (
                    <tr key={tr.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tr.asset_tag}</td>
                      <td style={{ fontWeight: 600 }}>{tr.asset_name}</td>
                      <td>{tr.from_user_name || tr.from_department_name || <span style={{ color: 'var(--text-muted)' }}>AVAILABLE</span>}</td>
                      <td><strong>{tr.to_user_name || tr.to_department_name}</strong></td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tr.requested_by_name}</td>
                      <td>
                        <span className={`badge ${
                          tr.status === 'APPROVED' ? 'badge-success' :
                          tr.status === 'REJECTED' ? 'badge-danger' :
                          'badge-warning'
                        }`}>{tr.status}</span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {isPending ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting decision</span> : (tr.approval_notes || '--')}
                      </td>
                      {['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user!.role) && (
                        <td style={{ textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: 6, borderRadius: 4 }} 
                                onClick={() => { setSelectedTransferId(tr.id); setTransferAction(true); setShowApproveModal(true); }}
                                title="Approve & Re-allocate"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: 6, borderRadius: 4 }} 
                                onClick={() => { setSelectedTransferId(tr.id); setTransferAction(false); setShowApproveModal(true); }}
                                title="Reject Request"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Done by {tr.approved_by_name || 'System'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredTransfers.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No requests found matching the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* RETURN MODAL */}
      {showReturnModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Confirm Asset Check-In</span>
              <button onClick={() => setShowReturnModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Asset Condition Upon Return</label>
                  <select 
                    className="form-control" 
                    value={returnCondition} 
                    onChange={(e) => setReturnCondition(e.target.value)}
                    required
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Check-In Notes</label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="Enter return checklist comments (e.g. returned charger, clean unit, reset passwords)..." 
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Complete Return</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER APPROVE MODAL */}
      {showApproveModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>
                {transferAction ? 'Approve & Re-allocate Asset' : 'Reject Transfer Request'}
              </span>
              <button onClick={() => setShowApproveModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleProcessTransferSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  You are about to {transferAction ? 'approve' : 'reject'} this transfer request. Approving will automatically close the previous active allocation and open a new one.
                </p>
                <div className="form-group">
                  <label className="form-label">Approval/Rejection Comments</label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="Add notes for this decision..." 
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>Cancel</button>
                <button type="submit" className={transferAction ? 'btn-primary' : 'btn-danger'}>
                  {transferAction ? 'Confirm Approval' : 'Reject Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default AllocationTransfer;
