/**
 * Migration utilities for backward compatibility with existing bookings and swap data
 * Requirement 16: Ensure backward compatibility with existing bookings and add migration support for existing swap data
 */

import { Booking, SwapWithBookings } from '@/services/bookingService';
import { BookingWithSwapInfo, SwapInfo } from '@booking-swap/shared';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Migrates legacy booking data to the enhanced format with swap information
 */
export const migrateLegacyBookingsToEnhanced = async (
  legacyBookings: Booking[],
  legacySwaps: SwapWithBookings[]
): Promise<{ bookings: BookingWithSwapInfo[]; result: MigrationResult }> => {
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    errors: [],
    warnings: [],
  };

  const enhancedBookings: BookingWithSwapInfo[] = [];

  try {
    for (const booking of legacyBookings) {
      try {
        // Find associated swap data
        const associatedSwap = legacySwaps.find(swap => 
          swap.sourceBooking?.id === booking.id || 
          swap.targetBooking?.id === booking.id
        );

        // Convert to enhanced format
        const enhancedBooking: BookingWithSwapInfo = {
          ...booking,
          swapInfo: associatedSwap ? mapLegacySwapToSwapInfo(associatedSwap, booking.id) : undefined,
        };

        enhancedBookings.push(enhancedBooking);
        result.migratedCount++;
      } catch (error) {
        result.errors.push(`Failed to migrate booking ${booking.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Check for orphaned swaps (swaps without corresponding bookings)
    const orphanedSwaps = legacySwaps.filter(swap => 
      !legacyBookings.some(booking => 
        booking.id === swap.sourceBooking?.id || booking.id === swap.targetBooking?.id
      )
    );

    if (orphanedSwaps.length > 0) {
      result.warnings.push(`Found ${orphanedSwaps.length} orphaned swaps without corresponding bookings`);
    }

  } catch (error) {
    result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.success = false;
  }

  return { bookings: enhancedBookings, result };
};

/**
 * Maps legacy swap data to the new SwapInfo format
 */
const mapLegacySwapToSwapInfo = (legacySwap: SwapWithBookings, bookingId: string): SwapInfo => {
  // Determine payment types based on legacy swap structure
  const paymentTypes: ('booking' | 'cash')[] = [];
  
  if (legacySwap.sourceBooking || legacySwap.targetBooking) {
    paymentTypes.push('booking');
  }
  
  // Check if there are cash offers in proposals
  const hasCashOffers = legacySwap.proposals?.some(proposal => 
    (proposal as any).cashOffer || (proposal as any).additionalPayment
  );
  
  if (hasCashOffers) {
    paymentTypes.push('cash');
  }

  // Default to booking if no payment types detected
  if (paymentTypes.length === 0) {
    paymentTypes.push('booking');
  }

  // Determine acceptance strategy (legacy swaps were typically first-match)
  const acceptanceStrategy = (legacySwap as any).auctionMode ? 'auction' : 'first-match';

  // Calculate cash amounts from proposals
  const cashOffers = legacySwap.proposals
    ?.map(proposal => (proposal as any).cashOffer?.amount || (proposal as any).additionalPayment)
    .filter(amount => typeof amount === 'number' && amount > 0) || [];

  const minCashAmount = cashOffers.length > 0 ? Math.min(...cashOffers) : undefined;
  const maxCashAmount = cashOffers.length > 0 ? Math.max(...cashOffers) : undefined;

  // Determine user proposal status (simplified for migration)
  const userProposalStatus = legacySwap.proposals && legacySwap.proposals.length > 0 ? 'pending' : 'none';

  return {
    swapId: legacySwap.id,
    paymentTypes,
    acceptanceStrategy,
    auctionEndDate: (legacySwap as any).auctionEndDate ? new Date((legacySwap as any).auctionEndDate) : undefined,
    minCashAmount,
    maxCashAmount,
    hasActiveProposals: legacySwap.status === 'active' && (legacySwap.proposals?.length || 0) > 0,
    activeProposalCount: legacySwap.proposals?.length || 0,
    userProposalStatus: userProposalStatus as 'none' | 'pending' | 'accepted' | 'rejected',
    timeRemaining: (legacySwap as any).auctionEndDate ? 
      Math.max(0, new Date((legacySwap as any).auctionEndDate).getTime() - Date.now()) : undefined,
    swapConditions: [], // Add missing field
    hasAnySwapInitiated: true, // Legacy swap exists means it was initiated
  };
};

/**
 * Validates that migrated data maintains consistency
 */
export const validateMigratedData = (
  originalBookings: Booking[],
  migratedBookings: BookingWithSwapInfo[]
): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Check that all original bookings are present
  if (originalBookings.length !== migratedBookings.length) {
    issues.push(`Booking count mismatch: original ${originalBookings.length}, migrated ${migratedBookings.length}`);
  }

  // Check that core booking data is preserved
  for (const originalBooking of originalBookings) {
    const migratedBooking = migratedBookings.find(b => b.id === originalBooking.id);
    
    if (!migratedBooking) {
      issues.push(`Missing migrated booking: ${originalBooking.id}`);
      continue;
    }

    // Validate core fields are preserved
    const coreFields = ['title', 'description', 'originalPrice', 'status', 'userId'] as const;
    for (const field of coreFields) {
      if (originalBooking[field] !== migratedBooking[field]) {
        issues.push(`Field mismatch for booking ${originalBooking.id}.${field}: ${originalBooking[field]} !== ${migratedBooking[field]}`);
      }
    }

    // Validate date ranges
    if (originalBooking.dateRange.checkIn !== migratedBooking.dateRange.checkIn ||
        originalBooking.dateRange.checkOut !== migratedBooking.dateRange.checkOut) {
      issues.push(`Date range mismatch for booking ${originalBooking.id}`);
    }

    // Validate location data
    if (originalBooking.location.city !== migratedBooking.location.city ||
        originalBooking.location.country !== migratedBooking.location.country) {
      issues.push(`Location mismatch for booking ${originalBooking.id}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
};

/**
 * Creates a backup of existing data before migration
 */
export const createDataBackup = (
  bookings: Booking[],
  swaps: SwapWithBookings[]
): { backup: string; timestamp: Date } => {
  const backup = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    bookings,
    swaps,
    metadata: {
      bookingCount: bookings.length,
      swapCount: swaps.length,
      migrationReason: 'UI simplification integration',
    },
  };

  return {
    backup: JSON.stringify(backup, null, 2),
    timestamp: new Date(),
  };
};

/**
 * Restores data from backup if migration fails
 */
export const restoreFromBackup = (backupData: string): {
  bookings: Booking[];
  swaps: SwapWithBookings[];
  metadata: any;
} => {
  try {
    const parsed = JSON.parse(backupData);
    
    if (!parsed.bookings || !parsed.swaps) {
      throw new Error('Invalid backup format: missing bookings or swaps data');
    }

    return {
      bookings: parsed.bookings,
      swaps: parsed.swaps,
      metadata: parsed.metadata,
    };
  } catch (error) {
    throw new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Checks if the current data needs migration
 */
export const needsMigration = (bookings: any[]): boolean => {
  // Check if bookings already have swapInfo (indicating they're already migrated)
  return bookings.length > 0 && !bookings[0].hasOwnProperty('swapInfo');
};

/**
 * Performs a gradual migration to avoid overwhelming the system
 */
export const performGradualMigration = async (
  bookings: Booking[],
  swaps: SwapWithBookings[],
  batchSize: number = 50,
  onProgress?: (progress: number, total: number) => void
): Promise<{ bookings: BookingWithSwapInfo[]; result: MigrationResult }> => {
  const totalBatches = Math.ceil(bookings.length / batchSize);
  let migratedBookings: BookingWithSwapInfo[] = [];
  const aggregatedResult: MigrationResult = {
    success: true,
    migratedCount: 0,
    errors: [],
    warnings: [],
  };

  for (let i = 0; i < totalBatches; i++) {
    const startIndex = i * batchSize;
    const endIndex = Math.min(startIndex + batchSize, bookings.length);
    const batch = bookings.slice(startIndex, endIndex);

    try {
      const { bookings: batchMigrated, result: batchResult } = await migrateLegacyBookingsToEnhanced(batch, swaps);
      
      migratedBookings = migratedBookings.concat(batchMigrated);
      aggregatedResult.migratedCount += batchResult.migratedCount;
      aggregatedResult.errors = aggregatedResult.errors.concat(batchResult.errors);
      aggregatedResult.warnings = aggregatedResult.warnings.concat(batchResult.warnings);
      
      if (!batchResult.success) {
        aggregatedResult.success = false;
      }

      // Report progress
      if (onProgress) {
        onProgress(endIndex, bookings.length);
      }

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      aggregatedResult.errors.push(`Batch ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      aggregatedResult.success = false;
    }
  }

  return { bookings: migratedBookings, result: aggregatedResult };
};

/**
 * Migration service class for managing the entire migration process
 */
export class MigrationService {
  private static instance: MigrationService;

  static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  async migrateUserData(userId: string): Promise<MigrationResult> {
    try {
      // This would typically fetch user's data from the API
      // For now, we'll return a success result
      return {
        success: true,
        migratedCount: 0,
        errors: [],
        warnings: ['Migration service is ready but no data to migrate'],
      };
    } catch (error) {
      return {
        success: false,
        migratedCount: 0,
        errors: [error instanceof Error ? error.message : 'Migration failed'],
        warnings: [],
      };
    }
  }

  async checkMigrationStatus(userId: string): Promise<{
    needsMigration: boolean;
    lastMigration?: Date;
    version?: string;
  }> {
    // This would check the user's migration status from the API
    // For now, we'll assume no migration is needed
    return {
      needsMigration: false,
      lastMigration: new Date(),
      version: '1.0.0',
    };
  }
}