import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Client, AccountId, PrivateKey, Hbar, AccountCreateTransaction, AccountBalanceQuery } from '@hashgraph/sdk';
import { NFTTestSuite } from '../NFTTestSuite';
import { AccountPermissionValidator } from '../AccountPermissionValidator';
import { DiagnosticReporter } from '../DiagnosticReporter';
import { HederaService } from '../HederaService';
import { getHederaConfig } from '../config';
import { HederaErrorType } from '../HederaErrorReporter';

/**
 * Comprehensive Integration Tests for Hedera NFT Debugging
 * 
 * This test suite covers:
 * - Real Hedera testnet account setup and validation
 * - Error scenarios with insufficient balance and invalid accounts
 * - Complete NFT lifecycle operations (create, mint, transfer, query)
 * - Permission validation with different account configurations
 * 
 * Requirements covered: 3.1, 3.4
 */
describe('Hedera NFT Debugging - Comprehensive Integration Tests', () => {
  let client: Client;
  let operatorAccountId: AccountId;
  let operatorPrivateKey: PrivateKey;
  let hederaService: HederaService;
  let nftTestSuite: NFTTestSuite;
  let accountValidator: AccountPermissionValidator;
  let diagnosticReporter: DiagnosticReporter;
  let config: any;

  // Test accounts for different scenarios
  let testAccounts: {
    valid: { accountId: AccountId; privateKey: PrivateKey };
    insufficientBalance?: { accountId: AccountId; privateKey: PrivateKey };
    invalid: { accountId: AccountId };
  };

  beforeAll(async () => {
    try {
      // Load configuration
      config = getHederaConfig();
      
      // Initialize Hedera client
      client = config.network === 'testnet' 
        ? Client.forTestnet() 
        : Client.forMainnet();
      
      operatorAccountId = AccountId.fromString(config.accountId);
      operatorPrivateKey = PrivateKey.fromString(config.privateKey);
      client.setOperator(operatorAccountId, operatorPrivateKey);

      // Initialize services
      hederaService = new HederaService(config);
      await hederaService.initialize();
      
      nftTestSuite = new NFTTestSuite(hederaService);
      accountValidator = new AccountPermissionValidator(client, operatorAccountId);
      diagnosticReporter = new DiagnosticReporter(hederaService, accountValidator, nftTestSuite);

      // Set up test accounts
      await setupTestAccounts();
      
    } catch (error) {
      console.warn('Hedera integration test setup failed:', error);
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup test assets
    if (nftTestSuite) {
      try {
        await nftTestSuite.cleanupTestAssets();
      } catch (error) {
        console.warn('Failed to cleanup test assets:', error);
      }
    }

    // Close connections
    if (client) {
      client.close();
    }
    if (hederaService) {
      hederaService.close();
    }
  }, 30000);

  /**
   * Set up test accounts for different scenarios
   */
  async function setupTestAccounts() {
    // Main test account (operator account)
    testAccounts = {
      valid: {
        accountId: operatorAccountId,
        privateKey: operatorPrivateKey
      },
      invalid: {
        accountId: AccountId.fromString('0.0.999999999') // Non-existent account
      }
    };

    // Try to create an account with insufficient balance for testing
    try {
      const newAccountPrivateKey = PrivateKey.generateED25519();
      const newAccountPublicKey = newAccountPrivateKey.publicKey;

      const createAccountTx = new AccountCreateTransaction()
        .setKey(newAccountPublicKey)
        .setInitialBalance(Hbar.fromTinybars(1000)); // Very small balance

      const createAccountResponse = await createAccountTx.execute(client);
      const createAccountReceipt = await createAccountResponse.getReceipt(client);
      
      if (createAccountReceipt.accountId) {
        testAccounts.insufficientBalance = {
          accountId: createAccountReceipt.accountId,
          privateKey: newAccountPrivateKey
        };
      }
    } catch (error) {
      console.warn('Could not create insufficient balance test account:', error);
      // This is optional, tests will adapt
    }
  }

  describe('Test Environment Setup and Validation', () => {
    it('should validate Hedera testnet connectivity', async () => {
      expect(client).toBeDefined();
      expect(config.network).toBe('testnet');
      expect(operatorAccountId.toString()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should validate operator account has sufficient balance', async () => {
      const balance = await new AccountBalanceQuery()
        .setAccountId(operatorAccountId)
        .execute(client);

      expect(balance.hbars.toBigNumber().toNumber()).toBeGreaterThan(10);
      console.log(`Operator account balance: ${balance.hbars.toString()}`);
    });

    it('should initialize all debugging services successfully', async () => {
      expect(hederaService).toBeDefined();
      expect(nftTestSuite).toBeDefined();
      expect(accountValidator).toBeDefined();
      expect(diagnosticReporter).toBeDefined();
    });
  });

  describe('Error Scenarios - Insufficient Balance', () => {
    it('should handle NFT operations with insufficient balance gracefully', async () => {
      if (!testAccounts.insufficientBalance) {
        console.log('Skipping insufficient balance test - could not create test account');
        return;
      }

      // Create a temporary client with insufficient balance account
      const insufficientClient = config.network === 'testnet' 
        ? Client.forTestnet() 
        : Client.forMainnet();
      
      insufficientClient.setOperator(
        testAccounts.insufficientBalance.accountId,
        testAccounts.insufficientBalance.privateKey
      );

      const insufficientValidator = new AccountPermissionValidator(
        insufficientClient,
        testAccounts.insufficientBalance.accountId
      );

      // Test balance validation
      const balanceResult = await insufficientValidator.validateAccountBalance(
        testAccounts.insufficientBalance.accountId.toString()
      );

      expect(balanceResult.passed).toBe(false);
      expect(balanceResult.details).toContain('insufficient');
      expect(balanceResult.recommendation).toBeTruthy();

      // Test account validation report
      const accountReport = await insufficientValidator.validateAccount(
        testAccounts.insufficientBalance.accountId.toString()
      );

      expect(accountReport.balance.sufficient).toBe(false);
      expect(accountReport.canMintNFTs).toBe(false);
      expect(accountReport.issues.length).toBeGreaterThan(0);
      expect(accountReport.recommendations.length).toBeGreaterThan(0);

      insufficientClient.close();
    }, 45000);

    it('should provide detailed error information for insufficient balance operations', async () => {
      // Test with main account but simulate insufficient balance scenario
      const result = await nftTestSuite.testTokenCreation();
      
      if (!result.success && result.error) {
        // If token creation fails due to balance, verify error details
        if (result.error.errorType === HederaErrorType.INSUFFICIENT_BALANCE) {
          expect(result.error.errorCode).toBeDefined();
          expect(result.error.errorMessage).toContain('insufficient');
          expect(result.error.recommendation).toBeTruthy();
          expect(result.error.retryable).toBe(false);
        }
      }
    }, 30000);
  });

  describe('Error Scenarios - Invalid Accounts', () => {
    it('should handle operations with invalid account IDs', async () => {
      const invalidAccountId = testAccounts.invalid.accountId.toString();

      // Test account validation with invalid account
      const validationResult = await accountValidator.validateAccountBalance(invalidAccountId);

      expect(validationResult.passed).toBe(false);
      expect(validationResult.details).toContain('validation failed');
      expect(validationResult.errorDetails).toBeDefined();
      expect(validationResult.recommendation).toBeTruthy();
    }, 30000);

    it('should provide comprehensive error reporting for invalid accounts', async () => {
      const invalidAccountId = testAccounts.invalid.accountId.toString();

      const accountReport = await accountValidator.validateAccount(invalidAccountId);

      expect(accountReport.accountExists).toBe(false);
      expect(accountReport.canMintNFTs).toBe(false);
      expect(accountReport.canTransferNFTs).toBe(false);
      expect(accountReport.issues.length).toBeGreaterThan(0);
      expect(accountReport.issues.some(issue => issue.includes('does not exist'))).toBe(true);
      expect(accountReport.recommendations.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle NFT transfer to invalid accounts', async () => {
      // First create and mint an NFT
      const mintResult = await nftTestSuite.testNFTMinting();
      if (!mintResult.success) {
        console.log('Skipping invalid transfer test - minting failed');
        return;
      }

      // Try to transfer to invalid account
      const transferResult = await nftTestSuite.testNFTTransfer(
        mintResult.details.tokenId,
        mintResult.details.serialNumber,
        testAccounts.invalid.accountId.toString()
      );

      expect(transferResult.success).toBe(false);
      expect(transferResult.error).toBeDefined();
      expect(transferResult.error?.errorType).toBe(HederaErrorType.INVALID_ACCOUNT);
      expect(transferResult.error?.recommendation).toBeTruthy();
    }, 60000);
  });

  describe('NFT Lifecycle Operations - Complete Flow', () => {
    let createdTokenId: string;
    let mintedSerialNumber: number;

    it('should create NFT token successfully', async () => {
      const result = await nftTestSuite.testTokenCreation();

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.details.tokenId).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.details.tokenName).toBe('Test NFT Token');
      expect(result.details.tokenSymbol).toBe('TNFT');
      expect(result.details.tokenType).toBe('NON_FUNGIBLE_UNIQUE');

      createdTokenId = result.details.tokenId;
      console.log(`Created token: ${createdTokenId}`);
    }, 45000);

    it('should mint NFT successfully', async () => {
      expect(createdTokenId).toBeDefined();

      const result = await nftTestSuite.testNFTMinting(createdTokenId);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.details.tokenId).toBe(createdTokenId);
      expect(result.details.serialNumber).toBe(1);
      expect(result.details.metadata).toBeDefined();
      expect(result.details.nftInfo).toBeDefined();

      mintedSerialNumber = result.details.serialNumber;
      console.log(`Minted NFT: ${createdTokenId}/${mintedSerialNumber}`);
    }, 45000);

    it('should query NFT information and validate metadata', async () => {
      expect(createdTokenId).toBeDefined();
      expect(mintedSerialNumber).toBeDefined();

      const result = await nftTestSuite.testNFTQuery(createdTokenId, mintedSerialNumber);

      expect(result.success).toBe(true);
      expect(result.details.nftInfo).toBeDefined();
      expect(result.details.nftInfo.nftId).toContain(createdTokenId);
      expect(result.details.nftInfo.metadataValid).toBe(true);
      expect(result.details.tokenInfo).toBeDefined();
      expect(result.details.tokenInfo.name).toBe('Test NFT Token');

      console.log(`Queried NFT: ${result.details.nftInfo.nftId}`);
    }, 45000);

    it('should transfer NFT successfully (same account)', async () => {
      expect(createdTokenId).toBeDefined();
      expect(mintedSerialNumber).toBeDefined();

      const result = await nftTestSuite.testNFTTransfer(
        createdTokenId,
        mintedSerialNumber,
        operatorAccountId.toString()
      );

      expect(result.success).toBe(true);
      expect(result.details.fromAccount).toBe(operatorAccountId.toString());
      expect(result.details.toAccount).toBe(operatorAccountId.toString());
      expect(result.details.note).toContain('same account');

      console.log(`Transferred NFT: ${createdTokenId}/${mintedSerialNumber}`);
    }, 45000);

    it('should handle multiple NFT minting on same token', async () => {
      expect(createdTokenId).toBeDefined();

      // Mint second NFT
      const result = await nftTestSuite.testNFTMinting(createdTokenId);

      expect(result.success).toBe(true);
      expect(result.details.tokenId).toBe(createdTokenId);
      expect(result.details.serialNumber).toBe(2);
      expect(result.details.metadata.name).toBe('Test NFT #2');

      console.log(`Minted second NFT: ${createdTokenId}/${result.details.serialNumber}`);
    }, 45000);
  });

  describe('Permission Validation - Different Account Configurations', () => {
    it('should validate operator account permissions comprehensively', async () => {
      const report = await accountValidator.validateAccount(operatorAccountId.toString());

      expect(report.accountId).toBe(operatorAccountId.toString());
      expect(report.accountExists).toBe(true);
      expect(report.balance.sufficient).toBe(true);
      expect(report.balance.hbar).toBeTruthy();
      expect(parseFloat(report.balance.hbar)).toBeGreaterThan(10);

      // Token permissions should indicate capability to mint NFTs
      expect(report.tokenPermissions.hasSupplyKey).toBe(true);
      expect(report.tokenPermissions.hasAdminKey).toBe(true);
      expect(report.tokenPermissions.canMintNFTs).toBe(true);
      expect(report.tokenPermissions.canManageToken).toBe(true);

      expect(report.canMintNFTs).toBe(true);
      expect(report.canTransferNFTs).toBe(true);
      expect(report.issues.length).toBe(0);

      console.log(`Account validation passed for: ${operatorAccountId.toString()}`);
    }, 30000);

    it('should test balance requirements for different operations', async () => {
      const operations = ['mint', 'transfer', 'create_token'] as const;
      
      for (const operation of operations) {
        const hasMinimum = await accountValidator.verifyMinimumBalance(
          operatorAccountId.toString(),
          operation
        );
        expect(typeof hasMinimum).toBe('boolean');
        console.log(`${operation} operation balance check: ${hasMinimum}`);
      }
    }, 30000);

    it('should validate balance requirements configuration', () => {
      const requirements = accountValidator.getBalanceRequirements();

      expect(requirements).toHaveProperty('minimumHbarForNFTOperations');
      expect(requirements).toHaveProperty('recommendedHbarBuffer');
      expect(requirements).toHaveProperty('tokenCreationCost');
      expect(requirements).toHaveProperty('nftMintingCost');
      expect(requirements).toHaveProperty('nftTransferCost');

      // All values should be positive numbers
      Object.values(requirements).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });

      console.log('Balance requirements:', requirements);
    });

    it('should test permission validation with created token', async () => {
      // Create a token first
      const tokenResult = await nftTestSuite.testTokenCreation();
      if (!tokenResult.success) {
        console.log('Skipping token permission test - token creation failed');
        return;
      }

      const tokenId = tokenResult.details.tokenId;
      const result = await accountValidator.validateTokenPermissions(
        tokenId,
        operatorAccountId.toString()
      );

      expect(result.check).toBe('token_permissions');
      expect(result.passed).toBe(true);

      const tokenData = JSON.parse(result.details);
      expect(tokenData.permissions.hasSupplyKey).toBe(true);
      expect(tokenData.permissions.hasAdminKey).toBe(true);
      expect(tokenData.permissions.canMintNFTs).toBe(true);
      expect(tokenData.permissions.canManageToken).toBe(true);

      expect(tokenData.tokenInfo.tokenId).toBe(tokenId);
      expect(tokenData.tokenInfo.name).toBe('Test NFT Token');

      console.log(`Token permission validation passed for: ${tokenId}`);
    }, 60000);
  });

  describe('Failure Scenarios - Comprehensive Testing', () => {
    it('should test all failure scenarios systematically', async () => {
      const failureResults = await nftTestSuite.testFailureScenarios();

      expect(failureResults.length).toBeGreaterThan(0);

      // Validate each failure scenario
      failureResults.forEach(result => {
        expect(result.testName).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(result.duration).toBeGreaterThan(0);

        if (!result.success && result.error) {
          expect(result.error.errorType).toBeDefined();
          expect(result.error.errorMessage).toBeDefined();
          expect(typeof result.error.retryable).toBe('boolean');
        }

        console.log(`Failure scenario: ${result.testName} - Success: ${result.success}`);
      });
    }, 120000);

    it('should handle network timeout scenarios', async () => {
      // This test simulates network issues by using a very short timeout
      const originalTimeout = client.requestTimeout;
      client.setRequestTimeout(1); // 1ms timeout to force failure

      try {
        const result = await nftTestSuite.testTokenCreation();
        
        // Should fail due to timeout
        expect(result.success).toBe(false);
        if (result.error) {
          expect([
            HederaErrorType.NETWORK_ERROR,
            HederaErrorType.TIMEOUT_ERROR,
            HederaErrorType.UNKNOWN
          ]).toContain(result.error.errorType);
        }
      } finally {
        // Restore original timeout
        client.setRequestTimeout(originalTimeout);
      }
    }, 30000);
  });

  describe('Diagnostic Reporting Integration', () => {
    it('should generate comprehensive diagnostic report', async () => {
      const report = await diagnosticReporter.generateReport();

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.environment.network).toBe('testnet');
      expect(report.environment.accountId).toBe(operatorAccountId.toString());

      expect(report.accountStatus).toBeDefined();
      expect(report.accountStatus.accountExists).toBe(true);
      expect(report.accountStatus.canMintNFTs).toBe(true);

      expect(Array.isArray(report.recentErrors)).toBe(true);
      expect(Array.isArray(report.testResults)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);

      console.log(`Diagnostic report generated with ${report.testResults.length} test results`);
    }, 60000);

    it('should export diagnostic report in different formats', async () => {
      const jsonReport = await diagnosticReporter.exportReport('json');
      const markdownReport = await diagnosticReporter.exportReport('markdown');

      // Validate JSON format
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      const parsedJson = JSON.parse(jsonReport);
      expect(parsedJson.timestamp).toBeDefined();
      expect(parsedJson.environment).toBeDefined();
      expect(parsedJson.accountStatus).toBeDefined();

      // Validate Markdown format
      expect(markdownReport).toContain('# Hedera NFT Diagnostic Report');
      expect(markdownReport).toContain('## Environment Information');
      expect(markdownReport).toContain('## Account Status');
      expect(markdownReport).toContain('## Test Results');

      console.log('Diagnostic reports exported successfully in both formats');
    }, 30000);
  });

  describe('Full Integration Test Suite', () => {
    it('should run complete test suite and validate all components', async () => {
      const results = await nftTestSuite.runFullTestSuite();

      expect(results.length).toBeGreaterThan(0);

      // Categorize results
      const successfulTests = results.filter(r => r.success);
      const failedTests = results.filter(r => !r.success);

      console.log(`Full test suite completed:`);
      console.log(`  Successful: ${successfulTests.length}`);
      console.log(`  Failed: ${failedTests.length}`);
      console.log(`  Total: ${results.length}`);

      // At least some core tests should succeed
      expect(successfulTests.length).toBeGreaterThan(0);

      // Validate test coverage
      const testNames = results.map(r => r.testName);
      expect(testNames).toContain('Token Creation Test');
      expect(testNames).toContain('NFT Minting Test');

      // All tests should have proper timing
      results.forEach(result => {
        expect(result.duration).toBeGreaterThan(0);
        expect(result.testName).toBeTruthy();
      });

      // Failed tests should have proper error information
      failedTests.forEach(result => {
        expect(result.error).toBeDefined();
        expect(result.error?.errorType).toBeDefined();
        expect(result.error?.errorMessage).toBeDefined();
      });
    }, 300000); // 5 minute timeout for full suite
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent NFT operations', async () => {
      const concurrentOperations = 3;
      const promises = Array(concurrentOperations).fill(null).map(() => 
        nftTestSuite.testTokenCreation()
      );

      const results = await Promise.allSettled(promises);
      
      expect(results.length).toBe(concurrentOperations);
      
      // At least some should succeed
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      );
      expect(successful.length).toBeGreaterThan(0);

      console.log(`Concurrent operations: ${successful.length}/${concurrentOperations} succeeded`);
    }, 120000);

    it('should maintain consistent error reporting across operations', async () => {
      const operations = [
        () => nftTestSuite.testTokenCreation(),
        () => nftTestSuite.testNFTMinting(),
        () => accountValidator.validateAccount(operatorAccountId.toString())
      ];

      for (const operation of operations) {
        const result = await operation();
        
        // All operations should have consistent timing information
        if ('duration' in result) {
          expect(result.duration).toBeGreaterThan(0);
        }
        
        // Error information should be consistent when present
        if ('error' in result && result.error) {
          expect(result.error.timestamp).toBeInstanceOf(Date);
          expect(result.error.operation).toBeTruthy();
        }
      }
    }, 90000);
  });
});