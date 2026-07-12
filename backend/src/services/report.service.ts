import { query } from '../config/db';
import { LogRepository } from '../repositories/log.repository';

export class ReportService {
  static async getOrganizationAnalytics() {
    // 1. Department Utilization Summary
    const deptUtilizationSql = `
      SELECT d.name as department_name,
             COUNT(a.id)::int as total_assets,
             COUNT(CASE WHEN a.status = 'ALLOCATED' THEN 1 END)::int as allocated_assets,
             ROUND(
               COALESCE(
                 (COUNT(CASE WHEN a.status = 'ALLOCATED' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0)) * 100, 
                 0
               ), 
               2
             )::float as utilization_rate
      FROM departments d
      LEFT JOIN assets a ON d.id = a.department_id
      GROUP BY d.name
      ORDER BY total_assets DESC
    `;
    const deptUtilization = await query(deptUtilizationSql);

    // 2. Asset Lifecycle Utilization (Overall counts)
    const lifecycleSql = `
      SELECT status, COUNT(*)::int as count
      FROM assets
      GROUP BY status
    `;
    const lifecycleCounts = await query(lifecycleSql);

    // 3. Maintenance frequency by Category
    const maintenanceFreqSql = `
      SELECT c.name as category_name, COUNT(mr.id)::int as maintenance_count
      FROM asset_categories c
      LEFT JOIN assets a ON c.id = a.category_id
      LEFT JOIN maintenance_requests mr ON a.id = mr.asset_id
      GROUP BY c.name
      ORDER BY maintenance_count DESC
    `;
    const maintenanceFreq = await query(maintenanceFreqSql);

    // 4. Idle assets (Available assets not booked/allocated/used in the last 45 days)
    const idleAssetsSql = `
      SELECT a.id, a.name, a.asset_tag, a.location, a.acquisition_date, c.name as category_name
      FROM assets a
      JOIN asset_categories c ON a.category_id = c.id
      WHERE a.status = 'AVAILABLE' 
        AND a.id NOT IN (
          SELECT DISTINCT asset_id FROM asset_allocations 
          WHERE allocated_at > NOW() - INTERVAL '45 days'
        )
        AND a.id NOT IN (
          SELECT DISTINCT asset_id FROM resource_bookings 
          WHERE start_time > NOW() - INTERVAL '45 days'
        )
      ORDER BY a.asset_tag ASC
    `;
    const idleAssets = await query(idleAssetsSql);

    // 5. Booking heatmap (bookings count by hour of day)
    const bookingHeatmapSql = `
      SELECT EXTRACT(HOUR FROM start_time)::int as hour,
             COUNT(*)::int as bookings_count
      FROM resource_bookings
      WHERE status != 'CANCELLED'
      GROUP BY hour
      ORDER BY hour ASC
    `;
    const bookingHeatmap = await query(bookingHeatmapSql);

    // 6. Retirement Candidates (Condition is 'Poor' OR Age is older than 5 years)
    const retirementSql = `
      SELECT id, name, asset_tag, condition, acquisition_date,
             EXTRACT(YEAR FROM AGE(NOW(), acquisition_date))::int as age_years
      FROM assets
      WHERE condition = 'Poor' OR acquisition_date <= NOW() - INTERVAL '5 years'
      ORDER BY acquisition_date ASC
    `;
    const retirementCandidates = await query(retirementSql);

    // 7. Upcoming/Pending Maintenance Requests
    const upcomingMaintenanceSql = `
      SELECT mr.*, a.name as asset_name, a.asset_tag, a.location
      FROM maintenance_requests mr
      JOIN assets a ON mr.asset_id = a.id
      WHERE mr.status IN ('PENDING', 'APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS')
      ORDER BY mr.priority DESC, mr.created_at ASC
    `;
    const upcomingMaintenance = await query(upcomingMaintenanceSql);

    // 8. Recent asset activity feed (for dashboard)
    const recentActivity = await LogRepository.findRecentAssetActivity(10);

    // 9. Dashboard KPIs Summary
    const kpiSql = `
      SELECT 
        (SELECT COUNT(*)::int FROM assets WHERE status = 'AVAILABLE') as assets_available,
        (SELECT COUNT(*)::int FROM assets WHERE status = 'ALLOCATED') as assets_allocated,
        (SELECT COUNT(*)::int FROM assets WHERE status = 'UNDER_MAINTENANCE') as assets_under_maintenance,
        (SELECT COUNT(*)::int FROM resource_bookings WHERE status = 'ONGOING') as active_bookings,
        (SELECT COUNT(*)::int FROM transfer_requests WHERE status = 'PENDING') as pending_transfers,
        (SELECT COUNT(*)::int FROM asset_allocations WHERE status = 'OVERDUE') as overdue_returns,
        (SELECT COUNT(*)::int FROM asset_allocations WHERE status = 'ACTIVE' AND expected_return_at > NOW() AND expected_return_at <= NOW() + INTERVAL '7 days') as upcoming_returns
    `;
    const kpiSummary = await query(kpiSql);

    // 9b. Overdue Returns List
    const overdueReturnsSql = `
      SELECT al.id, al.allocated_at, al.expected_return_at, 
             a.name as asset_name, a.asset_tag, 
             u.name as user_name, d.name as department_name
      FROM asset_allocations al
      JOIN assets a ON al.asset_id = a.id
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN departments d ON al.department_id = d.id
      WHERE al.status = 'OVERDUE'
      ORDER BY al.expected_return_at ASC
    `;
    const overdueReturnsList = await query(overdueReturnsSql);

    return {
      kpi: kpiSummary.rows[0],
      overdueReturnsList: overdueReturnsList.rows,
      deptUtilization: deptUtilization.rows,
      lifecycleCounts: lifecycleCounts.rows,
      maintenanceFreq: maintenanceFreq.rows,
      idleAssets: idleAssets.rows,
      bookingHeatmap: bookingHeatmap.rows,
      retirementCandidates: retirementCandidates.rows,
      upcomingMaintenance: upcomingMaintenance.rows,
      recentActivity,
      overdueReturnsList: overdueReturnsList.rows,
    };
  }
}
