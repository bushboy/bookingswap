import { Router } from 'express';
import { ProposalController } from '../controllers/ProposalController';
import { AuthMiddleware } from '../middleware/auth';
import {
    validateProposalId,
    validateUserId,
    validateRejectionRequest,
    validateProposalResponsesQuery
} from '../middleware/proposalValidation';

export function createProposalRoutes(
    proposalController: ProposalController,
    authMiddleware: AuthMiddleware
): Router {
    const router = Router();

    // All proposal routes require authentication
    router.use(authMiddleware.requireAuth());

    // Convenience route for getting received proposals (must come before parameterized routes)
    router.get('/received',
        proposalController.getReceivedProposals
    );

    // Proposal action endpoints with validation
    router.post('/:proposalId/accept',
        validateProposalId,
        proposalController.acceptProposal
    );

    router.post('/:proposalId/reject',
        validateProposalId,
        validateRejectionRequest,
        proposalController.rejectProposal
    );

    // Proposal status endpoint with validation
    router.get('/:proposalId/status',
        validateProposalId,
        proposalController.getProposalStatus
    );

    // Get all proposals for a specific user
    router.get('/user/:userId',
        validateUserId,
        proposalController.getUserProposals
    );

    // Get proposal status for a specific booking and user
    router.get('/status',
        proposalController.getProposalStatusForBooking
    );

    // Create a new proposal
    router.post('/',
        proposalController.createProposal
    );

    return router;
}

export function createUserProposalRoutes(
    proposalController: ProposalController,
    authMiddleware: AuthMiddleware
): Router {
    const router = Router();

    // All user proposal routes require authentication
    router.use(authMiddleware.requireAuth());

    // User proposal responses endpoint with validation
    router.get('/:userId/proposal-responses',
        validateUserId,
        validateProposalResponsesQuery,
        proposalController.getUserProposalResponses
    );

    return router;
}