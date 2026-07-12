import { Router, Response } from 'express';
import { MaintenanceService } from '../services/maintenance.service';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { raiseMaintenanceSchema, updateMaintenanceStatusSchema } from '../validators/maintenance.validator';

const router = Router();

// GET all maintenance requests (Admin, Asset Manager, Department Head)
router.get('/', authenticateJWT, requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']), async (req, res, next) => {
  try {
    const list = await MaintenanceService.getRequests();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST raise maintenance request (All roles can raise)
router.post(
  '/',
  authenticateJWT,
  validateRequest({ body: raiseMaintenanceSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const data = {
        ...req.body,
        raisedBy: userId,
      };
      const request = await MaintenanceService.raiseRequest(userId, data);
      res.status(201).json(request);
    } catch (err) {
      next(err);
    }
  }
);

// PUT update status of maintenance request (Asset Manager / Admin only)
router.put(
  '/:id/status',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validateRequest({ body: updateMaintenanceStatusSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { status, technicianId, cost, resolutionNotes } = req.body;

      const request = await MaintenanceService.updateStatus(userId, id, status, {
        technicianId,
        cost,
        resolutionNotes,
      });

      res.json({ message: `Maintenance request successfully updated to ${status}.`, request });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
