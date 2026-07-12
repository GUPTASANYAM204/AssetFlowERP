import { query } from '../config/db';

export interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceEntityType?: string;
  referenceEntityId?: string;
}

export class NotificationRepository {
  static async create(notif: NotificationInput) {
    const sql = `
      INSERT INTO notifications (user_id, title, message, type, reference_entity_type, reference_entity_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      notif.userId,
      notif.title,
      notif.message,
      notif.type,
      notif.referenceEntityType || null,
      notif.referenceEntityId || null,
    ];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findByUserId(userId: string) {
    const sql = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const res = await query(sql, [userId]);
    return res.rows;
  }

  static async markAllAsRead(userId: string) {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1
      RETURNING *
    `;
    const res = await query(sql, [userId]);
    return res.rows;
  }

  static async getUnreadCount(userId: string) {
    const sql = `
      SELECT COUNT(*)::int as count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
    `;
    const res = await query(sql, [userId]);
    return res.rows[0].count;
  }
}
