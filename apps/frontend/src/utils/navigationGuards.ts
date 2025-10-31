import { Booking } from '@booking-swap/shared';

/**
 * Navigation guards for booking-related routes
 * 
 * These guards validate booking ownership and access permissions
 * before allowing navigation to protected booking interfaces.
 */

export interface NavigationGuardContext {
  userId: string;
  token: string;
  booking?: Booking;
  bookingId?: string;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  redirectTo?: string;
}

/**
 * Base navigation guard class
 */
export abstract class BaseNavigationGuard {
  abstract check(context: NavigationGuardContext): Promise<GuardResult> | GuardResult;

  protected createResult(
    allowed: boolean,
    reason?: string,
    redirectTo?: string
  ): GuardResult {
    return { allowed, reason, redirectTo };
  }
}

/**
 * Guard to validate user authentication
 * Requirements: 6.4
 */
export class AuthenticationGuard extends BaseNavigationGuard {
  check(context: NavigationGuardContext): GuardResult {
    if (!context.userId || !context.token) {
      return this.createResult(
        false,
        'User must be authenticated to access booking interfaces',
        '/login'
      );
    }

    return this.createResult(true);
  }
}

/**
 * Guard to validate booking ownership
 * Requirements: 6.4, 6.5
 */
export class BookingOwnershipGuard extends BaseNavigationGuard {
  check(context: NavigationGuardContext): GuardResult {
    if (!context.booking) {
      return this.createResult(
        false,
        'Booking information is required for ownership validation'
      );
    }

    if (context.booking.userId !== context.userId) {
      return this.createResult(
        false,
        'You do not have permission to access this booking',
        '/bookings'
      );
    }

    return this.createResult(true);
  }
}

/**
 * Guard to validate booking exists and is accessible
 * Requirements: 6.4, 6.5
 */
export class BookingExistenceGuard extends BaseNavigationGuard {
  private bookingService: any; // Will be injected

  constructor(bookingService: any) {
    super();
    this.bookingService = bookingService;
  }

  async check(context: NavigationGuardContext): Promise<GuardResult> {
    if (!context.bookingId) {
      return this.createResult(
        false,
        'Booking ID is required',
        '/bookings'
      );
    }

    try {
      const booking = await this.bookingService.getBooking(context.bookingId);
      
      if (!booking) {
        return this.createResult(
          false,
          'Booking not found',
          '/bookings'
        );
      }

      // Update context with loaded booking
      context.booking = booking;
      return this.createResult(true);

    } catch (error) {
      console.error('Error loading booking for guard:', error);
      return this.createResult(
        false,
        'Failed to load booking information',
        '/bookings'
      );
    }
  }
}

/**
 * Guard to validate swap specification access
 * Requirements: 6.4, 6.5
 */
export class SwapSpecificationAccessGuard extends BaseNavigationGuard {
  check(context: NavigationGuardContext): GuardResult {
    if (!context.booking) {
      return this.createResult(
        false,
        'Booking information is required for swap specification access'
      );
    }

    // Check if booking is in a state that allows swap specification
    const now = new Date();
    const checkInDate = new Date(context.booking.dateRange.checkIn);

    if (checkInDate <= now) {
      return this.createResult(
        false,
        'Cannot create swap specifications for past bookings',
        '/bookings'
      );
    }

    // Additional business logic checks can be added here
    // For example, checking if booking type supports swapping

    return this.createResult(true);
  }
}

/**
 * Guard to validate booking edit access
 * Requirements: 6.4, 6.5
 */
export class BookingEditAccessGuard extends BaseNavigationGuard {
  check(context: NavigationGuardContext): GuardResult {
    if (!context.booking) {
      return this.createResult(
        false,
        'Booking information is required for edit access'
      );
    }

    // Check if booking can still be edited
    const now = new Date();
    const checkInDate = new Date(context.booking.dateRange.checkIn);
    
    // Allow editing up to 24 hours before check-in
    const editCutoff = new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000);

    if (now >= editCutoff) {
      return this.createResult(
        false,
        'Booking can no longer be edited (too close to check-in date)',
        '/bookings'
      );
    }

    return this.createResult(true);
  }
}

/**
 * Composite guard that runs multiple guards in sequence
 */
export class CompositeNavigationGuard {
  private guards: BaseNavigationGuard[];

  constructor(guards: BaseNavigationGuard[]) {
    this.guards = guards;
  }

  async check(context: NavigationGuardContext): Promise<GuardResult> {
    for (const guard of this.guards) {
      const result = await guard.check(context);
      
      if (!result.allowed) {
        return result;
      }
    }

    return { allowed: true };
  }
}

/**
 * Navigation guard manager for booking routes
 */
export class BookingNavigationGuardManager {
  private bookingService: any;

  constructor(bookingService: any) {
    this.bookingService = bookingService;
  }

  /**
   * Create guards for booking edit access
   * Requirements: 6.4, 6.5
   */
  createBookingEditGuards(): CompositeNavigationGuard {
    return new CompositeNavigationGuard([
      new AuthenticationGuard(),
      new BookingExistenceGuard(this.bookingService),
      new BookingOwnershipGuard(),
      new BookingEditAccessGuard(),
    ]);
  }

  /**
   * Create guards for swap specification access
   * Requirements: 6.4, 6.5
   */
  createSwapSpecificationGuards(): CompositeNavigationGuard {
    return new CompositeNavigationGuard([
      new AuthenticationGuard(),
      new BookingExistenceGuard(this.bookingService),
      new BookingOwnershipGuard(),
      new SwapSpecificationAccessGuard(),
    ]);
  }

  /**
   * Validate access to booking edit interface
   * Requirements: 6.4, 6.5
   */
  async validateBookingEditAccess(
    bookingId: string,
    userId: string,
    token: string
  ): Promise<GuardResult> {
    const guards = this.createBookingEditGuards();
    const context: NavigationGuardContext = {
      bookingId,
      userId,
      token,
    };

    return await guards.check(context);
  }

  /**
   * Validate access to swap specification interface
   * Requirements: 6.4, 6.5
   */
  async validateSwapSpecificationAccess(
    bookingId: string,
    userId: string,
    token: string
  ): Promise<GuardResult> {
    const guards = this.createSwapSpecificationGuards();
    const context: NavigationGuardContext = {
      bookingId,
      userId,
      token,
    };

    return await guards.check(context);
  }
}

/**
 * Hook-like utility for using navigation guards in components
 */
export class NavigationGuardHook {
  private guardManager: BookingNavigationGuardManager;

  constructor(guardManager: BookingNavigationGuardManager) {
    this.guardManager = guardManager;
  }

  /**
   * Check if user can access booking edit
   * Requirements: 6.4, 6.5
   */
  async canAccessBookingEdit(
    bookingId: string,
    userId: string,
    token: string
  ): Promise<{ canAccess: boolean; reason?: string; redirectTo?: string }> {
    const result = await this.guardManager.validateBookingEditAccess(
      bookingId,
      userId,
      token
    );

    return {
      canAccess: result.allowed,
      reason: result.reason,
      redirectTo: result.redirectTo,
    };
  }

  /**
   * Check if user can access swap specification
   * Requirements: 6.4, 6.5
   */
  async canAccessSwapSpecification(
    bookingId: string,
    userId: string,
    token: string
  ): Promise<{ canAccess: boolean; reason?: string; redirectTo?: string }> {
    const result = await this.guardManager.validateSwapSpecificationAccess(
      bookingId,
      userId,
      token
    );

    return {
      canAccess: result.canAccess,
      reason: result.reason,
      redirectTo: result.redirectTo,
    };
  }
}

/**
 * Error types for navigation guard failures
 */
export class NavigationGuardError extends Error {
  constructor(
    message: string,
    public readonly redirectTo?: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'NavigationGuardError';
  }
}

export class BookingAccessError extends NavigationGuardError {
  constructor(message: string, redirectTo?: string) {
    super(message, redirectTo, 'BOOKING_ACCESS_DENIED');
  }
}

export class BookingOwnershipError extends NavigationGuardError {
  constructor(bookingId: string) {
    super(
      `You do not have permission to access booking ${bookingId}`,
      '/bookings',
      'BOOKING_OWNERSHIP_DENIED'
    );
  }
}

export class BookingNotFoundError extends NavigationGuardError {
  constructor(bookingId: string) {
    super(
      `Booking ${bookingId} not found`,
      '/bookings',
      'BOOKING_NOT_FOUND'
    );
  }
}