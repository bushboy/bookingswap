import { SwapTargetStatus } from './swap-targeting.js';
import { BookingDetails } from './swap-with-booking-details.js';

/**
 * Types of targeting events that can occur
 */
export type TargetingEventType =
    | 'targeting_created'
    | 'targeting_accepted'
    | 'targeting_rejected'
    | 'targeting_cancelled'
    | 'targeting_retargeted'
    | 'auction_started'
    | 'auction_ended'
    | 'proposal_submitted'
    | 'proposal_withdrawn';

/**
 * Severity levels for targeting events
 */
export type TargetingEventSeverity = 'info' | 'warning' | 'success' | 'error';

/**
 * Actor information for targeting events
 */
export interface TargetingEventActor {
    id: string;
    name: string;
    avatar?: string;
}

/**
 * Swap information for targeting events
 */
export interface TargetingEventSwapInfo {
    id: string;
    bookingDetails: BookingDetails;
    ownerId: string;
    ownerName: string;
}

/**
 * Individual targeting event in the history
 */
export interface TargetingEvent {
    id: string;
    type: TargetingEventType;
    severity: TargetingEventSeverity;
    timestamp: Date;

    // Actor who performed the action
    actor: TargetingEventActor;

    // Swaps involved in the event
    sourceSwap: TargetingEventSwapInfo;
    targetSwap: TargetingEventSwapInfo;

    // Event details
    title: string;
    description: string;

    // Status information
    previousStatus?: SwapTargetStatus;
    newStatus?: SwapTargetStatus;

    // Additional context
    metadata?: {
        proposalId?: string;
        targetId?: string;
        auctionInfo?: {
            bidCount?: number;
            endDate?: Date;
            winningBid?: boolean;
        };
        reason?: string;
        automaticAction?: boolean;
    };
}

/**
 * Filtering options for targeting history
 */
export interface TargetingHistoryFilters {
    dateRange?: {
        startDate: Date;
        endDate: Date;
    };
    eventTypes?: TargetingEventType[];
    actors?: string[]; // User IDs
    swaps?: string[]; // Swap IDs
    severity?: TargetingEventSeverity[];
    searchQuery?: string;
}

/**
 * Sorting options for targeting history
 */
export interface TargetingHistorySorting {
    field: 'timestamp' | 'type' | 'actor' | 'severity';
    direction: 'asc' | 'desc';
}

/**
 * Pagination options for targeting history
 */
export interface TargetingHistoryPagination {
    page: number;
    limit: number;
    total?: number;
}

/**
 * Complete targeting history response
 */
export interface TargetingHistoryResponse {
    events: TargetingEvent[];
    pagination: TargetingHistoryPagination;
    filters: TargetingHistoryFilters;
    sorting: TargetingHistorySorting;
    hasMore: boolean;
}

/**
 * Request parameters for targeting history
 */
export interface TargetingHistoryRequest {
    swapId?: string;
    userId?: string;
    filters?: TargetingHistoryFilters;
    sorting?: TargetingHistorySorting;
    pagination?: Omit<TargetingHistoryPagination, 'total'>;
}

/**
 * Grouped targeting events by date
 */
export interface GroupedTargetingEvents {
    date: string; // YYYY-MM-DD format
    events: TargetingEvent[];
}

/**
 * Timeline data for targeting history display
 */
export interface TargetingHistoryTimeline {
    groupedEvents: GroupedTargetingEvents[];
    totalEvents: number;
    dateRange: {
        earliest: Date;
        latest: Date;
    };
}

/**
 * Statistics for targeting history
 */
export interface TargetingHistoryStats {
    totalEvents: number;
    eventsByType: Record<TargetingEventType, number>;
    eventsBySeverity: Record<TargetingEventSeverity, number>;
    mostActiveUsers: Array<{
        user: TargetingEventActor;
        eventCount: number;
    }>;
    timelineStats: {
        averageEventsPerDay: number;
        peakActivityDate: string;
        peakActivityCount: number;
    };
}