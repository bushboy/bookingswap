import { Router } from 'express';
import { SwapTargetingController } from '../controllers/SwapTargetingController';
import { AuthMiddleware } from '../middleware/auth';
import { TargetingAuthMiddleware } from '../middleware/targetingAuth';
import { applyTargetingRateLimit } from '../middleware/targetingRateLimit';
import {
    validateTargetSwap,
    validateRetargetSwap,
    validateRemoveTarget,
    validateSwapId,
    validateSwapIdWithPagination,
    validateUserIdWithPagination
} from '../validation/targeting-validation';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';

export function createTargetingRoutes(
    targetingController: SwapTargetingController,
    authMiddleware: AuthMiddleware,
    authService: AuthService,
    userRepository: UserRepository
): Router {
    const router = Router();

    // Targeting operations with enhanced authentication and validation
    router.post(
        '/swaps/:id/target',
        TargetingAuthMiddleware.allowCrossUserTargeting(authService, userRepository, 'target'),
        validateTargetSwap,
        applyTargetingRateLimit('TARGET_SWAP'),
        targetingController.targetSwap
    );

    router.put(
        '/swaps/:id/retarget',
        TargetingAuthMiddleware.requireTargetingOwnership(authService, userRepository, 'retarget'),
        validateRetargetSwap,
        applyTargetingRateLimit('RETARGET_SWAP'),
        targetingController.retargetSwap
    );

    router.delete(
        '/swaps/:id/target',
        TargetingAuthMiddleware.requireTargetingOwnership(authService, userRepository, 'remove_target'),
        validateRemoveTarget,
        applyTargetingRateLimit('REMOVE_TARGET'),
        targetingController.removeTarget
    );

    // Targeting status and validation endpoints with read-only authentication
    router.get(
        '/swaps/:id/targeting-status',
        TargetingAuthMiddleware.readOnlyTargeting(authService, userRepository, 'get_status'),
        validateSwapId,
        applyTargetingRateLimit('GET_STATUS'),
        targetingController.getTargetingStatus
    );

    router.get(
        '/swaps/:id/can-target',
        TargetingAuthMiddleware.readOnlyTargeting(authService, userRepository, 'validate'),
        validateSwapId,
        applyTargetingRateLimit('GET_STATUS'),
        targetingController.canTargetSwap
    );

    // Targeting history and query endpoints with cross-user access
    router.get(
        '/swaps/:id/targeting-history',
        TargetingAuthMiddleware.readOnlyTargeting(authService, userRepository, 'get_history'),
        validateSwapIdWithPagination,
        applyTargetingRateLimit('GET_HISTORY'),
        targetingController.getTargetingHistory
    );

    router.get(
        '/users/:id/targeting-activity',
        TargetingAuthMiddleware.readOnlyTargeting(authService, userRepository, 'get_history'),
        validateUserIdWithPagination,
        applyTargetingRateLimit('GET_HISTORY'),
        targetingController.getUserTargetingActivity
    );

    router.get(
        '/swaps/:id/targeted-by',
        TargetingAuthMiddleware.readOnlyTargeting(authService, userRepository, 'get_history'),
        validateSwapIdWithPagination,
        applyTargetingRateLimit('GET_HISTORY'),
        targetingController.getSwapsTargetingMe
    );

    return router;
}