import { SwapProposerMonitoringService } from '../SwapProposerMonitoringService';
import { logger } from '../../../utils/logger';

// Mock logger to avoid console output during tests
jest.mock('../../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

describe('SwapProposerMonitoringService', () => {
    let monitoringService: SwapProposerMonitoringService;

    beforeEach(() => {
        // Get fresh instance for each test
        monitoringService = SwapProposerMonitoringService.getInstance();

        // Clear any existing stats
        (monitoringService as any).joinChainStats.clear();
        (monitoringService as any).proposerLookupStats.clear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('JOIN Chain Monitoring', () => {
        it('should record JOIN chain failures correctly', () => {
            const userId = 'user123';
            const swapId = 'swap456';

            monitoringService.recordJoinChainFailure(
                userId,
                swapId,
                'null_proposer_name',
                {
                    proposerId: 'proposer789',
                    proposerName: null,
                    joinChainStatus: 'missing_user'
                }
            );

            expect(logger.error).toHaveBeenCalledWith(
                'JOIN chain failure detected',
                expect.objectContaining({
                    category: 'join_chain_failure',
                    userId,
                    swapId,
                    failureType: 'null_proposer_name',
                    requirement: '3.1'
                })
            );
        });

        it('should record JOIN chain successes correctly', () => {
            const userId = 'user123';
            const swapId = 'swap456';
            const proposerName = 'John Doe';

            monitoringService.recordJoinChainSuccess(userId, swapId, proposerName);

            expect(logger.debug).toHaveBeenCalledWith(
                'JOIN chain success recorded',
                expect.objectContaining({
                    category: 'join_chain_success',
                    userId,
                    swapId,
                    proposerName,
                    requirement: '3.1'
                })
            );
        });

        it('should generate JOIN chain health statistics', () => {
            const userId = 'user123';

            // Record some successes and failures
            monitoringService.recordJoinChainSuccess(userId, 'swap1', 'User 1');
            monitoringService.recordJoinChainSuccess(userId, 'swap2', 'User 2');
            monitoringService.recordJoinChainFailure(userId, 'swap3', 'null_proposer_name', {});

            const healthStats = monitoringService.getJoinChainHealthStats();

            expect(healthStats).toHaveLength(1);
            expect(healthStats[0]).toMatchObject({
                userId,
                totalQueries: 3,
                successfulJoins: 2,
                failedJoins: 1,
                successRate: 2 / 3
            });
        });
    });

    describe('Proposer Lookup Monitoring', () => {
        it('should record successful proposer lookups', () => {
            const swapId = 'swap123';
            const proposerId = 'proposer456';
            const proposerName = 'Jane Doe';

            monitoringService.recordProposerLookupAttempt(
                swapId,
                proposerId,
                'direct',
                true,
                proposerName
            );

            expect(logger.info).toHaveBeenCalledWith(
                'Proposer lookup successful',
                expect.objectContaining({
                    category: 'proposer_lookup_success',
                    swapId,
                    proposerId,
                    lookupMethod: 'direct',
                    proposerName,
                    requirement: '3.3'
                })
            );
        });

        it('should record failed proposer lookups', () => {
            const swapId = 'swap123';
            const proposerId = 'proposer456';
            const error = 'User not found';

            monitoringService.recordProposerLookupAttempt(
                swapId,
                proposerId,
                'fallback',
                false,
                undefined,
                error
            );

            expect(logger.warn).toHaveBeenCalledWith(
                'Proposer lookup failed',
                expect.objectContaining({
                    category: 'proposer_lookup_failure',
                    swapId,
                    proposerId,
                    lookupMethod: 'fallback',
                    error,
                    requirement: '3.4'
                })
            );
        });

        it('should generate proposer lookup success rates', () => {
            const proposerId = 'proposer123';

            // Record some successes and failures
            monitoringService.recordProposerLookupAttempt('swap1', proposerId, 'direct', true, 'User 1');
            monitoringService.recordProposerLookupAttempt('swap2', proposerId, 'direct', true, 'User 2');
            monitoringService.recordProposerLookupAttempt('swap3', proposerId, 'fallback', false, undefined, 'Not found');

            const successRates = monitoringService.getProposerLookupSuccessRates();

            expect(successRates).toHaveLength(1);
            expect(successRates[0]).toMatchObject({
                proposerId,
                totalAttempts: 3,
                successfulLookups: 2,
                failedLookups: 1,
                successRate: 2 / 3
            });
        });
    });

    describe('Missing User Relationship Monitoring', () => {
        it('should record missing user relationships with diagnostic details', () => {
            const swapId = 'swap123';
            const proposerId = 'proposer456';
            const diagnosticDetails = {
                expectedTable: 'users',
                expectedId: proposerId,
                actualResult: null,
                queryUsed: 'SELECT * FROM users WHERE id = ?'
            };

            monitoringService.recordMissingUserRelationship(
                swapId,
                proposerId,
                'user_record',
                diagnosticDetails
            );

            expect(logger.error).toHaveBeenCalledWith(
                'Missing user relationship detected',
                expect.objectContaining({
                    category: 'missing_user_relationship',
                    swapId,
                    proposerId,
                    relationshipType: 'user_record',
                    diagnosticDetails,
                    requirement: '3.2'
                })
            );
        });
    });

    describe('Diagnostic Report Generation', () => {
        it('should generate comprehensive diagnostic report', () => {
            const userId = 'user123';
            const proposerId = 'proposer456';

            // Add some test data
            monitoringService.recordJoinChainSuccess(userId, 'swap1', 'User 1');
            monitoringService.recordJoinChainFailure(userId, 'swap2', 'null_proposer_name', {});
            monitoringService.recordProposerLookupAttempt('swap1', proposerId, 'direct', true, 'User 1');
            monitoringService.recordProposerLookupAttempt('swap2', proposerId, 'fallback', false, undefined, 'Not found');

            const report = monitoringService.generateDiagnosticReport();

            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('overallHealth');
            expect(report).toHaveProperty('joinChainStats');
            expect(report).toHaveProperty('proposerLookupStats');
            expect(report).toHaveProperty('criticalIssues');
            expect(report).toHaveProperty('recommendations');

            expect(report.overallHealth).toHaveProperty('joinChainSuccessRate');
            expect(report.overallHealth).toHaveProperty('proposerLookupSuccessRate');
            expect(report.overallHealth).toHaveProperty('healthStatus');
        });

        it('should identify critical issues when success rates are low', () => {
            const userId = 'user123';
            const proposerId = 'proposer456';

            // Add mostly failures to trigger critical issues
            for (let i = 0; i < 10; i++) {
                monitoringService.recordJoinChainFailure(userId, `swap${i}`, 'null_proposer_name', {});
                monitoringService.recordProposerLookupAttempt(`swap${i}`, proposerId, 'fallback', false, undefined, 'Not found');
            }

            const report = monitoringService.generateDiagnosticReport();

            expect(report.overallHealth.healthStatus).toBe('critical');
            expect(report.criticalIssues.length).toBeGreaterThan(0);
            expect(report.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('Health Status Determination', () => {
        it('should return healthy status for good success rates', () => {
            const userId = 'user123';
            const proposerId = 'proposer456';

            // Add mostly successes
            for (let i = 0; i < 10; i++) {
                monitoringService.recordJoinChainSuccess(userId, `swap${i}`, `User ${i}`);
                monitoringService.recordProposerLookupAttempt(`swap${i}`, proposerId, 'direct', true, `User ${i}`);
            }

            const report = monitoringService.generateDiagnosticReport();

            expect(report.overallHealth.healthStatus).toBe('healthy');
            expect(report.criticalIssues).toHaveLength(0);
        });

        it('should return degraded status for moderate success rates', () => {
            const userId = 'user123';
            const proposerId = 'proposer456';

            // Add mixed results (70% success rate)
            for (let i = 0; i < 7; i++) {
                monitoringService.recordJoinChainSuccess(userId, `swap${i}`, `User ${i}`);
                monitoringService.recordProposerLookupAttempt(`swap${i}`, proposerId, 'direct', true, `User ${i}`);
            }
            for (let i = 7; i < 10; i++) {
                monitoringService.recordJoinChainFailure(userId, `swap${i}`, 'null_proposer_name', {});
                monitoringService.recordProposerLookupAttempt(`swap${i}`, proposerId, 'fallback', false, undefined, 'Not found');
            }

            const report = monitoringService.generateDiagnosticReport();

            expect(report.overallHealth.healthStatus).toBe('degraded');
        });
    });
});