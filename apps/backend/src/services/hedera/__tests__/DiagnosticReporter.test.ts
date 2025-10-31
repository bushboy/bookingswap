import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client, AccountId } from '@hashgraph/sdk';
import { DiagnosticReporter, DiagnosticReport, DiagnosticConfig } from '../DiagnosticReporter';
import { HederaService } from '../HederaService';
import { AccountPermissionValidator, AccountPermissionReport } from '../AccountPermissionValidator';
import { NFTTestSuite, NFTTestResult } from '../NFTTestSuite';
import { HederaErrorReporter, HederaErrorDetails, HederaErrorType } from '../HederaErrorReporter';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the dependencies
vi.mock('../AccountPermissionValidator');
vi.mock('../NFTTestSuite');
vi.mock('../HederaErrorReporter');

describe('DiagnosticReporter', () => {
  let diagnosticReporter: DiagnosticReporter;
  let mockHederaService: any;
  let mockClient: any;
  let mockOperatorAccountId: any;
  let mockPermissionValidator: any;
  let mockTestSuite: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock objects
    mockClient = {
      execute: vi.fn(),
    };

    mockOperatorAccountId = {
      toString: vi.fn().mockReturnValue('0.0.12345'),
    };

    mockHederaService = {
      client: mockClient,
      operatorAccountId: mockOperatorAccountId,
    };

    // Mock AccountPermissionValidator
    mockPermissionValidator = {
      validateAccount: vi.fn(),
    };
    vi.mocked(AccountPermissionValidator).mockImplementation(() => mockPermissionValidator);

    // Mock NFTTestSuite
    mockTestSuite = {
      runFullTestSuite: vi.fn(),
      testTokenCreation: vi.fn(),
    };
    vi.mocked(NFTTestSuite).mockImplementation(() => mockTestSuite);

    // Create DiagnosticReporter instance
    diagnosticReporter = new DiagnosticReporter(mockHederaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateReport', () => {
    it('should generate a comprehensive diagnostic report', async () => {
      // Mock successful account validation
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: ['Account is properly configured for NFT operations'],
        validationTimestamp: new Date(),
      };

      mockPermissionValidator.validateAccount.mockResolvedValue(mockAccountReport);

      // Mock successful test results
      const mockTestResults: NFTTestResult[] = [
        {
          testName: 'Token Creation Test',
          success: true,
          transactionId: 'test-tx-1',
          duration: 1500,
          details: {
            tokenId: '0.0.67890',
            tokenName: 'Test NFT Token',
          },
        },
        {
          testName: 'NFT Minting Test',
          success: true,
          transactionId: 'test-tx-2',
          duration: 1200,
          details: {
            tokenId: '0.0.67890',
            serialNumber: 1,
          },
        },
      ];

      mockTestSuite.runFullTestSuite.mockResolvedValue(mockTestResults);

      const report = await diagnosticReporter.generateReport();

      expect(report).toBeDefined();
      expect(report.reportId).toMatch(/^diag-\d+-[a-z0-9]+$/);
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.environment.accountId).toBe('0.0.12345');
      expect(report.environment.network).toBe('testnet');
      expect(report.accountStatus).toBe(mockAccountReport);
      expect(report.testResults).toBe(mockTestResults);
      expect(report.summary.overallHealth).toBe('healthy');
      expect(report.summary.passedTests).toBe(2);
      expect(report.summary.failedTests).toBe(0);
      expect(report.summary.totalTests).toBe(2);
      expect(report.recommendations).toContain('All diagnostic checks passed successfully.');
    });

    it('should handle account validation failures', async () => {
      // Mock account validation failure
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: false,
        balance: {
          hbar: '2',
          sufficient: false,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: false,
          hasAdminKey: false,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: false,
          canManageToken: false,
        },
        tokenExists: false,
        canMintNFTs: false,
        canTransferNFTs: false,
        issues: ['Insufficient HBAR balance: 2 HBAR (minimum required: 5 HBAR)'],
        recommendations: ['Add at least 3 HBAR to meet minimum balance requirements'],
        validationTimestamp: new Date(),
      };

      mockPermissionValidator.validateAccount.mockResolvedValue(mockAccountReport);

      // Mock failed test results
      const mockTestResults: NFTTestResult[] = [
        {
          testName: 'Token Creation Test',
          success: false,
          error: {
            errorType: HederaErrorType.INSUFFICIENT_BALANCE,
            errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
            errorMessage: 'Insufficient account balance',
            timestamp: new Date(),
            operation: 'TOKEN_CREATION',
            context: {},
            retryable: false,
          } as HederaErrorDetails,
          duration: 500,
          details: {
            errorMessage: 'Insufficient account balance',
          },
        },
      ];

      mockTestSuite.runFullTestSuite.mockResolvedValue(mockTestResults);

      const report = await diagnosticReporter.generateReport();

      expect(report.summary.overallHealth).toBe('critical');
      expect(report.summary.criticalIssues).toBeGreaterThan(0);
      expect(report.summary.failedTests).toBe(1);
      expect(report.recommendations).toContain('Account balance is insufficient (2 HBAR).');
      expect(report.recommendations).toContain('1 out of 1 tests failed.');
    });

    it('should handle test suite failures', async () => {
      // Mock successful account validation
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      mockPermissionValidator.validateAccount.mockResolvedValue(mockAccountReport);

      // Mock test suite failure
      mockTestSuite.runFullTestSuite.mockRejectedValue(new Error('Test suite execution failed'));

      const report = await diagnosticReporter.generateReport();

      expect(report.testResults).toHaveLength(1);
      expect(report.testResults[0].success).toBe(false);
      expect(report.testResults[0].testName).toBe('Diagnostic Test Suite');
      expect(report.testResults[0].details.message).toBe('Failed to execute test suite');
    });

    it('should handle complete validation failure', async () => {
      // Mock permission validator failure
      mockPermissionValidator.validateAccount.mockRejectedValue(new Error('Validation failed'));

      // Mock test suite failure
      mockTestSuite.runFullTestSuite.mockRejectedValue(new Error('Test suite failed'));

      const report = await diagnosticReporter.generateReport();

      expect(report.accountStatus.accountExists).toBe(false);
      expect(report.accountStatus.canMintNFTs).toBe(false);
      expect(report.accountStatus.issues).toContain('Failed to validate permissions: Validation failed');
      expect(report.summary.overallHealth).toBe('critical');
    });
  });

  describe('configuration management', () => {
    it('should use default configuration', () => {
      const defaultReporter = new DiagnosticReporter(mockHederaService);
      const config = (defaultReporter as any).config;

      expect(config.includeFullTestSuite).toBe(true);
      expect(config.includeFailureScenarios).toBe(false);
      expect(config.maxRecentErrors).toBe(10);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<DiagnosticConfig> = {
        includeFullTestSuite: false,
        includeFailureScenarios: true,
        maxRecentErrors: 5,
        tokenId: '0.0.67890',
        customRecommendations: ['Custom recommendation'],
      };

      const customReporter = new DiagnosticReporter(mockHederaService, customConfig);
      const config = (customReporter as any).config;

      expect(config.includeFullTestSuite).toBe(false);
      expect(config.includeFailureScenarios).toBe(true);
      expect(config.maxRecentErrors).toBe(5);
      expect(config.tokenId).toBe('0.0.67890');
      expect(config.customRecommendations).toEqual(['Custom recommendation']);
    });

    it('should update configuration', () => {
      diagnosticReporter.updateConfig({
        includeFullTestSuite: false,
        tokenId: '0.0.99999',
      });

      const config = (diagnosticReporter as any).config;
      expect(config.includeFullTestSuite).toBe(false);
      expect(config.tokenId).toBe('0.0.99999');
      expect(config.includeFailureScenarios).toBe(false); // Should retain original value
    });
  });

  describe('test execution modes', () => {
    it('should run basic test when full test suite is disabled', async () => {
      diagnosticReporter.updateConfig({ includeFullTestSuite: false });

      // Mock successful account validation
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      mockPermissionValidator.validateAccount.mockResolvedValue(mockAccountReport);

      // Mock basic test result
      const mockBasicTest: NFTTestResult = {
        testName: 'Token Creation Test',
        success: true,
        transactionId: 'basic-tx-1',
        duration: 800,
        details: {
          tokenId: '0.0.67890',
        },
      };

      mockTestSuite.testTokenCreation.mockResolvedValue(mockBasicTest);

      const report = await diagnosticReporter.generateReport();

      expect(mockTestSuite.runFullTestSuite).not.toHaveBeenCalled();
      expect(mockTestSuite.testTokenCreation).toHaveBeenCalled();
      expect(report.testResults).toHaveLength(1);
      expect(report.testResults[0]).toBe(mockBasicTest);
    });
  });

  describe('recent error management', () => {
    it('should add and track recent errors', () => {
      const error1: HederaErrorDetails = {
        errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
        errorMessage: 'Error 1',
        timestamp: new Date(),
        operation: 'TEST_OP_1',
        context: {},
        errorType: HederaErrorType.INSUFFICIENT_BALANCE,
        retryable: false,
      };

      const error2: HederaErrorDetails = {
        errorCode: 'INVALID_TOKEN_ID',
        errorMessage: 'Error 2',
        timestamp: new Date(),
        operation: 'TEST_OP_2',
        context: {},
        errorType: HederaErrorType.INVALID_TOKEN_ID,
        retryable: false,
      };

      diagnosticReporter.addRecentError(error1);
      diagnosticReporter.addRecentError(error2);

      const recentErrors = (diagnosticReporter as any).recentErrors;
      expect(recentErrors).toHaveLength(2);
      expect(recentErrors[0]).toBe(error1);
      expect(recentErrors[1]).toBe(error2);
    });

    it('should limit recent errors to maxRecentErrors', () => {
      diagnosticReporter.updateConfig({ maxRecentErrors: 2 });

      const errors = Array.from({ length: 5 }, (_, i) => ({
        errorCode: `ERROR_${i}`,
        errorMessage: `Error ${i}`,
        timestamp: new Date(),
        operation: `TEST_OP_${i}`,
        context: {},
        errorType: HederaErrorType.UNKNOWN,
        retryable: false,
      }));

      errors.forEach(error => diagnosticReporter.addRecentError(error));

      const recentErrors = (diagnosticReporter as any).recentErrors;
      expect(recentErrors).toHaveLength(2);
      expect(recentErrors[0].errorMessage).toBe('Error 3'); // Should keep last 2
      expect(recentErrors[1].errorMessage).toBe('Error 4');
    });

    it('should clear recent errors', () => {
      const error: HederaErrorDetails = {
        errorCode: 'TEST_ERROR',
        errorMessage: 'Test error',
        timestamp: new Date(),
        operation: 'TEST_OP',
        context: {},
        errorType: HederaErrorType.UNKNOWN,
        retryable: false,
      };

      diagnosticReporter.addRecentError(error);
      expect((diagnosticReporter as any).recentErrors).toHaveLength(1);

      diagnosticReporter.clearRecentErrors();
      expect((diagnosticReporter as any).recentErrors).toHaveLength(0);
    });
  });

  describe('recommendation generation', () => {
    it('should include custom recommendations from config', async () => {
      const customRecommendations = ['Custom recommendation 1', 'Custom recommendation 2'];
      diagnosticReporter.updateConfig({ customRecommendations });

      // Mock successful validation and tests
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      mockPermissionValidator.validateAccount.mockResolvedValue(mockAccountReport);
      mockTestSuite.runFullTestSuite.mockResolvedValue([]);

      const report = await diagnosticReporter.generateReport();

      expect(report.recommendations).toContain('Custom recommendation 1');
      expect(report.recommendations).toContain('Custom recommendation 2');
    });

    it('should generate recommendations based on recent errors', async () => {
      // Add recent errors
      const balanceError: HederaErrorDetails = {
        errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
        errorMessage: 'Balance error',
        timestamp: new Date(),
        operation: 'TEST_OP',
        context: {},
        errorType: HederaErrorType.INSUFFICIENT_BALANCE,
        retryable: false,
      };

      const associationError: HederaErrorDetails = {
        errorCode: 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT',
        errorMessage: 'Association error',
        timestamp: new Date(),
        operation: 'TEST_OP',
        context: {},
        errorType: HederaErrorType.TOKEN_NOT_ASSOCIATED,
        retryable: false,
      };

      diagnosticReporter.addRecentError(balanceError);
      diagnosticReporter.addRecentError(associationError);

      // Mock successful validation and tests
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      mockPermissionValidator.validateAccount.mockResolvedValue(mockAccountReport);
      mockTestSuite.runFullTestSuite.mockResolvedValue([]);

      const report = await diagnosticReporter.generateReport();

      expect(report.recommendations.some(r => r.includes('insufficient account balance'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('token association issues'))).toBe(true);
    });

    it('should generate recommendations for failed tests', async () => {
      // Mock account validation
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      mockPermissionValidator.validateAccount.mockResolvedValue(mockAccountReport);

      // Mock failed tests
      const failedTests: NFTTestResult[] = [
        {
          testName: 'Balance Test',
          success: false,
          error: {
            errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
            errorMessage: 'Insufficient balance',
            timestamp: new Date(),
            operation: 'TEST',
            context: {},
            errorType: HederaErrorType.INSUFFICIENT_BALANCE,
            retryable: false,
          } as HederaErrorDetails,
          duration: 100,
          details: {},
        },
        {
          testName: 'Signature Test',
          success: false,
          error: {
            errorCode: 'INVALID_SIGNATURE',
            errorMessage: 'Invalid signature',
            timestamp: new Date(),
            operation: 'TEST',
            context: {},
            errorType: HederaErrorType.INVALID_SIGNATURE,
            retryable: false,
          } as HederaErrorDetails,
          duration: 100,
          details: {},
        },
      ];

      mockTestSuite.runFullTestSuite.mockResolvedValue(failedTests);

      const report = await diagnosticReporter.generateReport();

      expect(report.recommendations.some(r => r.includes('2 out of 2 tests failed'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('insufficient balance'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('invalid signature'))).toBe(true);
    });
  });

  describe('report export', () => {
    it('should export report as JSON', async () => {
      const mockReport: DiagnosticReport = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        reportId: 'test-report-123',
        environment: {
          network: 'testnet',
          accountId: '0.0.12345',
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
        accountStatus: {} as AccountPermissionReport,
        recentErrors: [],
        testResults: [],
        recommendations: ['Test recommendation'],
        summary: {
          overallHealth: 'healthy',
          criticalIssues: 0,
          warningIssues: 0,
          passedTests: 1,
          failedTests: 0,
          totalTests: 1,
        },
      };

      const jsonExport = await diagnosticReporter.exportReport(mockReport, 'json');
      const parsedReport = JSON.parse(jsonExport);

      expect(parsedReport.reportId).toBe('test-report-123');
      expect(parsedReport.environment.network).toBe('testnet');
      expect(parsedReport.recommendations).toEqual(['Test recommendation']);
    });

    it('should export report as markdown', async () => {
      const mockReport: DiagnosticReport = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        reportId: 'test-report-123',
        environment: {
          network: 'testnet',
          accountId: '0.0.12345',
          tokenId: '0.0.67890',
          topicId: '0.0.11111',
          clientVersion: '1.0.0',
          nodeVersion: 'v18.0.0',
          timestamp: new Date('2024-01-01T00:00:00Z'),
        },
        accountStatus: {
          accountId: '0.0.12345',
          accountExists: true,
          balance: {
            hbar: '15',
            sufficient: true,
            minimumRequired: '5',
            recommendedAmount: '10',
          },
          tokenPermissions: {
            hasSupplyKey: true,
            hasAdminKey: true,
            hasWipeKey: false,
            hasFreezeKey: false,
            hasKycKey: false,
            hasPauseKey: false,
            canMintNFTs: true,
            canManageToken: true,
          },
          tokenExists: true,
          canMintNFTs: true,
          canTransferNFTs: true,
          issues: ['Test issue'],
          recommendations: [],
          validationTimestamp: new Date(),
        },
        recentErrors: [
          {
            errorCode: 'TEST_ERROR',
            errorMessage: 'Test error message',
            timestamp: new Date('2024-01-01T00:00:00Z'),
            operation: 'TEST_OPERATION',
            context: {},
            errorType: HederaErrorType.UNKNOWN,
            retryable: false,
          },
        ],
        testResults: [
          {
            testName: 'Test 1',
            success: true,
            duration: 1000,
            details: {},
          },
          {
            testName: 'Test 2',
            success: false,
            error: {
              errorCode: 'TEST_ERROR',
              errorMessage: 'Test failed',
              timestamp: new Date(),
              operation: 'TEST',
              context: {},
              errorType: HederaErrorType.UNKNOWN,
              retryable: false,
            } as HederaErrorDetails,
            duration: 500,
            details: {},
          },
        ],
        recommendations: ['Recommendation 1', 'Recommendation 2'],
        summary: {
          overallHealth: 'warning',
          criticalIssues: 1,
          warningIssues: 1,
          passedTests: 1,
          failedTests: 1,
          totalTests: 2,
        },
      };

      const markdownExport = await diagnosticReporter.exportReport(mockReport, 'markdown');

      expect(markdownExport).toContain('# Hedera NFT Diagnostic Report');
      expect(markdownExport).toContain('**Report ID:** test-report-123');
      expect(markdownExport).toContain('**Overall Health:** WARNING');
      expect(markdownExport).toContain('- **Network:** testnet');
      expect(markdownExport).toContain('- **Token ID:** 0.0.67890');
      expect(markdownExport).toContain('- **Topic ID:** 0.0.11111');
      expect(markdownExport).toContain('- **Critical Issues:** 1');
      expect(markdownExport).toContain('- **Balance:** 15 HBAR (Sufficient: true)');
      expect(markdownExport).toContain('- ✅ **Test 1** (1000ms)');
      expect(markdownExport).toContain('- ❌ **Test 2** (500ms)');
      expect(markdownExport).toContain('- **TEST_OPERATION** (2024-01-01T00:00:00.000Z)');
      expect(markdownExport).toContain('- Recommendation 1');
      expect(markdownExport).toContain('- Recommendation 2');
    });

    it('should throw error for unsupported export format', async () => {
      const mockReport = {} as DiagnosticReport;

      await expect(
        diagnosticReporter.exportReport(mockReport, 'xml' as any)
      ).rejects.toThrow('Unsupported export format: xml');
    });
  });

  describe('summary calculation', () => {
    it('should calculate healthy summary', () => {
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      const mockTestResults: NFTTestResult[] = [
        { testName: 'Test 1', success: true, duration: 100, details: {} },
        { testName: 'Test 2', success: true, duration: 200, details: {} },
      ];

      const summary = (diagnosticReporter as any).calculateSummary(mockAccountReport, mockTestResults);

      expect(summary.overallHealth).toBe('healthy');
      expect(summary.criticalIssues).toBe(0);
      expect(summary.warningIssues).toBe(0);
      expect(summary.passedTests).toBe(2);
      expect(summary.failedTests).toBe(0);
      expect(summary.totalTests).toBe(2);
    });

    it('should calculate critical summary', () => {
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: false,
        balance: {
          hbar: '2',
          sufficient: false,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: false,
          hasAdminKey: false,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: false,
          canManageToken: false,
        },
        tokenExists: false,
        canMintNFTs: false,
        canTransferNFTs: false,
        issues: ['Issue 1', 'Issue 2'],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      const mockTestResults: NFTTestResult[] = [
        { testName: 'Test 1', success: false, duration: 100, details: {} },
        { testName: 'Test 2', success: false, duration: 200, details: {} },
      ];

      const summary = (diagnosticReporter as any).calculateSummary(mockAccountReport, mockTestResults);

      expect(summary.overallHealth).toBe('critical');
      expect(summary.criticalIssues).toBeGreaterThan(0);
      expect(summary.passedTests).toBe(0);
      expect(summary.failedTests).toBe(2);
      expect(summary.totalTests).toBe(2);
    });

    it('should calculate warning summary', () => {
      const mockAccountReport: AccountPermissionReport = {
        accountId: '0.0.12345',
        accountExists: true,
        balance: {
          hbar: '15',
          sufficient: true,
          minimumRequired: '5',
          recommendedAmount: '10',
        },
        tokenPermissions: {
          hasSupplyKey: true,
          hasAdminKey: true,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: true,
          canManageToken: true,
        },
        tokenExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
        validationTimestamp: new Date(),
      };

      const mockTestResults: NFTTestResult[] = [
        { testName: 'Test 1', success: true, duration: 100, details: {} },
        { testName: 'Test 2', success: false, duration: 200, details: {} },
      ];

      // Add many recent errors to trigger warning
      Array.from({ length: 10 }, (_, i) => {
        diagnosticReporter.addRecentError({
          errorCode: `ERROR_${i}`,
          errorMessage: `Error ${i}`,
          timestamp: new Date(),
          operation: 'TEST',
          context: {},
          errorType: HederaErrorType.UNKNOWN,
          retryable: false,
        });
      });

      const summary = (diagnosticReporter as any).calculateSummary(mockAccountReport, mockTestResults);

      expect(summary.overallHealth).toBe('warning');
      expect(summary.passedTests).toBe(1);
      expect(summary.failedTests).toBe(1);
    });
  });
});