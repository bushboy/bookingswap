import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionData } from '../HederaService';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock the entire Hedera SDK module
vi.mock('@hashgraph/sdk', () => {
  const mockClient = {
    setOperator: vi.fn(),
    close: vi.fn(),
  };

  const mockTransaction = {
    transactionId: { toString: () => 'test-transaction-id' },
    getReceipt: vi.fn(),
  };

  const mockReceipt = {
    status: { toString: () => 'SUCCESS' },
    consensusTimestamp: { toString: () => '1234567890.123456789' },
    topicId: { toString: () => '0.0.789012' },
    contractId: { toString: () => '0.0.123456' },
  };

  mockTransaction.getReceipt.mockResolvedValue(mockReceipt);

  return {
    Client: {
      forTestnet: () => mockClient,
      forMainnet: () => mockClient,
    },
    AccountId: {
      fromString: () => ({ toString: () => '0.0.123456' }),
    },
    PrivateKey: {
      fromString: () => ({ toString: () => 'test-private-key' }),
      generate: () => ({
        toString: () => 'generated-private-key',
        publicKey: { toString: () => 'generated-public-key' },
      }),
    },
    TopicId: {
      fromString: () => ({ toString: () => '0.0.789012' }),
    },
    ContractId: {
      fromString: () => ({ toString: () => '0.0.123456' }),
    },
    TransactionId: {
      fromString: () => ({ toString: () => 'test-transaction-id' }),
    },
    TopicCreateTransaction: function() {
      return {
        setTopicMemo: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTransaction),
      };
    },
    TopicMessageSubmitTransaction: function() {
      return {
        setTopicId: vi.fn().mockReturnThis(),
        setMessage: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTransaction),
      };
    },
    ContractCreateTransaction: function() {
      return {
        setBytecode: vi.fn().mockReturnThis(),
        setGas: vi.fn().mockReturnThis(),
        setConstructorParameters: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTransaction),
      };
    },
    ContractExecuteTransaction: function() {
      return {
        setContractId: vi.fn().mockReturnThis(),
        setGas: vi.fn().mockReturnThis(),
        setFunction: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockTransaction),
      };
    },
    TransactionReceiptQuery: function() {
      return {
        setTransactionId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(mockReceipt),
      };
    },
    AccountBalanceQuery: function() {
      return {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
          hbars: { toString: () => '100.0 ℏ' },
        }),
      };
    },
    TopicInfoQuery: function() {
      return {
        setTopicId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
          topicMemo: 'Test topic',
        }),
      };
    },
    Hbar: vi.fn(),
    Status: { Success: 'SUCCESS' },
  };
});

describe('HederaService', () => {
  let HederaService: any;

  beforeEach(async () => {
    // Dynamically import the service after mocks are set up
    const module = await import('../HederaService');
    HederaService = module.HederaService;
  });

  describe('constructor', () => {
    it('should initialize with testnet configuration', () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');
      expect(service.getOperatorAccountId()).toBe('0.0.123456');
      expect(service.getTopicId()).toBe('0.0.789012');
      service.close();
    });

    it('should initialize with mainnet configuration', () => {
      const service = new HederaService('mainnet', '0.0.123456', 'test-private-key');
      expect(service.getOperatorAccountId()).toBe('0.0.123456');
      service.close();
    });
  });

  describe('submitTransaction', () => {
    it('should submit transaction successfully', async () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');
      
      const transactionData: TransactionData = {
        type: 'booking_listing',
        payload: { bookingId: 'test-booking' },
        timestamp: new Date(),
      };

      const result = await service.submitTransaction(transactionData);

      expect(result).toEqual({
        transactionId: 'test-transaction-id',
        consensusTimestamp: '1234567890.123456789',
        status: 'SUCCESS',
        receipt: expect.any(Object),
      });

      service.close();
    });

    it('should throw error when topic ID is not configured', async () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key');
      
      const transactionData: TransactionData = {
        type: 'booking_listing',
        payload: { bookingId: 'test-booking' },
        timestamp: new Date(),
      };

      await expect(service.submitTransaction(transactionData))
        .rejects.toThrow('Topic ID not configured');

      service.close();
    });
  });

  describe('createSmartContract', () => {
    it('should create smart contract successfully', async () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');
      const bytecode = '0x608060405234801561001057600080fd5b50';

      const result = await service.createSmartContract(bytecode);

      expect(result).toEqual({
        contractId: '0.0.123456',
        transactionId: 'test-transaction-id',
        status: 'SUCCESS',
      });

      service.close();
    });
  });

  describe('executeContract', () => {
    it('should execute contract function successfully', async () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');
      const contractId = '0.0.123456';
      const functionName = 'transfer';
      const params = ['0x123', 100];

      const result = await service.executeContract(contractId, functionName, params);

      expect(result).toEqual({
        transactionId: 'test-transaction-id',
        consensusTimestamp: '1234567890.123456789',
        status: 'SUCCESS',
        receipt: expect.any(Object),
      });

      service.close();
    });
  });

  describe('createTopic', () => {
    it('should create topic successfully', async () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key');
      const memo = 'Test topic for booking swaps';

      const result = await service.createTopic(memo);

      expect(result).toBe('0.0.789012');
      service.close();
    });
  });

  describe('getAccountBalance', () => {
    it('should get account balance successfully', async () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');

      const result = await service.getAccountBalance();

      expect(result.toString()).toBe('100.0 ℏ');
      service.close();
    });
  });

  describe('utility methods', () => {
    it('should return topic ID', () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');
      expect(service.getTopicId()).toBe('0.0.789012');
      service.close();
    });

    it('should return operator account ID', () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');
      expect(service.getOperatorAccountId()).toBe('0.0.123456');
      service.close();
    });

    it('should close client connection', () => {
      const service = new HederaService('testnet', '0.0.123456', 'test-private-key', '0.0.789012');
      service.close();
      // Just verify it doesn't throw an error
      expect(true).toBe(true);
    });
  });
});