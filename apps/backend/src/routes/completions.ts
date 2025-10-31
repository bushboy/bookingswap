import { Router } from 'express';
import { CompletionController } from '../controllers/CompletionController';
import { AuthMiddleware } from '../middleware/auth';
import {
    validateCompletionId,
    validateCompletionValidationRequest
} from '../middleware/completionValidation';

/**
 * Routes for completion operations
 * Provides REST API endpoints for completion audit and validation
 * 
 * Requirements: 1.1, 5.1, 6.1
 */
export function createCompletionRoutes(
    completionController: CompletionController,
    authMiddleware: AuthMiddleware
): Router {
    const router = Router();

    // All completion routes require authentication
    router.use(authMiddleware.requireAuth());

    /**
     * GET /api/completions/:completionId/audit
     * Get completion audit record by completion ID
     */
    router.get('/:completionId/audit',
        validateCompletionId,
        completionController.getCompletionAudit
    );

    /**
     * POST /api/completions/validate
     * Validate completion consistency for specific entities
     */
    router.post('/validate',
        validateCompletionValidationRequest,
        completionController.validateCompletionConsistency
    );

    return router;
}