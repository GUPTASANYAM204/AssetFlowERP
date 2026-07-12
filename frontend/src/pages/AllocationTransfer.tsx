import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { RefreshCw, Check, X, AlertTriangle } from 'lucide-react';

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

  // Form states
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [allocationTarget, setAllocationTarget] = useState<'user' | 'dept'>('user');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');

  // Selected Asset holdings check (Priya holds it block)
  const [conflictHolder, setConflictHolder] = useState<any | null>(null);
  const [transferReason, setTransferReason] = useState('');

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
      // 1. Fetch active allocations
      const resAlloc = await fetch('http://localhost:5001/api/allocations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAlloc.ok) setAllocations(await resAlloc.json());

      // 2. Fetch transfer requests
      const resTrans = await fetch('http://localhost:5001/api/allocations/transfers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resTrans.ok) setTransfers(await resTrans.json());

      // 3. Fetch all assets (to choose for allocation, showing ALL so we can demo the Priya holdings block!)
      const resAssets = await fetch('http://localhost:5001/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAssets.ok) setAssets(await resAssets.json());

      // 4. Fetch employees
      const resEmps = await fetch('http://localhost:5001/api/org/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmps.ok) setEmployees(await resEmps.json());

      // 5. Fetch departments
      const resDepts = await fetch('http://localhost:5001/api/org/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  // Check selected asset status to flag holdings conflict
  useEffect(() => {
    if (!selectedAssetId) {
      setConflictHolder(null);
      return;
    }
    const asset = assets.find(a => a.id === selectedAssetId);
    if (asset && asset.status === 'ALLOCATED') {
      setConflictHolder({
        name: asset.holder_name || asset.department_name || 'Another employee',
        holderId: asset.current_holder_id,
        deptId: asset.department_id
      });
    } else {
      setConflictHolder(null);
    }
  }, [selectedAssetId, assets]);

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        assetId: selectedAssetId,
        userId: allocationTarget === 'user' ? targetUserId : null,
        departmentId: allocationTarget === 'dept' ? targetDeptId : null,
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
        throw new Error(err.message || 'Allocation failed');
      }

      showToast('Asset allocated successfully');
      setSelectedAssetId('');
      setTargetUserId('');
      setTargetDeptId('');
      setExpectedReturn('');
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
        toUserId: allocationTarget === 'user' ? targetUserId : null,
        toDepartmentId: allocationTarget === 'dept' ? targetDeptId : null,
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
        throw new Error(err.message || 'Transfer request failed');
      }

      showToast('Transfer request submitted successfully. Awaiting Manager approval.');
      setSelectedAssetId('');
      setTargetUserId('');
      setTargetDeptId('');
      setTransferReason('');
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading allocation dashboard...
      </div>
    );
  }

  return (
    <div className="main-content">
      <Header title="Allocations & Transfers" />
      <div className="page-body">
        
        {/* Main Grid: Form Left, Active Allocations Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 32, alignItems: 'start' }}>
          
          {/* Form Card */}
          <div className="table-card" style={{ padding: 24 }}>
            <span style={{ fontWeight: 700, fontSize: 16, display: 'block', marginBottom: 20 }}>
              {conflictHolder ? 'Mandatory Asset Transfer' : 'Allocate Physical Asset'}
            </span>

            {/* Hold Conflict Alarm Block (Priya holds it block) */}
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

            <form onSubmit={conflictHolder ? handleTransferRequestSubmit : handleAllocateSubmit}>
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

              <div className="form-group">
                <label className="form-label">Allocate To Target</label>
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
                    {employees.map(emp => (
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

              {!conflictHolder ? (
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
                  <label className="form-label">Reason for Transfer</label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="Provide justification why this asset needs to be transferred..." 
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    required
                  />
                </div>
              )}

              <button 
                type="submit" 
                className={`btn btn-block ${conflictHolder ? 'btn-danger' : 'btn-primary'}`}
                disabled={!['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && !conflictHolder}
              >
                {conflictHolder ? 'Submit Transfer Request' : 'Confirm Allocation'}
              </button>
              {!['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && !conflictHolder && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                  Only Administrators & Asset Managers can allocate assets.
                </p>
              )}
            </form>
          </div>

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
        </div>

        {/* Transfer Requests Board (Approvals strip) */}
        <div className="table-card" style={{ marginTop: 32 }}>
          <div className="table-header">
            <span style={{ fontWeight: 700, fontSize: 16 }}>Pending & Historic Transfers Log</span>
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
                  <th>Approval Notes</th>
                  {['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user!.role) && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transfers.map((tr) => (
                  <tr key={tr.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tr.asset_tag}</td>
                    <td style={{ fontWeight: 600 }}>{tr.asset_name}</td>
                    <td>{tr.from_user_name || tr.from_department_name}</td>
                    <td><strong>{tr.to_user_name || tr.to_department_name}</strong></td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tr.requested_by_name}</td>
                    <td>
                      <span className={`badge ${
                        tr.status === 'APPROVED' ? 'badge-success' :
                        tr.status === 'REJECTED' ? 'badge-danger' :
                        'badge-warning'
                      }`}>{tr.status}</span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tr.approval_notes || '--'}</td>
                    {['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(user!.role) && (
                      <td style={{ textAlign: 'right' }}>
                        {tr.status === 'PENDING' ? (
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
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No transfer requests logged.
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
