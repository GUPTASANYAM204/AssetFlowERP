import { Router, Response } from 'express';
import { BookingService } from '../services/booking.service';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { bookResourceSchema } from '../validators/booking.validator';

const router = Router();

// GET all bookings (All users can see calendar bookings)
router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    // Automatically update booking states first
    await BookingService.syncBookingStates();
    const list = await BookingService.getBookings();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST book resource (All roles can book)
router.post(
  '/',
  authenticateJWT,
  validateRequest({ body: bookResourceSchema }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const userId = req.user!.id;
      const data = {
        ...req.body,
        bookedBy: userId,
      };
      const booking = await BookingService.book(userId, data);
      res.status(201).json(booking);
    } catch (err) {
      next(err);
    }
  }
);

// POST cancel booking (All authenticated roles can cancel their own, Managers can cancel any)
router.post('/:id/cancel', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const roleName = req.user!.role;
    const { id } = req.params;

    const booking = await BookingService.cancel(userId, id, roleName);
    res.json({ message: 'Booking successfully cancelled.', booking });
  } catch (err) {
    next(err);
  }
});

// GET bookings for a specific asset (for resource-specific calendars)
router.get('/resource/:assetId', authenticateJWT, async (req, res, next) => {
  try {
    const { assetId } = req.params;
    const list = await BookingService.getBookingsByAssetId(assetId);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

export default router;
