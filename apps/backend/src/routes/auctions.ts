import { Router } from 'express';
import { SwapController } from '../controllers/SwapController';
import { AuthMiddleware } from '../middleware/auth';

export function createAuctionRoutes(
  swapController: SwapController,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // All auction routes require authentication
  router.use(authMiddleware.requireAuth());

  // Auction management endpoints
  router.get('/:id', swapController.getAuctionDetails);
  router.post('/:id/proposals', swapController.submitAuctionProposal);
  router.put('/:id/select-winner', swapController.selectAuctionWinner);
  router.get('/user/:userId', swapController.getUserAuctions);

  return router;
}