import { query } from '../config/db';
import { PoolClient } from 'pg';

export interface AuditCycleInput {
  name: string;
  scopeDepartmentId?: string | null;
  scopeLocation?: string | null;
  startDate: string;
  endDate: string;
}

export interface AuditRecordInput {
  auditCycleId: string;
  assetId: string;
  auditorId: string;
  status: string;
  notes?: string | null;
}

export class AuditRepository {
  // Audit Cycles
  static async createCycle(cycle: AuditCycleInput, auditorIds: string[], client?: PoolClient) {
    const run = async (c: PoolClient) => {
      const sqlCycle = `
        INSERT INTO audit_cycles (name, scope_department_id, scope_location, start_date, end_date, status)
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        RETURNING *
      `;
      const cycleParams = [
        cycle.name,
        cycle.scopeDepartmentId || null,
        cycle.scopeLocation || null,
        cycle.startDate,
        cycle.endDate,
      ];
      const cycleRes = await c.query(sqlCycle, cycleParams);
      const newCycle = cycleRes.rows[0];

      // Insert junction records for auditors
      const sqlAuditor = `
        INSERT INTO audit_auditors (audit_cycle_id, auditor_id)
        VALUES ($1, $2)
      `;
      for (const auditorId of auditorIds) {
        await c.query(sqlAuditor, [newCycle.id, auditorId]);
      }

      return newCycle;
    };

    if (client) {
      return run(client);
    } else {
      // Create separate connection/transaction
      const connection = require('../config/db');
      return connection.runInTransaction(run);
    }
  }

  static async findCycleById(id: string) {
    const sql = `
      SELECT ac.*, d.name as department_name
      FROM audit_cycles ac
      LEFT JOIN departments d ON ac.scope_department_id = d.id
      WHERE ac.id = $1
    `;
    const res = await query(sql, [id]);
    const cycle = res.rows[0];
    if (!cycle) return null;

    // Fetch auditors
    const auditorsSql = `
      SELECT u.id, u.name, u.email
      FROM audit_auditors aa
      JOIN users u ON aa.auditor_id = u.id
      WHERE aa.audit_cycle_id = $1
    `;
    const auditorsRes = await query(auditorsSql, [id]);
    cycle.auditors = auditorsRes.rows;

    return cycle;
  }

  static async updateCycleStatus(id: string, status: string, client?: PoolClient) {
    const sql = `
      UPDATE audit_cycles
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const res = client ? await client.query(sql, [status, id]) : await query(sql, [status, id]);
    return res.rows[0];
  }

  static async findAllCycles() {
    const sql = `
      SELECT ac.*, d.name as department_name
      FROM audit_cycles ac
      LEFT JOIN departments d ON ac.scope_department_id = d.id
      ORDER BY ac.created_at DESC
    `;
    const res = await query(sql);
    return res.rows;
  }

  // Audit Records / Checklist
  static async recordAudit(rec: AuditRecordInput) {
    const sql = `
      INSERT INTO audit_records (audit_cycle_id, asset_id, auditor_id, status, notes, checked_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (audit_cycle_id, asset_id)
      DO UPDATE SET 
        auditor_id = EXCLUDED.auditor_id,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        checked_at = NOW()
      RETURNING *
    `;
    const params = [
      rec.auditCycleId,
      rec.assetId,
      rec.auditorId,
      rec.status,
      rec.notes || null,
    ];
    const res = await query(sql, params);
    return res.rows[0];
  }

  static async findRecordsByCycleId(cycleId: string) {
    const sql = `
      SELECT ar.*, 
             a.name as asset_name, a.asset_tag, a.location as expected_location, a.status as asset_status,
             u.name as auditor_name
      FROM audit_records ar
      JOIN assets a ON ar.asset_id = a.id
      JOIN users u ON ar.auditor_id = u.id
      WHERE ar.audit_cycle_id = $1
      ORDER BY a.asset_tag ASC
    `;
    const res = await query(sql, [cycleId]);
    return res.rows;
  }

  static async getDiscrepancies(cycleId: string) {
    const sql = `
      SELECT ar.*, a.name as asset_name, a.asset_tag, a.location as expected_location,
             u.name as auditor_name
      FROM audit_records ar
      JOIN assets a ON ar.asset_id = a.id
      JOIN users u ON ar.auditor_id = u.id
      WHERE ar.audit_cycle_id = $1 AND ar.status IN ('MISSING', 'DAMAGED')
      ORDER BY a.asset_tag ASC
    `;
    const res = await query(sql, [cycleId]);
    return res.rows;
  }
}
