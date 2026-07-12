import { Router, Response } from 'express';
import { z } from 'zod';
import { AllocationService } from '../services/allocation.service';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { allocateAssetSchema, returnAssetSchema, transferRequestSchema, approveTransferSchema } from '../validators/allocation.validator';

const router = Router();

// GET active allocations (Admin / Asset Manager / Department Head / Employee)
router.get('/', authenticateJWT, requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE']), async (req, res, next) => {
  try {
    // Run automatic overdue check first to ensure accurate dashboard counts on refetch!
    await AllocationService.flagOverdueAllocations();
    const list = await AllocationService.getActiveAllocations();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST allocate an asset (Asset Manager / Admin only)
router.post(
  '/',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validateRequest({ body: allocateAssetSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const managerId = req.user!.id;
      const allocation = await AllocationService.allocate(managerId, req.body);
      res.status(201).json(allocation);
    } catch (err) {
      next(err);
    }
  }
);

// POST return asset (Asset Manager / Admin only)
router.post(
  '/return',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validateRequest({ body: returnAssetSchema.extend({ assetId: z.string().uuid() }).partial() }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const managerId = req.user!.id;
      const { assetId, checkInNotes, condition } = req.body;
      if (!assetId) return res.status(400).json({ message: 'assetId is required' });

      const allocation = await AllocationService.returnAsset(managerId, assetId, checkInNotes || null, condition);
      res.json({ message: 'Asset successfully returned and marked AVAILABLE.', allocation });
    } catch (err) {
      next(err);
    }
  }
);

// GET transfer requests (Admin / Asset Manager / Department Head / Employee)
router.get('/transfers', authenticateJWT, requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE']), async (req, res, next) => {
  try {
    const list = await AllocationService.getTransferRequests();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST request a transfer (All authenticated roles can request)
router.post(
  '/transfers',
  authenticateJWT,
  validateRequest({ body: transferRequestSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const requesterId = req.user!.id;
      const request = await AllocationService.requestTransfer(requesterId, req.body);
      res.status(201).json(request);
    } catch (err) {
      next(err);
    }
  }
);

// POST approve/reject transfer request (Asset Manager / Department Head / Admin only)
router.post(
  '/transfers/:id/approve',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  validateRequest({ body: approveTransferSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const managerId = req.user!.id;
      const { id } = req.params;
      const { approved, approvalNotes } = req.body;

      const request = await AllocationService.approveTransfer(managerId, id, approved, approvalNotes || null);
      res.json({ message: `Transfer request successfully ${approved ? 'APPROVED' : 'REJECTED'}.`, request });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
