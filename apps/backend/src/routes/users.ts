import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { AuthMiddleware } from '../middleware/auth';

export function createUserRoutes(
  userController: UserController,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // All user routes require authentication
  router.use(authMiddleware.requireAuth());

  // User profile management
  router.get('/profile', userController.getProfile);
  router.put('/profile', userController.updateProfile);
  router.put('/wallet', userController.updateWallet);

  // User dashboard and statistics
  router.get('/dashboard', userController.getDashboard);
  router.get('/statistics', userController.getStatistics);

  // User transaction history
  router.get('/history', userController.getTransactionHistory);

  return router;
}