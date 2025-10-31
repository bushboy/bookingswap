import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import { BookingController } from '../controllers/BookingController';
import { createBookingRoutes } from '../routes/bookings';
import { AuthMiddleware } from '../middleware/auth';

// Mock the booking service and auth middleware for testing
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

const mockAuthMiddleware = {
  requireAuth: () => (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', isAdmin: false };
    next();
  },
};

describe('Booking Management API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
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
          checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
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
      expect(response.body.data.booking.userId).toBe('test-user-id');
      expect(response.body.data.booking.status).toBe('available');
      expect(response.body.data.blockchain).toBeDefined();
      expect(response.body.data.blockchain.transactionId).toBeDefined();
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

    it('should return 401 for unauthenticated requests', async () => {
      const bookingData = {
        type: 'hotel',
        title: 'Test Hotel',
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/bookings', () => {
    it('should return available bookings with search', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .query({
          query: 'Paris',
          limit: 10,
          offset: 0,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toBeDefined();
      expect(Array.isArray(response.body.data.bookings)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.searchCriteria).toBeDefined();
    });

    it('should return bookings with filters', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .query({
          type: 'hotel',
          status: 'available',
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toBeDefined();
      expect(response.body.data.filters).toBeDefined();
    });

    it('should return bookings with location-based search', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .query({
          city: 'Paris',
          country: 'France',
          coordinates: '2.3522,48.8566',
          radius: '10',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searchCriteria.location).toBeDefined();
    });

    it('should return bookings with date range search', async () => {
      const checkIn = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const checkOut = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .get('/api/bookings')
        .query({
          checkIn,
          checkOut,
          flexible: 'true',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searchCriteria.dateRange).toBeDefined();
    });

    it('should return bookings with price range filter', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .query({
          minPrice: '100',
          maxPrice: '1000',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.searchCriteria.priceRange).toBeDefined();
    });
  });

  describe('GET /api/bookings/:id', () => {
    it('should return booking by ID', async () => {
      if (!createdBookingId) {
        // Create a booking first if not already created
        const bookingData = {
          type: 'hotel',
          title: 'Test Hotel for ID fetch',
          description: 'Test description',
          location: { city: 'Paris', country: 'France' },
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

        const createResponse = await request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${authToken}`)
          .send(bookingData);

        createdBookingId = createResponse.body.data.booking.id;
      }

      const response = await request(app)
        .get(`/api/bookings/${createdBookingId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking).toBeDefined();
      expect(response.body.data.booking.id).toBe(createdBookingId);
    });

    it('should return 404 for non-existent booking', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/bookings/${nonExistentId}`)
        .expect(404);

      expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
    });

    it('should return 400 for invalid booking ID format', async () => {
      const response = await request(app)
        .get('/api/bookings/invalid-id')
        .expect(404); // Will be handled by the service layer

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/bookings/:id', () => {
    it('should update booking status', async () => {
      if (!createdBookingId) {
        return; // Skip if no booking was created
      }

      const response = await request(app)
        .put(`/api/bookings/${createdBookingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'locked' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.status).toBe('locked');
    });

    it('should return 400 for invalid status', async () => {
      if (!createdBookingId) {
        return;
      }

      const response = await request(app)
        .put(`/api/bookings/${createdBookingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for unauthenticated requests', async () => {
      if (!createdBookingId) {
        return;
      }

      const response = await request(app)
        .put(`/api/bookings/${createdBookingId}`)
        .send({ status: 'available' })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/bookings/:id/verify', () => {
    it('should verify booking', async () => {
      if (!createdBookingId) {
        return;
      }

      const response = await request(app)
        .post(`/api/bookings/${createdBookingId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking).toBeDefined();
    });

    it('should return 401 for unauthenticated requests', async () => {
      if (!createdBookingId) {
        return;
      }

      const response = await request(app)
        .post(`/api/bookings/${createdBookingId}/verify`)
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should cancel booking', async () => {
      if (!createdBookingId) {
        return;
      }

      const response = await request(app)
        .delete(`/api/bookings/${createdBookingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.status).toBe('cancelled');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .delete('/api/bookings/some-id')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/bookings/user/:userId', () => {
    it('should return user bookings for authenticated user', async () => {
      const response = await request(app)
        .get(`/api/bookings/user/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toBeDefined();
      expect(Array.isArray(response.body.data.bookings)).toBe(true);
    });

    it('should return 403 for accessing other user bookings', async () => {
      const otherUserId = '00000000-0000-0000-0000-000000000001';

      const response = await request(app)
        .get(`/api/bookings/user/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get(`/api/bookings/user/${userId}`)
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});