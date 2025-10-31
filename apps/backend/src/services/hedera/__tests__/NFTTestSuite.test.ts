import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Client,
  AccountId,
  PrivateKey,
  TokenId,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenNftTransferTransaction,
  TokenInfoQuery,
  TokenNftInfoQuery,
  TokenBurnTransaction,
  TokenDeleteTransaction,
  NftId,
  Status,
  TransactionReceipt,
  TransactionResponse,
} from '@hashgraph/sdk';
import { NFTTestSuite, NFTTestResult } from '../NFTTestSuite';
import { HederaService } from '../HederaService';
import { HederaErrorType } from '../HederaErrorReporter';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Hedera SDK
vi.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: vi.fn(),
  },
  AccountId: {
    fromString: vi.fn(),
  },
  PrivateKey: {
    fromString: vi.fn(),
  },
  TokenId: {
    fromString: vi.fn(),
  },
  TokenCreateTransaction: vi.fn(),
  TokenMintTransaction: vi.fn(),
  TokenNftTransferTransaction: vi.fn(),
  TokenInfoQuery: vi.fn(),
  TokenNftInfoQuery: vi.fn(),
  TokenBurnTransaction: vi.fn(),
  TokenDeleteTransaction: vi.fn(),
  NftId: vi.fn(),
  TokenType: {
    NonFungibleUnique: 'NON_FUNGIBLE_UNIQUE',
  },
  TokenSupplyType: {
    Infinite: 'INFINITE',
  },
  Status: {
    Success: 'SUCCESS',
    InsufficientAccountBalance: 'INSUFFICIENT_ACCOUNT_BALANCE',
    InvalidTokenId: 'INVALID_TOKEN_ID',
  },
}));

describe('NFTTestSuite', () => {
  let nftTestSuite: NFTTestSuite;
  let mockHederaService: any;
  let mockClient: any;
  let mockOperatorAccountId: any;
  let mockOperatorPrivateKey: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock objects
    mockClient = {
      execute: vi.fn(),
    };

    mockOperatorAccountId = {
      toString: vi.fn().mockReturnValue('0.0.12345'),
    };

    mockOperatorPrivateKey = {
      toString: vi.fn().mockReturnValue('mock-private-key'),
    };

    mockHederaService = {
      client: mockClient,
      operatorAccountId: mockOperatorAccountId,
      operatorPrivateKey: mockOperatorPrivateKey,
    };

    // Make the private properties accessible for testing
    nftTestSuite = new NFTTestSuite(mockHederaService);
    (nftTestSuite as any).client = mockClient;
    (nftTestSuite as any).operatorAccountId = mockOperatorAccountId;
    (nftTestSuite as any).operatorPrivateKey = mockOperatorPrivateKey;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('testTokenCreation', () => {
    it('should successfully create a test token', async () => {
      // Mock successful token creation
      const mockTokenId = { toString: () => '0.0.67890' };
      const mockTransactionId = { toString: () => 'test-tx-id' };
      const mockReceipt = { tokenId: mockTokenId };
      const mockResponse = {
        transactionId: mockTransactionId,
        getReceipt: vi.fn().mockResolvedValue(mockReceipt),
      };

      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockResponse),
      };

      const mockTokenInfo = {
        name: 'Test NFT Token',
        symbol: 'TNFT',
        tokenType: { toString: () => 'NON_FUNGIBLE_UNIQUE' },
        supplyType: { toString: () => 'INFINITE' },
        totalSupply: { toString: () => '0' },
        treasuryAccountId: { toString: () => '0.0.12345' },
      };

      const mockTokenInfoQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      // Mock constructors
      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);
      (TokenInfoQuery as any).mockImplementation(() => mockTokenInfoQuery);
      (TokenId.fromString as any).mockReturnValue(mockTokenId);

      const result = await nftTestSuite.testTokenCreation();

      expect(result.success).toBe(true);
      expect(result.testName).toBe('Token Creation Test');
      expect(result.transactionId).toBe('test-tx-id');
      expect(result.details.tokenId).toBe('0.0.67890');
      expect(result.details.tokenName).toBe('Test NFT Token');
      expect(result.details.tokenSymbol).toBe('TNFT');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle token creation failure', async () => {
      const mockError = new Error('Insufficient account balance');
      (mockError as any).status = Status.InsufficientAccountBalance;

      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);

      const result = await nftTestSuite.testTokenCreation();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.errorType).toBe(HederaErrorType.INSUFFICIENT_BALANCE);
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe('testNFTMinting', () => {
    it('should successfully mint an NFT with provided token ID', async () => {
      const tokenId = '0.0.67890';
      const mockSerialNumber = 1;
      const mockTransactionId = { toString: () => 'mint-tx-id' };
      const mockReceipt = { serials: [{ toNumber: () => mockSerialNumber }] };
      const mockResponse = {
        transactionId: mockTransactionId,
        getReceipt: vi.fn().mockResolvedValue(mockReceipt),
      };

      const mockMintTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockResponse),
      };

      const mockNftInfo = {
        nftId: { toString: () => `${tokenId}/${mockSerialNumber}` },
        accountId: { toString: () => '0.0.12345' },
        creationTime: { toString: () => '2024-01-01T00:00:00Z' },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT #1' })),
      };

      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockNftInfo),
      };

      (TokenMintTransaction as any).mockImplementation(() => mockMintTx);
      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });
      (NftId as any).mockImplementation(() => ({}));

      const result = await nftTestSuite.testNFTMinting(tokenId);

      expect(result.success).toBe(true);
      expect(result.testName).toBe('NFT Minting Test');
      expect(result.transactionId).toBe('mint-tx-id');
      expect(result.details.tokenId).toBe(tokenId);
      expect(result.details.serialNumber).toBe(mockSerialNumber);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should create token and mint NFT when no token ID provided', async () => {
      // Mock token creation first
      const mockTokenId = { toString: () => '0.0.67890' };
      const mockCreateResponse = {
        transactionId: { toString: () => 'create-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({ tokenId: mockTokenId }),
      };

      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockCreateResponse),
      };

      const mockTokenInfo = {
        name: 'Test NFT Token',
        symbol: 'TNFT',
        tokenType: { toString: () => 'NON_FUNGIBLE_UNIQUE' },
        supplyType: { toString: () => 'INFINITE' },
        totalSupply: { toString: () => '0' },
        treasuryAccountId: { toString: () => '0.0.12345' },
      };

      const mockTokenInfoQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      // Mock minting
      const mockSerialNumber = 1;
      const mockMintResponse = {
        transactionId: { toString: () => 'mint-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({ serials: [{ toNumber: () => mockSerialNumber }] }),
      };

      const mockMintTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockMintResponse),
      };

      const mockNftInfo = {
        nftId: { toString: () => `0.0.67890/${mockSerialNumber}` },
        accountId: { toString: () => '0.0.12345' },
        creationTime: { toString: () => '2024-01-01T00:00:00Z' },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT #1' })),
      };

      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockNftInfo),
      };

      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);
      (TokenInfoQuery as any).mockImplementation(() => mockTokenInfoQuery);
      (TokenMintTransaction as any).mockImplementation(() => mockMintTx);
      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (TokenId.fromString as any).mockReturnValue(mockTokenId);
      (NftId as any).mockImplementation(() => ({}));

      const result = await nftTestSuite.testNFTMinting();

      expect(result.success).toBe(true);
      expect(result.details.tokenId).toBe('0.0.67890');
      expect(result.details.serialNumber).toBe(mockSerialNumber);
    });

    it('should handle minting failure', async () => {
      const tokenId = '0.0.67890';
      const mockError = new Error('Invalid token ID');
      (mockError as any).status = Status.InvalidTokenId;

      const mockMintTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      (TokenMintTransaction as any).mockImplementation(() => mockMintTx);
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });

      const result = await nftTestSuite.testNFTMinting(tokenId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.errorType).toBe(HederaErrorType.INVALID_TOKEN_ID);
    });
  });

  describe('testNFTTransfer', () => {
    it('should handle same account transfer (operator to operator)', async () => {
      const tokenId = '0.0.67890';
      const serialNumber = 1;
      const operatorAccount = '0.0.12345';

      const mockNftInfo = {
        nftId: { toString: () => `${tokenId}/${serialNumber}` },
        accountId: { toString: () => operatorAccount },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT' })),
      };

      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockNftInfo),
      };

      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (NftId as any).mockImplementation(() => ({}));
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });

      const result = await nftTestSuite.testNFTTransfer(tokenId, serialNumber, operatorAccount);

      expect(result.success).toBe(true);
      expect(result.testName).toBe('NFT Transfer Test');
      expect(result.details.fromAccount).toBe(operatorAccount);
      expect(result.details.toAccount).toBe(operatorAccount);
      expect(result.details.note).toContain('same account');
    });

    it('should handle transfer to different account', async () => {
      const tokenId = '0.0.67890';
      const serialNumber = 1;
      const toAccount = '0.0.54321';

      const mockNftInfoBefore = {
        nftId: { toString: () => `${tokenId}/${serialNumber}` },
        accountId: { toString: () => '0.0.12345' },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT' })),
      };

      const mockNftInfoAfter = {
        nftId: { toString: () => `${tokenId}/${serialNumber}` },
        accountId: { toString: () => toAccount },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT' })),
      };

      const mockTransferResponse = {
        transactionId: { toString: () => 'transfer-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({}),
      };

      const mockTransferTx = {
        setNftId: vi.fn().mockReturnThis(),
        setSenderAccountId: vi.fn().mockReturnThis(),
        setReceiverAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTransferResponse),
      };

      let callCount = 0;
      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve(callCount === 1 ? mockNftInfoBefore : mockNftInfoAfter);
        }),
      };

      (TokenNftTransferTransaction as any).mockImplementation(() => mockTransferTx);
      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (NftId as any).mockImplementation(() => ({}));
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });
      (AccountId.fromString as any).mockReturnValue({ toString: () => toAccount });

      const result = await nftTestSuite.testNFTTransfer(tokenId, serialNumber, toAccount);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('transfer-tx-id');
      expect(result.details.nftInfoBefore.accountId).toBe('0.0.12345');
      expect(result.details.nftInfoAfter.accountId).toBe(toAccount);
    });

    it('should handle transfer failure', async () => {
      const tokenId = '0.0.67890';
      const serialNumber = 1;
      const toAccount = '0.0.54321';

      const mockNftInfo = {
        nftId: { toString: () => `${tokenId}/${serialNumber}` },
        accountId: { toString: () => '0.0.12345' },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT' })),
      };

      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockNftInfo),
      };

      const mockError = new Error('Token not associated to account');
      const mockTransferTx = {
        setNftId: vi.fn().mockReturnThis(),
        setSenderAccountId: vi.fn().mockReturnThis(),
        setReceiverAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      (TokenNftTransferTransaction as any).mockImplementation(() => mockTransferTx);
      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (NftId as any).mockImplementation(() => ({}));
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });
      (AccountId.fromString as any).mockReturnValue({ toString: () => toAccount });

      const result = await nftTestSuite.testNFTTransfer(tokenId, serialNumber, toAccount);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.errorType).toBe(HederaErrorType.TOKEN_NOT_ASSOCIATED);
    });
  });

  describe('testNFTQuery', () => {
    it('should successfully query NFT and validate metadata', async () => {
      const tokenId = '0.0.67890';
      const serialNumber = 1;

      const testMetadata = {
        name: 'Test NFT',
        description: 'Test description',
        attributes: [
          { trait_type: 'Test Type', value: 'Automated Test' },
        ],
      };

      const mockNftInfo = {
        nftId: { toString: () => `${tokenId}/${serialNumber}` },
        accountId: { toString: () => '0.0.12345' },
        creationTime: { toString: () => '2024-01-01T00:00:00Z' },
        metadata: Buffer.from(JSON.stringify(testMetadata)),
      };

      const mockTokenInfo = {
        name: 'Test NFT Token',
        symbol: 'TNFT',
        tokenType: { toString: () => 'NON_FUNGIBLE_UNIQUE' },
        supplyType: { toString: () => 'INFINITE' },
        totalSupply: { toString: () => '1' },
        treasuryAccountId: { toString: () => '0.0.12345' },
      };

      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockNftInfo),
      };

      const mockTokenInfoQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (TokenInfoQuery as any).mockImplementation(() => mockTokenInfoQuery);
      (NftId as any).mockImplementation(() => ({}));
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });

      const result = await nftTestSuite.testNFTQuery(tokenId, serialNumber);

      expect(result.success).toBe(true);
      expect(result.testName).toBe('NFT Query and Metadata Test');
      expect(result.details.nftInfo.metadataValid).toBe(true);
      expect(result.details.nftInfo.metadata).toEqual(testMetadata);
      expect(result.details.tokenInfo.name).toBe('Test NFT Token');
    });

    it('should handle query failure', async () => {
      const tokenId = '0.0.67890';
      const serialNumber = 999999;

      const mockError = new Error('NFT not found');
      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (NftId as any).mockImplementation(() => ({}));
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });

      const result = await nftTestSuite.testNFTQuery(tokenId, serialNumber);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('runFullTestSuite', () => {
    it('should run all tests in sequence', async () => {
      // Mock successful token creation
      const mockTokenId = { toString: () => '0.0.67890' };
      const mockCreateResponse = {
        transactionId: { toString: () => 'create-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({ tokenId: mockTokenId }),
      };

      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockCreateResponse),
      };

      const mockTokenInfo = {
        name: 'Test NFT Token',
        symbol: 'TNFT',
        tokenType: { toString: () => 'NON_FUNGIBLE_UNIQUE' },
        supplyType: { toString: () => 'INFINITE' },
        totalSupply: { toString: () => '0' },
        treasuryAccountId: { toString: () => '0.0.12345' },
      };

      const mockTokenInfoQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      // Mock successful minting
      const mockMintResponse = {
        transactionId: { toString: () => 'mint-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({ serials: [{ toNumber: () => 1 }] }),
      };

      const mockMintTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockMintResponse),
      };

      const mockNftInfo = {
        nftId: { toString: () => '0.0.67890/1' },
        accountId: { toString: () => '0.0.12345' },
        creationTime: { toString: () => '2024-01-01T00:00:00Z' },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT #1', description: 'Test' })),
      };

      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockNftInfo),
      };

      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);
      (TokenInfoQuery as any).mockImplementation(() => mockTokenInfoQuery);
      (TokenMintTransaction as any).mockImplementation(() => mockMintTx);
      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (TokenId.fromString as any).mockReturnValue(mockTokenId);
      (NftId as any).mockImplementation(() => ({}));

      const results = await nftTestSuite.runFullTestSuite();

      expect(results).toHaveLength(6); // 1 creation + 1 minting + 1 query + 1 transfer + 2 failure tests
      expect(results[0].testName).toBe('Token Creation Test');
      expect(results[1].testName).toBe('NFT Minting Test');
      expect(results[2].testName).toBe('NFT Query and Metadata Test');
      expect(results[3].testName).toBe('NFT Transfer Test');
    });
  });

  describe('cleanupTestAssets', () => {
    it('should clean up test tokens and NFTs', async () => {
      // Set up test data
      (nftTestSuite as any).testTokenIds = ['0.0.67890'];
      (nftTestSuite as any).testSerialNumbers = new Map([['0.0.67890', [1, 2]]]);

      const mockBurnTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setSerials: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({}),
      };

      const mockDeleteTx = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({}),
      };

      (TokenBurnTransaction as any).mockImplementation(() => mockBurnTx);
      (TokenDeleteTransaction as any).mockImplementation(() => mockDeleteTx);
      (TokenId.fromString as any).mockReturnValue({ toString: () => '0.0.67890' });

      await nftTestSuite.cleanupTestAssets();

      expect(mockBurnTx.execute).toHaveBeenCalledTimes(2); // 2 NFTs to burn
      expect(mockDeleteTx.execute).toHaveBeenCalledTimes(1); // 1 token to delete
      expect((nftTestSuite as any).testTokenIds).toHaveLength(0);
      expect((nftTestSuite as any).testSerialNumbers.size).toBe(0);
    });

    it('should handle cleanup failures gracefully', async () => {
      // Set up test data
      (nftTestSuite as any).testTokenIds = ['0.0.67890'];
      (nftTestSuite as any).testSerialNumbers = new Map([['0.0.67890', [1]]]);

      const mockBurnTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setSerials: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(new Error('Burn failed')),
      };

      const mockDeleteTx = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(new Error('Delete failed')),
      };

      (TokenBurnTransaction as any).mockImplementation(() => mockBurnTx);
      (TokenDeleteTransaction as any).mockImplementation(() => mockDeleteTx);
      (TokenId.fromString as any).mockReturnValue({ toString: () => '0.0.67890' });

      // Should not throw despite failures
      await expect(nftTestSuite.cleanupTestAssets()).resolves.toBeUndefined();

      // Arrays should still be cleared
      expect((nftTestSuite as any).testTokenIds).toHaveLength(0);
      expect((nftTestSuite as any).testSerialNumbers.size).toBe(0);
    });
  });

  describe('failure scenario tests', () => {
    it('should test invalid token operations correctly', async () => {
      const mockError = new Error('Invalid token ID');
      (mockError as any).status = Status.InvalidTokenId;

      const mockMintTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(mockError),
      };

      (TokenMintTransaction as any).mockImplementation(() => mockMintTx);
      (TokenId.fromString as any).mockReturnValue({ toString: () => '0.0.999999999' });

      const results = await nftTestSuite.testFailureScenarios();
      const invalidTokenTest = results.find(r => r.testName === 'Invalid Token Operation Test');

      expect(invalidTokenTest).toBeDefined();
      expect(invalidTokenTest?.success).toBe(true); // Expected failure is success
      expect(invalidTokenTest?.details.expectedError).toBe(true);
      expect(invalidTokenTest?.details.errorType).toBe(HederaErrorType.INVALID_TOKEN_ID);
    });

    it('should test invalid account transfer correctly', async () => {
      // Mock successful token creation and minting for setup
      const mockTokenId = { toString: () => '0.0.67890' };
      const mockCreateResponse = {
        transactionId: { toString: () => 'create-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({ tokenId: mockTokenId }),
      };

      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockCreateResponse),
      };

      const mockTokenInfo = {
        name: 'Test NFT Token',
        symbol: 'TNFT',
        tokenType: { toString: () => 'NON_FUNGIBLE_UNIQUE' },
        supplyType: { toString: () => 'INFINITE' },
        totalSupply: { toString: () => '0' },
        treasuryAccountId: { toString: () => '0.0.12345' },
      };

      const mockTokenInfoQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      const mockMintResponse = {
        transactionId: { toString: () => 'mint-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({ serials: [{ toNumber: () => 1 }] }),
      };

      const mockMintTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockMintResponse),
      };

      const mockNftInfo = {
        nftId: { toString: () => '0.0.67890/1' },
        accountId: { toString: () => '0.0.12345' },
        creationTime: { toString: () => '2024-01-01T00:00:00Z' },
        metadata: Buffer.from(JSON.stringify({ name: 'Test NFT #1', description: 'Test' })),
      };

      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockNftInfo),
      };

      // Mock transfer failure
      const transferError = new Error('Invalid account ID');
      const mockTransferTx = {
        setNftId: vi.fn().mockReturnThis(),
        setSenderAccountId: vi.fn().mockReturnThis(),
        setReceiverAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(transferError),
      };

      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);
      (TokenInfoQuery as any).mockImplementation(() => mockTokenInfoQuery);
      (TokenMintTransaction as any).mockImplementation(() => mockMintTx);
      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (TokenNftTransferTransaction as any).mockImplementation(() => mockTransferTx);
      (TokenId.fromString as any).mockReturnValue(mockTokenId);
      (NftId as any).mockImplementation(() => ({}));
      (AccountId.fromString as any).mockReturnValue({ toString: () => '0.0.999999999' });

      const results = await nftTestSuite.testFailureScenarios();
      const invalidAccountTest = results.find(r => r.testName === 'Invalid Account Transfer Test');

      expect(invalidAccountTest).toBeDefined();
      expect(invalidAccountTest?.success).toBe(true); // Expected failure is success
      expect(invalidAccountTest?.details.expectedError).toBe(true);
    });

    it('should test non-existent NFT query correctly', async () => {
      // Mock successful token creation
      const mockTokenId = { toString: () => '0.0.67890' };
      const mockCreateResponse = {
        transactionId: { toString: () => 'create-tx-id' },
        getReceipt: vi.fn().mockResolvedValue({ tokenId: mockTokenId }),
      };

      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockCreateResponse),
      };

      const mockTokenInfo = {
        name: 'Test NFT Token',
        symbol: 'TNFT',
        tokenType: { toString: () => 'NON_FUNGIBLE_UNIQUE' },
        supplyType: { toString: () => 'INFINITE' },
        totalSupply: { toString: () => '0' },
        treasuryAccountId: { toString: () => '0.0.12345' },
      };

      const mockTokenInfoQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTokenInfo),
      };

      // Mock NFT query failure
      const queryError = new Error('NFT not found');
      const mockNftInfoQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(queryError),
      };

      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);
      (TokenInfoQuery as any).mockImplementation(() => mockTokenInfoQuery);
      (TokenNftInfoQuery as any).mockImplementation(() => mockNftInfoQuery);
      (TokenId.fromString as any).mockReturnValue(mockTokenId);
      (NftId as any).mockImplementation(() => ({}));

      const results = await nftTestSuite.testFailureScenarios();
      const nonExistentTest = results.find(r => r.testName === 'Non-existent NFT Query Test');

      expect(nonExistentTest).toBeDefined();
      expect(nonExistentTest?.success).toBe(true); // Expected failure is success
      expect(nonExistentTest?.details.expectedError).toBe(true);
    });
  });

  describe('metadata validation', () => {
    it('should validate correct metadata structure', () => {
      const validMetadata = {
        name: 'Test NFT',
        description: 'Test description',
        image: 'https://example.com/image.png',
        attributes: [
          { trait_type: 'Color', value: 'Blue' },
          { trait_type: 'Size', value: 'Large' },
        ],
      };

      // Access private method for testing
      const isValid = (nftTestSuite as any).validateMetadataStructure(validMetadata);
      expect(isValid).toBe(true);
    });

    it('should reject invalid metadata structure', () => {
      const testCases = [
        null,
        undefined,
        'string instead of object',
        {},
        { name: 'Test' }, // Missing description
        { name: 'Test', description: 'Test', attributes: 'invalid' }, // Invalid attributes
        { name: 'Test', description: 'Test', attributes: [{ trait_type: 'Color' }] }, // Missing value
      ];

      testCases.forEach(invalidMetadata => {
        const isValid = (nftTestSuite as any).validateMetadataStructure(invalidMetadata);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('test metadata creation', () => {
    it('should create valid test metadata', () => {
      const metadata = (nftTestSuite as any).createTestMetadata('Test NFT Name');

      expect(metadata.name).toBe('Test NFT Name');
      expect(metadata.description).toContain('Test NFT created for testing purposes');
      expect(metadata.image).toBe('https://example.com/test-nft-image.png');
      expect(metadata.attributes).toHaveLength(3);
      expect(metadata.attributes[0].trait_type).toBe('Test Type');
      expect(metadata.attributes[0].value).toBe('Automated Test');
    });
  });

  describe('error handling in test operations', () => {
    it('should handle token creation failure in minting test', async () => {
      const createError = new Error('Token creation failed');
      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(createError),
      };

      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);

      const result = await nftTestSuite.testNFTMinting();

      expect(result.success).toBe(false);
      expect(result.error?.errorMessage).toContain('Token creation failed');
    });

    it('should handle missing serial numbers in mint receipt', async () => {
      const tokenId = '0.0.67890';
      const mockReceipt = { serials: [] }; // Empty serials array
      const mockResponse = {
        transactionId: { toString: () => 'mint-tx-id' },
        getReceipt: vi.fn().mockResolvedValue(mockReceipt),
      };

      const mockMintTx = {
        setTokenId: vi.fn().mockReturnThis(),
        setMetadata: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockResponse),
      };

      (TokenMintTransaction as any).mockImplementation(() => mockMintTx);
      (TokenId.fromString as any).mockReturnValue({ toString: () => tokenId });

      const result = await nftTestSuite.testNFTMinting(tokenId);

      expect(result.success).toBe(false);
      expect(result.error?.errorMessage).toContain('no serial numbers returned');
    });

    it('should handle missing token ID in creation receipt', async () => {
      const mockReceipt = { tokenId: null }; // No token ID
      const mockResponse = {
        transactionId: { toString: () => 'create-tx-id' },
        getReceipt: vi.fn().mockResolvedValue(mockReceipt),
      };

      const mockTokenCreateTx = {
        setTokenName: vi.fn().mockReturnThis(),
        setTokenSymbol: vi.fn().mockReturnThis(),
        setTokenType: vi.fn().mockReturnThis(),
        setDecimals: vi.fn().mockReturnThis(),
        setInitialSupply: vi.fn().mockReturnThis(),
        setTreasuryAccountId: vi.fn().mockReturnThis(),
        setSupplyType: vi.fn().mockReturnThis(),
        setSupplyKey: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setWipeKey: vi.fn().mockReturnThis(),
        setFreezeKey: vi.fn().mockReturnThis(),
        setKycKey: vi.fn().mockReturnThis(),
        setPauseKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockResponse),
      };

      (TokenCreateTransaction as any).mockImplementation(() => mockTokenCreateTx);

      const result = await nftTestSuite.testTokenCreation();

      expect(result.success).toBe(false);
      expect(result.error?.errorMessage).toContain('no token ID returned');
    });
  });
});