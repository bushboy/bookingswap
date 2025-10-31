#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { logger } from '../utils/logger';
import { HederaService } from '../services/hedera/HederaService';
import { DiagnosticReporter, DiagnosticConfig } from '../services/hedera/DiagnosticReporter';
import { AccountPermissionValidator } from '../services/hedera/AccountPermissionValidator';
import { NFTTestSuite } from '../services/hedera/NFTTestSuite';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

/**
 * CLI configuration interface
 */
interface CLIConfig {
  network: 'testnet' | 'mainnet';
  accountId?: string;
  privateKey?: string;
  tokenId?: string;
  outputDir: string;
  verbose: boolean;
}

/**
 * Hedera NFT Diagnostic CLI Tool
 * Provides command-line interface for running NFT diagnostics, testing operations,
 * and generating reports
 * Requirements: 3.1, 4.4
 */
class HederaDiagnosticsCLI {
  private program: Command;
  private config: CLIConfig;
  private hederaService?: HederaService;
  private diagnosticReporter?: DiagnosticReporter;
  private permissionValidator?: AccountPermissionValidator;
  private testSuite?: NFTTestSuite;

  constructor() {
    this.program = new Command();
    this.config = {
      network: 'testnet',
      outputDir: './diagnostic-reports',
      verbose: false,
    };
    
    this.setupCommands();
  }

  /**
   * Setup CLI commands and options
   */
  private setupCommands(): void {
    this.program
      .name('hedera-diagnostics')
      .description('Hedera NFT Diagnostic Tool - Debug and test NFT operations')
      .version('1.0.0');

    // Global options
    this.program
      .option('-n, --network <network>', 'Hedera network (testnet|mainnet)', 'testnet')
      .option('-a, --account-id <accountId>', 'Hedera account ID')
      .option('-k, --private-key <privateKey>', 'Hedera private key')
      .option('-t, --token-id <tokenId>', 'NFT token ID for testing')
      .option('-o, --output-dir <dir>', 'Output directory for reports', './diagnostic-reports')
      .option('-v, --verbose', 'Enable verbose logging', false);

    // Diagnostic report command
    this.program
      .command('report')
      .description('Generate comprehensive diagnostic report')
      .option('-f, --format <format>', 'Report format (json|markdown)', 'markdown')
      .option('--full-test-suite', 'Include full test suite in report', false)
      .option('--include-failures', 'Include failure scenario tests', false)
      .action(this.generateReport.bind(this));

    // Account verification command
    this.program
      .command('verify-account')
      .description('Verify account permissions and configuration')
      .argument('[accountId]', 'Account ID to verify (uses configured account if not provided)')
      .option('-t, --token-id <tokenId>', 'Token ID to check permissions for')
      .action(this.verifyAccount.bind(this));

    // Individual test commands
    const testCommand = this.program
      .command('test')
      .description('Run individual NFT operation tests');

    testCommand
      .command('token-creation')
      .description('Test NFT token creation')
      .action(this.testTokenCreation.bind(this));

    testCommand
      .command('nft-minting')
      .description('Test NFT minting operation')
      .option('-t, --token-id <tokenId>', 'Token ID to mint NFT for')
      .action(this.testNFTMinting.bind(this));

    testCommand
      .command('nft-transfer')
      .description('Test NFT transfer operation')
      .requiredOption('-t, --token-id <tokenId>', 'Token ID of NFT to transfer')
      .requiredOption('-s, --serial <serial>', 'Serial number of NFT to transfer')
      .option('--to-account <accountId>', 'Recipient account ID')
      .action(this.testNFTTransfer.bind(this));

    testCommand
      .command('nft-query')
      .description('Test NFT query and metadata verification')
      .requiredOption('-t, --token-id <tokenId>', 'Token ID of NFT to query')
      .requiredOption('-s, --serial <serial>', 'Serial number of NFT to query')
      .action(this.testNFTQuery.bind(this));

    testCommand
      .command('full-suite')
      .description('Run complete NFT test suite')
      .option('--cleanup', 'Clean up test assets after completion', true)
      .action(this.runFullTestSuite.bind(this));

    // Balance check command
    this.program
      .command('check-balance')
      .description('Check account balance and minimum requirements')
      .argument('[accountId]', 'Account ID to check (uses configured account if not provided)')
      .option('--operation <operation>', 'Operation type (mint|transfer|create_token)', 'mint')
      .action(this.checkBalance.bind(this));

    // Metadata size check command
    this.program
      .command('check-metadata-size')
      .description('Check NFT metadata size against Hedera limits')
      .requiredOption('-m, --metadata <metadata>', 'JSON metadata to check')
      .action(this.checkMetadataSize.bind(this));

    // Health check command
    this.program
      .command('health-check')
      .description('Quick health check of Hedera connection and account')
      .action(this.healthCheck.bind(this));

    // Export command
    this.program
      .command('export')
      .description('Export diagnostic data in various formats')
      .argument('<reportFile>', 'Path to existing report JSON file')
      .option('-f, --format <format>', 'Export format (json|markdown|csv)', 'markdown')
      .option('-o, --output <file>', 'Output file path')
      .action(this.exportReport.bind(this));
  }

  /**
   * Initialize Hedera services with CLI configuration
   */
  private async initializeServices(): Promise<void> {
    try {
      // Use CLI options or environment variables
      const accountId = this.config.accountId || process.env.HEDERA_ACCOUNT_ID;
      const privateKey = this.config.privateKey || process.env.HEDERA_PRIVATE_KEY;
      const network = this.config.network;

      if (!accountId || !privateKey) {
        throw new Error(
          'Account ID and private key are required. ' +
          'Provide via --account-id and --private-key options or ' +
          'HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY environment variables.'
        );
      }

      if (this.config.verbose) {
        logger.info('Initializing Hedera services', {
          network,
          accountId,
          tokenId: this.config.tokenId,
        });
      }

      // Initialize Hedera service
      this.hederaService = new HederaService();
      
      // Initialize diagnostic components
      const diagnosticConfig: Partial<DiagnosticConfig> = {
        tokenId: this.config.tokenId,
        includeFullTestSuite: true,
        includeFailureScenarios: false,
        maxRecentErrors: 10,
      };

      this.diagnosticReporter = new DiagnosticReporter(this.hederaService, diagnosticConfig);
      this.permissionValidator = new AccountPermissionValidator(
        this.hederaService['client'],
        this.hederaService['operatorAccountId']
      );
      this.testSuite = new NFTTestSuite(this.hederaService);

      if (this.config.verbose) {
        logger.info('Hedera services initialized successfully');
      }
    } catch (error) {
      logger.error('Failed to initialize Hedera services', { error });
      throw error;
    }
  }

  /**
   * Parse CLI arguments and update configuration
   */
  private parseArguments(options: any): void {
    this.config = {
      ...this.config,
      network: options.network || this.config.network,
      accountId: options.accountId,
      privateKey: options.privateKey,
      tokenId: options.tokenId,
      outputDir: options.outputDir || this.config.outputDir,
      verbose: options.verbose || this.config.verbose,
    };

    // Ensure output directory exists
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive diagnostic report
   * Requirements: 4.4
   */
  private async generateReport(options: any): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      console.log('🔍 Generating comprehensive diagnostic report...');

      // Update diagnostic configuration based on options
      if (this.diagnosticReporter) {
        this.diagnosticReporter.updateConfig({
          includeFullTestSuite: options.fullTestSuite,
          includeFailureScenarios: options.includeFailures,
          tokenId: this.config.tokenId,
        });
      }

      const report = await this.diagnosticReporter!.generateReport();
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `diagnostic-report-${timestamp}`;
      
      let outputPath: string;
      let content: string;

      if (options.format === 'json') {
        outputPath = join(this.config.outputDir, `${filename}.json`);
        content = await this.diagnosticReporter!.exportReport(report, 'json');
      } else {
        outputPath = join(this.config.outputDir, `${filename}.md`);
        content = await this.diagnosticReporter!.exportReport(report, 'markdown');
      }

      writeFileSync(outputPath, content);

      // Display summary
      console.log('\n📊 Diagnostic Report Summary:');
      console.log(`   Overall Health: ${report.summary.overallHealth.toUpperCase()}`);
      console.log(`   Critical Issues: ${report.summary.criticalIssues}`);
      console.log(`   Warning Issues: ${report.summary.warningIssues}`);
      console.log(`   Tests Passed: ${report.summary.passedTests}/${report.summary.totalTests}`);
      console.log(`   Tests Failed: ${report.summary.failedTests}/${report.summary.totalTests}`);
      console.log(`\n📄 Report saved to: ${outputPath}`);

      if (report.recommendations.length > 0) {
        console.log('\n💡 Key Recommendations:');
        report.recommendations.slice(0, 3).forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }

    } catch (error) {
      console.error('❌ Failed to generate diagnostic report:', error);
      process.exit(1);
    }
  }

  /**
   * Verify account permissions and configuration
   * Requirements: 3.1, 4.4
   */
  private async verifyAccount(accountId?: string, options?: any): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      const targetAccountId = accountId || this.config.accountId;
      if (!targetAccountId) {
        throw new Error('Account ID is required');
      }

      console.log(`🔐 Verifying account permissions for ${targetAccountId}...`);

      const tokenId = options?.tokenId || this.config.tokenId;
      const report = await this.permissionValidator!.validateAccount(targetAccountId, tokenId);

      // Display results
      console.log('\n📋 Account Verification Results:');
      console.log(`   Account ID: ${report.accountId}`);
      console.log(`   Account Exists: ${report.accountExists ? '✅' : '❌'}`);
      console.log(`   Balance: ${report.balance.hbar} HBAR`);
      console.log(`   Balance Sufficient: ${report.balance.sufficient ? '✅' : '❌'}`);
      console.log(`   Can Mint NFTs: ${report.canMintNFTs ? '✅' : '❌'}`);
      console.log(`   Can Transfer NFTs: ${report.canTransferNFTs ? '✅' : '❌'}`);

      if (tokenId) {
        console.log(`\n🎫 Token Permissions (${tokenId}):`);
        console.log(`   Token Exists: ${report.tokenExists ? '✅' : '❌'}`);
        console.log(`   Has Supply Key: ${report.tokenPermissions.hasSupplyKey ? '✅' : '❌'}`);
        console.log(`   Has Admin Key: ${report.tokenPermissions.hasAdminKey ? '✅' : '❌'}`);
        console.log(`   Can Mint NFTs: ${report.tokenPermissions.canMintNFTs ? '✅' : '❌'}`);
      }

      if (report.issues.length > 0) {
        console.log('\n⚠️  Issues Found:');
        report.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
      }

      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }

    } catch (error) {
      console.error('❌ Account verification failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test token creation functionality
   * Requirements: 3.1
   */
  private async testTokenCreation(): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      console.log('🎫 Testing NFT token creation...');

      const result = await this.testSuite!.testTokenCreation();
      this.displayTestResult(result);

      if (result.success) {
        console.log(`\n✅ Token created successfully: ${result.details.tokenId}`);
        console.log('💡 Remember to clean up test tokens when done testing');
      }

    } catch (error) {
      console.error('❌ Token creation test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test NFT minting operation
   * Requirements: 3.1
   */
  private async testNFTMinting(options: any): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      const tokenId = options.tokenId || this.config.tokenId;
      console.log(`🎨 Testing NFT minting${tokenId ? ` for token ${tokenId}` : ''}...`);

      const result = await this.testSuite!.testNFTMinting(tokenId);
      this.displayTestResult(result);

      if (result.success) {
        console.log(`\n✅ NFT minted successfully:`);
        console.log(`   Token ID: ${result.details.tokenId}`);
        console.log(`   Serial Number: ${result.details.serialNumber}`);
      }

    } catch (error) {
      console.error('❌ NFT minting test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test NFT transfer operation
   * Requirements: 3.1
   */
  private async testNFTTransfer(options: any): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      const { tokenId, serial, toAccount } = options;
      console.log(`📤 Testing NFT transfer for ${tokenId}:${serial}...`);

      const result = await this.testSuite!.testNFTTransfer(
        tokenId,
        parseInt(serial),
        toAccount
      );
      this.displayTestResult(result);

      if (result.success) {
        console.log(`\n✅ NFT transfer completed successfully`);
      }

    } catch (error) {
      console.error('❌ NFT transfer test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test NFT query and metadata verification
   * Requirements: 3.1
   */
  private async testNFTQuery(options: any): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      const { tokenId, serial } = options;
      console.log(`🔍 Testing NFT query for ${tokenId}:${serial}...`);

      const result = await this.testSuite!.testNFTQuery(tokenId, parseInt(serial));
      this.displayTestResult(result);

      if (result.success) {
        console.log(`\n✅ NFT query completed successfully`);
        if (result.details.nftInfo.metadata) {
          console.log('📄 Metadata found and validated');
        }
      }

    } catch (error) {
      console.error('❌ NFT query test failed:', error);
      process.exit(1);
    }
  }

  /**
   * Run complete NFT test suite
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  private async runFullTestSuite(options: any): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      console.log('🧪 Running complete NFT test suite...');

      const results = await this.testSuite!.runFullTestSuite();
      
      console.log('\n📊 Test Suite Results:');
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${result.testName} (${result.duration}ms)`);
        
        if (!result.success && result.error) {
          console.log(`      Error: ${result.error.errorMessage}`);
        }
      });

      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      const successRate = ((successCount / totalCount) * 100).toFixed(1);

      console.log(`\n📈 Summary: ${successCount}/${totalCount} tests passed (${successRate}%)`);

      if (options.cleanup) {
        console.log('\n🧹 Cleaning up test assets...');
        await this.testSuite!.cleanupTestAssets();
        console.log('✅ Cleanup completed');
      }

    } catch (error) {
      console.error('❌ Full test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check account balance and minimum requirements
   * Requirements: 3.1
   */
  private async checkBalance(accountId?: string, options?: any): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      const targetAccountId = accountId || this.config.accountId;
      if (!targetAccountId) {
        throw new Error('Account ID is required');
      }

      const operation = options?.operation || 'mint';
      console.log(`💰 Checking balance for ${targetAccountId} (${operation} operation)...`);

      const sufficient = await this.permissionValidator!.verifyMinimumBalance(
        targetAccountId,
        operation
      );

      const balanceResult = await this.permissionValidator!.validateAccountBalance(targetAccountId);
      
      if (balanceResult.passed) {
        const balanceData = JSON.parse(balanceResult.details);
        console.log(`\n💳 Balance Information:`);
        console.log(`   Current Balance: ${balanceData.hbar} HBAR`);
        console.log(`   Minimum Required: ${balanceData.minimumRequired} HBAR`);
        console.log(`   Recommended Amount: ${balanceData.recommendedAmount} HBAR`);
        console.log(`   Sufficient for ${operation}: ${sufficient ? '✅' : '❌'}`);
      } else {
        console.log(`\n❌ Balance check failed: ${balanceResult.details}`);
        if (balanceResult.recommendation) {
          console.log(`💡 Recommendation: ${balanceResult.recommendation}`);
        }
      }

    } catch (error) {
      console.error('❌ Balance check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check NFT metadata size against Hedera limits
   * Requirements: Error prevention for metadata size limits
   */
  private async checkMetadataSize(options: any): Promise<void> {
    try {
      console.log('🔍 Checking NFT metadata size...');

      const metadataString = options.metadata;
      let metadata: any;

      // Parse the metadata JSON
      try {
        metadata = JSON.parse(metadataString);
      } catch (parseError) {
        console.error('❌ Invalid JSON metadata:', parseError.message);
        process.exit(1);
      }

      // Calculate metadata size
      const metadataBytes = Buffer.from(metadataString).length;
      const maxMetadataSize = 100; // Hedera NFT metadata limit
      const isValid = metadataBytes <= maxMetadataSize;

      // Display results
      console.log('\n📊 Metadata Size Analysis:');
      console.log(`   Size: ${metadataBytes} bytes`);
      console.log(`   Limit: ${maxMetadataSize} bytes`);
      console.log(`   Status: ${isValid ? '✅ Valid' : '❌ Too Large'}`);
      
      if (!isValid) {
        const excess = metadataBytes - maxMetadataSize;
        console.log(`   Excess: ${excess} bytes over limit`);
        console.log('\n💡 Suggestions to reduce size:');
        console.log('   • Use shorter field names and values');
        console.log('   • Remove unnecessary attributes');
        console.log('   • Use external URLs for large data');
        console.log('   • Compress JSON structure');
        
        console.log('\n📝 Example optimized metadata:');
        const optimized = {
          name: metadata.name?.substring(0, 15) || 'NFT',
          desc: 'Booking NFT',
          url: 'https://api.example.com/nft/123'
        };
        console.log(JSON.stringify(optimized, null, 2));
        
        process.exit(1);
      }

      console.log('\n✅ Metadata size is within Hedera limits');
      
      // Show metadata structure
      console.log('\n📋 Metadata Structure:');
      console.log(JSON.stringify(metadata, null, 2));

    } catch (error) {
      console.error('❌ Metadata size check failed:', error.message);
      if (this.config.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Quick health check of Hedera connection and account
   * Requirements: 3.1
   */
  private async healthCheck(): Promise<void> {
    try {
      this.parseArguments(this.program.opts());
      
      console.log('🏥 Performing health check...');
      
      // Test service initialization
      await this.initializeServices();
      console.log('✅ Hedera services initialized');

      // Test account balance query
      const accountId = this.config.accountId || process.env.HEDERA_ACCOUNT_ID;
      if (accountId) {
        const balanceResult = await this.permissionValidator!.validateAccountBalance(accountId);
        if (balanceResult.passed) {
          console.log('✅ Account balance query successful');
        } else {
          console.log('⚠️  Account balance query failed');
        }
      }

      // Test basic token query if token ID is provided
      if (this.config.tokenId) {
        try {
          const tokenResult = await this.permissionValidator!.validateTokenPermissions(
            this.config.tokenId,
            accountId!
          );
          if (tokenResult.passed) {
            console.log('✅ Token information query successful');
          } else {
            console.log('⚠️  Token information query failed');
          }
        } catch (error) {
          console.log('⚠️  Token information query failed');
        }
      }

      console.log('\n🎉 Health check completed successfully');

    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Export diagnostic data in various formats
   * Requirements: 4.4
   */
  private async exportReport(reportFile: string, options: any): Promise<void> {
    try {
      console.log(`📤 Exporting report from ${reportFile}...`);

      // Read existing report
      const reportContent = require(join(process.cwd(), reportFile));
      
      // Initialize services for export functionality
      this.parseArguments(this.program.opts());
      await this.initializeServices();

      let content: string;
      let extension: string;

      switch (options.format) {
        case 'json':
          content = JSON.stringify(reportContent, null, 2);
          extension = 'json';
          break;
        case 'markdown':
          content = await this.diagnosticReporter!.exportReport(reportContent, 'markdown');
          extension = 'md';
          break;
        case 'csv':
          content = this.exportToCSV(reportContent);
          extension = 'csv';
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      const outputPath = options.output || 
        join(this.config.outputDir, `exported-report.${extension}`);
      
      writeFileSync(outputPath, content);
      console.log(`✅ Report exported to: ${outputPath}`);

    } catch (error) {
      console.error('❌ Export failed:', error);
      process.exit(1);
    }
  }

  /**
   * Display test result in formatted output
   */
  private displayTestResult(result: any): void {
    const status = result.success ? '✅' : '❌';
    console.log(`\n${status} ${result.testName}`);
    console.log(`   Duration: ${result.duration}ms`);
    
    if (result.transactionId) {
      console.log(`   Transaction ID: ${result.transactionId}`);
    }

    if (!result.success && result.error) {
      console.log(`   Error: ${result.error.errorMessage}`);
      if (result.error.errorCode) {
        console.log(`   Error Code: ${result.error.errorCode}`);
      }
      if (result.error.recommendation) {
        console.log(`   💡 ${result.error.recommendation}`);
      }
    }
  }

  /**
   * Export report data to CSV format
   */
  private exportToCSV(report: any): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Category,Item,Status,Details');
    
    // Summary
    lines.push(`Summary,Overall Health,${report.summary.overallHealth},`);
    lines.push(`Summary,Critical Issues,${report.summary.criticalIssues},`);
    lines.push(`Summary,Warning Issues,${report.summary.warningIssues},`);
    lines.push(`Summary,Tests Passed,${report.summary.passedTests},`);
    lines.push(`Summary,Tests Failed,${report.summary.failedTests},`);
    
    // Account Status
    lines.push(`Account,Balance,${report.accountStatus.balance.hbar} HBAR,Sufficient: ${report.accountStatus.balance.sufficient}`);
    lines.push(`Account,Can Mint NFTs,${report.accountStatus.canMintNFTs},`);
    lines.push(`Account,Token Exists,${report.accountStatus.tokenExists},`);
    
    // Test Results
    report.testResults.forEach((test: any) => {
      lines.push(`Test,${test.testName},${test.success ? 'PASS' : 'FAIL'},${test.duration}ms`);
    });
    
    return lines.join('\n');
  }

  /**
   * Run the CLI application
   */
  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error('❌ CLI execution failed:', error);
      process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new HederaDiagnosticsCLI();
  cli.run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { HederaDiagnosticsCLI };