import { MaintenanceRepository, MaintenanceInput } from '../repositories/maintenance.repository';
import { AssetRepository } from '../repositories/asset.repository';
import { LogRepository } from '../repositories/log.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { runInTransaction } from '../config/db';
import { broadcast } from '../websocket/server';

export class MaintenanceService {
  static async raiseRequest(userId: string, data: MaintenanceInput) {
    const asset = await AssetRepository.findById(data.assetId);
    if (!asset) {
      throw { status: 404, message: 'Asset not found' };
    }

    // Insert request
    const request = await MaintenanceRepository.create(data);

    // Log request
    await LogRepository.create({
      userId,
      action: 'MAINTENANCE_REQUEST_CREATED',
      targetTable: 'maintenance_requests',
      targetId: request.id,
      newValues: { assetTag: asset.asset_tag, priority: data.priority, description: data.description },
    });

    broadcast('KPI_UPDATE', { source: 'MAINTENANCE_REQUEST' });

    return request;
  }

  static async updateStatus(
    userId: string,
    requestId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'TECHNICIAN_ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED',
    updateData: {
      technicianId?: string | null;
      cost?: number | null;
      resolutionNotes?: string | null;
    }
  ) {
    return runInTransaction(async (client) => {
      // 1. Fetch request details
      const request = await MaintenanceRepository.findById(requestId);
      if (!request) {
        throw { status: 404, message: 'Maintenance request not found' };
      }

      const prevStatus = request.status;

      // 2. Perform updates
      const resolvedAt = status === 'RESOLVED' ? new Date() : null;
      const updatedRequest = await MaintenanceRepository.updateStatus(
        requestId,
        status,
        {
          ...updateData,
          resolvedAt,
        },
        client
      );

      // Note: Triggers automatically handle asset status flips:
      // status APPROVED -> asset status = UNDER_MAINTENANCE
      // status RESOLVED -> asset status = AVAILABLE

      // 3. Send notification to the user who raised the request
      await NotificationRepository.create({
        userId: request.raised_by,
        title: `Maintenance Request ${status}`,
        message: `Your maintenance request for "${request.asset_name}" (${request.asset_tag}) is now ${status}.`,
        type: 'MAINTENANCE_APPROVED',
        referenceEntityType: 'maintenance_requests',
        referenceEntityId: requestId,
      });

      // 4. Log the action
      await LogRepository.create({
        userId,
        action: `MAINTENANCE_STATUS_${status}`,
        targetTable: 'maintenance_requests',
        targetId: requestId,
        previousValues: { status: prevStatus },
        newValues: { status, technicianId: updateData.technicianId, cost: updateData.cost, resolutionNotes: updateData.resolutionNotes },
      });

      // 5. Broadcast live KPI & Notification updates
      broadcast('KPI_UPDATE', { source: 'MAINTENANCE_UPDATE' });
      broadcast('NOTIFICATIONS_UPDATE', { userId: request.raised_by });

      return updatedRequest;
    });
  }

  static async getRequests() {
    return MaintenanceRepository.findAll();
  }
}
