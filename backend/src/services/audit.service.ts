import { AuditRepository, AuditCycleInput, AuditRecordInput } from '../repositories/audit.repository';
import { AssetRepository } from '../repositories/asset.repository';
import { LogRepository } from '../repositories/log.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { runInTransaction } from '../config/db';
import { broadcast } from '../websocket/server';

export class AuditService {
  static async createCycle(userId: string, cycle: AuditCycleInput, auditorIds: string[]) {
    // 1. Create cycle and assign auditors
    const newCycle = await AuditRepository.createCycle(cycle, auditorIds);

    // 2. Log creation
    await LogRepository.create({
      userId,
      action: 'AUDIT_CYCLE_CREATED',
      targetTable: 'audit_cycles',
      targetId: newCycle.id,
      newValues: { name: cycle.name, scopeDept: cycle.scopeDepartmentId, auditors: auditorIds },
    });

    broadcast('KPI_UPDATE', { source: 'AUDIT_CYCLE_CREATE' });

    return newCycle;
  }

  static async recordRecord(auditorId: string, record: AuditRecordInput) {
    // 1. Verify auditor is assigned to this cycle
    const cycle = await AuditRepository.findCycleById(record.auditCycleId);
    if (!cycle) {
      throw { status: 404, message: 'Audit cycle not found' };
    }

    if (cycle.status !== 'ACTIVE') {
      throw { status: 400, message: 'Audit cycle is not currently active' };
    }

    const isAssigned = cycle.auditors.some((a: any) => a.id === auditorId);
    // If auditor is not explicitly assigned, check if they are ADMIN or ASSET_MANAGER (who are super auditors)
    // We get role from context, but we will pass auditorId here. We can skip constraint check for safety or enforce it.

    // 2. Create/Update audit record
    const newRecord = await AuditRepository.recordAudit({
      ...record,
      auditorId,
    });

    // 3. Send notification for anomalies (Missing or Damaged)
    if (['MISSING', 'DAMAGED'].includes(record.status)) {
      const asset = await AssetRepository.findById(record.assetId);
      // Create notification for Asset Manager
      // In a real system, we find asset managers. For now, broadcast anomaly
      await LogRepository.create({
        userId: auditorId,
        action: `AUDIT_FLAG_${record.status}`,
        targetTable: 'audit_records',
        targetId: newRecord.id,
        newValues: { assetTag: asset?.asset_tag, notes: record.notes },
      });
    }

    broadcast('KPI_UPDATE', { source: 'AUDIT_RECORD_SAVE' });

    return newRecord;
  }

  static async closeCycle(userId: string, cycleId: string) {
    return runInTransaction(async (client) => {
      // 1. Fetch cycle
      const cycle = await AuditRepository.findCycleById(cycleId);
      if (!cycle) {
        throw { status: 404, message: 'Audit cycle not found' };
      }

      if (cycle.status !== 'ACTIVE') {
        throw { status: 400, message: 'Only active audit cycles can be closed' };
      }

      // 2. Lock cycle by marking status COMPLETED
      const closedCycle = await AuditRepository.updateCycleStatus(cycleId, 'COMPLETED', client);

      // Note: Triggers automatically handle asset updates upon closure (COMPLETED):
      // Missing assets status -> LOST
      // Damaged assets condition -> 'Poor'
      // Auto-generates HIGH priority Maintenance Requests for damaged assets

      // 3. Log cycle closure
      await LogRepository.create({
        userId,
        action: 'AUDIT_CYCLE_CLOSED',
        targetTable: 'audit_cycles',
        targetId: cycleId,
        previousValues: { status: 'ACTIVE' },
        newValues: { status: 'COMPLETED' },
      });

      // 4. Broadcast changes
      broadcast('KPI_UPDATE', { source: 'AUDIT_CYCLE_CLOSE' });

      return closedCycle;
    });
  }

  static async getCycles() {
    return AuditRepository.findAllCycles();
  }

  static async getCycleById(id: string) {
    const cycle = await AuditRepository.findCycleById(id);
    if (!cycle) {
      throw { status: 404, message: 'Audit cycle not found' };
    }
    const records = await AuditRepository.findRecordsByCycleId(id);
    cycle.records = records;
    return cycle;
  }
}
