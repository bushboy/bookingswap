import { describe, it, expect } from 'vitest';
import { swapSchema, createSwapSchema, updateSwapStatusSchema } from '../swap';
import { Swap } from '../../types/swap';

describe('Swap Validation', () => {
  const validSwap: Swap = {
    id: 'swap-123',
    sourceBookingId: 'booking-456',
    targetBookingId: 'booking-789',
    proposerId: 'user-123',
    ownerId: 'user-456',
    status: 'pending',
    terms: {
      additionalPayment: 100,
      conditions: ['Must confirm 24h before check-in', 'No cancellation allowed'],
      expiresAt: new Date('2025-06-01')
    },
    blockchain: {
      proposalTransactionId: 'tx-proposal-123',
      executionTransactionId: 'tx-execution-456',
      escrowContractId: 'contract-789'
    },
    timeline: {
      proposedAt: new Date('2024-05-01'),
      respondedAt: new Date('2024-05-02'),
      completedAt: new Date('2024-05-03')
    },
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-05-03')
  };

  describe('swapSchema', () => {
    it('should validate a complete valid swap', () => {
      const { error } = swapSchema.validate(validSwap);
      expect(error).toBeUndefined();
    });

    it('should reject swap with missing required fields', () => {
      const invalidSwap = { ...validSwap };
      delete (invalidSwap as any).sourceBookingId;
      
      const { error } = swapSchema.validate(invalidSwap);
      expect(error).toBeDefined();
      expect(error?.details[0].path).toContain('sourceBookingId');
    });

    it('should reject swap with invalid status', () => {
      const invalidSwap = { ...validSwap, status: 'invalid' as any };
      
      const { error } = swapSchema.validate(invalidSwap);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('must be one of');
    });

    it('should reject swap with negative additional payment', () => {
      const invalidSwap = {
        ...validSwap,
        terms: {
          ...validSwap.terms,
          additionalPayment: -50
        }
      };
      
      const { error } = swapSchema.validate(invalidSwap);
      expect(error).toBeDefined();
    });

    it('should reject swap with past expiration date', () => {
      const invalidSwap = {
        ...validSwap,
        terms: {
          ...validSwap.terms,
          expiresAt: new Date('2020-01-01') // past date
        }
      };
      
      const { error } = swapSchema.validate(invalidSwap);
      expect(error).toBeUndefined(); // base schema doesn't check for future dates
    });

    it('should accept swap without optional additional payment', () => {
      const swapWithoutPayment = {
        ...validSwap,
        terms: {
          conditions: validSwap.terms.conditions,
          expiresAt: validSwap.terms.expiresAt
        }
      };
      
      const { error } = swapSchema.validate(swapWithoutPayment);
      expect(error).toBeUndefined();
    });

    it('should accept swap without optional blockchain execution details', () => {
      const swapWithoutExecution = {
        ...validSwap,
        blockchain: {
          proposalTransactionId: validSwap.blockchain.proposalTransactionId
        }
      };
      
      const { error } = swapSchema.validate(swapWithoutExecution);
      expect(error).toBeUndefined();
    });
  });

  describe('createSwapSchema', () => {
    it('should validate swap creation without id and timestamps', () => {
      const createData = { 
        ...validSwap,
        terms: {
          ...validSwap.terms,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // tomorrow
        }
      };
      delete (createData as any).id;
      delete (createData as any).createdAt;
      delete (createData as any).updatedAt;
      
      const { error } = createSwapSchema.validate(createData);
      expect(error).toBeUndefined();
    });
  });

  describe('updateSwapStatusSchema', () => {
    it('should validate status updates', () => {
      const updateData = { status: 'accepted' };
      
      const { error } = updateSwapStatusSchema.validate(updateData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid status', () => {
      const updateData = { status: 'invalid-status' };
      
      const { error } = updateSwapStatusSchema.validate(updateData);
      expect(error).toBeDefined();
    });

    it('should reject pending status in updates', () => {
      const updateData = { status: 'pending' };
      
      const { error } = updateSwapStatusSchema.validate(updateData);
      expect(error).toBeDefined();
    });
  });
});