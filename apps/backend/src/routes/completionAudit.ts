import { Router } from 'express';
import { SwapCompletionAuditController } from '../controllers/SwapCompletionAuditController';
import { createSwapCompletionOrchestrator } from '../services/swap/factory';
import { createNotificationService } from '../services/notification/factory';
import { HederaService } from '../services/hedera/HederaService';
import { authMiddleware } from '../middleware/auth';
import { getPool } from '../database/config';

/**
 * Routes for swap completion audit trail operations
 * Provides REST API endpoints for completion audit functionality
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

const router = Router();

// Initialize services and controller
const pool = getPool();

// Initialize Hedera service with environment variables
const hederaService = new HederaService(
    process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' || 'testnet',
    process.env.HEDERA_ACCOUNT_ID!,
    process.env.HEDERA_PRIVATE_KEY!,
    process.env.HEDERA_TOPIC_ID
);

const notificationService = createNotificationService(pool);
const completionOrchestrator = createSwapCompletionOrchestrator(
    pool,
    hederaService,
    notificationService
);
const auditController = new SwapCompletionAuditController(completionOrchestrator);

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/completions/{proposalId}/audit
 * Get completion audit record by proposal ID
 */
router.get('/:proposalId/audit', async (req, res) => {
    await auditController.getCompletionAudit(req, res);
});

/**
 * GET /api/completions/history
 * Query completion history with filtering and pagination
 */
router.get('/history', async (req, res) => {
    await auditController.getCompletionHistory(req, res);
});

/**
 * GET /api/completions/statistics
 * Get completion statistics for monitoring and reporting
 */
router.get('/statistics', async (req, res) => {
    await auditController.getCompletionStatistics(req, res);
});

/**
 * POST /api/completions/validate
 * Validate completion consistency for specific entities
 */
router.post('/validate', async (req, res) => {
    await auditController.validateCompletionConsistency(req, res);
});

/**
 * GET /api/completions/entities/{entityType}/{entityId}/audit
 * Get audit records for a specific entity (swap or booking)
 */
router.get('/entities/:entityType/:entityId/audit', async (req, res) => {
    await auditController.getEntityAuditRecords(req, res);
});

export default router;