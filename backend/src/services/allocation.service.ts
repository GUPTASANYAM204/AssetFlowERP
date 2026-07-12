import { AllocationRepository, AllocationInput, TransferRequestInput } from '../repositories/allocation.repository';
import { AssetRepository } from '../repositories/asset.repository';
import { UserRepository } from '../repositories/user.repository';
import { LogRepository } from '../repositories/log.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { runInTransaction } from '../config/db';
import { broadcast } from '../websocket/server';

export class AllocationService {
  static async allocate(managerId: string, data: Omit<AllocationInput, 'allocatedBy'>) {
    return runInTransaction(async (client) => {
      // 1. Fetch asset and check status
      const asset = await AssetRepository.findById(data.assetId);
      if (!asset) {
        throw { status: 404, message: 'Asset not found' };
      }

      if (asset.status !== 'AVAILABLE') {
        throw { 
          status: 400, 
          message: `Asset is already allocated/taken. Currently held by: ${asset.holder_name || asset.department_name || 'System'}. Use a Transfer Request instead.`
        };
      }

      // 2. Resolve allocation target details for logging
      let targetName = 'Department';
      if (data.userId) {
        const user = await UserRepository.findById(data.userId);
        if (!user) throw { status: 404, message: 'Allocation target user not found' };
        targetName = user.name;
      }

      // 3. Create allocation entry
      const allocation = await AllocationRepository.create(
        {
          ...data,
          allocatedBy: managerId,
        },
        client
      );

      // 4. Update asset status and assignment holders
      await AssetRepository.updateHolderAndDept(
        data.assetId,
        data.userId || null,
        data.departmentId || null,
        'ALLOCATED',
        client
      );

      // 5. Send notification to user if allocated to a user
      if (data.userId) {
        await NotificationRepository.create({
          userId: data.userId,
          title: 'Asset Allocated',
          message: `Asset "${asset.name}" (${asset.asset_tag}) has been allocated to you by ${managerId}.`,
          type: 'ASSET_ASSIGNED',
          referenceEntityType: 'assets',
          referenceEntityId: data.assetId,
        });
      }

      // 6. Log the allocation
      await LogRepository.create({
        userId: managerId,
        action: 'ALLOCATE_ASSET',
        targetTable: 'asset_allocations',
        targetId: allocation.id,
        newValues: { assetTag: asset.asset_tag, allocatedTo: targetName, expectedReturn: data.expectedReturnAt },
      });

      // 7. Broadcast KPI updates
      broadcast('KPI_UPDATE', { source: 'ALLOCATE_ASSET' });
      broadcast('NOTIFICATIONS_UPDATE', { userId: data.userId });

      return allocation;
    });
  }

  static async returnAsset(managerId: string, assetId: string, checkInNotes: string | null, newCondition?: string) {
    return runInTransaction(async (client) => {
      // 1. Fetch asset
      const asset = await AssetRepository.findById(assetId);
      if (!asset) {
        throw { status: 404, message: 'Asset not found' };
      }

      // 2. Fetch active allocation
      const activeAlloc = await AllocationRepository.findActiveByAssetId(assetId, client);
      if (!activeAlloc) {
        throw { status: 400, message: 'No active allocation record found for this asset' };
      }

      // 3. Mark allocation returned
      const returnedAlloc = await AllocationRepository.returnAllocation(
        activeAlloc.id,
        new Date(),
        checkInNotes,
        client
      );

      // 4. Return asset back to AVAILABLE, reset holders
      await AssetRepository.updateHolderAndDept(assetId, null, null, 'AVAILABLE', client);

      // 5. Update asset condition if specified
      if (newCondition) {
        await AssetRepository.updateCondition(assetId, newCondition, client);
      }

      // 6. Log return
      await LogRepository.create({
        userId: managerId,
        action: 'RETURN_ASSET',
        targetTable: 'asset_allocations',
        targetId: activeAlloc.id,
        previousValues: { holder: activeAlloc.user_name || activeAlloc.department_name },
        newValues: { checkInNotes, condition: newCondition || asset.condition },
      });

      // 7. Broadcast updates
      broadcast('KPI_UPDATE', { source: 'RETURN_ASSET' });

      return returnedAlloc;
    });
  }

  static async requestTransfer(requesterId: string, data: Omit<TransferRequestInput, 'requestedBy'>) {
    // 1. Check if asset exists
    const asset = await AssetRepository.findById(data.assetId);
    if (!asset) {
      throw { status: 404, message: 'Asset not found' };
    }

    if (asset.status !== 'ALLOCATED') {
      throw { status: 400, message: 'Asset is not currently allocated. You can allocate it directly.' };
    }

    // 2. Resolve current holders to verify the request parameters
    const activeAlloc = await AllocationRepository.findActiveByAssetId(data.assetId);
    if (!activeAlloc) {
      throw { status: 400, message: 'Could not resolve current holding allocation' };
    }

    // 3. Create transfer request
    const request = await AllocationRepository.createTransferRequest({
      ...data,
      fromUserId: activeAlloc.user_id,
      fromDepartmentId: activeAlloc.department_id,
      requestedBy: requesterId,
    });

    // 4. Log transfer request
    await LogRepository.create({
      userId: requesterId,
      action: 'TRANSFER_REQUEST_CREATED',
      targetTable: 'transfer_requests',
      targetId: request.id,
      newValues: { assetTag: asset.asset_tag, reason: data.reason },
    });

    // 5. Notify Asset Managers or Department Head
    // For simplicity, broadcast that a transfer request is pending
    broadcast('KPI_UPDATE', { source: 'TRANSFER_REQUEST' });

    return request;
  }

  static async approveTransfer(managerId: string, requestId: string, approved: boolean, notes: string | null) {
    return runInTransaction(async (client) => {
      // 1. Get transfer request
      const request = await AllocationRepository.findTransferRequestById(requestId, client);
      if (!request) {
        throw { status: 404, message: 'Transfer request not found' };
      }

      if (request.status !== 'PENDING') {
        throw { status: 400, message: 'Transfer request has already been processed' };
      }

      if (!approved) {
        // Mark as rejected
        const rejected = await AllocationRepository.updateTransferRequestStatus(
          requestId,
          'REJECTED',
          managerId,
          notes,
          client
        );

        await LogRepository.create({
          userId: managerId,
          action: 'TRANSFER_REQUEST_REJECTED',
          targetTable: 'transfer_requests',
          targetId: requestId,
          newValues: { notes },
        });

        broadcast('KPI_UPDATE', { source: 'TRANSFER_REJECT' });
        return rejected;
      }

      // Approve & Re-allocate!
      // A. Close the active allocation for fromUser / fromDept
      const activeAlloc = await AllocationRepository.findActiveByAssetId(request.asset_id, client);
      if (activeAlloc) {
        await AllocationRepository.returnAllocation(
          activeAlloc.id,
          new Date(),
          `Transferred automatically via request approval: ${notes || ''}`,
          client
        );
      }

      // B. Create a new active allocation for toUser / toDept
      const newAlloc = await AllocationRepository.create(
        {
          assetId: request.asset_id,
          userId: request.to_user_id,
          departmentId: request.to_department_id,
          allocatedBy: managerId,
        },
        client
      );

      // C. Update asset holders and status
      await AssetRepository.updateHolderAndDept(
        request.asset_id,
        request.to_user_id || null,
        request.to_department_id || null,
        'ALLOCATED',
        client
      );

      // D. Update transfer request status
      const approvedReq = await AllocationRepository.updateTransferRequestStatus(
        requestId,
        'APPROVED',
        managerId,
        notes,
        client
      );

      // E. Notify target user
      if (request.to_user_id) {
        await NotificationRepository.create({
          userId: request.to_user_id,
          title: 'Transfer Approved',
          message: `Asset "${request.asset_name}" (${request.asset_tag}) has been transferred to you.`,
          type: 'TRANSFER_APPROVED',
          referenceEntityType: 'assets',
          referenceEntityId: request.asset_id,
        });
      }

      // F. Log action
      await LogRepository.create({
        userId: managerId,
        action: 'TRANSFER_REQUEST_APPROVED',
        targetTable: 'transfer_requests',
        targetId: requestId,
        previousValues: { from: request.from_user_name || request.from_department_name },
        newValues: { to: request.to_user_name || request.to_department_name, notes },
      });

      // G. Broadcast KPI & Notification updates
      broadcast('KPI_UPDATE', { source: 'TRANSFER_APPROVE' });
      if (request.to_user_id) broadcast('NOTIFICATIONS_UPDATE', { userId: request.to_user_id });

      return approvedReq;
    });
  }

  static async getActiveAllocations() {
    return AllocationRepository.findActiveAllocations();
  }

  static async getTransferRequests() {
    return AllocationRepository.findAllTransferRequests();
  }

  // Cron / trigger method called periodically (or triggered on dashboard view) to catch overdue items
  static async flagOverdueAllocations() {
    const affected = await AllocationRepository.checkOverdueAllocations();
    for (const alloc of affected) {
      if (alloc.user_id) {
        await NotificationRepository.create({
          userId: alloc.user_id,
          title: 'Asset Overdue Return Alert',
          message: `The asset you hold was expected back on ${new Date(alloc.expected_return_at).toLocaleDateString()}. Please return it as soon as possible.`,
          type: 'OVERDUE_RETURN',
          referenceEntityType: 'asset_allocations',
          referenceEntityId: alloc.id,
        });
        broadcast('NOTIFICATIONS_UPDATE', { userId: alloc.user_id });
      }
    }
    if (affected.length > 0) {
      broadcast('KPI_UPDATE', { source: 'OVERDUE_CRON' });
    }
    return affected;
  }
}
