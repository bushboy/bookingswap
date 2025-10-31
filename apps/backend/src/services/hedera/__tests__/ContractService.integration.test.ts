import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { HederaService } from '../HederaService';
import { ContractService, BookingData, SwapProposal } from '../ContractService';
import { AccountId, PrivateKey } from '@hashgraph/sdk';

// Test configuration
const TEST_CONFIG = {
  network: 'testnet' as const,
  accountId: process.env.HEDERA_ACCOUNT_ID || '0.0.123456',
  privateKey: process.env.HEDERA_PRIVATE_KEY || '302e020100300506032b657004220420...',
  topicId: process.env.HEDERA_TOPIC_ID,
};

describe('ContractService Integration Tests', () => {
  let hederaService: HederaService;
  let contractService: ContractService;
  let contractId: string;

  beforeAll(async () => {
    // Skip integration tests if credentials are not provided
    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      console.log('Skipping integration tests - Hedera credentials not provided');
      return;
    }

    // Initialize services
    hederaService = new HederaService(
      TEST_CONFIG.network,
      TEST_CONFIG.accountId,
      TEST_CONFIG.privateKey,
      TEST_CONFIG.topicId
    );

    contractService = new ContractService(hederaService);
  });

  afterAll(async () => {
    if (hederaService) {
      hederaService.close();
    }
  });

  describe('Contract Deployment', () => {
    it('should deploy the escrow contract successfully', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Deploy contract
      contractId = await contractService.deployEscrowContract();

      expect(contractId).toBeDefined();
      expect(contractId).toMatch(/^0\.0\.\d+$/);
      expect(contractService.getContractId()).toBe(contractId);
    }, 60000); // 60 second timeout for deployment

    it('should handle deployment errors gracefully', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Create a service with invalid configuration to test error handling
      const invalidService = new HederaService(
        'testnet',
        '0.0.999999', // Invalid account
        'invalid_private_key',
      );
      const invalidContractService = new ContractService(invalidService);

      await expect(invalidContractService.deployEscrowContract()).rejects.toThrow();
    });
  });

  describe('Booking Registration', () => {
    beforeEach(async () => {
      if (!contractId && process.env.HEDERA_ACCOUNT_ID) {
        contractId = await contractService.deployEscrowContract();
      }
    });

    it('should register a booking successfully', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const bookingData: BookingData = {
        bookingId: `booking_${Date.now()}`,
        value: 1000000, // 1 HBAR in tinybars
        metadata: 'QmTestIPFSHash123',
      };

      const result = await contractService.registerBooking(bookingData, bookingData.value);

      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe('SUCCESS');
      expect(result.consensusTimestamp).toBeDefined();
    }, 30000);

    it('should retrieve booking details after registration', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const bookingData: BookingData = {
        bookingId: `booking_details_${Date.now()}`,
        value: 2000000, // 2 HBAR in tinybars
        metadata: 'QmTestIPFSHash456',
      };

      // Register booking
      await contractService.registerBooking(bookingData, bookingData.value);

      // Retrieve booking details
      const retrievedBooking = await contractService.getBooking(bookingData.bookingId);

      expect(retrievedBooking.bookingId).toBe(bookingData.bookingId);
      expect(retrievedBooking.value).toBe(bookingData.value);
      expect(retrievedBooking.metadata).toBe(bookingData.metadata);
      expect(retrievedBooking.owner).toBe(TEST_CONFIG.accountId);
      expect(retrievedBooking.isLocked).toBe(false);
    }, 45000);

    it('should reject duplicate booking registration', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const bookingData: BookingData = {
        bookingId: `duplicate_booking_${Date.now()}`,
        value: 1000000,
        metadata: 'QmTestIPFSHash789',
      };

      // Register booking first time
      await contractService.registerBooking(bookingData, bookingData.value);

      // Attempt to register same booking again
      await expect(
        contractService.registerBooking(bookingData, bookingData.value)
      ).rejects.toThrow();
    }, 45000);
  });

  describe('Swap Operations', () => {
    let sourceBookingId: string;
    let targetBookingId: string;

    beforeEach(async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        return;
      }

      if (!contractId) {
        contractId = await contractService.deployEscrowContract();
      }

      // Create two bookings for swap testing
      sourceBookingId = `source_${Date.now()}`;
      targetBookingId = `target_${Date.now()}`;

      const sourceBooking: BookingData = {
        bookingId: sourceBookingId,
        value: 1500000,
        metadata: 'QmSourceBooking',
      };

      const targetBooking: BookingData = {
        bookingId: targetBookingId,
        value: 1800000,
        metadata: 'QmTargetBooking',
      };

      await contractService.registerBooking(sourceBooking, sourceBooking.value);
      await contractService.registerBooking(targetBooking, targetBooking.value);
    });

    it('should propose a swap successfully', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const swapProposal: SwapProposal = {
        swapId: `swap_${Date.now()}`,
        sourceBookingId,
        targetBookingId,
        additionalPayment: 300000, // 0.3 HBAR difference
        expirationTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      const result = await contractService.proposeSwap(swapProposal, swapProposal.additionalPayment);

      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe('SUCCESS');

      // Verify bookings are locked
      const sourceBooking = await contractService.getBooking(sourceBookingId);
      const targetBooking = await contractService.getBooking(targetBookingId);

      expect(sourceBooking.isLocked).toBe(true);
      expect(targetBooking.isLocked).toBe(true);
    }, 60000);

    it('should retrieve swap details after proposal', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const swapProposal: SwapProposal = {
        swapId: `swap_details_${Date.now()}`,
        sourceBookingId,
        targetBookingId,
        additionalPayment: 200000,
        expirationTime: Math.floor(Date.now() / 1000) + 3600,
      };

      await contractService.proposeSwap(swapProposal, swapProposal.additionalPayment);

      const swapDetails = await contractService.getSwap(swapProposal.swapId);

      expect(swapDetails.swapId).toBe(swapProposal.swapId);
      expect(swapDetails.sourceBookingId).toBe(swapProposal.sourceBookingId);
      expect(swapDetails.targetBookingId).toBe(swapProposal.targetBookingId);
      expect(swapDetails.additionalPayment).toBe(swapProposal.additionalPayment);
      expect(swapDetails.status).toBe(0); // PENDING status
      expect(swapDetails.proposer).toBe(TEST_CONFIG.accountId);
    }, 60000);

    it('should cancel a swap successfully', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const swapProposal: SwapProposal = {
        swapId: `swap_cancel_${Date.now()}`,
        sourceBookingId,
        targetBookingId,
        additionalPayment: 100000,
        expirationTime: Math.floor(Date.now() / 1000) + 3600,
      };

      // Propose swap
      await contractService.proposeSwap(swapProposal, swapProposal.additionalPayment);

      // Cancel swap
      const cancelResult = await contractService.cancelSwap(swapProposal.swapId);

      expect(cancelResult.transactionId).toBeDefined();
      expect(cancelResult.status).toBe('SUCCESS');

      // Verify bookings are unlocked
      const sourceBooking = await contractService.getBooking(sourceBookingId);
      const targetBooking = await contractService.getBooking(targetBookingId);

      expect(sourceBooking.isLocked).toBe(false);
      expect(targetBooking.isLocked).toBe(false);

      // Verify swap status is cancelled
      const swapDetails = await contractService.getSwap(swapProposal.swapId);
      expect(swapDetails.status).toBe(4); // CANCELLED status
    }, 75000);
  });

  describe('Balance Operations', () => {
    beforeEach(async () => {
      if (!contractId && process.env.HEDERA_ACCOUNT_ID) {
        contractId = await contractService.deployEscrowContract();
      }
    });

    it('should retrieve user balance', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const balance = await contractService.getUserBalance(TEST_CONFIG.accountId);

      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle contract not deployed error', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const newContractService = new ContractService(hederaService);

      const bookingData: BookingData = {
        bookingId: 'test_booking',
        value: 1000000,
        metadata: 'QmTest',
      };

      await expect(
        newContractService.registerBooking(bookingData, bookingData.value)
      ).rejects.toThrow('Escrow contract not deployed');
    });

    it('should handle invalid booking queries', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      if (!contractId) {
        contractId = await contractService.deployEscrowContract();
      }

      await expect(
        contractService.getBooking('non_existent_booking')
      ).rejects.toThrow();
    }, 45000);

    it('should handle invalid swap queries', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      if (!contractId) {
        contractId = await contractService.deployEscrowContract();
      }

      await expect(
        contractService.getSwap('non_existent_swap')
      ).rejects.toThrow();
    }, 45000);
  });
});

// Mock tests for when credentials are not available
describe('ContractService Unit Tests (Mocked)', () => {
  let mockHederaService: HederaService;
  let contractService: ContractService;

  beforeAll(() => {
    // Create mock Hedera service for unit testing
    mockHederaService = {
      getOperatorAccountId: () => '0.0.123456',
      close: () => {},
      client: {} as any,
    } as any;

    contractService = new ContractService(mockHederaService);
  });

  it('should initialize with contract ID', () => {
    const testContractId = '0.0.789012';
    contractService.setContractId(testContractId);
    
    expect(contractService.getContractId()).toBe(testContractId);
  });

  it('should throw error when contract not deployed', () => {
    const newContractService = new ContractService(mockHederaService);
    
    const bookingData: BookingData = {
      bookingId: 'test',
      value: 1000,
      metadata: 'test',
    };

    expect(() => {
      // This would trigger the ensureContractDeployed check
      newContractService['ensureContractDeployed']();
    }).toThrow('Escrow contract not deployed');
  });
});