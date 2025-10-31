/**
 * Centralized booking types configuration
 * Single source of truth for all booking type definitions, labels, and enabled status
 */

// Currently enabled booking types (accommodation only)
export const ENABLED_BOOKING_TYPES = [
    'hotel',
    'vacation_rental',
    'resort',
    'hostel',
    'bnb'
] as const;

// All possible booking types (for future expansion)
export const ALL_BOOKING_TYPES = [
    // Accommodation types (currently enabled)
    'hotel',
    'vacation_rental',
    'resort',
    'hostel',
    'bnb',
    // Event types (temporarily disabled)
    'event',
    'concert',
    'sports',
    'theater',
    // Other types (temporarily disabled)
    'flight',
    'rental'
] as const;

// Type definitions
export type EnabledBookingType = typeof ENABLED_BOOKING_TYPES[number];
export type AllBookingType = typeof ALL_BOOKING_TYPES[number];
export type AccommodationType = EnabledBookingType;

// Booking type configuration with labels and metadata
export interface BookingTypeConfig {
    value: EnabledBookingType;
    label: string;
    icon: string;
    category: 'accommodation';
    enabled: true;
    description: string;
}

// Disabled booking type configuration
export interface DisabledBookingTypeConfig {
    value: Exclude<AllBookingType, EnabledBookingType>;
    label: string;
    icon: string;
    category: 'event' | 'travel' | 'other';
    enabled: false;
    description: string;
    disabledReason: string;
}

// Complete booking type configurations
export const BOOKING_TYPE_CONFIGS: Record<EnabledBookingType, BookingTypeConfig> = {
    hotel: {
        value: 'hotel',
        label: 'Hotel',
        icon: '🏨',
        category: 'accommodation',
        enabled: true,
        description: 'Traditional hotel accommodations with full service amenities'
    },
    vacation_rental: {
        value: 'vacation_rental',
        label: 'Vacation Rental',
        icon: '🏡',
        category: 'accommodation',
        enabled: true,
        description: 'Private vacation rental properties including homes, apartments, and condos'
    },
    resort: {
        value: 'resort',
        label: 'Resort',
        icon: '🏖️',
        category: 'accommodation',
        enabled: true,
        description: 'All-inclusive resort properties with recreational facilities'
    },
    hostel: {
        value: 'hostel',
        label: 'Hostel',
        icon: '🏠',
        category: 'accommodation',
        enabled: true,
        description: 'Budget-friendly shared accommodations for travelers'
    },
    bnb: {
        value: 'bnb',
        label: 'Bed & Breakfast',
        icon: '🛏️',
        category: 'accommodation',
        enabled: true,
        description: 'Small lodging establishments offering overnight accommodation and breakfast'
    }
};

// Disabled booking type configurations (for reference and future use)
export const DISABLED_BOOKING_TYPE_CONFIGS: Record<Exclude<AllBookingType, EnabledBookingType>, DisabledBookingTypeConfig> = {
    event: {
        value: 'event',
        label: 'Event',
        icon: '🎪',
        category: 'event',
        enabled: false,
        description: 'General event tickets and experiences',
        disabledReason: 'Event bookings are temporarily disabled pending system updates'
    },
    concert: {
        value: 'concert',
        label: 'Concert',
        icon: '🎵',
        category: 'event',
        enabled: false,
        description: 'Music concerts and live performances',
        disabledReason: 'Event bookings are temporarily disabled pending system updates'
    },
    sports: {
        value: 'sports',
        label: 'Sports Event',
        icon: '⚽',
        category: 'event',
        enabled: false,
        description: 'Sports games and athletic events',
        disabledReason: 'Event bookings are temporarily disabled pending system updates'
    },
    theater: {
        value: 'theater',
        label: 'Theater',
        icon: '🎭',
        category: 'event',
        enabled: false,
        description: 'Theater shows and dramatic performances',
        disabledReason: 'Event bookings are temporarily disabled pending system updates'
    },
    flight: {
        value: 'flight',
        label: 'Flight',
        icon: '✈️',
        category: 'travel',
        enabled: false,
        description: 'Airline tickets and flight reservations',
        disabledReason: 'Flight bookings are temporarily disabled pending system updates'
    },
    rental: {
        value: 'rental',
        label: 'Car Rental',
        icon: '🚗',
        category: 'other',
        enabled: false,
        description: 'Vehicle rental reservations',
        disabledReason: 'Rental bookings are temporarily disabled pending system updates'
    }
};

// Utility functions for working with booking types

/**
 * Check if a booking type is currently enabled
 */
export function isBookingTypeEnabled(type: AllBookingType): type is EnabledBookingType {
    return ENABLED_BOOKING_TYPES.includes(type as EnabledBookingType);
}

/**
 * Get all enabled booking types
 */
export function getEnabledBookingTypes(): readonly EnabledBookingType[] {
    return ENABLED_BOOKING_TYPES;
}

/**
 * Get all enabled booking type configurations
 */
export function getEnabledBookingTypeConfigs(): Record<EnabledBookingType, BookingTypeConfig> {
    return BOOKING_TYPE_CONFIGS;
}

/**
 * Get configuration for a specific booking type
 */
export function getBookingTypeConfig(type: EnabledBookingType): BookingTypeConfig {
    return BOOKING_TYPE_CONFIGS[type];
}

/**
 * Get all booking type options for dropdowns/selects
 */
export function getBookingTypeOptions(): Array<{
    value: EnabledBookingType;
    label: string;
    icon: string;
    description: string;
}> {
    return ENABLED_BOOKING_TYPES.map(type => ({
        value: type,
        label: BOOKING_TYPE_CONFIGS[type].label,
        icon: BOOKING_TYPE_CONFIGS[type].icon,
        description: BOOKING_TYPE_CONFIGS[type].description
    }));
}

/**
 * Get booking type label for display
 */
export function getBookingTypeLabel(type: EnabledBookingType): string {
    return BOOKING_TYPE_CONFIGS[type].label;
}

/**
 * Get booking type icon for display
 */
export function getBookingTypeIcon(type: EnabledBookingType): string {
    return BOOKING_TYPE_CONFIGS[type].icon;
}

/**
 * Validate if a string is a valid enabled booking type
 */
export function validateBookingType(type: string): type is EnabledBookingType {
    return ENABLED_BOOKING_TYPES.includes(type as EnabledBookingType);
}

/**
 * Get error message for invalid booking types
 */
export function getBookingTypeValidationMessage(): string {
    const enabledTypeLabels = ENABLED_BOOKING_TYPES.map(type => BOOKING_TYPE_CONFIGS[type].label);
    return `Only accommodation bookings are currently supported: ${enabledTypeLabels.join(', ')}. Event, flight, and rental bookings are temporarily disabled.`;
}

/**
 * Get list of enabled booking type values for validation schemas
 */
export function getBookingTypeValidationValues(): readonly EnabledBookingType[] {
    return ENABLED_BOOKING_TYPES;
}