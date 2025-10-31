import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { BookingRepository } from '../BookingRepository';
import { Booking } from '@booking-swap/shared';

describe('BookingRepository', () => {
  let mockPool: Pool;
  let repository: BookingRepository;

  const mockBookingRow = {
    id: '123',
    user_id: 'user-123',
    type: 'hotel',
    title: 'Luxury Hotel Stay',
    description: 'Beautiful hotel in downtown',
    location_city: 'New York',
    location_country: 'USA',
    location_coordinates: JSON.stringify([40.7128, -74.0060]),
    check_in_date: new Date('2024-01-15'),
    check_out_date: new Date('2024-01-20'),
    original_price: '500.00',
    swap_value: '450.00',
    provider_name: 'Booking.com',
    confirmation_number: 'BK123456',
    booking_reference: 'REF789',
    verification_status: 'verified',
    verified_at: new Date('2023-12-01'),
    verification_documents: JSON.stringify(['receipt.pdf']),
    blockchain_transaction_id: 'tx-123',
    blockchain_consensus_timestamp: '2023-12-01T10:00:00Z',
    blockchain_topic_id: 'topic-123',
    status: 'available',
    created_at: new Date('2023-12-01'),
    updated_at: new Date('2023-12-01'),
  };

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    } as any;

    repository = new BookingRepository(mockPool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRowToEntity', () => {
    it('should correctly map database row to Booking entity', () => {
      const result = repository.mapRowToEntity(mockBookingRow);

      expect(result).toEqual({
        id: '123',
        userId: 'user-123',
        type: 'hotel',
        title: 'Luxury Hotel Stay',
        description: 'Beautiful hotel in downtown',
        location: {
          city: 'New York',
          country: 'USA',
          coordinates: [40.7128, -74.0060],
        },
        dateRange: {
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('2024-01-20'),
        },
        originalPrice: 500.00,
        swapValue: 450.00,
        providerDetails: {
          provider: 'Booking.com',
          confirmationNumber: 'BK123456',
          bookingReference: 'REF789',
        },
        verification: {
          status: 'verified',
          verifiedAt: new Date('2023-12-01'),
          documents: ['receipt.pdf'],
        },
        blockchain: {
          transactionId: 'tx-123',
          consensusTimestamp: '2023-12-01T10:00:00Z',
          topicId: 'topic-123',
        },
        status: 'available',
        createdAt: new Date('2023-12-01'),
        updatedAt: new Date('2023-12-01'),
      });
    });
  });

  describe('mapEntityToRow', () => {
    it('should correctly map Booking entity to database row', () => {
      const booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: 'user-123',
        type: 'hotel',
        title: 'Luxury Hotel Stay',
        description: 'Beautiful hotel in downtown',
        location: {
          city: 'New York',
          country: 'USA',
          coordinates: [40.7128, -74.0060],
        },
        dateRange: {
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('2024-01-20'),
        },
        originalPrice: 500.00,
        swapValue: 450.00,
        providerDetails: {
          provider: 'Booking.com',
          confirmationNumber: 'BK123456',
          bookingReference: 'REF789',
        },
        verification: {
          status: 'verified',
          verifiedAt: new Date('2023-12-01'),
          documents: ['receipt.pdf'],
        },
        blockchain: {
          transactionId: 'tx-123',
          consensusTimestamp: '2023-12-01T10:00:00Z',
          topicId: 'topic-123',
        },
        status: 'available',
      };

      const result = repository.mapEntityToRow(booking);

      expect(result).toEqual({
        user_id: 'user-123',
        type: 'hotel',
        title: 'Luxury Hotel Stay',
        description: 'Beautiful hotel in downtown',
        location_city: 'New York',
        location_country: 'USA',
        location_coordinates: JSON.stringify([40.7128, -74.0060]),
        check_in_date: new Date('2024-01-15'),
        check_out_date: new Date('2024-01-20'),
        original_price: 500.00,
        swap_value: 450.00,
        provider_name: 'Booking.com',
        confirmation_number: 'BK123456',
        booking_reference: 'REF789',
        verification_status: 'verified',
        verified_at: new Date('2023-12-01'),
        verification_documents: JSON.stringify(['receipt.pdf']),
        blockchain_transaction_id: 'tx-123',
        blockchain_consensus_timestamp: '2023-12-01T10:00:00Z',
        blockchain_topic_id: 'topic-123',
        status: 'available',
      });
    });
  });

  describe('findByUserId', () => {
    it('should find bookings by user ID', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.findByUserId('user-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        ['user-123', 100, 0]
      );
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
    });
  });

  describe('findByFilters', () => {
    it('should find bookings by type filter', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.findByFilters({
        type: 'hotel',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE type = $1'),
        ['hotel', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should find bookings by status filter', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.findByFilters({
        status: 'available',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['available', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should find bookings by price range', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.findByFilters({
        minPrice: 400,
        maxPrice: 600,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE swap_value >= $1 AND swap_value <= $2'),
        [400, 600, 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should find bookings by date range', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const checkInAfter = new Date('2024-01-01');
      const checkOutBefore = new Date('2024-01-31');

      const result = await repository.findByFilters({
        checkInAfter,
        checkOutBefore,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE check_in_date >= $1 AND check_out_date <= $2'),
        [checkInAfter, checkOutBefore, 100, 0]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('searchBookings', () => {
    it('should search bookings by text query', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.searchBookings({
        query: 'luxury hotel',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('title ILIKE $2'),
        ['available', '%luxury hotel%', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should search bookings by location', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.searchBookings({
        location: {
          city: 'New York',
          country: 'USA',
        },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('location_city ILIKE $2 AND location_country ILIKE $3'),
        ['available', '%New York%', '%USA%', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should search bookings by date range with flexible dates', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.searchBookings({
        dateRange: {
          checkIn: new Date('2024-01-10'),
          checkOut: new Date('2024-01-25'),
          flexible: true,
        },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('check_out_date >= $2 AND check_in_date <= $3'),
        ['available', new Date('2024-01-10'), new Date('2024-01-25'), 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should search bookings by booking types', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockBookingRow],
      });

      const result = await repository.searchBookings({
        types: ['hotel', 'event'],
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('type IN ($2, $3)'),
        ['available', 'hotel', 'event', 100, 0]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update booking status', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{ ...mockBookingRow, status: 'locked' }],
      });

      const result = await repository.updateStatus('123', 'locked');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $2'),
        ['123', 'locked']
      );
      expect(result?.status).toBe('locked');
    });

    it('should return null when booking not found', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [],
      });

      const result = await repository.updateStatus('123', 'locked');

      expect(result).toBeNull();
    });
  });

  describe('updateVerificationStatus', () => {
    it('should update verification status', async () => {
      const verifiedAt = new Date();
      (mockPool.query as any).mockResolvedValue({
        rows: [{ ...mockBookingRow, verification_status: 'verified', verified_at: verifiedAt }],
      });

      const result = await repository.updateVerificationStatus('123', 'verified', verifiedAt);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET verification_status = $2, verified_at = $3'),
        ['123', 'verified', verifiedAt]
      );
      expect(result?.verification.status).toBe('verified');
    });
  });

  describe('updateBlockchainInfo', () => {
    it('should update blockchain information', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{ ...mockBookingRow, blockchain_transaction_id: 'new-tx-123' }],
      });

      const result = await repository.updateBlockchainInfo('123', {
        transactionId: 'new-tx-123',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET blockchain_transaction_id = $2'),
        ['123', 'new-tx-123']
      );
      expect(result?.blockchain.transactionId).toBe('new-tx-123');
    });

    it('should return existing booking when no updates provided', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({
        id: '123',
      } as Booking);

      const result = await repository.updateBlockchainInfo('123', {});

      expect(repository.findById).toHaveBeenCalledWith('123');
      expect(result?.id).toBe('123');
    });
  });
});