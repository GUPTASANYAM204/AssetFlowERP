import { query } from '../config/db';

export interface ActivityLogInput {
  userId?: string | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  previousValues?: any;
  newValues?: any;
}

/** Tables whose activity appears in recent-operations / audit log views */
export const ASSET_ACTIVITY_TABLES = [
  'assets',
  'asset_allocations',
  'transfer_requests',
  'resource_bookings',
] as const;

export interface PaginatedLogsResult {
  items: any[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class LogRepository {
  static async create(log: ActivityLogInput) {
    const sql = `
      INSERT INTO activity_logs (user_id, action, target_table, target_id, previous_values, new_values)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      log.userId || null,
      log.action,
      log.targetTable || null,
      log.targetId || null,
      log.previousValues ? JSON.stringify(log.previousValues) : null,
      log.newValues ? JSON.stringify(log.newValues) : null,
    ];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findRecentAssetActivity(limit = 10) {
    const sql = `
      SELECT al.*, u.name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.target_table = ANY($1::text[])
      ORDER BY al.timestamp DESC
      LIMIT $2
    `;
    const res = await query(sql, [ASSET_ACTIVITY_TABLES, limit]);
    return res.rows;
  }

  static async findAssetActivityPaginated(page = 1, pageSize = 20): Promise<PaginatedLogsResult> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const offset = (safePage - 1) * safePageSize;

    const countSql = `
      SELECT COUNT(*)::int as total
      FROM activity_logs al
      WHERE al.target_table = ANY($1::text[])
    `;
    const countRes = await query(countSql, [ASSET_ACTIVITY_TABLES]);
    const total = countRes.rows[0]?.total ?? 0;

    const sql = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.target_table = ANY($1::text[])
      ORDER BY al.timestamp DESC
      LIMIT $2 OFFSET $3
    `;
    const res = await query(sql, [ASSET_ACTIVITY_TABLES, safePageSize, offset]);

    return {
      items: res.rows,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / safePageSize),
      },
    };
  }
}
