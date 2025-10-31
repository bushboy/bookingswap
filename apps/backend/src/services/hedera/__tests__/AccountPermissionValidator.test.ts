import {
  Client,
  AccountId,
  TokenId,
  AccountBalanceQuery,
  TokenInfoQuery,
  Hbar,
  Status,
  TokenType,
  TokenSupplyType,
  Key,
  PublicKey,
} from '@hashgraph/sdk';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccountPermissionValidator } from '../AccountPermissionValidator';
import { HederaErrorType } from '../HederaErrorReporter';

// Mock the Hedera SDK
vi.mock('@hashgraph/sdk');
vi.mock('../../utils/logger');

describe('AccountPermissionValidator', () => {
  let validator: AccountPermissionValidator;
  let mockClient: any;
  let mockOperatorAccountId: AccountId;

  beforeEach(() => {
    // Create mocked client and account ID
    mockClient = {
      execute: vi.fn(),
    } as any;

    mockOperatorAccountId = AccountId.fromString('0.0.123456');
    
    // Create validator instance
    validator = new AccountPermissionValidator(mockClient, mockOperatorAccountId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateAccountBalance', () => {
    it('should validate sufficient account balance', async () => {
      // Mock successful balance query
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 10, // 10 HBAR
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.validateAccountBalance('0.0.789012');

      expect(result.passed).toBe(true);
      expect(result.check).toBe('account_balance');
      
      const balanceData = JSON.parse(result.details);
      expect(balanceData.sufficient).toBe(true);
      expect(balanceData.hbar).toBe('10');
    });

    it('should detect insufficient account balance', async () => {
      // Mock insufficient balance
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 2, // 2 HBAR (below minimum of 5)
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.validateAccountBalance('0.0.789012');

      expect(result.passed).toBe(false);
      expect(result.check).toBe('account_balance');
      expect(result.details).toContain('Insufficient HBAR balance');
      expect(result.recommendation).toContain('Add at least 3 HBAR');
    });

    it('should handle account balance query errors', async () => {
      // Mock query error
      const mockError = new Error('Account not found');
      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.validateAccountBalance('0.0.invalid');

      expect(result.passed).toBe(false);
      expect(result.check).toBe('account_balance');
      expect(result.details).toContain('Account balance validation failed');
      expect(result.errorDetails).toBeDefined();
    });
  });

  describe('validateTokenPermissions', () => {
    it('should validate token permissions successfully', async () => {
      // Mock successful token info query
      const mockTokenInfo = {
        tokenId: TokenId.fromString('0.0.555666'),
        name: 'Test NFT Token',
        symbol: 'TNT',
        tokenType: TokenType.NonFungibleUnique,
        supplyType: TokenSupplyType.Infinite,
        totalSupply: 100,
        treasuryAccountId: mockOperatorAccountId,
        isDeleted: false,
        pauseStatus: false,
        supplyKey: Key.fromString(mockOperatorAccountId.toString()),
        adminKey: Key.fromString(mockOperatorAccountId.toString()),
        wipeKey: null,
        freezeKey: null,
        kycKey: null,
        pauseKey: null,
      };

      const mockTokenQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      vi.mocked(TokenInfoQuery).mockImplementation(() => mockTokenQuery);

      const result = await validator.validateTokenPermissions('0.0.555666', '0.0.123456');

      expect(result.passed).toBe(true);
      expect(result.check).toBe('token_permissions');
      
      const tokenData = JSON.parse(result.details);
      expect(tokenData.permissions.hasSupplyKey).toBe(true);
      expect(tokenData.permissions.hasAdminKey).toBe(true);
      expect(tokenData.permissions.canMintNFTs).toBe(true);
      expect(tokenData.tokenInfo.name).toBe('Test NFT Token');
    });

    it('should detect missing token permissions', async () => {
      // Mock token info with no keys for the account
      const mockTokenInfo = {
        tokenId: TokenId.fromString('0.0.555666'),
        name: 'Test NFT Token',
        symbol: 'TNT',
        tokenType: TokenType.NonFungibleUnique,
        supplyType: TokenSupplyType.Infinite,
        totalSupply: 100,
        treasuryAccountId: AccountId.fromString('0.0.999999'), // Different account
        isDeleted: false,
        pauseStatus: false,
        supplyKey: null,
        adminKey: null,
        wipeKey: null,
        freezeKey: null,
        kycKey: null,
        pauseKey: null,
      };

      const mockTokenQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      vi.mocked(TokenInfoQuery).mockImplementation(() => mockTokenQuery);

      const result = await validator.validateTokenPermissions('0.0.555666', '0.0.123456');

      expect(result.passed).toBe(true); // Query succeeds, but permissions are limited
      
      const tokenData = JSON.parse(result.details);
      expect(tokenData.permissions.hasSupplyKey).toBe(false);
      expect(tokenData.permissions.hasAdminKey).toBe(false);
      expect(tokenData.permissions.canMintNFTs).toBe(false);
    });

    it('should handle token query errors', async () => {
      // Mock query error
      const mockError = new Error('Token not found');
      const mockTokenQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(TokenInfoQuery).mockImplementation(() => mockTokenQuery);

      const result = await validator.validateTokenPermissions('0.0.invalid', '0.0.123456');

      expect(result.passed).toBe(false);
      expect(result.check).toBe('token_permissions');
      expect(result.details).toContain('Token permission validation failed');
      expect(result.errorDetails).toBeDefined();
    });
  });

  describe('validateAccount', () => {
    it('should perform comprehensive account validation', async () => {
      // Mock successful balance query
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 15, // 15 HBAR (sufficient)
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      // Mock successful token info query
      const mockTokenInfo = {
        tokenId: TokenId.fromString('0.0.555666'),
        name: 'Test NFT Token',
        symbol: 'TNT',
        tokenType: TokenType.NonFungibleUnique,
        supplyType: TokenSupplyType.Infinite,
        totalSupply: 100,
        treasuryAccountId: mockOperatorAccountId,
        isDeleted: false,
        pauseStatus: false,
        supplyKey: Key.fromString(mockOperatorAccountId.toString()),
        adminKey: Key.fromString(mockOperatorAccountId.toString()),
        wipeKey: null,
        freezeKey: null,
        kycKey: null,
        pauseKey: null,
      };

      const mockTokenQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);
      vi.mocked(TokenInfoQuery).mockImplementation(() => mockTokenQuery);

      const report = await validator.validateAccount('0.0.123456', '0.0.555666');

      expect(report.accountExists).toBe(true);
      expect(report.balance.sufficient).toBe(true);
      expect(report.tokenExists).toBe(true);
      expect(report.tokenPermissions.canMintNFTs).toBe(true);
      expect(report.canMintNFTs).toBe(true);
      expect(report.canTransferNFTs).toBe(true);
      expect(report.issues).toHaveLength(0);
      expect(report.recommendations).toContain('Account is properly configured for NFT operations');
    });

    it('should identify issues with insufficient balance', async () => {
      // Mock insufficient balance
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 2, // 2 HBAR (insufficient)
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const report = await validator.validateAccount('0.0.123456');

      expect(report.accountExists).toBe(true);
      expect(report.balance.sufficient).toBe(false);
      expect(report.canMintNFTs).toBe(false);
      expect(report.issues).toContain('Insufficient HBAR balance: 2 HBAR (minimum required: 5 HBAR)');
      expect(report.recommendations).toContain('Add at least 3 HBAR to meet minimum balance requirements');
    });

    it('should handle validation errors gracefully', async () => {
      // Mock balance query error
      const mockError = new Error('Network error');
      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const report = await validator.validateAccount('0.0.invalid');

      expect(report.accountExists).toBe(false);
      expect(report.balance.sufficient).toBe(false);
      expect(report.canMintNFTs).toBe(false);
      expect(report.issues).toContain('Validation failed: Network error');
      expect(report.recommendations).toContain('Check account configuration and network connectivity');
    });
  });

  describe('verifyMinimumBalance', () => {
    it('should verify sufficient balance for minting operations', async () => {
      // Mock sufficient balance
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 10, // 10 HBAR
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.verifyMinimumBalance('0.0.123456', 'mint');

      expect(result).toBe(true);
    });

    it('should detect insufficient balance for token creation', async () => {
      // Mock insufficient balance for token creation
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 10, // 10 HBAR (insufficient for 20 HBAR token creation)
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.verifyMinimumBalance('0.0.123456', 'create_token');

      expect(result).toBe(false);
    });

    it('should handle balance query errors', async () => {
      // Mock query error
      const mockError = new Error('Query failed');
      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.verifyMinimumBalance('0.0.invalid', 'mint');

      expect(result).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should update balance requirements', () => {
      const newRequirements = {
        minimumHbarForNFTOperations: 10,
        recommendedHbarBuffer: 20,
      };

      validator.setBalanceRequirements(newRequirements);

      const currentRequirements = validator.getBalanceRequirements();
      expect(currentRequirements.minimumHbarForNFTOperations).toBe(10);
      expect(currentRequirements.recommendedHbarBuffer).toBe(20);
      expect(currentRequirements.tokenCreationCost).toBe(20); // Should retain default
    });

    it('should return current balance requirements', () => {
      const requirements = validator.getBalanceRequirements();

      expect(requirements).toHaveProperty('minimumHbarForNFTOperations');
      expect(requirements).toHaveProperty('recommendedHbarBuffer');
      expect(requirements).toHaveProperty('tokenCreationCost');
      expect(requirements).toHaveProperty('nftMintingCost');
      expect(requirements).toHaveProperty('nftTransferCost');
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle malformed account IDs', async () => {
      const mockError = new Error('Invalid account ID format');
      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.validateAccountBalance('invalid-account-id');

      expect(result.passed).toBe(false);
      expect(result.details).toContain('Account balance validation failed');
      expect(result.errorDetails).toBeDefined();
    });

    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      
      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(timeoutError),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const result = await validator.validateAccountBalance('0.0.123456');

      expect(result.passed).toBe(false);
      expect(result.errorDetails?.errorType).toBe(HederaErrorType.TIMEOUT_ERROR);
    });

    it('should validate account with missing token permissions', async () => {
      // Mock successful balance query
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 15, // Sufficient balance
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      // Mock token info with no permissions
      const mockTokenInfo = {
        tokenId: TokenId.fromString('0.0.555666'),
        name: 'Restricted Token',
        symbol: 'RT',
        tokenType: TokenType.NonFungibleUnique,
        supplyType: TokenSupplyType.Infinite,
        totalSupply: 100,
        treasuryAccountId: AccountId.fromString('0.0.999999'), // Different account
        isDeleted: false,
        pauseStatus: false,
        supplyKey: null, // No supply key
        adminKey: null,  // No admin key
        wipeKey: null,
        freezeKey: null,
        kycKey: null,
        pauseKey: null,
      };

      const mockTokenQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);
      vi.mocked(TokenInfoQuery).mockImplementation(() => mockTokenQuery);

      const report = await validator.validateAccount('0.0.123456', '0.0.555666');

      expect(report.accountExists).toBe(true);
      expect(report.balance.sufficient).toBe(true);
      expect(report.tokenExists).toBe(true);
      expect(report.tokenPermissions.hasSupplyKey).toBe(false);
      expect(report.tokenPermissions.hasAdminKey).toBe(false);
      expect(report.tokenPermissions.canMintNFTs).toBe(false);
      expect(report.canMintNFTs).toBe(false); // Should be false due to missing permissions
      expect(report.recommendations).toContain('Ensure the account has supply key permissions for NFT minting operations');
    });

    it('should handle deleted tokens', async () => {
      // Mock successful balance query
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 15,
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      // Mock deleted token
      const mockTokenInfo = {
        tokenId: TokenId.fromString('0.0.555666'),
        name: 'Deleted Token',
        symbol: 'DT',
        tokenType: TokenType.NonFungibleUnique,
        supplyType: TokenSupplyType.Infinite,
        totalSupply: 0,
        treasuryAccountId: mockOperatorAccountId,
        isDeleted: true, // Token is deleted
        pauseStatus: false,
        supplyKey: Key.fromString(mockOperatorAccountId.toString()),
        adminKey: Key.fromString(mockOperatorAccountId.toString()),
        wipeKey: null,
        freezeKey: null,
        kycKey: null,
        pauseKey: null,
      };

      const mockTokenQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);
      vi.mocked(TokenInfoQuery).mockImplementation(() => mockTokenQuery);

      const report = await validator.validateAccount('0.0.123456', '0.0.555666');

      expect(report.tokenExists).toBe(true); // Query succeeds but token is deleted
      expect(report.tokenInfo?.deleted).toBe(true);
      expect(report.canMintNFTs).toBe(false); // Can't mint on deleted token
    });
  });

  describe('comprehensive validation scenarios', () => {
    it('should provide detailed recommendations for multiple issues', async () => {
      // Mock insufficient balance
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 1, // Very low balance
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const report = await validator.validateAccount('0.0.123456');

      expect(report.recommendations.length).toBeGreaterThan(1);
      expect(report.recommendations.some(r => r.includes('Add at least'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('Consider maintaining a balance'))).toBe(true);
    });

    it('should validate different operation types correctly', async () => {
      // Mock balance that's sufficient for minting but not token creation
      const mockBalance = {
        hbars: {
          toBigNumber: () => ({
            toNumber: () => 10, // 10 HBAR - enough for minting (0.1) but not token creation (20)
          }),
        },
      };

      const mockBalanceQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockBalance),
      };

      vi.mocked(AccountBalanceQuery).mockImplementation(() => mockBalanceQuery);

      const mintResult = await validator.verifyMinimumBalance('0.0.123456', 'mint');
      const transferResult = await validator.verifyMinimumBalance('0.0.123456', 'transfer');
      const createResult = await validator.verifyMinimumBalance('0.0.123456', 'create_token');

      expect(mintResult).toBe(true);
      expect(transferResult).toBe(true);
      expect(createResult).toBe(false);
    });
  });

  describe('token key validation', () => {
    it('should correctly identify token key ownership', async () => {
      // This test verifies the private hasTokenKey method behavior
      // by testing through the public validateTokenPermissions method
      
      const mockTokenInfo = {
        tokenId: TokenId.fromString('0.0.555666'),
        name: 'Test Token',
        symbol: 'TT',
        tokenType: TokenType.NonFungibleUnique,
        supplyType: TokenSupplyType.Infinite,
        totalSupply: 100,
        treasuryAccountId: mockOperatorAccountId,
        isDeleted: false,
        pauseStatus: false,
        supplyKey: Key.fromString(mockOperatorAccountId.toString()),
        adminKey: Key.fromString(mockOperatorAccountId.toString()),
        wipeKey: Key.fromString(mockOperatorAccountId.toString()),
        freezeKey: Key.fromString(mockOperatorAccountId.toString()),
        kycKey: Key.fromString(mockOperatorAccountId.toString()),
        pauseKey: Key.fromString(mockOperatorAccountId.toString()),
      };

      const mockTokenQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      vi.mocked(TokenInfoQuery).mockImplementation(() => mockTokenQuery);

      const result = await validator.validateTokenPermissions('0.0.555666', mockOperatorAccountId.toString());

      expect(result.passed).toBe(true);
      
      const tokenData = JSON.parse(result.details);
      expect(tokenData.permissions.hasSupplyKey).toBe(true);
      expect(tokenData.permissions.hasAdminKey).toBe(true);
      expect(tokenData.permissions.hasWipeKey).toBe(true);
      expect(tokenData.permissions.hasFreezeKey).toBe(true);
      expect(tokenData.permissions.hasKycKey).toBe(true);
      expect(tokenData.permissions.hasPauseKey).toBe(true);
      expect(tokenData.permissions.canMintNFTs).toBe(true);
      expect(tokenData.permissions.canManageToken).toBe(true);
    });
  });
});