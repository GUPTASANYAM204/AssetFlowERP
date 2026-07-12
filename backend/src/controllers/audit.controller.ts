import { Router, Response } from 'express';
import { z } from 'zod';
import { AuditService } from '../services/audit.service';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { createAuditCycleSchema, recordAuditSchema } from '../validators/audit.validator';

const router = Router();

// GET all audit cycles (Admin, Asset Manager, Department Head, Employee)
router.get('/', authenticateJWT, requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE']), async (req, res, next) => {
  try {
    const list = await AuditService.getCycles();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST create audit cycle (Admin / Asset Manager only)
router.post(
  '/',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validateRequest({ body: createAuditCycleSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const { name, scopeDepartmentId, scopeLocation, startDate, endDate, auditorIds } = req.body;
      
      const cycle = await AuditService.createCycle(
        userId, 
        { name, scopeDepartmentId, scopeLocation, startDate, endDate }, 
        auditorIds
      );
      res.status(201).json(cycle);
    } catch (err) {
      next(err);
    }
  }
);

// GET cycle details (with auditor records checklist)
router.get('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const { id } = req.params;
    const cycle = await AuditService.getCycleById(id);
    res.json(cycle);
  } catch (err) {
    next(err);
  }
});

// POST record auditor checklist finding (Assigned Auditors, Asset Managers, Admin only)
router.post(
  '/record',
  authenticateJWT,
  validateRequest({ body: recordAuditSchema.extend({ auditCycleId: z.string().uuid() }) }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const auditorId = req.user!.id;
      const { auditCycleId, assetId, status, notes } = req.body;
      if (!auditCycleId) return res.status(400).json({ message: 'auditCycleId is required' });

      const record = await AuditService.recordRecord(auditorId, {
        auditCycleId,
        assetId,
        status,
        notes,
        auditorId,
      });

      res.status(201).json({ message: 'Auditor check successfully saved.', record });
    } catch (err) {
      next(err);
    }
  }
);

// POST close audit cycle (Asset Manager / Admin only)
router.post('/:id/close', authenticateJWT, requireRole(['ADMIN', 'ASSET_MANAGER']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const cycle = await AuditService.closeCycle(userId, id);
    res.json({ message: 'Audit cycle successfully completed and locked. Missing/Damaged assets updated.', cycle });
  } catch (err) {
    next(err);
  }
});

export default router;
