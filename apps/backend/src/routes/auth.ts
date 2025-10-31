import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthMiddleware } from '../middleware/auth';
import { 
  passwordResetRateLimit, 
  passwordResetCompletionRateLimit, 
  tokenValidationRateLimit 
} from '../middleware/rateLimiting';

export function createAuthRoutes(
  authController: AuthController,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // Public routes
  router.post('/challenge', authController.generateChallenge);
  router.post('/login', authController.login); // Wallet-based login
  router.post('/register', authController.register); // Email/password registration
  router.post('/email-login', authController.emailLogin); // Email/password login
  
  // Password reset routes (public) with rate limiting
  router.post('/request-password-reset', passwordResetRateLimit, authController.requestPasswordReset);
  router.post('/reset-password', passwordResetCompletionRateLimit, authController.resetPassword);
  router.post('/validate-reset-token', tokenValidationRateLimit, authController.validatePasswordResetToken);

  // Protected routes
  router.post('/refresh', authMiddleware.requireAuth(), authController.refreshToken);
  router.get('/validate', authMiddleware.requireAuth(), authController.validateToken);
  router.get('/debug-wallet', authMiddleware.requireAuth(), authController.debugWalletStatus);

  return router;
}