import { BookingRepository, BookingInput } from '../repositories/booking.repository';
import { AssetRepository } from '../repositories/asset.repository';
import { LogRepository } from '../repositories/log.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { broadcast } from '../websocket/server';

export class BookingService {
  static async book(userId: string, data: BookingInput) {
    // 1. Verify resource exists and is shared bookable
    const asset = await AssetRepository.findById(data.assetId);
    if (!asset) {
      throw { status: 404, message: 'Resource not found' };
    }

    if (!asset.is_shared_bookable) {
      throw { status: 400, message: 'This asset is not flagged as a shared, bookable resource' };
    }

    if (asset.status !== 'AVAILABLE') {
      throw { status: 400, message: `This resource is currently ${asset.status}. Bookings can only be made on Available items.` };
    }

    // 2. Overlap validation pre-check
    const conflicts = await BookingRepository.checkConflicts(data.assetId, data.startTime, data.endTime);
    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      throw { 
        status: 409, 
        message: `Booking conflict: The resource is already booked by ${firstConflict.user_name} from ${new Date(firstConflict.start_time).toLocaleTimeString()} to ${new Date(firstConflict.end_time).toLocaleTimeString()}`
      };
    }

    // 3. Create booking
    const booking = await BookingRepository.create(data);

    // 4. Send notification
    await NotificationRepository.create({
      userId,
      title: 'Booking Confirmed',
      message: `Your booking for "${asset.name}" (${asset.asset_tag}) on ${new Date(data.startTime).toLocaleDateString()} has been confirmed.`,
      type: 'BOOKING_CONFIRMED',
      referenceEntityType: 'resource_bookings',
      referenceEntityId: booking.id,
    });

    // 5. Log booking
    await LogRepository.create({
      userId,
      action: 'BOOK_RESOURCE',
      targetTable: 'resource_bookings',
      targetId: booking.id,
      newValues: { resource: asset.name, start: data.startTime, end: data.endTime },
    });

    // 6. Broadcast KPI updates
    broadcast('KPI_UPDATE', { source: 'BOOK_RESOURCE' });
    broadcast('NOTIFICATIONS_UPDATE', { userId });

    return booking;
  }

  static async cancel(userId: string, bookingId: string, roleName: string) {
    const booking = await BookingRepository.findById(bookingId);
    if (!booking) {
      throw { status: 404, message: 'Booking not found' };
    }

    // Authorization: User can cancel their own booking, Admin/Asset Manager can cancel any booking
    if (booking.booked_by !== userId && !['ADMIN', 'ASSET_MANAGER'].includes(roleName)) {
      throw { status: 403, message: 'You are not authorized to cancel this booking' };
    }

    if (booking.status !== 'UPCOMING') {
      throw { status: 400, message: `Only Upcoming bookings can be cancelled. Current status is ${booking.status}` };
    }

    // Update status to CANCELLED
    const cancelled = await BookingRepository.updateStatus(bookingId, 'CANCELLED');

    // Notify user if cancelled by someone else
    if (booking.booked_by !== userId) {
      await NotificationRepository.create({
        userId: booking.booked_by,
        title: 'Booking Cancelled',
        message: `Your booking for "${booking.asset_name}" (${booking.asset_tag}) was cancelled by administration.`,
        type: 'SYSTEM',
        referenceEntityType: 'resource_bookings',
        referenceEntityId: bookingId,
      });
      broadcast('NOTIFICATIONS_UPDATE', { userId: booking.booked_by });
    }

    // Log cancellation
    await LogRepository.create({
      userId,
      action: 'CANCEL_BOOKING',
      targetTable: 'resource_bookings',
      targetId: bookingId,
      previousValues: { status: 'UPCOMING' },
      newValues: { status: 'CANCELLED' },
    });

    broadcast('KPI_UPDATE', { source: 'CANCEL_BOOKING' });

    return cancelled;
  }

  static async getBookings() {
    return BookingRepository.findAll();
  }

  static async getBookingsByAssetId(assetId: string) {
    return BookingRepository.findByAssetId(assetId);
  }

  // Periodic method to sync booking states (Upcoming -> Ongoing -> Completed)
  static async syncBookingStates() {
    await BookingRepository.updateBookingStates();
  }
}
