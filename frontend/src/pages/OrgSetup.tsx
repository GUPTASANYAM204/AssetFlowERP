import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { Plus, Check, ShieldAlert } from 'lucide-react';

export const OrgSetup: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast } = useSocket();
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'directory'>('departments');

  // Load Data
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Modal States
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);

  // Form Fields
  const [deptForm, setDeptForm] = useState({ name: '', headId: '', parentDepartmentId: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });
  const [catForm, setCatForm] = useState({ name: '', customFields: {} as Record<string, string> });
  const [catFieldInput, setCatFieldInput] = useState({ key: '', type: 'string' });
  
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [promoteRole, setPromoteRole] = useState('EMPLOYEE');

  // Edit contexts
  const [editDeptId, setEditDeptId] = useState<string | null>(null);

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      // 1. Fetch departments
      const resDepts = await fetch('http://localhost:5001/api/org/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resDepts.ok) setDepartments(await resDepts.json());

      // 2. Fetch categories
      const resCats = await fetch('http://localhost:5001/api/org/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resCats.ok) setCategories(await resCats.json());

      // 3. Fetch employees
      const resEmps = await fetch('http://localhost:5001/api/org/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmps.ok) setEmployees(await resEmps.json());

    } catch (err) {
      console.error('Error loading setup data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editDeptId 
        ? `http://localhost:5001/api/org/departments/${editDeptId}` 
        : 'http://localhost:5001/api/org/departments';
      
      const method = editDeptId ? 'PUT' : 'POST';
      
      // Normalize empty strings to null for optional UUID fields
      const payload: any = {
        name: deptForm.name,
        status: deptForm.status,
        headId: deptForm.headId && deptForm.headId.trim() !== '' ? deptForm.headId : null,
        parentDepartmentId: deptForm.parentDepartmentId && deptForm.parentDepartmentId.trim() !== '' ? deptForm.parentDepartmentId : null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Operation failed');
      }

      showToast(`Department successfully ${editDeptId ? 'updated' : 'created'}`);
      setShowDeptModal(false);
      setDeptForm({ name: '', headId: '', parentDepartmentId: '', status: 'ACTIVE' });
      setEditDeptId(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEditDept = (dept: any) => {
    setEditDeptId(dept.id);
    setDeptForm({
      name: dept.name,
      headId: dept.head_id || '',
      parentDepartmentId: dept.parent_department_id || '',
      status: dept.status,
    });
    setShowDeptModal(true);
  };

  const handleAddCatField = () => {
    if (!catFieldInput.key) return;
    setCatForm({
      ...catForm,
      customFields: {
        ...catForm.customFields,
        [catFieldInput.key]: catFieldInput.type,
      },
    });
    setCatFieldInput({ key: '', type: 'string' });
  };

  const handleRemoveCatField = (key: string) => {
    const updated = { ...catForm.customFields };
    delete updated[key];
    setCatForm({ ...catForm, customFields: updated });
  };

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5001/api/org/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(catForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Operation failed');
      }

      showToast('Asset category registered');
      setShowCatModal(false);
      setCatForm({ name: '', customFields: {} });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    try {
      const res = await fetch('http://localhost:5001/api/auth/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedEmployee.id,
          roleName: promoteRole,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Promotion failed');
      }

      showToast(`User role successfully changed to ${promoteRole}`);
      setShowPromoteModal(false);
      setSelectedEmployee(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="main-content">
        <Header title="Access Denied" />
        <div className="page-body" style={{ textAlign: 'center', marginTop: 100, color: 'var(--danger)' }}>
          <ShieldAlert size={64} style={{ marginBottom: 20 }} />
          <h2>Forbidden: Administrator permissions are required to access Organization Setup.</h2>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading setups...
      </div>
    );
  }

  return (
    <div className="main-content">
      <Header title="Organization Setup" />
      <div className="page-body">
        
        {/* Navigation Tabs */}
        <div className="tabs-header">
          <button className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
            Department Management
          </button>
          <button className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
            Asset Category Management
          </button>
          <button className={`tab-btn ${activeTab === 'directory' ? 'active' : ''}`} onClick={() => setActiveTab('directory')}>
            Employee Directory
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'departments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button className="btn btn-primary" onClick={() => { setEditDeptId(null); setDeptForm({ name: '', headId: '', parentDepartmentId: '', status: 'ACTIVE' }); setShowDeptModal(true); }}>
                <Plus size={16} /> Create Department
              </button>
            </div>
            
            <div className="table-card">
              <div className="table-wrapper">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th>Head of Department</th>
                      <th>Parent Department</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.id}>
                        <td style={{ fontWeight: 600 }}>{dept.name}</td>
                        <td>{dept.head_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                        <td>{dept.parent_department_name || <span style={{ color: 'var(--text-muted)' }}>--</span>}</td>
                        <td>
                          <span className={`badge ${dept.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                            {dept.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleOpenEditDept(dept)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button className="btn btn-primary" onClick={() => setShowCatModal(true)}>
                <Plus size={16} /> Create Category
              </button>
            </div>

            <div className="table-card">
              <div className="table-wrapper">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Category Name</th>
                      <th>Schema attributes</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id}>
                        <td style={{ fontWeight: 600 }}>{cat.name}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {Object.entries(cat.custom_fields).map(([key, type]) => (
                              <span key={key} style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4, fontSize: 12, border: '1px solid var(--border-color)' }}>
                                {key}: <span style={{ color: 'var(--info)' }}>{type as string}</span>
                              </span>
                            ))}
                            {Object.keys(cat.custom_fields).length === 0 && (
                              <span style={{ color: 'var(--text-muted)' }}>No extra attributes</span>
                            )}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{new Date(cat.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'directory' && (
          <div>
            <div className="table-card">
              <div className="table-wrapper">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Role Profile</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id}>
                        <td style={{ fontWeight: 600 }}>{emp.name}</td>
                        <td>{emp.email}</td>
                        <td>{emp.department_name || <span style={{ color: 'var(--text-muted)' }}>--</span>}</td>
                        <td>
                          <span className={`badge ${emp.role_name === 'ADMIN' ? 'badge-danger' : emp.role_name === 'ASSET_MANAGER' ? 'badge-warning' : emp.role_name === 'DEPARTMENT_HEAD' ? 'badge-info' : 'badge-success'}`}>
                            {emp.role_name.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${emp.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                            {emp.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: 12 }} 
                            onClick={() => { setSelectedEmployee(emp); setPromoteRole(emp.role_name); setShowPromoteModal(true); }}
                          >
                            Promote / Change Role
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* DEPARTMENT MODAL */}
      {showDeptModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>{editDeptId ? 'Update Department Details' : 'Create Department'}</span>
              <button onClick={() => setShowDeptModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleDeptSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Department Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Facilities Management"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Head of Department (HoD)</label>
                  <select
                    className="form-control"
                    value={deptForm.headId}
                    onChange={(e) => setDeptForm({ ...deptForm, headId: e.target.value })}
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Parent Department (for Hierarchical structure)</label>
                  <select
                    className="form-control"
                    value={deptForm.parentDepartmentId}
                    onChange={(e) => setDeptForm({ ...deptForm, parentDepartmentId: e.target.value })}
                  >
                    <option value="">None (Top Level)</option>
                    {departments.filter(d => d.id !== editDeptId).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Operational Status</label>
                  <select
                    className="form-control"
                    value={deptForm.status}
                    onChange={(e) => setDeptForm({ ...deptForm, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                    required
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editDeptId ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCatModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Register Asset Category</span>
              <button onClick={() => setShowCatModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleCatSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Vehicles"
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="form-group" style={{ border: '1px solid var(--border-color)', padding: 16, borderRadius: 8 }}>
                  <label className="form-label">Define Schema Attributes</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="field_key (e.g. mileage)"
                      value={catFieldInput.key}
                      onChange={(e) => setCatFieldInput({ ...catFieldInput, key: e.target.value })}
                    />
                    <select
                      className="form-control"
                      value={catFieldInput.type}
                      onChange={(e) => setCatFieldInput({ ...catFieldInput, type: e.target.value })}
                    >
                      <option value="string">Text / String</option>
                      <option value="number">Numeric / Number</option>
                      <option value="boolean">Yes/No Boolean</option>
                    </select>
                    <button type="button" className="btn btn-secondary" style={{ height: 42 }} onClick={handleAddCatField}>
                      Add
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(catForm.customFields).map(([key, type]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: 4, fontSize: 13 }}>
                        <span>
                          {key}: <span style={{ color: 'var(--info)' }}>{type}</span>
                        </span>
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleRemoveCatField(key)}>
                          Remove
                        </button>
                      </div>
                    ))}
                    {Object.keys(catForm.customFields).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                        No dynamic schema attributes added yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE PROMOTION MODAL */}
      {showPromoteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Promote Employee Role</span>
              <button onClick={() => setShowPromoteModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handlePromoteSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                  Changing the security role profile of <strong>{selectedEmployee?.name}</strong>.
                </p>
                <div className="form-group">
                  <label className="form-label">Promote to Role</label>
                  <select
                    className="form-control"
                    value={promoteRole}
                    onChange={(e) => setPromoteRole(e.target.value)}
                    required
                  >
                    <option value="EMPLOYEE">Employee (Default)</option>
                    <option value="DEPARTMENT_HEAD">Department Head</option>
                    <option value="ASSET_MANAGER">Asset Manager</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPromoteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Promotion</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default OrgSetup;
