import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { HederaService } from '../../hedera/HederaService';
import { ContractService } from '../../hedera/ContractService';
import { AtomicSwapService, SwapExecutionRequest, SwapStatus } from '../AtomicSwapService';

// Test configuration
const TEST_CONFIG = {
  network: 'testnet' as const,
  accountId: process.env.HEDERA_ACCOUNT_ID || '0.0.123456',
  privateKey: process.env.HEDERA_PRIVATE_KEY || '302e020100300506032b657004220420...',
  topicId: process.env.HEDERA_TOPIC_ID,
};

describe('AtomicSwapService Integration Tests', () => {
  let hederaService: HederaService;
  let contractService: ContractService;
  let atomicSwapService: AtomicSwapService;
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
    atomicSwapService = new AtomicSwapService(hederaService, contractService);

    // Deploy contract for testing
    contractId = await contractService.deployEscrowContract();
  });

  afterAll(async () => {
    if (hederaService) {
      hederaService.close();
    }
  });

  describe('Complete Atomic Swap Flow', () => {
    let sourceBookingId: string;
    let targetBookingId: string;
    let swapRequest: SwapExecutionRequest;

    beforeEach(async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        return;
      }

      // Create unique booking IDs for each test
      const timestamp = Date.now();
      sourceBookingId = `source_${timestamp}`;
      targetBookingId = `target_${timestamp}`;

      // Register two bookings for swap testing
      const sourceBooking = {
        bookingId: sourceBookingId,
        value: 2000000, // 2 HBAR
        metadata: 'QmSourceBookingMetadata',
      };

      const targetBooking = {
        bookingId: targetBookingId,
        value: 2500000, // 2.5 HBAR
        metadata: 'QmTargetBookingMetadata',
      };

      await contractService.registerBooking(sourceBooking, sourceBooking.value);
      await contractService.registerBooking(targetBooking, targetBooking.value);

      // Create swap request
      swapRequest = {
        swapId: `atomic_swap_${timestamp}`,
        sourceBookingId,
        targetBookingId,
        proposerAccountId: TEST_CONFIG.accountId,
        acceptorAccountId: TEST_CONFIG.accountId, // Same account for testing
        additionalPayment: 500000, // 0.5 HBAR difference
        expirationTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      };
    });

    it('should execute a complete atomic swap successfully', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Execute the atomic swap
      const result = await atomicSwapService.executeAtomicSwap(swapRequest);

      expect(result.success).toBe(true);
      expect(result.swapId).toBe(swapRequest.swapId);
      expect(result.transactionId).toBeDefined();
      expect(result.consensusTimestamp).toBeDefined();
      expect(result.error).toBeUndefined();

      // Verify swap completion on blockchain
      const swapDetails = await contractService.getSwap(swapRequest.swapId);
      expect(swapDetails.status).toBe(SwapStatus.COMPLETED);

      // Verify bookings are unlocked
      const sourceBooking = await contractService.getBooking(sourceBookingId);
      const targetBooking = await contractService.getBooking(targetBookingId);
      
      expect(sourceBooking.isLocked).toBe(false);
      expect(targetBooking.isLocked).toBe(false);

    }, 120000); // 2 minute timeout for full flow

    it('should handle swap validation failures', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Create invalid swap request (non-existent booking)
      const invalidRequest: SwapExecutionRequest = {
        ...swapRequest,
        swapId: `invalid_swap_${Date.now()}`,
        targetBookingId: 'non_existent_booking',
      };

      const result = await atomicSwapService.executeAtomicSwap(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
      expect(result.rollbackTransactionId).toBeUndefined(); // No rollback needed for validation failures

    }, 60000);

    it('should handle expired swap proposals', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Create expired swap request
      const expiredRequest: SwapExecutionRequest = {
        ...swapRequest,
        swapId: `expired_swap_${Date.now()}`,
        expirationTime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      const result = await atomicSwapService.executeAtomicSwap(expiredRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');

    }, 60000);

    it('should rollback failed swaps', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Create a swap that will fail during execution
      // We'll simulate this by using insufficient additional payment
      const failingRequest: SwapExecutionRequest = {
        ...swapRequest,
        swapId: `failing_swap_${Date.now()}`,
        additionalPayment: 999999999999, // Impossibly large payment
      };

      const result = await atomicSwapService.executeAtomicSwap(failingRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // If rollback was attempted, verify it
      if (result.rollbackTransactionId) {
        expect(result.rollbackTransactionId).toBeDefined();
        
        // Verify bookings are unlocked after rollback
        const sourceBooking = await contractService.getBooking(sourceBookingId);
        const targetBooking = await contractService.getBooking(targetBookingId);
        
        expect(sourceBooking.isLocked).toBe(false);
        expect(targetBooking.isLocked).toBe(false);
      }

    }, 90000);
  });

  describe('Swap Execution Management', () => {
    it('should track active swap executions', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      const swapId = `tracking_test_${Date.now()}`;
      
      // Check no active swaps initially
      expect(atomicSwapService.getActiveSwaps()).toHaveLength(0);
      expect(atomicSwapService.getSwapExecutionStatus(swapId)).toBeUndefined();

      // Note: In a real test, we would need to create a scenario where
      // we can check the status during execution. For now, we just verify
      // the tracking methods work correctly.
      
      const activeSwaps = atomicSwapService.getActiveSwaps();
      expect(Array.isArray(activeSwaps)).toBe(true);

    });

    it('should cleanup expired executions', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Test cleanup with very short max age
      const cleanedCount = atomicSwapService.cleanupExpiredExecutions(1); // 1ms
      
      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount).toBeGreaterThanOrEqual(0);

    });
  });

  describe('Error Recovery', () => {
    it('should handle contract service errors gracefully', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Create a swap request with invalid contract state
      const invalidRequest: SwapExecutionRequest = {
        swapId: `error_test_${Date.now()}`,
        sourceBookingId: 'invalid_booking',
        targetBookingId: 'another_invalid_booking',
        proposerAccountId: TEST_CONFIG.accountId,
        acceptorAccountId: TEST_CONFIG.accountId,
        expirationTime: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await atomicSwapService.executeAtomicSwap(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');

    }, 60000);

    it('should handle network connectivity issues', async () => {
      if (!process.env.HEDERA_ACCOUNT_ID) {
        console.log('Skipping test - credentials not provided');
        return;
      }

      // Create a service with invalid network configuration
      const invalidHederaService = new HederaService(
        'testnet',
        '0.0.999999', // Invalid account
        'invalid_key'
      );
      
      const invalidContractService = new ContractService(invalidHederaService);
      const invalidAtomicService = new AtomicSwapService(invalidHederaService, invalidContractService);

      const request: SwapExecutionRequest = {
        swapId: `network_test_${Date.now()}`,
        sourceBookingId: 'test_booking',
        targetBookingId: 'test_booking_2',
        proposerAccountId: '0.0.999999',
        acceptorAccountId: '0.0.999998',
        expirationTime: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await invalidAtomicService.executeAtomicSwap(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      invalidHederaService.close();

    }, 30000);
  });
});

// Mock tests for when credentials are not available
describe('AtomicSwapService Unit Tests (Mocked)', () => {
  let mockHederaService: HederaService;
  let mockContractService: ContractService;
  let atomicSwapService: AtomicSwapService;

  beforeAll(() => {
    // Create mock services
    mockHederaService = {
      getOperatorAccountId: () => '0.0.123456',
      close: () => {},
    } as any;

    mockContractService = {
      getSwap: async (swapId: string) => {
        throw new Error('Swap not found');
      },
      getBooking: async (bookingId: string) => ({
        bookingId,
        owner: '0.0.123456',
        value: 1000000,
        metadata: 'test',
        isLocked: false,
      }),
      getUserBalance: async () => 1000000,
      proposeSwap: async () => ({
        transactionId: 'mock_tx_id',
        status: 'SUCCESS',
        consensusTimestamp: new Date().toISOString(),
      }),
      acceptSwap: async () => ({
        transactionId: 'mock_accept_tx',
        status: 'SUCCESS',
        consensusTimestamp: new Date().toISOString(),
      }),
      executeSwap: async () => ({
        transactionId: 'mock_execute_tx',
        status: 'SUCCESS',
        consensusTimestamp: new Date().toISOString(),
      }),
      cancelSwap: async () => ({
        transactionId: 'mock_cancel_tx',
        status: 'SUCCESS',
        consensusTimestamp: new Date().toISOString(),
      }),
    } as any;

    atomicSwapService = new AtomicSwapService(mockHederaService, mockContractService);
  });

  it('should initialize correctly', () => {
    expect(atomicSwapService).toBeDefined();
    expect(atomicSwapService.getActiveSwaps()).toHaveLength(0);
  });

  it('should handle swap execution status tracking', () => {
    const swapId = 'test_swap_123';
    
    // Initially no status
    expect(atomicSwapService.getSwapExecutionStatus(swapId)).toBeUndefined();
    
    // Active swaps should be empty
    expect(atomicSwapService.getActiveSwaps()).toHaveLength(0);
  });

  it('should handle cleanup operations', () => {
    const cleanedCount = atomicSwapService.cleanupExpiredExecutions(1000);
    expect(typeof cleanedCount).toBe('number');
    expect(cleanedCount).toBeGreaterThanOrEqual(0);
  });
});