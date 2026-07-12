import { Router, Response } from 'express';
import { AssetService } from '../services/asset.service';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { registerAssetSchema, updateAssetStatusSchema } from '../validators/asset.validator';
import { AssetRepository } from '../repositories/asset.repository';
import { LogRepository } from '../repositories/log.repository';
import { broadcast } from '../websocket/server';

const router = Router();

// Search / list assets
router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    const filters = {
      query: req.query.query as string | undefined,
      category: req.query.category as string | undefined,
      status: req.query.status as string | undefined,
      departmentId: req.query.departmentId as string | undefined,
      location: req.query.location as string | undefined,
    };
    const list = await AssetService.search(filters);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// Register asset (Asset Manager / Admin only)
router.post(
  '/',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validateRequest({ body: registerAssetSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const managerId = req.user!.id;
      const asset = await AssetService.register(managerId, req.body);
      res.status(201).json(asset);
    } catch (err) {
      next(err);
    }
  }
);

// Get asset detail (with history)
router.get('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { id } = req.params;
    const details = await AssetService.getAssetDetailWithHistory(id);
    res.json(details);
  } catch (err) {
    next(err);
  }
});

// Update asset lifecycle status manually (Asset Manager / Admin only)
router.put(
  '/:id/status',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validateRequest({ body: updateAssetStatusSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const prev = await AssetRepository.findById(id);
      if (!prev) return res.status(404).json({ message: 'Asset not found' });

      const asset = await AssetRepository.updateStatus(id, status);
      
      // Log status change
      await LogRepository.create({
        userId: req.user!.id,
        action: 'UPDATE_ASSET_STATUS',
        targetTable: 'assets',
        targetId: id,
        previousValues: { status: prev.status },
        newValues: { status },
      });

      broadcast('KPI_UPDATE', { source: 'MANUAL_STATUS_UPDATE' });
      res.json(asset);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
