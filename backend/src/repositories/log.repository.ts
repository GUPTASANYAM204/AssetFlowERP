import { query } from '../config/db';

export interface ActivityLogInput {
  userId?: string | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  previousValues?: any;
  newValues?: any;
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

  static async findAll() {
    const sql = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT 100
    `;
    const res = await query(sql);
    return res.rows;
  }
}
