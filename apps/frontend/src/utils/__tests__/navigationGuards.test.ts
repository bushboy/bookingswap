import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuthenticationGuard,
  BookingOwnershipGuard,
  BookingExistenceGuard,
  SwapSpecificationAccessGuard,
  BookingEditAccessGuard,
  CompositeNavigationGuard,
  BookingNavigationGuardManager,
  NavigationGuardContext,
} from '../navigationGuards';
import { Booking } from '@booking-swap/shared';

// Mock booking service
const mockBookingService = {
  getBooking: vi.fn(),
};

// Mock booking data
const mockBooking: Booking = {
  id: 'booking-123',
  userId: 'user-456',
  title: 'Test Booking',
  description: 'Test Description',
  type: 'hotel',
  location: {
    city: 'Test City',
    country: 'Test Country',
    address: 'Test Address',
  },
  dateRange: {
    checkIn: '2024-12-01T10:00:00Z',
    checkOut: '2024-12-03T10:00:00Z',
  },
  originalPrice: 200,
  swapValue: 180,
  providerDetails: {
    name: 'Test Provider',
    contact: 'test@provider.com',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// Mock context
const mockContext: NavigationGuardContext = {
  userId: 'user-456',
  token: 'valid-token',
  booking: mockBooking,
  bookingId: 'booking-123',
};

describe('AuthenticationGuard', () => {
  let guard: AuthenticationGuard;

  beforeEach(() => {
    guard = new AuthenticationGuard();
  });

  it('should allow access when user is authenticated', () => {
    const result = guard.check(mockContext);
    
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.redirectTo).toBeUndefined();
  });

  it('should deny access when user ID is missing', () => {
    const context = { ...mockContext, userId: '' };
    const result = guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User must be authenticated to access booking interfaces');
    expect(result.redirectTo).toBe('/login');
  });

  it('should deny access when token is missing', () => {
    const context = { ...mockContext, token: '' };
    const result = guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User must be authenticated to access booking interfaces');
    expect(result.redirectTo).toBe('/login');
  });
});

describe('BookingOwnershipGuard', () => {
  let guard: BookingOwnershipGuard;

  beforeEach(() => {
    guard = new BookingOwnershipGuard();
  });

  it('should allow access when user owns the booking', () => {
    const result = guard.check(mockContext);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny access when booking is missing', () => {
    const context = { ...mockContext, booking: undefined };
    const result = guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Booking information is required for ownership validation');
  });

  it('should deny access when user does not own the booking', () => {
    const context = {
      ...mockContext,
      booking: { ...mockBooking, userId: 'different-user' },
    };
    const result = guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('You do not have permission to access this booking');
    expect(result.redirectTo).toBe('/bookings');
  });
});

describe('BookingExistenceGuard', () => {
  let guard: BookingExistenceGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new BookingExistenceGuard(mockBookingService);
  });

  it('should allow access when booking exists', async () => {
    mockBookingService.getBooking.mockResolvedValue(mockBooking);
    
    const context = { ...mockContext, booking: undefined };
    const result = await guard.check(context);
    
    expect(result.allowed).toBe(true);
    expect(mockBookingService.getBooking).toHaveBeenCalledWith('booking-123');
    expect(context.booking).toBe(mockBooking);
  });

  it('should deny access when booking ID is missing', async () => {
    const context = { ...mockContext, bookingId: undefined };
    const result = await guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Booking ID is required');
    expect(result.redirectTo).toBe('/bookings');
  });

  it('should deny access when booking does not exist', async () => {
    mockBookingService.getBooking.mockResolvedValue(null);
    
    const context = { ...mockContext, booking: undefined };
    const result = await guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Booking not found');
    expect(result.redirectTo).toBe('/bookings');
  });

  it('should deny access when service throws error', async () => {
    mockBookingService.getBooking.mockRejectedValue(new Error('Service error'));
    
    const context = { ...mockContext, booking: undefined };
    const result = await guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Failed to load booking information');
    expect(result.redirectTo).toBe('/bookings');
  });
});

describe('SwapSpecificationAccessGuard', () => {
  let guard: SwapSpecificationAccessGuard;

  beforeEach(() => {
    guard = new SwapSpecificationAccessGuard();
    // Mock current date to be before the booking check-in date
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-11-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow access for future bookings', () => {
    const result = guard.check(mockContext);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny access when booking is missing', () => {
    const context = { ...mockContext, booking: undefined };
    const result = guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Booking information is required for swap specification access');
  });

  it('should deny access for past bookings', () => {
    // Set current time to after the booking check-in date
    vi.setSystemTime(new Date('2024-12-02T10:00:00Z'));
    
    const result = guard.check(mockContext);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Cannot create swap specifications for past bookings');
    expect(result.redirectTo).toBe('/bookings');
  });
});

describe('BookingEditAccessGuard', () => {
  let guard: BookingEditAccessGuard;

  beforeEach(() => {
    guard = new BookingEditAccessGuard();
    // Mock current date to be well before the booking check-in date
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-11-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow access when booking can be edited', () => {
    const result = guard.check(mockContext);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny access when booking is missing', () => {
    const context = { ...mockContext, booking: undefined };
    const result = guard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Booking information is required for edit access');
  });

  it('should deny access when too close to check-in date', () => {
    // Set current time to within 24 hours of check-in
    vi.setSystemTime(new Date('2024-11-30T15:00:00Z'));
    
    const result = guard.check(mockContext);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Booking can no longer be edited (too close to check-in date)');
    expect(result.redirectTo).toBe('/bookings');
  });
});

describe('CompositeNavigationGuard', () => {
  let authGuard: AuthenticationGuard;
  let ownershipGuard: BookingOwnershipGuard;
  let compositeGuard: CompositeNavigationGuard;

  beforeEach(() => {
    authGuard = new AuthenticationGuard();
    ownershipGuard = new BookingOwnershipGuard();
    compositeGuard = new CompositeNavigationGuard([authGuard, ownershipGuard]);
  });

  it('should allow access when all guards pass', async () => {
    const result = await compositeGuard.check(mockContext);
    
    expect(result.allowed).toBe(true);
  });

  it('should deny access when first guard fails', async () => {
    const context = { ...mockContext, userId: '' };
    const result = await compositeGuard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User must be authenticated to access booking interfaces');
  });

  it('should deny access when second guard fails', async () => {
    const context = {
      ...mockContext,
      booking: { ...mockBooking, userId: 'different-user' },
    };
    const result = await compositeGuard.check(context);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('You do not have permission to access this booking');
  });
});

describe('BookingNavigationGuardManager', () => {
  let guardManager: BookingNavigationGuardManager;

  beforeEach(() => {
    vi.clearAllMocks();
    guardManager = new BookingNavigationGuardManager(mockBookingService);
    
    // Mock current date
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-11-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validateBookingEditAccess', () => {
    it('should allow access for valid booking edit request', async () => {
      mockBookingService.getBooking.mockResolvedValue(mockBooking);
      
      const result = await guardManager.validateBookingEditAccess(
        'booking-123',
        'user-456',
        'valid-token'
      );
      
      expect(result.allowed).toBe(true);
    });

    it('should deny access when user is not authenticated', async () => {
      const result = await guardManager.validateBookingEditAccess(
        'booking-123',
        '',
        ''
      );
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User must be authenticated to access booking interfaces');
    });

    it('should deny access when booking does not exist', async () => {
      mockBookingService.getBooking.mockResolvedValue(null);
      
      const result = await guardManager.validateBookingEditAccess(
        'booking-123',
        'user-456',
        'valid-token'
      );
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Booking not found');
    });

    it('should deny access when user does not own booking', async () => {
      const differentUserBooking = { ...mockBooking, userId: 'different-user' };
      mockBookingService.getBooking.mockResolvedValue(differentUserBooking);
      
      const result = await guardManager.validateBookingEditAccess(
        'booking-123',
        'user-456',
        'valid-token'
      );
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('You do not have permission to access this booking');
    });
  });

  describe('validateSwapSpecificationAccess', () => {
    it('should allow access for valid swap specification request', async () => {
      mockBookingService.getBooking.mockResolvedValue(mockBooking);
      
      const result = await guardManager.validateSwapSpecificationAccess(
        'booking-123',
        'user-456',
        'valid-token'
      );
      
      expect(result.allowed).toBe(true);
    });

    it('should deny access for past bookings', async () => {
      const pastBooking = {
        ...mockBooking,
        dateRange: {
          checkIn: '2024-10-01T10:00:00Z',
          checkOut: '2024-10-03T10:00:00Z',
        },
      };
      mockBookingService.getBooking.mockResolvedValue(pastBooking);
      
      const result = await guardManager.validateSwapSpecificationAccess(
        'booking-123',
        'user-456',
        'valid-token'
      );
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot create swap specifications for past bookings');
    });
  });
});