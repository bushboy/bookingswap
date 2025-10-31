import { Router } from 'express';
import { SwapController } from '../controllers/SwapController';
import { AuthMiddleware } from '../middleware/auth';

export function createPaymentRoutes(
  swapController: SwapController,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // All payment routes require authentication
  router.use(authMiddleware.requireAuth());

  // Payment processing endpoints
  router.post('/cash-offer', swapController.submitCashOffer);
  router.get('/methods', swapController.getUserPaymentMethods);
  router.post('/escrow', swapController.createEscrowAccount);
  router.put('/escrow/:id/release', swapController.releaseEscrowFunds);
  
  // Transaction management
  router.get('/transactions/:id/status', swapController.getPaymentTransactionStatus);
  router.get('/transactions/:id/receipt', swapController.generatePaymentReceipt);

  return router;
}