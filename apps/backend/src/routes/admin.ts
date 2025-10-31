import { Router } from 'express';
import { Pool } from 'pg';
import { AdminController } from '../controllers/AdminController';
import { AdminService } from '../services/admin/AdminService';
import { adminAuth, requirePermission } from '../middleware/adminAuth';
import { BookingRepository } from '../database/repositories/BookingRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { UserRepository } from '../database/repositories/UserRepository';
import { createHederaService } from '../services/hedera/factory';

// Factory function to create admin router with dependencies
export function createAdminRouter(dbPool: Pool): Router {
  const router = Router();

  // Initialize dependencies
  const bookingRepository = new BookingRepository(dbPool);
  const swapRepository = new SwapRepository(dbPool);
  const userRepository = new UserRepository(dbPool);
  const hederaService = createHederaService();

  const adminService = new AdminService(
    bookingRepository,
    swapRepository,
    userRepository,
    hederaService
  );

  const adminController = new AdminController(adminService);

// Apply admin authentication to all routes
router.use(adminAuth);

// Platform statistics and monitoring
router.get(
  '/statistics',
  requirePermission('view_statistics'),
  adminController.getStatistics.bind(adminController)
);

router.get(
  '/activity',
  requirePermission('view_statistics'),
  adminController.getRecentActivity.bind(adminController)
);

// Dispute management
router.get(
  '/disputes',
  requirePermission('view_disputes'),
  adminController.getDisputes.bind(adminController)
);

router.post(
  '/disputes',
  requirePermission('view_disputes'),
  adminController.createDispute.bind(adminController)
);

router.put(
  '/disputes/:disputeId/resolve',
  requirePermission('resolve_disputes'),
  adminController.resolveDispute.bind(adminController)
);

// User management
router.post(
  '/users/:userId/flag',
  requirePermission('flag_users'),
  adminController.flagUser.bind(adminController)
);

router.delete(
  '/users/:userId/flag',
  requirePermission('flag_users'),
  adminController.unflagUser.bind(adminController)
);

// Blockchain investigation
router.get(
  '/transactions/:transactionId/investigate',
  requirePermission('view_transactions'),
  adminController.investigateTransaction.bind(adminController)
);

// System maintenance (super admin only)
router.post(
  '/maintenance/enable',
  requirePermission('system_maintenance'),
  adminController.enableMaintenanceMode.bind(adminController)
);

router.post(
  '/maintenance/disable',
  requirePermission('system_maintenance'),
  adminController.disableMaintenanceMode.bind(adminController)
);

  return router;
}

// For backward compatibility, export a default function that requires dbPool
export default createAdminRouter;