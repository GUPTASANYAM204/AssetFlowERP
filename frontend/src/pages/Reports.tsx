import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { BarChart3, Download, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react';

export const Reports: React.FC = () => {
  const { token } = useAuth();
  const { kpiTrigger } = useSocket();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5001/api/reports/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Error loading reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token, kpiTrigger]);

  const handleExportCSV = (reportType: string, listData: any[]) => {
    if (!listData || listData.length === 0) return;
    
    // Create headers
    const headers = Object.keys(listData[0]).join(',');
    
    // Create rows
    const rows = listData.map((row) => {
      return Object.values(row)
        .map((value) => {
          // Escaping commas
          const str = String(value).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `assetflow_${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Aggregating Direct SQL Analytics...
      </div>
    );
  }

  const { deptUtilization, maintenanceFreq, idleAssets, retirementCandidates, upcomingMaintenance } = data;

  return (
    <div className="main-content">
      <Header title="Reports & Actionable Analytics" />
      <div className="page-body">
        
        {/* Department Utilization Bar Chart */}
        <div className="chart-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Department Asset Utilization Rate</span>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Percentage of allocated assets by department</p>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleExportCSV('dept_utilization', deptUtilization)}>
              <Download size={12} /> Export CSV
            </button>
          </div>

          <div className="chart-bar-list">
            {deptUtilization.map((dept: any) => (
              <div key={dept.department_name} className="chart-bar-item">
                <span className="chart-bar-label">{dept.department_name}</span>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ width: `${Math.min(dept.utilization_rate, 100)}%` }} />
                </div>
                <span className="chart-bar-value">{dept.utilization_rate}%</span>
              </div>
            ))}
            {deptUtilization.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 12 }}>No department assets to measure.</div>
            )}
          </div>
        </div>

        {/* 2-Column Grid: Idle Assets Left, Maintenance Frequencies Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
          
          {/* Idle Assets Card */}
          <div className="table-card" style={{ marginBottom: 0 }}>
            <div className="table-header">
              <div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Idle Bookable Assets (45+ Days Unused)</span>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Available assets with no allocations or bookings in 45 days</p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => handleExportCSV('idle_assets', idleAssets)}>
                <Download size={10} /> CSV
              </button>
            </div>
            <div className="table-wrapper" style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Asset Name</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {idleAssets.map((asset: any) => (
                    <tr key={asset.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{asset.asset_tag}</td>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{asset.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{asset.location}</td>
                    </tr>
                  ))}
                  {idleAssets.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                        No idle assets found. Excellent utilization!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Frequency Card */}
          <div className="table-card" style={{ marginBottom: 0 }}>
            <div className="table-header">
              <div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Category Maintenance Frequency</span>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Categories sorted by total maintenance tickets filed</p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => handleExportCSV('maintenance_frequency', maintenanceFreq)}>
                <Download size={10} /> CSV
              </button>
            </div>
            <div className="table-wrapper" style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total Repair Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceFreq.map((cat: any) => (
                    <tr key={cat.category_name}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{cat.category_name}</td>
                      <td>
                        <span className="badge badge-info">{cat.maintenance_count} Tickets</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Retirement Candidates Card */}
        <div className="table-card">
          <div className="table-header">
            <div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Lifecycle Retirement Candidates</span>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Assets flagged as "Poor" condition OR older than 5 years</p>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => handleExportCSV('retirement_candidates', retirementCandidates)}>
              <Download size={12} /> Export CSV
            </button>
          </div>
          <div className="table-wrapper">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Asset Tag</th>
                  <th>Name</th>
                  <th>Age (Years)</th>
                  <th>Condition</th>
                  <th>Acquisition Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {retirementCandidates.map((asset: any) => (
                  <tr key={asset.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{asset.asset_tag}</td>
                    <td style={{ fontWeight: 600 }}>{asset.name}</td>
                    <td>{asset.age_years} Years Old</td>
                    <td>
                      <span className={`badge ${asset.condition === 'Poor' ? 'badge-danger' : 'badge-warning'}`}>
                        {asset.condition}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(asset.acquisition_date).toLocaleDateString()}</td>
                    <td>
                      <span style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{asset.status}</span>
                    </td>
                  </tr>
                ))}
                {retirementCandidates.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
                      No assets fit the retirement profile.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
export default Reports;
