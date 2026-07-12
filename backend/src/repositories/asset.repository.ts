import { query } from '../config/db';
import { PoolClient } from 'pg';

export interface AssetInput {
  name: string;
  categoryId: string;
  assetTag: string;
  serialNumber?: string | null;
  acquisitionDate: string;
  acquisitionCost: number;
  condition: string;
  location: string;
  photoUrl?: string | null;
  isSharedBookable: boolean;
  categoryFields: any;
}

export class AssetRepository {
  static async create(asset: AssetInput) {
    const sql = `
      INSERT INTO assets (name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, photo_url, is_shared_bookable, status, category_fields)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'AVAILABLE', $11)
      RETURNING *
    `;
    const params = [
      asset.name,
      asset.categoryId,
      asset.assetTag,
      asset.serialNumber || null,
      asset.acquisitionDate,
      asset.acquisitionCost,
      asset.condition,
      asset.location,
      asset.photoUrl || null,
      asset.isSharedBookable,
      JSON.stringify(asset.categoryFields || {}),
    ];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findById(id: string) {
    const sql = `
      SELECT a.*, c.name as category_name, d.name as department_name, u.name as holder_name
      FROM assets a
      JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN users u ON a.current_holder_id = u.id
      WHERE a.id = $1
    `;
    const res = await query(sql, [id]);
    return res.rows[0] || null;
  }

  static async findByTag(tag: string) {
    const sql = `
      SELECT a.*, c.name as category_name, d.name as department_name, u.name as holder_name
      FROM assets a
      JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN users u ON a.current_holder_id = u.id
      WHERE a.asset_tag = $1
    `;
    const res = await query(sql, [tag]);
    return res.rows[0] || null;
  }

  static async updateStatus(id: string, status: string, client?: PoolClient) {
    const sql = `
      UPDATE assets
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = client ? await client.query(sql, [status, id]) : await query(sql, [status, id]);
    return res.rows[0];
  }

  static async updateHolderAndDept(
    id: string,
    holderId: string | null,
    deptId: string | null,
    status: string,
    client?: PoolClient
  ) {
    const sql = `
      UPDATE assets
      SET current_holder_id = $1, department_id = $2, status = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;
    const res = client
      ? await client.query(sql, [holderId, deptId, status, id])
      : await query(sql, [holderId, deptId, status, id]);
    return res.rows[0];
  }

  static async updateCondition(id: string, condition: string, client?: PoolClient) {
    const sql = `
      UPDATE assets
      SET condition = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = client ? await client.query(sql, [condition, id]) : await query(sql, [condition, id]);
    return res.rows[0];
  }

  static async search(filters: {
    query?: string;
    category?: string;
    status?: string;
    departmentId?: string;
    location?: string;
  }) {
    let sql = `
      SELECT a.*, c.name as category_name, d.name as department_name, u.name as holder_name
      FROM assets a
      JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN users u ON a.current_holder_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.query) {
      sql += ` AND (a.name ILIKE $${paramIndex} OR a.asset_tag ILIKE $${paramIndex} OR a.serial_number ILIKE $${paramIndex})`;
      params.push(`%${filters.query}%`);
      paramIndex++;
    }

    if (filters.category && filters.category !== 'All') {
      sql += ` AND c.name = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters.status && filters.status !== 'All') {
      sql += ` AND a.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.departmentId) {
      sql += ` AND a.department_id = $${paramIndex}`;
      params.push(filters.departmentId);
      paramIndex++;
    }

    if (filters.location && filters.location !== 'All') {
      sql += ` AND a.location = $${paramIndex}`;
      params.push(filters.location);
      paramIndex++;
    }

    sql += ` ORDER BY a.asset_tag ASC`;

    const res = await query(sql, params);
    return res.rows;
  }

  static async getHistory(assetId: string) {
    // 1. Get allocations history
    const allocationSql = `
      SELECT al.*, 
             u.name as user_name, u.email as user_email,
             d.name as department_name,
             ab.name as allocated_by_name
      FROM asset_allocations al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN departments d ON al.department_id = d.id
      LEFT JOIN users ab ON al.allocated_by = ab.id
      WHERE al.asset_id = $1
      ORDER BY al.allocated_at DESC
    `;
    const allocations = await query(allocationSql, [assetId]);

    // 2. Get maintenance requests history
    const maintenanceSql = `
      SELECT mr.*, 
             rb.name as raised_by_name,
             tech.name as technician_name
      FROM maintenance_requests mr
      LEFT JOIN users rb ON mr.raised_by = rb.id
      LEFT JOIN users tech ON mr.technician_id = tech.id
      WHERE mr.asset_id = $1
      ORDER BY mr.created_at DESC
    `;
    const maintenance = await query(maintenanceSql, [assetId]);

    return {
      allocations: allocations.rows,
      maintenance: maintenance.rows,
    };
  }

  static async getNextAssetTag() {
    const sql = `SELECT asset_tag FROM assets ORDER BY asset_tag DESC LIMIT 1`;
    const res = await query(sql);
    if (res.rows.length === 0) return 'AF-0001';
    const lastTag = res.rows[0].asset_tag;
    const numPart = parseInt(lastTag.replace('AF-', ''));
    const nextNum = numPart + 1;
    return `AF-${nextNum.toString().padStart(4, '0')}`;
  }
}
