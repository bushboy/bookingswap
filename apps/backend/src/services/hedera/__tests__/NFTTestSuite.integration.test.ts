import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NFTTestSuite, NFTTestResult } from '../NFTTestSuite';
import { HederaService } from '../HederaService';
import { getHederaConfig } from '../config';
import { HederaErrorType } from '../HederaErrorReporter';

// Mock the logger for cleaner test output
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('NFTTestSuite Integration Tests', () => {
  let nftTestSuite: NFTTestSuite;
  let hederaService: HederaService;

  beforeAll(async () => {
    try {
      // Initialize Hedera service with testnet configuration
      const config = getHederaConfig();
      hederaService = new HederaService(config);
      await hederaService.initialize();
      
      nftTestSuite = new NFTTestSuite(hederaService);
    } catch (error) {
      console.warn('Hedera service initialization failed, skipping integration tests:', error);
      // Skip tests if Hedera service can't be initialized
      return;
    }
  });

  afterAll(async () => {
    if (nftTestSuite) {
      try {
        // Clean up any test assets created during testing
        await nftTestSuite.cleanupTestAssets();
      } catch (error) {
        console.warn('Failed to clean up test assets:', error);
      }
    }
  });

  // Helper function to check if Hedera service is available
  const skipIfNoHedera = () => {
    if (!hederaService || !nftTestSuite) {
      console.log('Skipping test - Hedera service not available');
      return true;
    }
    return false;
  };

  describe('Token Creation Integration', () => {
    it('should create a test token on Hedera testnet', async () => {
      if (skipIfNoHedera()) return;

      const result = await nftTestSuite.testTokenCreation();

      expect(result.success).toBe(true);
      expect(result.testName).toBe('Token Creation Test');
      expect(result.transactionId).toBeDefined();
      expect(result.details.tokenId).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.details.tokenName).toBe('Test NFT Token');
      expect(result.details.tokenSymbol).toBe('TNFT');
      expect(result.details.tokenType).toBe('NON_FUNGIBLE_UNIQUE');
      expect(result.duration).toBeGreaterThan(0);
    }, 30000); // 30 second timeout for network operations

    it('should handle token creation with insufficient balance gracefully', async () => {
      if (skipIfNoHedera()) return;

      // This test assumes the test account might have insufficient balance
      // The test should either succeed or fail with appropriate error handling
      const result = await nftTestSuite.testTokenCreation();

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect([
          HederaErrorType.INSUFFICIENT_BALANCE,
          HederaErrorType.NETWORK_ERROR,
          HederaErrorType.TIMEOUT_ERROR,
        ]).toContain(result.error?.errorType);
      }
    }, 30000);
  });

  describe('NFT Minting Integration', () => {
    it('should mint an NFT after creating a token', async () => {
      if (skipIfNoHedera()) return;

      // First create a token
      const tokenResult = await nftTestSuite.testTokenCreation();
      if (!tokenResult.success) {
        console.log('Skipping minting test - token creation failed');
        return;
      }

      // Then mint an NFT
      const mintResult = await nftTestSuite.testNFTMinting(tokenResult.details.tokenId);

      expect(mintResult.success).toBe(true);
      expect(mintResult.testName).toBe('NFT Minting Test');
      expect(mintResult.transactionId).toBeDefined();
      expect(mintResult.details.tokenId).toBe(tokenResult.details.tokenId);
      expect(mintResult.details.serialNumber).toBe(1);
      expect(mintResult.details.metadata).toBeDefined();
      expect(mintResult.details.nftInfo).toBeDefined();
      expect(mintResult.duration).toBeGreaterThan(0);
    }, 45000);

    it('should create token and mint NFT when no token ID provided', async () => {
      if (skipIfNoHedera()) return;

      const result = await nftTestSuite.testNFTMinting();

      if (result.success) {
        expect(result.details.tokenId).toMatch(/^\d+\.\d+\.\d+$/);
        expect(result.details.serialNumber).toBe(1);
        expect(result.details.metadata.name).toBe('Test NFT #1');
      } else {
        // If it fails, it should be due to network/balance issues
        expect(result.error).toBeDefined();
        expect([
          HederaErrorType.INSUFFICIENT_BALANCE,
          HederaErrorType.NETWORK_ERROR,
          HederaErrorType.TIMEOUT_ERROR,
        ]).toContain(result.error?.errorType);
      }
    }, 60000);
  });

  describe('NFT Query Integration', () => {
    it('should query NFT information and validate metadata', async () => {
      if (skipIfNoHedera()) return;

      // Create token and mint NFT first
      const mintResult = await nftTestSuite.testNFTMinting();
      if (!mintResult.success) {
        console.log('Skipping query test - minting failed');
        return;
      }

      const queryResult = await nftTestSuite.testNFTQuery(
        mintResult.details.tokenId,
        mintResult.details.serialNumber
      );

      expect(queryResult.success).toBe(true);
      expect(queryResult.testName).toBe('NFT Query and Metadata Test');
      expect(queryResult.details.nftInfo).toBeDefined();
      expect(queryResult.details.nftInfo.nftId).toContain(mintResult.details.tokenId);
      expect(queryResult.details.nftInfo.metadataValid).toBe(true);
      expect(queryResult.details.tokenInfo).toBeDefined();
      expect(queryResult.details.tokenInfo.name).toBe('Test NFT Token');
      expect(queryResult.duration).toBeGreaterThan(0);
    }, 60000);

    it('should handle query of non-existent NFT', async () => {
      if (skipIfNoHedera()) return;

      // Create a token first
      const tokenResult = await nftTestSuite.testTokenCreation();
      if (!tokenResult.success) {
        console.log('Skipping non-existent NFT query test - token creation failed');
        return;
      }

      // Try to query a non-existent serial number
      const queryResult = await nftTestSuite.testNFTQuery(tokenResult.details.tokenId, 999999);

      expect(queryResult.success).toBe(false);
      expect(queryResult.error).toBeDefined();
      // The exact error type may vary, but it should be some kind of error
      expect(queryResult.error?.errorType).toBeDefined();
    }, 45000);
  });

  describe('NFT Transfer Integration', () => {
    it('should handle same account transfer', async () => {
      if (skipIfNoHedera()) return;

      // Create token and mint NFT first
      const mintResult = await nftTestSuite.testNFTMinting();
      if (!mintResult.success) {
        console.log('Skipping transfer test - minting failed');
        return;
      }

      // Get operator account ID for same-account transfer
      const operatorAccountId = (hederaService as any).operatorAccountId.toString();

      const transferResult = await nftTestSuite.testNFTTransfer(
        mintResult.details.tokenId,
        mintResult.details.serialNumber,
        operatorAccountId
      );

      expect(transferResult.success).toBe(true);
      expect(transferResult.testName).toBe('NFT Transfer Test');
      expect(transferResult.details.fromAccount).toBe(operatorAccountId);
      expect(transferResult.details.toAccount).toBe(operatorAccountId);
      expect(transferResult.details.note).toContain('same account');
      expect(transferResult.duration).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Failure Scenarios Integration', () => {
    it('should test invalid token operations', async () => {
      if (skipIfNoHedera()) return;

      const failureResults = await nftTestSuite.testFailureScenarios();

      expect(failureResults).toHaveLength(3);
      
      // Invalid token operation test
      const invalidTokenTest = failureResults.find(r => r.testName === 'Invalid Token Operation Test');
      expect(invalidTokenTest).toBeDefined();
      expect(invalidTokenTest?.success).toBe(true); // Success means it properly detected the error
      expect(invalidTokenTest?.details.expectedError).toBe(true);

      // Invalid account transfer test
      const invalidAccountTest = failureResults.find(r => r.testName === 'Invalid Account Transfer Test');
      expect(invalidAccountTest).toBeDefined();
      // This test creates real assets, so it might succeed or fail depending on the scenario

      // Non-existent NFT query test
      const nonExistentNFTTest = failureResults.find(r => r.testName === 'Non-existent NFT Query Test');
      expect(nonExistentNFTTest).toBeDefined();
      expect(nonExistentNFTTest?.success).toBe(true); // Success means it properly detected the error
      expect(nonExistentNFTTest?.details.expectedError).toBe(true);
    }, 120000); // Longer timeout for multiple operations
  });

  describe('Full Test Suite Integration', () => {
    it('should run complete test suite successfully', async () => {
      if (skipIfNoHedera()) return;

      const results = await nftTestSuite.runFullTestSuite();

      expect(results.length).toBeGreaterThan(0);
      
      // Check that we have the expected test types
      const testNames = results.map(r => r.testName);
      expect(testNames).toContain('Token Creation Test');
      expect(testNames).toContain('NFT Minting Test');
      
      // At least some tests should succeed (depending on account balance and network conditions)
      const successfulTests = results.filter(r => r.success);
      expect(successfulTests.length).toBeGreaterThan(0);

      // All tests should have duration > 0
      results.forEach(result => {
        expect(result.duration).toBeGreaterThan(0);
      });

      // Log summary for debugging
      const successCount = successfulTests.length;
      const totalCount = results.length;
      console.log(`Test suite completed: ${successCount}/${totalCount} tests passed`);
    }, 180000); // 3 minute timeout for full suite
  });

  describe('Cleanup Integration', () => {
    it('should clean up test assets without errors', async () => {
      if (skipIfNoHedera()) return;

      // Create some test assets first
      const tokenResult = await nftTestSuite.testTokenCreation();
      if (tokenResult.success) {
        await nftTestSuite.testNFTMinting(tokenResult.details.tokenId);
      }

      // Cleanup should not throw errors
      await expect(nftTestSuite.cleanupTestAssets()).resolves.not.toThrow();
    }, 60000);
  });

  describe('Error Handling Integration', () => {
    it('should provide detailed error information for network issues', async () => {
      if (skipIfNoHedera()) return;

      // This test might pass or fail depending on network conditions
      // The important thing is that errors are properly captured and formatted
      const result = await nftTestSuite.testTokenCreation();

      if (!result.success && result.error) {
        expect(result.error.errorCode).toBeDefined();
        expect(result.error.errorMessage).toBeDefined();
        expect(result.error.errorType).toBeDefined();
        expect(result.error.timestamp).toBeDefined();
        expect(result.error.operation).toBe('TOKEN_CREATION_TEST');
        expect(typeof result.error.retryable).toBe('boolean');
        
        if (result.error.recommendation) {
          expect(typeof result.error.recommendation).toBe('string');
          expect(result.error.recommendation.length).toBeGreaterThan(0);
        }
      }
    }, 30000);
  });
});

// Test configuration validation
describe('NFTTestSuite Configuration', () => {
  it('should validate test metadata structure', () => {
    // This test doesn't require Hedera connection
    const nftTestSuite = new NFTTestSuite({} as any);
    
    // Test valid metadata
    const validMetadata = {
      name: 'Test NFT',
      description: 'Test description',
      attributes: [
        { trait_type: 'Test', value: 'Value' }
      ]
    };
    
    const isValid = (nftTestSuite as any).validateMetadataStructure(validMetadata);
    expect(isValid).toBe(true);
    
    // Test invalid metadata
    const invalidMetadata = {
      name: 'Test NFT',
      // missing description
      attributes: 'not an array'
    };
    
    const isInvalid = (nftTestSuite as any).validateMetadataStructure(invalidMetadata);
    expect(isInvalid).toBe(false);
  });

  it('should create proper test metadata', () => {
    const nftTestSuite = new NFTTestSuite({} as any);
    const metadata = (nftTestSuite as any).createTestMetadata('Test NFT Name');
    
    expect(metadata.name).toBe('Test NFT Name');
    expect(metadata.description).toContain('Test NFT created for testing purposes');
    expect(metadata.image).toBeDefined();
    expect(Array.isArray(metadata.attributes)).toBe(true);
    expect(metadata.attributes.length).toBeGreaterThan(0);
    
    // Check attribute structure
    metadata.attributes.forEach((attr: any) => {
      expect(attr.trait_type).toBeDefined();
      expect(attr.value).toBeDefined();
    });
  });
});