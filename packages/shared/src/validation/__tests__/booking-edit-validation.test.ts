import { describe, it, expect } from 'vitest';
import {
  validateBookingEditData,
  validateBookingEditUpdateData,
  validateCreateBookingEditRequest,
  isValidBookingEditData,
  isValidBookingType,
  hasBookingEditErrors,
  getBookingEditErrorSummary,
  sanitizeBookingEditData,
} from '../booking-edit-validation';
import { BookingEditData, CreateBookingEditRequest } from '../../types/booking-edit';

describe('booking-edit-validation', () => {
  const validBookingData: BookingEditData = {
    type: 'hotel',
    title: 'Test Hotel Booking',
    description: 'A test hotel booking for validation',
    location: {
      city: 'New York',
      country: 'USA',
    },
    dateRange: {
      checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF456',
    },
  };

  describe('validateBookingEditData', () => {
    it('should validate complete booking data without errors', () => {
      const errors = validateBookingEditData(validBookingData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should require title', () => {
      const data = { ...validBookingData, title: '' };
      const errors = validateBookingEditData(data);
      expect(errors.title).toBeDefined();
      expect(errors.title).toContain('required');
    });

    it('should limit title length', () => {
      const data = { ...validBookingData, title: 'a'.repeat(201) };
      const errors = validateBookingEditData(data);
      expect(errors.title).toBeDefined();
      expect(errors.title).toContain('200 characters');
    });

    it('should require description', () => {
      const data = { ...validBookingData, description: '' };
      const errors = validateBookingEditData(data);
      expect(errors.description).toBeDefined();
      expect(errors.description).toContain('required');
    });

    it('should limit description length', () => {
      const data = { ...validBookingData, description: 'a'.repeat(1001) };
      const errors = validateBookingEditData(data);
      expect(errors.description).toBeDefined();
      expect(errors.description).toContain('1000 characters');
    });

    it('should require valid booking type', () => {
      const data = { ...validBookingData, type: 'invalid' as any };
      const errors = validateBookingEditData(data);
      expect(errors.type).toBeDefined();
      expect(errors.type).toContain('accommodation bookings are currently supported');
    });

    it('should require location city and country', () => {
      const data = { ...validBookingData, location: { city: '', country: '' } };
      const errors = validateBookingEditData(data);
      expect(errors.location).toBeDefined();
      expect(errors.location).toContain('City is required');
    });

    it('should require future check-in date', () => {
      const data = {
        ...validBookingData,
        dateRange: {
          checkIn: new Date('2020-01-01'),
          checkOut: new Date('2020-01-05'),
        },
      };
      const errors = validateBookingEditData(data);
      expect(errors.dateRange).toBeDefined();
      expect(errors.dateRange).toContain('future');
    });

    it('should require check-out after check-in', () => {
      const checkInDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const checkOutDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now (before check-in)
      const data = {
        ...validBookingData,
        dateRange: {
          checkIn: checkInDate,
          checkOut: checkOutDate,
        },
      };
      const errors = validateBookingEditData(data);
      expect(errors.dateRange).toBeDefined();
      expect(errors.dateRange).toContain('after check-in');
    });

    it('should require positive prices', () => {
      const data = { ...validBookingData, originalPrice: 0, swapValue: -10 };
      const errors = validateBookingEditData(data);
      expect(errors.originalPrice).toBeDefined();
      expect(errors.swapValue).toBeDefined();
    });

    it('should require provider details', () => {
      const data = {
        ...validBookingData,
        providerDetails: {
          provider: '',
          confirmationNumber: '',
          bookingReference: '',
        },
      };
      const errors = validateBookingEditData(data);
      expect(errors.providerDetails).toBeDefined();
    });
  });

  describe('validateBookingEditUpdateData', () => {
    it('should validate partial update data', () => {
      const updateData = {
        title: 'Updated Title',
        originalPrice: 600,
      };
      const errors = validateBookingEditUpdateData(updateData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should validate only provided fields', () => {
      const updateData = {
        title: '', // Invalid
        originalPrice: 600, // Valid
      };
      const errors = validateBookingEditUpdateData(updateData);
      expect(errors.title).toBeDefined();
      expect(errors.originalPrice).toBeUndefined();
    });
  });

  describe('validateCreateBookingEditRequest', () => {
    it('should validate create request', () => {
      const createRequest: CreateBookingEditRequest = {
        ...validBookingData,
        documents: [],
      };
      const errors = validateCreateBookingEditRequest(createRequest);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('type guards', () => {
    it('should identify valid booking edit data', () => {
      expect(isValidBookingEditData(validBookingData)).toBe(true);
      expect(isValidBookingEditData({})).toBe(false);
      expect(isValidBookingEditData(null)).toBe(false);
    });

    it('should identify valid booking types', () => {
      expect(isValidBookingType('hotel')).toBe(true);
      expect(isValidBookingType('vacation_rental')).toBe(true);
      expect(isValidBookingType('resort')).toBe(true);
      expect(isValidBookingType('hostel')).toBe(true);
      expect(isValidBookingType('bnb')).toBe(true);
      expect(isValidBookingType('event')).toBe(false); // Now disabled
      expect(isValidBookingType('flight')).toBe(false); // Now disabled
      expect(isValidBookingType('rental')).toBe(false); // Now disabled
      expect(isValidBookingType('invalid')).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should detect validation errors', () => {
      expect(hasBookingEditErrors({})).toBe(false);
      expect(hasBookingEditErrors({ title: 'Error message' })).toBe(true);
    });

    it('should generate error summary', () => {
      const errors = { title: 'Title error', description: 'Description error' };
      const summary = getBookingEditErrorSummary(errors);
      expect(summary).toHaveLength(2);
      expect(summary).toContain('Title error');
      expect(summary).toContain('Description error');
    });

    it('should sanitize booking data', () => {
      const dirtyData = {
        ...validBookingData,
        title: '  Dirty Title  ',
        description: '  Dirty Description  ',
        location: {
          city: '  New York  ',
          country: '  USA  ',
        },
        providerDetails: {
          provider: '  Booking.com  ',
          confirmationNumber: '  ABC123  ',
          bookingReference: '  REF456  ',
        },
      };
      const sanitized = sanitizeBookingEditData(dirtyData);
      expect(sanitized.title).toBe('Dirty Title');
      expect(sanitized.description).toBe('Dirty Description');
      expect(sanitized.location.city).toBe('New York');
      expect(sanitized.providerDetails.provider).toBe('Booking.com');
    });
  });
});