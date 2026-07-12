import { Router, Response } from 'express';
import { ReportService } from '../services/report.service';
import { LogRepository } from '../repositories/log.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { logsQuerySchema } from '../validators/report.validator';
import { broadcast } from '../websocket/server';

const router = Router();

// GET organization-wide analytics (All users can view analytics, but maybe Admins/Managers see everything and employees see a trimmed version. For a hackathon, we show full analytics to show off our direct DB queries!)
router.get('/analytics', authenticateJWT, async (req, res, next) => {
  try {
    const reports = await ReportService.getOrganizationAnalytics();
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// GET paginated asset activity logs (Admin / Asset Manager only)
router.get(
  '/logs',
  authenticateJWT,
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validateRequest({ query: logsQuerySchema }),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await LogRepository.findAssetActivityPaginated(page, limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET user notifications
router.get('/notifications', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const list = await NotificationRepository.findByUserId(userId);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST mark all user notifications as read
router.post('/notifications/read', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    await NotificationRepository.markAllAsRead(userId);
    broadcast('NOTIFICATIONS_UPDATE', { userId });
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

// GET user unread notification counts
router.get('/notifications/unread-count', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const count = await NotificationRepository.getUnreadCount(userId);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

export default router;
