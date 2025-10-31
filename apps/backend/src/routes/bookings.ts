import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { AuthMiddleware } from '../middleware/auth';
import { validateBookingCreation, validateBookingUpdate } from '../middleware/bookingValidation';

export function createBookingRoutes(
  bookingController: BookingController,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // Enhanced routes for UI simplification (must come before parameterized routes)
  router.get('/with-swap-info', authMiddleware.optionalAuth(), bookingController.getBookingsWithSwapInfo);

  // Convenience route for getting current user's bookings (must come before /:id)
  router.get('/my-bookings', authMiddleware.requireAuth(), bookingController.getMyBookings);

  // Public routes (for searching available bookings)
  router.get('/', bookingController.getBookings);
  router.get('/:id', bookingController.getBookingById);
  // router.post('/batch-with-swap-info', authMiddleware.optionalAuth(), bookingController.getBatchBookingsWithSwapInfo);
  // router.get('/swap-statistics', authMiddleware.optionalAuth(), bookingController.getBookingSwapStatistics);

  // Protected routes (authentication re-enabled)
  router.post('/', authMiddleware.requireAuth(), validateBookingCreation, bookingController.createBooking);
  // router.post('/with-swap', authMiddleware.requireAuth(), bookingController.createBookingWithSwap); // TODO: implement
  router.put('/:id', authMiddleware.requireAuth(), validateBookingUpdate, bookingController.updateBooking);
  // router.put('/:id/with-swap', authMiddleware.requireAuth(), bookingController.updateBookingWithSwap); // TODO: implement
  router.delete('/:id', authMiddleware.requireAuth(), bookingController.deleteBooking);
  router.post('/:id/verify', authMiddleware.requireAuth(), bookingController.verifyBooking);
  router.get('/user/:userId', authMiddleware.requireAuth(), bookingController.getUserBookings);

  // NFT and swapping management routes
  router.post('/:id/enable-swapping', authMiddleware.requireAuth(), bookingController.enableSwapping);
  router.post('/:id/disable-swapping', authMiddleware.requireAuth(), bookingController.disableSwapping);

  return router;
}