import { Router } from 'express';
import { SwapController } from '../controllers/SwapController';
import { AuthMiddleware } from '../middleware/auth';

export function createSwapRoutes(
  swapController: SwapController,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // Browse endpoint - optional authentication for filtering
  router.get('/browse', authMiddleware.optionalAuth(), swapController.browseAvailableSwaps);

  // Public swap info endpoints (TODO: implement missing method)
  // router.get('/info/:bookingId', authMiddleware.optionalAuth(), swapController.getSwapInfoByBooking);

  // Convenience route for getting current user's swaps (must come before auth middleware to use requireAuth)
  router.get('/my-swaps', authMiddleware.requireAuth(), swapController.getUserSwaps);

  // All other swap routes require authentication
  router.use(authMiddleware.requireAuth());

  // User eligible swaps for proposal creation
  router.get('/user/eligible', swapController.getUserEligibleSwaps);

  // Enhanced swap creation endpoints
  router.post('/enhanced', swapController.createEnhancedSwap);
  router.post('/:id/proposals/enhanced', swapController.createEnhancedProposal);
  router.post('/:id/proposals/from-browse', swapController.createProposalFromBrowse);
  router.post('/:id/proposals', swapController.createProposal);

  // New enhanced swap offer endpoint using workflow service
  router.post('/:id/offers', swapController.submitSwapOffer);

  // Enhanced inline proposal endpoints for UI simplification (TODO: implement missing methods)
  // router.post('/proposals/inline', swapController.createInlineProposal);
  // router.put('/proposals/:proposalId', swapController.updateInlineProposal);
  // router.delete('/proposals/:proposalId', swapController.withdrawInlineProposal);
  // router.get('/proposals/:proposalId/status', swapController.getProposalStatus);

  // Swap listing management
  router.post('/listings', swapController.createSwapListing);

  // Swap compatibility analysis endpoint - must be before generic /:id routes
  router.get('/:sourceSwapId/compatibility/:targetSwapId', swapController.getSwapCompatibility);

  // Swap proposal management
  router.post('/', swapController.createSwapProposal);
  router.get('/cards', swapController.getUserSwapCards); // New dedicated endpoint for swap cards
  router.get('/', swapController.getUserSwaps); // Legacy endpoint
  router.get('/:id', swapController.getSwapById);
  router.delete('/:id', swapController.cancelSwap);

  // Swap response operations
  router.put('/:id/accept', swapController.acceptSwap);
  router.put('/:id/reject', swapController.rejectSwap);

  // Swap status and history
  router.get('/:id/status', swapController.getSwapStatus);

  // Booking-specific proposals
  router.get('/booking/:bookingId/proposals', swapController.getBookingProposals);
  // router.get('/by-booking/:bookingId', swapController.getSwapByBookingId); // TODO: implement missing method

  // Swap-specific proposals
  router.get('/:id/proposals', swapController.getSwapProposals);

  return router;
}