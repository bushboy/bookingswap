import { describe, it, expect } from 'vitest';
import { userSchema, createUserSchema, updateUserProfileSchema } from '../user';
import { User } from '../../types/user';

describe('User Validation', () => {
  const validUser: User = {
    id: 'user-123',
    walletAddress: '0.0.12345',
    profile: {
      displayName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      preferences: {
        notifications: true,
        autoAcceptCriteria: {
          maxAdditionalPayment: 200,
          preferredLocations: ['Paris', 'London'],
          bookingTypes: ['hotel', 'vacation_rental']
        }
      }
    },
    verification: {
      level: 'verified',
      documents: ['ipfs-doc-1', 'ipfs-doc-2'],
      verifiedAt: new Date('2024-05-01')
    },
    reputation: {
      score: 4.5,
      completedSwaps: 10,
      cancelledSwaps: 1,
      reviews: [
        {
          id: 'review-1',
          reviewerId: 'user-456',
          rating: 5,
          comment: 'Great swap partner!',
          swapId: 'swap-123',
          createdAt: new Date('2024-05-01')
        }
      ]
    },
    lastActiveAt: new Date('2024-05-15'),
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date('2024-05-15')
  };

  describe('userSchema', () => {
    it('should validate a complete valid user', () => {
      const { error } = userSchema.validate(validUser);
      expect(error).toBeUndefined();
    });

    it('should reject user with missing required fields', () => {
      const invalidUser = { ...validUser };
      delete (invalidUser as any).walletAddress;

      const { error } = userSchema.validate(invalidUser);
      expect(error).toBeDefined();
      expect(error?.details[0].path).toContain('walletAddress');
    });

    it('should reject user with invalid wallet address format', () => {
      const invalidUser = { ...validUser, walletAddress: 'invalid-address' };

      const { error } = userSchema.validate(invalidUser);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('pattern');
    });

    it('should reject user with invalid email format', () => {
      const invalidUser = {
        ...validUser,
        profile: {
          ...validUser.profile,
          email: 'invalid-email'
        }
      };

      const { error } = userSchema.validate(invalidUser);
      expect(error).toBeDefined();
    });

    it('should reject user with invalid phone format', () => {
      const invalidUser = {
        ...validUser,
        profile: {
          ...validUser.profile,
          phone: 'invalid-phone'
        }
      };

      const { error } = userSchema.validate(invalidUser);
      expect(error).toBeDefined();
    });

    it('should reject user with invalid verification level', () => {
      const invalidUser = {
        ...validUser,
        verification: {
          ...validUser.verification,
          level: 'invalid' as any
        }
      };

      const { error } = userSchema.validate(invalidUser);
      expect(error).toBeDefined();
    });

    it('should reject user with invalid reputation score', () => {
      const invalidUser = {
        ...validUser,
        reputation: {
          ...validUser.reputation,
          score: 6 // score should be max 5
        }
      };

      const { error } = userSchema.validate(invalidUser);
      expect(error).toBeDefined();
    });

    it('should reject user with invalid review rating', () => {
      const invalidUser = {
        ...validUser,
        reputation: {
          ...validUser.reputation,
          reviews: [
            {
              ...validUser.reputation.reviews[0],
              rating: 0 // rating should be min 1
            }
          ]
        }
      };

      const { error } = userSchema.validate(invalidUser);
      expect(error).toBeDefined();
    });

    it('should accept user without optional profile fields', () => {
      const userWithMinimalProfile = {
        ...validUser,
        profile: {
          preferences: {
            notifications: false
          }
        }
      };

      const { error } = userSchema.validate(userWithMinimalProfile);
      expect(error).toBeUndefined();
    });

    it('should accept user without auto-accept criteria', () => {
      const userWithoutCriteria = {
        ...validUser,
        profile: {
          ...validUser.profile,
          preferences: {
            notifications: true
          }
        }
      };

      const { error } = userSchema.validate(userWithoutCriteria);
      expect(error).toBeUndefined();
    });
  });

  describe('createUserSchema', () => {
    it('should validate user creation without id and timestamps', () => {
      const createData = { ...validUser };
      delete (createData as any).id;
      delete (createData as any).createdAt;
      delete (createData as any).updatedAt;
      delete (createData as any).lastActiveAt;

      const { error } = createUserSchema.validate(createData);
      expect(error).toBeUndefined();
    });
  });

  describe('updateUserProfileSchema', () => {
    it('should validate profile updates', () => {
      const updateData = {
        displayName: 'Jane Doe',
        email: 'jane.doe@example.com',
        preferences: {
          notifications: false
        }
      };

      const { error } = updateUserProfileSchema.validate(updateData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid email in update', () => {
      const updateData = {
        email: 'invalid-email'
      };

      const { error } = updateUserProfileSchema.validate(updateData);
      expect(error).toBeDefined();
    });

    it('should reject invalid phone in update', () => {
      const updateData = {
        phone: 'invalid-phone'
      };

      const { error } = updateUserProfileSchema.validate(updateData);
      expect(error).toBeDefined();
    });
  });
});