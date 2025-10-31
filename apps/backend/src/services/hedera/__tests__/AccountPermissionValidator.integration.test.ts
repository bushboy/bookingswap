import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, AccountId } from '@hashgraph/sdk';
import { AccountPermissionValidator } from '../AccountPermissionValidator';
import { HederaService } from '../HederaService';
import { getHederaConfig } from '../config';

/**
 * Integration tests for AccountPermissionValidator
 * These tests require actual Hedera network connectivity and valid credentials
 * 
 * To run these tests:
 * 1. Set up your .env file with valid Hedera testnet credentials
 * 2. Run: npm run test:integration
 */
describe('AccountPermissionValidator Integration Tests', () => {
  let validator: AccountPermissionValidator;
  let hederaService: HederaService;
  let client: Client;
  let config: any;

  beforeAll(async () => {
    try {
      // Get configuration
      config = getHederaConfig();
      
      // Initialize Hedera client
      client = config.network === 'testnet' 
        ? Client.forTestnet() 
        : Client.forMainnet();
      
      const operatorAccountId = AccountId.fromString(config.accountId);
      client.setOperator(operatorAccountId, config.privateKey);

      // Create validator and service instances
      validator = new AccountPermissionValidator(client, operatorAccountId);
      hederaService = new HederaService(
        config.network,
        config.accountId,
        config.privateKey,
        config.topicId
      );
    } catch (error) {
      console.warn('Skipping integration tests - Hedera configuration not available:', error.message);
      throw error;
    }
  });

  afterAll(async () => {
    if (client) {
      client.close();
    }
    if (hederaService) {
      hederaService.close();
    }
  });

  it('should validate operator account balance', async () => {
    const result = await validator.validateAccountBalance(config.accountId);
    
    expect(result.check).toBe('account_balance');
    
    if (result.passed) {
      const balanceData = JSON.parse(result.details);
      expect(balanceData).toHaveProperty('hbar');
      expect(balanceData).toHaveProperty('sufficient');
      expect(balanceData).toHaveProperty('minimumRequired');
      expect(balanceData).toHaveProperty('recommendedAmount');
      expect(typeof balanceData.sufficient).toBe('boolean');
    } else {
      // If balance validation fails, it should provide helpful information
      expect(result.details).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    }
  });

  it('should verify minimum balance for different operations', async () => {
    const operations = ['mint', 'transfer', 'create_token'] as const;
    
    for (const operation of operations) {
      const hasMinimum = await validator.verifyMinimumBalance(config.accountId, operation);
      expect(typeof hasMinimum).toBe('boolean');
    }
  });

  it('should perform comprehensive account validation', async () => {
    const report = await validator.validateAccount(config.accountId);
    
    // Validate report structure
    expect(report).toHaveProperty('accountId', config.accountId);
    expect(report).toHaveProperty('accountExists');
    expect(report).toHaveProperty('balance');
    expect(report).toHaveProperty('tokenPermissions');
    expect(report).toHaveProperty('canMintNFTs');
    expect(report).toHaveProperty('canTransferNFTs');
    expect(report).toHaveProperty('issues');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('validationTimestamp');
    
    // Validate balance structure
    expect(report.balance).toHaveProperty('hbar');
    expect(report.balance).toHaveProperty('sufficient');
    expect(report.balance).toHaveProperty('minimumRequired');
    expect(report.balance).toHaveProperty('recommendedAmount');
    
    // Validate token permissions structure
    expect(report.tokenPermissions).toHaveProperty('hasSupplyKey');
    expect(report.tokenPermissions).toHaveProperty('hasAdminKey');
    expect(report.tokenPermissions).toHaveProperty('canMintNFTs');
    expect(report.tokenPermissions).toHaveProperty('canManageToken');
    
    // Validate arrays
    expect(Array.isArray(report.issues)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    
    // Validate timestamp
    expect(report.validationTimestamp).toBeInstanceOf(Date);
    
    // If account exists, it should have some balance information
    if (report.accountExists) {
      expect(report.balance.hbar).toBeTruthy();
    }
  });

  it('should handle invalid account ID gracefully', async () => {
    const result = await validator.validateAccountBalance('0.0.999999999');
    
    expect(result.check).toBe('account_balance');
    expect(result.passed).toBe(false);
    expect(result.details).toContain('validation failed');
    expect(result.errorDetails).toBeDefined();
    expect(result.recommendation).toBeTruthy();
  });

  it('should manage balance requirements configuration', () => {
    const originalRequirements = validator.getBalanceRequirements();
    
    // Validate default requirements structure
    expect(originalRequirements).toHaveProperty('minimumHbarForNFTOperations');
    expect(originalRequirements).toHaveProperty('recommendedHbarBuffer');
    expect(originalRequirements).toHaveProperty('tokenCreationCost');
    expect(originalRequirements).toHaveProperty('nftMintingCost');
    expect(originalRequirements).toHaveProperty('nftTransferCost');
    
    // Update requirements
    const newRequirements = {
      minimumHbarForNFTOperations: 15,
      recommendedHbarBuffer: 30,
    };
    
    validator.setBalanceRequirements(newRequirements);
    
    const updatedRequirements = validator.getBalanceRequirements();
    expect(updatedRequirements.minimumHbarForNFTOperations).toBe(15);
    expect(updatedRequirements.recommendedHbarBuffer).toBe(30);
    
    // Other values should remain unchanged
    expect(updatedRequirements.tokenCreationCost).toBe(originalRequirements.tokenCreationCost);
    expect(updatedRequirements.nftMintingCost).toBe(originalRequirements.nftMintingCost);
    expect(updatedRequirements.nftTransferCost).toBe(originalRequirements.nftTransferCost);
  });

  it('should integrate with HederaService for balance checks', async () => {
    // Get balance using HederaService
    const hederaBalance = await hederaService.getAccountBalance();
    
    // Get balance using AccountPermissionValidator
    const validatorResult = await validator.validateAccountBalance(config.accountId);
    
    if (validatorResult.passed) {
      const validatorBalanceData = JSON.parse(validatorResult.details);
      const validatorBalance = parseFloat(validatorBalanceData.hbar);
      const hederaBalanceValue = hederaBalance.toBigNumber().toNumber();
      
      // Balances should be approximately equal (allowing for small timing differences)
      expect(Math.abs(validatorBalance - hederaBalanceValue)).toBeLessThan(0.1);
    }
  });

  // Skip token-specific tests if no test token is configured
  it.skipIf(!process.env.HEDERA_TEST_TOKEN_ID)('should validate token permissions when token ID is provided', async () => {
    const tokenId = process.env.HEDERA_TEST_TOKEN_ID!;
    
    const result = await validator.validateTokenPermissions(tokenId, config.accountId);
    
    expect(result.check).toBe('token_permissions');
    
    if (result.passed) {
      const tokenData = JSON.parse(result.details);
      expect(tokenData).toHaveProperty('permissions');
      expect(tokenData).toHaveProperty('tokenInfo');
      
      // Validate permissions structure
      expect(tokenData.permissions).toHaveProperty('hasSupplyKey');
      expect(tokenData.permissions).toHaveProperty('hasAdminKey');
      expect(tokenData.permissions).toHaveProperty('canMintNFTs');
      expect(tokenData.permissions).toHaveProperty('canManageToken');
      
      // Validate token info structure
      expect(tokenData.tokenInfo).toHaveProperty('tokenId');
      expect(tokenData.tokenInfo).toHaveProperty('name');
      expect(tokenData.tokenInfo).toHaveProperty('symbol');
    } else {
      expect(result.details).toBeTruthy();
      expect(result.errorDetails).toBeDefined();
    }
  });

  it.skipIf(!process.env.HEDERA_TEST_TOKEN_ID)('should perform comprehensive validation with token', async () => {
    const tokenId = process.env.HEDERA_TEST_TOKEN_ID!;
    
    const report = await validator.validateAccount(config.accountId, tokenId);
    
    expect(report.accountId).toBe(config.accountId);
    expect(report.tokenExists).toBe(true);
    
    if (report.tokenExists) {
      expect(report.tokenInfo).toBeDefined();
      expect(report.tokenInfo.tokenId).toBe(tokenId);
    }
  });
}, 30000); // 30 second timeout for integration tests