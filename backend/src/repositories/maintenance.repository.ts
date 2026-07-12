import { query } from '../config/db';
import { PoolClient } from 'pg';

export interface MaintenanceInput {
  assetId: string;
  raisedBy: string;
  description: string;
  priority: string;
  photoUrl?: string | null;
}

export class MaintenanceRepository {
  static async create(req: MaintenanceInput) {
    const sql = `
      INSERT INTO maintenance_requests (asset_id, raised_by, description, priority, status)
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
    `;
    const params = [
      req.assetId,
      req.raisedBy,
      req.description,
      req.priority,
    ];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findById(id: string) {
    const sql = `
      SELECT mr.*, 
             a.name as asset_name, a.asset_tag, a.location, a.status as asset_status,
             u.name as raised_by_name,
             t.name as technician_name
      FROM maintenance_requests mr
      JOIN assets a ON mr.asset_id = a.id
      JOIN users u ON mr.raised_by = u.id
      LEFT JOIN users t ON mr.technician_id = t.id
      WHERE mr.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  static async updateStatus(
    id: string,
    status: string,
    updateData: {
      technicianId?: string | null;
      cost?: number | null;
      resolutionNotes?: string | null;
      resolvedAt?: Date | null;
    },
    client?: PoolClient
  ) {
    const sql = `
      UPDATE maintenance_requests
      SET status = $1, 
          technician_id = COALESCE($2, technician_id), 
          cost = COALESCE($3, cost), 
          resolution_notes = COALESCE($4, resolution_notes),
          resolved_at = COALESCE($5, resolved_at),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const params = [
      status,
      updateData.technicianId !== undefined ? updateData.technicianId : null,
      updateData.cost !== undefined ? updateData.cost : null,
      updateData.resolutionNotes !== undefined ? updateData.resolutionNotes : null,
      updateData.resolvedAt !== undefined ? updateData.resolvedAt : null,
      id,
    ];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  static async findAll() {
    const sql = `
      SELECT mr.*, 
             a.name as asset_name, a.asset_tag, a.location,
             u.name as raised_by_name, u.email as raised_by_email,
             t.name as technician_name
      FROM maintenance_requests mr
      JOIN assets a ON mr.asset_id = a.id
      JOIN users u ON mr.raised_by = u.id
      LEFT JOIN users t ON mr.technician_id = t.id
      ORDER BY mr.created_at DESC
    `;
    const res = await query(sql);
    return res.rows;
  }

  static async findByAssetId(assetId: string) {
    const sql = `
      SELECT mr.*, u.name as raised_by_name, t.name as technician_name
      FROM maintenance_requests mr
      JOIN users u ON mr.raised_by = u.id
      LEFT JOIN users t ON mr.technician_id = t.id
      WHERE mr.asset_id = $1
      ORDER BY mr.created_at DESC
    `;
    const res = await query(sql, [assetId]);
    return res.rows;
  }
}
