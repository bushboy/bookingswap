/**
 * Type definitions for browse page user filtering feature
 * 
 * This module provides type-safe interfaces for the browse page filtering system
 * that manages user proposal status and booking interactions based on authentication
 * and existing proposal history.
 * 
 * Requirements satisfied:
 * - 3.3: Proposal status tracking and management
 * - 4.1, 4.2, 4.3: Proposal interaction handling based on status
 * - 5.1, 5.2: User proposal status display and action availability
 */

import { Booking } from '@booking-swap/shared';

/**
 * Proposal status values for user interactions with bookings
 * Represents the current state of a user's proposal for a specific booking
 */
export type ProposalStatus = 'none' | 'pending' | 'rejected' | 'accepted';

/**
 * Enhanced booking interface that extends base Booking with proposal status information
 * Used in browse page to display bookings with user-specific proposal context
 */
export interface BookingWithProposalStatus extends Booking {
    /**
     * The swap ID associated with this booking (for making proposals)
     * This is different from the booking ID
     */
    swapId: string;

    /**
     * Current proposal status for the authenticated user
     * - 'none': User has not made any proposal for this booking
     * - 'pending': User has an active proposal waiting for response
     * - 'rejected': User's previous proposal was rejected
     * - 'accepted': User's proposal was accepted
     */
    userProposalStatus?: ProposalStatus;

    /**
     * Whether the current user can make a proposal for this booking
     * - false for pending proposals (user must wait for response)
     * - false for accepted proposals (swap is already in progress)
     * - true for no proposals or rejected proposals (user can propose/re-propose)
     */
    canPropose: boolean;

    /**
     * Whether this booking belongs to the current user
     * Used to filter out user's own bookings from browse results
     */
    isOwnBooking: boolean;
}

/**
 * Result interface for handling user proposal interactions
 * Provides structured feedback for proposal attempt outcomes
 */
export interface ProposalInteractionResult {
    /**
     * Whether the proposal interaction was successful
     */
    success: boolean;

    /**
     * The action that was taken or should be taken
     * - 'blocked': Action was prevented (own booking, existing proposal)
     * - 'allowed': Action can proceed normally
     * - 'refresh_required': Page needs to refresh to update state
     */
    action: 'blocked' | 'allowed' | 'refresh_required';

    /**
     * Optional message to display to the user
     * Used for feedback when actions are blocked or need explanation
     */
    message?: string;

    /**
     * Whether the page should refresh after this interaction
     * Used to update UI state after blocked attempts
     */
    shouldRefresh?: boolean;

    /**
     * Additional data related to the interaction result
     * Can contain proposal details, booking information, etc.
     */
    data?: any;
}

/**
 * Configuration for proposal status display and behavior
 * Defines how different proposal statuses should be presented to users
 */
export interface ProposalStatusConfig {
    /**
     * Display text for the proposal status
     */
    displayText: string;

    /**
     * CSS class name for styling the status indicator
     */
    styleClass: string;

    /**
     * Button text to show for this status
     */
    buttonText: string;

    /**
     * Whether the propose button should be disabled
     */
    buttonDisabled: boolean;

    /**
     * Tooltip text to explain the status
     */
    tooltipText?: string;

    /**
     * Color theme for the status indicator
     */
    color: 'default' | 'orange' | 'green' | 'red';
}

/**
 * Type guard to check if a booking has proposal status information
 * Helps identify enhanced bookings vs regular bookings
 */
export function hasProposalStatus(booking: Booking | BookingWithProposalStatus): booking is BookingWithProposalStatus {
    return 'userProposalStatus' in booking && 'canPropose' in booking && 'isOwnBooking' in booking;
}

/**
 * Utility function to get proposal status configuration
 * Maps proposal status to display configuration
 */
export function getProposalStatusConfig(status: ProposalStatus): ProposalStatusConfig {
    switch (status) {
        case 'pending':
            return {
                displayText: 'Proposal Pending',
                styleClass: 'proposal-status--pending',
                buttonText: 'Proposal Pending',
                buttonDisabled: true,
                tooltipText: 'You have a pending proposal for this booking',
                color: 'orange'
            };

        case 'accepted':
            return {
                displayText: 'Proposal Accepted',
                styleClass: 'proposal-status--accepted',
                buttonText: 'Proposal Accepted',
                buttonDisabled: true,
                tooltipText: 'Your proposal was accepted',
                color: 'green'
            };

        case 'rejected':
            return {
                displayText: 'Previous Proposal Rejected',
                styleClass: 'proposal-status--rejected',
                buttonText: 'Propose Again',
                buttonDisabled: false,
                tooltipText: 'Your previous proposal was rejected. You can propose again.',
                color: 'red'
            };

        case 'none':
        default:
            return {
                displayText: '',
                styleClass: '',
                buttonText: 'Propose Swap',
                buttonDisabled: false,
                tooltipText: '',
                color: 'default'
            };
    }
}

/**
 * Utility function to determine if a user can propose on a booking
 * Combines proposal status and ownership checks
 */
export function canUserPropose(booking: BookingWithProposalStatus, userId?: string): boolean {
    // User cannot propose on their own booking
    if (booking.isOwnBooking || booking.userId === userId) {
        return false;
    }

    // User cannot propose if they have a pending or accepted proposal
    if (booking.userProposalStatus === 'pending' || booking.userProposalStatus === 'accepted') {
        return false;
    }

    // User can propose if they have no proposal or a rejected proposal
    return true;
}

/**
 * Utility function to create a proposal interaction result
 * Helper for consistent result creation
 */
export function createProposalInteractionResult(
    success: boolean,
    action: ProposalInteractionResult['action'],
    message?: string,
    shouldRefresh?: boolean,
    data?: any
): ProposalInteractionResult {
    return {
        success,
        action,
        message,
        shouldRefresh,
        data
    };
}