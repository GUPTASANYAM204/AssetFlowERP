import { query } from '../config/db';
import { PoolClient } from 'pg';

export interface AllocationInput {
  assetId: string;
  userId?: string | null;
  departmentId?: string | null;
  allocatedBy: string;
  expectedReturnAt?: string | null;
}

export interface TransferRequestInput {
  assetId: string;
  fromUserId?: string | null;
  fromDepartmentId?: string | null;
  toUserId?: string | null;
  toDepartmentId?: string | null;
  requestedBy: string;
  reason: string;
}

export class AllocationRepository {
  // Allocations
  static async create(alloc: AllocationInput, client?: PoolClient) {
    const sql = `
      INSERT INTO asset_allocations (asset_id, user_id, department_id, allocated_by, expected_return_at, status)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      RETURNING *
    `;
    const params = [
      alloc.assetId,
      alloc.userId || null,
      alloc.departmentId || null,
      alloc.allocatedBy,
      alloc.expectedReturnAt || null,
    ];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  static async findActiveByAssetId(assetId: string, client?: PoolClient) {
    const sql = `
      SELECT al.*, u.name as user_name, u.email as user_email, d.name as department_name
      FROM asset_allocations al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN departments d ON al.department_id = d.id
      WHERE al.asset_id = $1 AND al.status = 'ACTIVE'
    `;
    const res = client ? await client.query(sql, [assetId]) : await query(sql, [assetId]);
    return res.rows[0] || null;
  }

  static async returnAllocation(
    id: string,
    returnedAt: Date,
    checkInNotes: string | null,
    client?: PoolClient
  ) {
    const sql = `
      UPDATE asset_allocations
      SET returned_at = $1, check_in_notes = $2, status = 'RETURNED', updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const res = client
      ? await client.query(sql, [returnedAt, checkInNotes, id])
      : await query(sql, [returnedAt, checkInNotes, id]);
    return res.rows[0];
  }

  static async findActiveAllocations() {
    const sql = `
      SELECT al.*, 
             a.name as asset_name, a.asset_tag, a.location,
             u.name as user_name, u.email as user_email,
             d.name as department_name,
             ab.name as allocated_by_name
      FROM asset_allocations al
      JOIN assets a ON al.asset_id = a.id
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN departments d ON al.department_id = d.id
      LEFT JOIN users ab ON al.allocated_by = ab.id
      WHERE al.status = 'ACTIVE' OR al.status = 'OVERDUE'
      ORDER BY al.allocated_at DESC
    `;
    const res = await query(sql);
    return res.rows;
  }

  // Transfers
  static async createTransferRequest(req: TransferRequestInput) {
    const sql = `
      INSERT INTO transfer_requests (asset_id, from_user_id, from_department_id, to_user_id, to_department_id, requested_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *
    `;
    const params = [
      req.assetId,
      req.fromUserId || null,
      req.fromDepartmentId || null,
      req.toUserId || null,
      req.toDepartmentId || null,
      req.requestedBy,
    ];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findTransferRequestById(id: string, client?: PoolClient) {
    const sql = `
      SELECT tr.*, 
             a.name as asset_name, a.asset_tag,
             fu.name as from_user_name, tu.name as to_user_name,
             fd.name as from_department_name, td.name as to_department_name,
             rb.name as requested_by_name
      FROM transfer_requests tr
      JOIN assets a ON tr.asset_id = a.id
      LEFT JOIN users fu ON tr.from_user_id = fu.id
      LEFT JOIN users tu ON tr.to_user_id = tu.id
      LEFT JOIN departments fd ON tr.from_department_id = fd.id
      LEFT JOIN departments td ON tr.to_department_id = td.id
      LEFT JOIN users rb ON tr.requested_by = rb.id
      WHERE tr.id = $1
    `;
    const res = client ? await client.query(sql, [id]) : await query(sql, [id]);
    return res.rows[0] || null;
  }

  static async updateTransferRequestStatus(
    id: string,
    status: string,
    approvedBy: string,
    notes: string | null,
    client?: PoolClient
  ) {
    const sql = `
      UPDATE transfer_requests
      SET status = $1, approved_by = $2, approval_notes = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const params = [status, approvedBy, notes, id];
    const res = client ? await client.query(sql, params) : await query(sql, params);
    return res.rows[0];
  }

  static async findAllTransferRequests() {
    const sql = `
      SELECT tr.*, 
             a.name as asset_name, a.asset_tag,
             fu.name as from_user_name, fu.email as from_user_email,
             tu.name as to_user_name, tu.email as to_user_email,
             fd.name as from_department_name, 
             td.name as to_department_name,
             rb.name as requested_by_name,
             ab.name as approved_by_name
      FROM transfer_requests tr
      JOIN assets a ON tr.asset_id = a.id
      LEFT JOIN users fu ON tr.from_user_id = fu.id
      LEFT JOIN users tu ON tr.to_user_id = tu.id
      LEFT JOIN departments fd ON tr.from_department_id = fd.id
      LEFT JOIN departments td ON tr.to_department_id = td.id
      LEFT JOIN users rb ON tr.requested_by = rb.id
      LEFT JOIN users ab ON tr.approved_by = ab.id
      ORDER BY tr.created_at DESC
    `;
    const res = await query(sql);
    return res.rows;
  }

  // Update allocations expected to overdue
  static async checkOverdueAllocations() {
    const sql = `
      UPDATE asset_allocations
      SET status = 'OVERDUE'
      WHERE status = 'ACTIVE' AND expected_return_at IS NOT NULL AND expected_return_at < NOW()
      RETURNING *
    `;
    const res = await query(sql);
    return res.rows;
  }
}
