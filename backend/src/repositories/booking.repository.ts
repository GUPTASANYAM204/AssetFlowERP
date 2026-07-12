import { query } from '../config/db';

export interface BookingInput {
  assetId: string;
  bookedBy: string;
  bookedForDepartmentId?: string | null;
  startTime: string;
  endTime: string;
}

export class BookingRepository {
  static async create(booking: BookingInput) {
    const sql = `
      INSERT INTO resource_bookings (asset_id, booked_by, booked_for_department_id, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, $5, 'UPCOMING')
      RETURNING *
    `;
    const params = [
      booking.assetId,
      booking.bookedBy,
      booking.bookedForDepartmentId || null,
      booking.startTime,
      booking.endTime,
    ];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findById(id: string) {
    const sql = `
      SELECT rb.*, a.name as asset_name, a.asset_tag, u.name as booked_by_name, d.name as department_name
      FROM resource_bookings rb
      JOIN assets a ON rb.asset_id = a.id
      JOIN users u ON rb.booked_by = u.id
      LEFT JOIN departments d ON rb.booked_for_department_id = d.id
      WHERE rb.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  static async updateStatus(id: string, status: string) {
    const sql = `
      UPDATE resource_bookings
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = await query(sql, [status, id]);
    return res.rows[0];
  }

  static async checkConflicts(assetId: string, startTime: string, endTime: string, ignoreBookingId?: string) {
    // Check overlaps using SQL query (pre-checks before insert to show nice message)
    let sql = `
      SELECT rb.*, u.name as user_name
      FROM resource_bookings rb
      JOIN users u ON rb.booked_by = u.id
      WHERE rb.asset_id = $1 
        AND rb.status IN ('UPCOMING', 'ONGOING')
        AND tstzrange(rb.start_time, rb.end_time) && tstzrange($2, $3)
    `;
    const params: any[] = [assetId, startTime, endTime];

    if (ignoreBookingId) {
      sql += ` AND rb.id != $4`;
      params.push(ignoreBookingId);
    }

    const res = await query(sql, params);
    return res.rows;
  }

  static async findAll() {
    const sql = `
      SELECT rb.*, 
             a.name as asset_name, a.asset_tag, a.location,
             u.name as booked_by_name, u.email as booked_by_email,
             d.name as department_name
      FROM resource_bookings rb
      JOIN assets a ON rb.asset_id = a.id
      JOIN users u ON rb.booked_by = u.id
      LEFT JOIN departments d ON rb.booked_for_department_id = d.id
      ORDER BY rb.start_time ASC
    `;
    const res = await query(sql);
    return res.rows;
  }

  static async findByAssetId(assetId: string) {
    const sql = `
      SELECT rb.*, u.name as booked_by_name, d.name as department_name
      FROM resource_bookings rb
      JOIN users u ON rb.booked_by = u.id
      LEFT JOIN departments d ON rb.booked_for_department_id = d.id
      WHERE rb.asset_id = $1 AND rb.status IN ('UPCOMING', 'ONGOING')
      ORDER BY rb.start_time ASC
    `;
    const res = await query(sql, [assetId]);
    return res.rows;
  }

  // Update statuses automatically (e.g. Upcoming -> Ongoing -> Completed)
  static async updateBookingStates() {
    // 1. Mark Ongoing
    await query(`
      UPDATE resource_bookings
      SET status = 'ONGOING'
      WHERE status = 'UPCOMING' AND start_time <= NOW() AND end_time > NOW()
    `);

    // 2. Mark Completed
    await query(`
      UPDATE resource_bookings
      SET status = 'COMPLETED'
      WHERE status IN ('UPCOMING', 'ONGOING') AND end_time <= NOW()
    `);
  }
}
