import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import { BookingController } from '../controllers/BookingController';
import { createBookingRoutes } from '../routes/bookings';

// Mock the booking service for testing
const mockBookingService = {
  createBookingListing: vi.fn(),
  searchBookings: vi.fn(),
  getBookingsWithFilters: vi.fn(),
  getBookingById: vi.fn(),
  updateBookingStatus: vi.fn(),
  cancelBooking: vi.fn(),
  verifyBooking: vi.fn(),
  getUserBookings: vi.fn(),
};

// Mock auth middleware
const mockAuthMiddleware = {
  requireAuth: () => (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', isAdmin: false };
    next();
  },
};

describe('Booking Management API Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    // Create test app with mocked dependencies
    app = express();
    app.use(express.json());
    
    const bookingController = new BookingController(mockBookingService as any);
    const authMiddleware = mockAuthMiddleware as any;
    
    app.use('/api/bookings', createBookingRoutes(bookingController, authMiddleware));
  });

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('POST /api/bookings', () => {
    it('should create a new booking listing', async () => {
      const bookingData = {
        type: 'hotel',
        title: 'Luxury Hotel Stay in Paris',
        description: 'Beautiful 5-star hotel in the heart of Paris',
        location: {
          city: 'Paris',
          country: 'France',
          coordinates: [2.3522, 48.8566],
        },
        dateRange: {
          checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        originalPrice: 500,
        swapValue: 450,
        providerDetails: {
          provider: 'Booking.com',
          confirmationNumber: 'BK123456789',
          bookingReference: 'REF-ABC-123',
        },
      };

      const mockResult = {
        booking: {
          id: 'test-booking-id',
          userId: 'test-user-id',
          title: bookingData.title,
          status: 'available',
          ...bookingData,
        },
        blockchainTransaction: {
          transactionId: 'test-tx-id',
          consensusTimestamp: '123456789.000000000',
        },
      };

      mockBookingService.createBookingListing.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking).toBeDefined();
      expect(response.body.data.booking.title).toBe(bookingData.title);
      expect(response.body.data.blockchain).toBeDefined();
      expect(mockBookingService.createBookingListing).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'test-user-id',
          type: bookingData.type,
          title: bookingData.title,
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteBookingData = {
        type: 'hotel',
        title: 'Test Hotel',
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(incompleteBookingData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Missing required fields');
    });

    it('should return 400 for invalid date range', async () => {
      const invalidBookingData = {
        type: 'hotel',
        title: 'Test Hotel',
        description: 'Test description',
        location: {
          city: 'Paris',
          country: 'France',
        },
        dateRange: {
          checkIn: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          checkOut: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Check-out before check-in
        },
        originalPrice: 500,
        swapValue: 450,
        providerDetails: {
          provider: 'Booking.com',
          confirmationNumber: 'BK123456789',
          bookingReference: 'REF-ABC-123',
        },
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidBookingData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Check-in date must be before check-out date');
    });
  });

  describe('GET /api/bookings', () => {
    it('should return available bookings with search', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          title: 'Hotel in Paris',
          type: 'hotel',
          status: 'available',
        },
        {
          id: 'booking-2',
          title: 'Event in London',
          type: 'event',
          status: 'available',
        },
      ];

      mockBookingService.searchBookings.mockResolvedValue(mockBookings);

      const response = await request(app)
        .get('/api/bookings')
        .query({
          query: 'Paris',
          limit: 10,
          offset: 0,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toEqual(mockBookings);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.searchCriteria).toBeDefined();
      expect(mockBookingService.searchBookings).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'Paris' }),
        10,
        0
      );
    });

    it('should return bookings with filters', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          title: 'Hotel in Paris',
          type: 'hotel',
          status: 'available',
        },
      ];

      mockBookingService.getBookingsWithFilters.mockResolvedValue(mockBookings);

      const response = await request(app)
        .get('/api/bookings')
        .query({
          type: 'hotel',
          status: 'available',
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toEqual(mockBookings);
      expect(response.body.data.filters).toBeDefined();
      expect(mockBookingService.getBookingsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'hotel', status: 'available' }),
        10,
        0
      );
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should return booking by ID', async () => {
      const mockBooking = {
        id: 'test-booking-id',
        title: 'Test Hotel',
        type: 'hotel',
        status: 'available',
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking);

      const response = await request(app)
        .get('/api/bookings/test-booking-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking).toEqual(mockBooking);
      expect(mockBookingService.getBookingById).toHaveBeenCalledWith('test-booking-id');
    });

    it('should return 404 for non-existent booking', async () => {
      mockBookingService.getBookingById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/bookings/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  describe('PUT /api/bookings/:id', () => {
    it('should update booking status', async () => {
      const mockUpdatedBooking = {
        id: 'test-booking-id',
        title: 'Test Hotel',
        status: 'locked',
      };

      mockBookingService.updateBookingStatus.mockResolvedValue(mockUpdatedBooking);

      const response = await request(app)
        .put('/api/bookings/test-booking-id')
        .send({ status: 'locked' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.status).toBe('locked');
      expect(mockBookingService.updateBookingStatus).toHaveBeenCalledWith(
        'test-booking-id',
        'locked',
        'test-user-id'
      );
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put('/api/bookings/test-booking-id')
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/bookings/:id/verify', () => {
    it('should verify booking', async () => {
      const mockVerifiedBooking = {
        id: 'test-booking-id',
        title: 'Test Hotel',
        verification: { status: 'verified' },
      };

      mockBookingService.verifyBooking.mockResolvedValue(mockVerifiedBooking);

      const response = await request(app)
        .post('/api/bookings/test-booking-id/verify')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking).toEqual(mockVerifiedBooking);
      expect(mockBookingService.verifyBooking).toHaveBeenCalledWith('test-booking-id');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should cancel booking', async () => {
      const mockCancelledBooking = {
        id: 'test-booking-id',
        title: 'Test Hotel',
        status: 'cancelled',
      };

      mockBookingService.cancelBooking.mockResolvedValue(mockCancelledBooking);

      const response = await request(app)
        .delete('/api/bookings/test-booking-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.status).toBe('cancelled');
      expect(mockBookingService.cancelBooking).toHaveBeenCalledWith(
        'test-booking-id',
        'test-user-id'
      );
    });
  });

  describe('GET /api/bookings/user/:userId', () => {
    it('should return user bookings for authenticated user', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          title: 'User Hotel 1',
          userId: 'test-user-id',
        },
        {
          id: 'booking-2',
          title: 'User Hotel 2',
          userId: 'test-user-id',
        },
      ];

      mockBookingService.getUserBookings.mockResolvedValue(mockBookings);

      const response = await request(app)
        .get('/api/bookings/user/test-user-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toEqual(mockBookings);
      expect(mockBookingService.getUserBookings).toHaveBeenCalledWith(
        'test-user-id',
        100,
        0
      );
    });

    it('should return 403 for accessing other user bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/user/other-user-id')
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});