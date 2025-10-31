import {
  Client,
  AccountId,
} from '@hashgraph/sdk';
import { logger } from '../../utils/logger';
import { HederaErrorReporter, HederaErrorDetails } from './HederaErrorReporter';
import { AccountPermissionValidator, AccountPermissionReport } from './AccountPermissionValidator';
import { NFTTestSuite, NFTTestResult } from './NFTTestSuite';
import { HederaService } from './HederaService';

/**
 * Environment information for diagnostic reporting
 */
export interface DiagnosticEnvironment {
  network: string;
  accountId: string;
  tokenId?: string;
  topicId?: string;
  clientVersion?: string;
  nodeVersion?: string;
  timestamp: Date;
}

/**
 * Comprehensive diagnostic report structure
 */
export interface DiagnosticReport {
  timestamp: Date;
  reportId: string;
  environment: DiagnosticEnvironment;
  accountStatus: AccountPermissionReport;
  recentErrors: HederaErrorDetails[];
  testResults: NFTTestResult[];
  recommendations: string[];
  summary: {
    overallHealth: 'healthy' | 'warning' | 'critical';
    criticalIssues: number;
    warningIssues: number;
    passedTests: number;
    failedTests: number;
    totalTests: number;
  };
}

/**
 * Configuration for diagnostic reporting
 */
export interface DiagnosticConfig {
  includeFullTestSuite: boolean;
  includeFailureScenarios: boolean;
  maxRecentErrors: number;
  tokenId?: string;
  customRecommendations?: string[];
}

/**
 * Diagnostic reporter for comprehensive Hedera NFT system analysis
 * Integrates error reporting, permission validation, and testing capabilities
 * Requirements: 2.5, 4.4
 */
export class DiagnosticReporter {
  private hederaService: HederaService;
  private client: Client;
  private operatorAccountId: AccountId;
  private permissionValidator: AccountPermissionValidator;
  private testSuite: NFTTestSuite;
  private recentErrors: HederaErrorDetails[] = [];
  private config: DiagnosticConfig;

  constructor(
    hederaService: HederaService,
    config: Partial<DiagnosticConfig> = {}
  ) {
    this.hederaService = hederaService;
    this.client = hederaService['client'];
    this.operatorAccountId = hederaService['operatorAccountId'];
    this.permissionValidator = new AccountPermissionValidator(this.client, this.operatorAccountId);
    this.testSuite = new NFTTestSuite(hederaService);
    
    // Default configuration
    this.config = {
      includeFullTestSuite: true,
      includeFailureScenarios: false,
      maxRecentErrors: 10,
      ...config,
    };
  }

  /**
   * Generate comprehensive diagnostic report
   * Requirements: 2.5, 4.4
   */
  async generateReport(): Promise<DiagnosticReport> {
    const timestamp = new Date();
    const reportId = this.generateReportId();

    logger.info('Starting diagnostic report generation', {
      reportId,
      timestamp: timestamp.toISOString(),
      config: this.config,
    });

    try {
      // Gather environment information
      const environment = await this.gatherEnvironmentInfo();

      // Validate account permissions
      const accountStatus = await this.validateAccountPermissions();

      // Run diagnostic tests
      const testResults = await this.runDiagnosticTests();

      // Generate recommendations based on findings
      const recommendations = this.generateRecommendations(accountStatus, testResults);

      // Calculate summary metrics
      const summary = this.calculateSummary(accountStatus, testResults);

      const report: DiagnosticReport = {
        timestamp,
        reportId,
        environment,
        accountStatus,
        recentErrors: this.recentErrors.slice(-this.config.maxRecentErrors),
        testResults,
        recommendations,
        summary,
      };

      logger.info('Diagnostic report generated successfully', {
        reportId,
        overallHealth: summary.overallHealth,
        criticalIssues: summary.criticalIssues,
        warningIssues: summary.warningIssues,
        totalTests: summary.totalTests,
      });

      return report;
    } catch (error) {
      logger.error('Failed to generate diagnostic report', {
        reportId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `diag-${timestamp}-${random}`;
  }

  /**
   * Gather environment information
   */
  private async gatherEnvironmentInfo(): Promise<DiagnosticEnvironment> {
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    return {
      network,
      accountId: this.operatorAccountId.toString(),
      tokenId: this.config.tokenId,
      topicId: process.env.HEDERA_TOPIC_ID,
      clientVersion: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version,
      timestamp: new Date(),
    };
  }

  /**
   * Validate account permissions
   */
  private async validateAccountPermissions(): Promise<AccountPermissionReport> {
    try {
      return await this.permissionValidator.validateAccount(this.operatorAccountId.toString());
    } catch (error) {
      logger.error('Failed to validate account permissions', { error });
      
      // Return a basic report with error information
      return {
        accountId: this.operatorAccountId.toString(),
        accountExists: false,
        balance: {
          hbar: '0',
          sufficient: false,
          minimumRequired: '10',
          recommendedAmount: '20',
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
        issues: [`Failed to validate permissions: ${error instanceof Error ? error.message : String(error)}`],
        recommendations: ['Check account configuration and network connectivity'],
        validationTimestamp: new Date(),
      };
    }
  }

  /**
   * Run diagnostic tests
   */
  private async runDiagnosticTests(): Promise<NFTTestResult[]> {
    const results: NFTTestResult[] = [];

    try {
      if (this.config.includeFullTestSuite) {
        logger.info('Running full NFT test suite');
        const fullResults = await this.testSuite.runFullTestSuite();
        results.push(...fullResults);
      } else {
        // Run basic connectivity test
        logger.info('Running basic NFT connectivity test');
        const basicTest = await this.testSuite.testTokenCreation();
        results.push(basicTest);
      }

      if (this.config.includeFailureScenarios) {
        logger.info('Running failure scenario tests');
        // Add specific failure tests if needed
      }
    } catch (error) {
      logger.error('Failed to run diagnostic tests', { error });
      
      // Add a failed test result
      results.push({
        testName: 'Diagnostic Test Suite',
        success: false,
        error: HederaErrorReporter.captureError(error, 'diagnostic_test_suite', {}),
        duration: 0,
        details: {
          message: 'Failed to execute test suite',
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    return results;
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(
    accountStatus: AccountPermissionReport,
    testResults: NFTTestResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Add custom recommendations from config
    if (this.config.customRecommendations) {
      recommendations.push(...this.config.customRecommendations);
    }

    // Account balance recommendations
    if (!accountStatus.balance.sufficient) {
      recommendations.push(
        `Account balance is insufficient (${accountStatus.balance.hbar} HBAR). ` +
        `Minimum required: ${accountStatus.balance.minimumRequired} HBAR. ` +
        `Please fund the account before attempting NFT operations.`
      );
    }

    // Token permission recommendations
    if (!accountStatus.canMintNFTs) {
      recommendations.push(
        'Account does not have permission to mint NFTs. ' +
        'Verify that the account has the required supply key for the NFT token.'
      );
    }

    if (!accountStatus.tokenExists && this.config.tokenId) {
      recommendations.push(
        `NFT token ${this.config.tokenId} does not exist or is not accessible. ` +
        'Verify the token ID and ensure the account has access to query token information.'
      );
    }

    // Test result recommendations
    const failedTests = testResults.filter(test => !test.success);
    if (failedTests.length > 0) {
      recommendations.push(
        `${failedTests.length} out of ${testResults.length} tests failed. ` +
        'Review the test results for specific error details and resolution steps.'
      );

      // Add specific recommendations based on common error patterns
      failedTests.forEach(test => {
        if (test.error?.errorCode === 'INSUFFICIENT_ACCOUNT_BALANCE') {
          recommendations.push(
            `Test "${test.testName}" failed due to insufficient balance. ` +
            'Ensure the account has sufficient HBAR for transaction fees.'
          );
        } else if (test.error?.errorCode === 'INVALID_SIGNATURE') {
          recommendations.push(
            `Test "${test.testName}" failed due to invalid signature. ` +
            'Verify that the correct private key is configured for the account.'
          );
        }
      });
    }

    // Recent error recommendations
    if (this.recentErrors.length > 0) {
      const errorTypes = new Set(this.recentErrors.map(err => err.errorCode));
      if (errorTypes.has('INSUFFICIENT_ACCOUNT_BALANCE')) {
        recommendations.push(
          'Recent errors indicate insufficient account balance. ' +
          'Monitor account balance and set up automatic funding if needed.'
        );
      }
      if (errorTypes.has('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
        recommendations.push(
          'Recent errors indicate token association issues. ' +
          'Ensure user accounts are properly associated with the NFT token before minting.'
        );
      }
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push(
        'All diagnostic checks passed successfully. ' +
        'The system appears to be configured correctly for NFT operations.'
      );
    }

    return recommendations;
  }

  /**
   * Calculate summary metrics
   */
  private calculateSummary(
    accountStatus: AccountPermissionReport,
    testResults: NFTTestResult[]
  ): DiagnosticReport['summary'] {
    const criticalIssues = accountStatus.issues.length + 
      (accountStatus.canMintNFTs ? 0 : 1) +
      (!accountStatus.balance.sufficient ? 1 : 0);
    
    const warningIssues = this.recentErrors.length > 5 ? 1 : 0;
    
    const passedTests = testResults.filter(test => test.success).length;
    const failedTests = testResults.filter(test => !test.success).length;
    const totalTests = testResults.length;

    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalIssues > 0 || failedTests > totalTests / 2) {
      overallHealth = 'critical';
    } else if (warningIssues > 0 || failedTests > 0) {
      overallHealth = 'warning';
    }

    return {
      overallHealth,
      criticalIssues,
      warningIssues,
      passedTests,
      failedTests,
      totalTests,
    };
  }

  /**
   * Export report in specified format
   * Requirements: 2.5
   */
  async exportReport(report: DiagnosticReport, format: 'json' | 'markdown'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    if (format === 'markdown') {
      return this.formatReportAsMarkdown(report);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Format report as markdown
   */
  private formatReportAsMarkdown(report: DiagnosticReport): string {
    const lines: string[] = [];

    lines.push('# Hedera NFT Diagnostic Report');
    lines.push('');
    lines.push(`**Report ID:** ${report.reportId}`);
    lines.push(`**Generated:** ${report.timestamp.toISOString()}`);
    lines.push(`**Overall Health:** ${report.summary.overallHealth.toUpperCase()}`);
    lines.push('');

    // Environment section
    lines.push('## Environment');
    lines.push(`- **Network:** ${report.environment.network}`);
    lines.push(`- **Account ID:** ${report.environment.accountId}`);
    if (report.environment.tokenId) {
      lines.push(`- **Token ID:** ${report.environment.tokenId}`);
    }
    if (report.environment.topicId) {
      lines.push(`- **Topic ID:** ${report.environment.topicId}`);
    }
    lines.push(`- **Client Version:** ${report.environment.clientVersion}`);
    lines.push(`- **Node Version:** ${report.environment.nodeVersion}`);
    lines.push('');

    // Summary section
    lines.push('## Summary');
    lines.push(`- **Critical Issues:** ${report.summary.criticalIssues}`);
    lines.push(`- **Warning Issues:** ${report.summary.warningIssues}`);
    lines.push(`- **Tests Passed:** ${report.summary.passedTests}/${report.summary.totalTests}`);
    lines.push(`- **Tests Failed:** ${report.summary.failedTests}/${report.summary.totalTests}`);
    lines.push('');

    // Account status section
    lines.push('## Account Status');
    lines.push(`- **Balance:** ${report.accountStatus.balance.hbar} HBAR (Sufficient: ${report.accountStatus.balance.sufficient})`);
    lines.push(`- **Can Mint NFTs:** ${report.accountStatus.canMintNFTs}`);
    lines.push(`- **Token Exists:** ${report.accountStatus.tokenExists}`);
    
    if (report.accountStatus.issues.length > 0) {
      lines.push('');
      lines.push('### Issues');
      report.accountStatus.issues.forEach(issue => {
        lines.push(`- ${issue}`);
      });
    }
    lines.push('');

    // Test results section
    if (report.testResults.length > 0) {
      lines.push('## Test Results');
      report.testResults.forEach(test => {
        const status = test.success ? '✅' : '❌';
        lines.push(`- ${status} **${test.testName}** (${test.duration}ms)`);
        if (!test.success && test.error) {
          lines.push(`  - Error: ${test.error.errorMessage}`);
          if (test.error.errorCode) {
            lines.push(`  - Code: ${test.error.errorCode}`);
          }
        }
      });
      lines.push('');
    }

    // Recent errors section
    if (report.recentErrors.length > 0) {
      lines.push('## Recent Errors');
      report.recentErrors.forEach(error => {
        lines.push(`- **${error.operation}** (${error.timestamp.toISOString()})`);
        lines.push(`  - ${error.errorMessage}`);
        if (error.errorCode) {
          lines.push(`  - Code: ${error.errorCode}`);
        }
      });
      lines.push('');
    }

    // Recommendations section
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach(recommendation => {
        lines.push(`- ${recommendation}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Add error to recent errors list
   */
  addRecentError(error: HederaErrorDetails): void {
    this.recentErrors.push(error);
    
    // Keep only the most recent errors
    if (this.recentErrors.length > this.config.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(-this.config.maxRecentErrors);
    }
  }

  /**
   * Clear recent errors
   */
  clearRecentErrors(): void {
    this.recentErrors = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DiagnosticConfig>): void {
    this.config = { ...this.config, ...config };
  }
}