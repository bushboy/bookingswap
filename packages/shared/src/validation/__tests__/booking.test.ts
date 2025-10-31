import { describe, it, expect } from 'vitest';
import { bookingSchema, createBookingSchema, updateBookingSchema } from '../booking';
import { Booking } from '../../types/booking';

describe('Booking Validation', () => {
  const validBooking: Booking = {
    id: 'booking-123',
    userId: 'user-456',
    type: 'hotel',
    title: 'Luxury Hotel Stay in Paris',
    description: 'Beautiful 5-star hotel in the heart of Paris with amazing views',
    location: {
      city: 'Paris',
      country: 'France',
      coordinates: [48.8566, 2.3522]
    },
    dateRange: {
      checkIn: new Date('2025-06-01'),
      checkOut: new Date('2025-06-05')
    },
    originalPrice: 1200,
    swapValue: 1000,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'BK123456789',
      bookingReference: 'REF-ABC-123'
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-05-01'),
      documents: ['ipfs-hash-1', 'ipfs-hash-2']
    },
    blockchain: {
      transactionId: 'tx-123',
      consensusTimestamp: '1234567890.123456789',
      topicId: '0.0.12345'
    },
    status: 'available',
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-05-01')
  };

  describe('bookingSchema', () => {
    it('should validate a complete valid booking', () => {
      const { error } = bookingSchema.validate(validBooking);
      expect(error).toBeUndefined();
    });

    it('should reject booking with missing required fields', () => {
      const invalidBooking = { ...validBooking };
      delete (invalidBooking as any).title;

      const { error } = bookingSchema.validate(invalidBooking);
      expect(error).toBeDefined();
      expect(error?.details[0].path).toContain('title');
    });

    it('should reject booking with invalid type', () => {
      const invalidBooking = { ...validBooking, type: 'invalid' as any };

      const { error } = bookingSchema.validate(invalidBooking);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('accommodation bookings are currently supported');
    });

    it('should reject booking with invalid date range', () => {
      const invalidBooking = {
        ...validBooking,
        dateRange: {
          checkIn: new Date('2025-06-05'),
          checkOut: new Date('2025-06-01') // checkout before checkin
        }
      };

      const { error } = bookingSchema.validate(invalidBooking);
      expect(error).toBeDefined();
    });

    it('should reject booking with negative price', () => {
      const invalidBooking = { ...validBooking, originalPrice: -100 };

      const { error } = bookingSchema.validate(invalidBooking);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('positive');
    });

    it('should reject booking with invalid coordinates', () => {
      const invalidBooking = {
        ...validBooking,
        location: {
          ...validBooking.location,
          coordinates: [48.8566] as any // only one coordinate
        }
      };

      const { error } = bookingSchema.validate(invalidBooking);
      expect(error).toBeDefined();
    });

    it('should accept booking without optional coordinates', () => {
      const bookingWithoutCoords = {
        ...validBooking,
        location: {
          city: validBooking.location.city,
          country: validBooking.location.country
        }
      };

      const { error } = bookingSchema.validate(bookingWithoutCoords);
      expect(error).toBeUndefined();
    });
  });

  describe('createBookingSchema', () => {
    it('should validate booking creation without id and timestamps', () => {
      const createData = {
        ...validBooking,
        dateRange: {
          checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
          checkOut: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
        }
      };
      delete (createData as any).id;
      delete (createData as any).createdAt;
      delete (createData as any).updatedAt;

      const { error } = createBookingSchema.validate(createData);
      expect(error).toBeUndefined();
    });
  });

  describe('updateBookingSchema', () => {
    it('should validate partial booking updates', () => {
      const updateData = {
        title: 'Updated Hotel Stay',
        swapValue: 900
      };

      const { error } = updateBookingSchema.validate(updateData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid status in update', () => {
      const updateData = {
        status: 'invalid-status'
      };

      const { error } = updateBookingSchema.validate(updateData);
      expect(error).toBeDefined();
    });
  });
});