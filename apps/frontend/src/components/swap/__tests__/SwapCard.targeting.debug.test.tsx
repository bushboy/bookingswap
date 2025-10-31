/**
 * Debug test to identify why targeting indicators aren't showing
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EnhancedSwapCard } from '../SwapCard.enhanced';
import { EnhancedSwapCardData } from '@booking-swap/shared';

// Mock the responsive hook
vi.mock('../../../hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false })
}));

// Mock the accessibility hooks
vi.mock('../../../hooks/useAccessibility', () => ({
    useId: () => 'test-id',
    useAnnouncements: () => ({ announce: vi.fn() }),
    useHighContrast: () => ({ isHighContrast: false })
}));

// Mock the WebSocket hook
vi.mock('../../../hooks/useSwapWebSocket', () => ({
    useSwapWebSocket: () => ({ isConnected: true })
}));

describe('SwapCard Targeting Debug Tests', () => {
    const realApiData: EnhancedSwapCardData = {
        userSwap: {
            id: "e01afbcd-44c3-44a8-b3b2-8783d36d1c92",
            bookingDetails: {
                id: "d3db6fe8-a23c-4d66-bc62-1b2a110e197d",
                title: "Waterfront Luxury Hotel",
                location: {
                    city: "Cape Town",
                    country: "South Africa"
                },
                dateRange: {
                    checkIn: new Date("2025-10-20T00:00:00.000Z"),
                    checkOut: new Date("2025-10-25T00:00:00.000Z")
                },
                originalPrice: 1000,
                swapValue: 1000
            },
            status: "pending",
            createdAt: new Date("2025-10-12T18:49:11.291Z"),
            expiresAt: new Date("2025-10-20T00:00:00.000Z")
        },
        proposalsFromOthers: [],
        proposalCount: 0,
        targeting: {
            incomingTargets: [],
            incomingTargetCount: 0,
            outgoingTarget: {
                targetId: "808ad4bb-feaa-4b0c-9347-ca28a254d790",
                targetSwapId: "f63db0b1-8151-4cde-a623-4398c984958f",
                targetSwap: {
                    id: "f63db0b1-8151-4cde-a623-4398c984958f",
                    bookingDetails: {
                        id: "f63db0b1-8151-4cde-a623-4398c984958f",
                        title: "Luxurious Mecure Hotel",
                        location: {
                            city: "Unknown",
                            country: "Unknown"
                        },
                        dateRange: {
                            checkIn: new Date("2025-10-13T18:42:42.754Z"),
                            checkOut: new Date("2025-10-13T18:42:42.754Z")
                        },
                        originalPrice: 0,
                        swapValue: 0
                    },
                    ownerId: "",
                    ownerName: "Unknown User"
                },
                proposalId: "",
                status: "active",
                createdAt: new Date("2025-10-13T18:42:42.754Z"),
                updatedAt: new Date("2025-10-13T18:42:42.754Z"),
                targetSwapInfo: {
                    acceptanceStrategy: {
                        type: "first_match" as any
                    }
                }
            },
            canReceiveTargets: true,
            canTarget: true,
            targetingRestrictions: []
        }
    };

    it('should detect targeting data correctly', () => {
        console.log('🐛 Testing targeting data detection');

        const targeting = realApiData.targeting;
        const incomingCount = targeting?.incomingTargets?.length || 0;
        const hasOutgoing = !!targeting?.outgoingTarget;
        const hasTargeting = targeting && (incomingCount > 0 || hasOutgoing);

        console.log('Debug values:', {
            targetingExists: !!targeting,
            incomingCount,
            hasOutgoing,
            hasTargeting
        });

        expect(targeting).toBeDefined();
        expect(incomingCount).toBe(0);
        expect(hasOutgoing).toBe(true);
        expect(hasTargeting).toBe(true);
    });

    it('should render outgoing target indicator', () => {
        console.log('🐛 Testing outgoing target indicator rendering');

        render(<EnhancedSwapCard swapData={realApiData} />);

        // Look for the outgoing target indicator
        const outgoingIcon = screen.queryByText('📤');
        const targetingText = screen.queryByText('targeting');
        const detailsLink = screen.queryByText('details');

        console.log('Elements found:', {
            outgoingIcon: !!outgoingIcon,
            targetingText: !!targetingText,
            detailsLink: !!detailsLink
        });

        // Debug: Print all text content
        const cardElement = screen.getByTitle(/Swap card:/);
        const allText = cardElement.textContent;
        console.log('All card text content:', allText);

        // The outgoing indicator should be present
        expect(outgoingIcon).toBeInTheDocument();
    });

    it('should NOT render incoming target indicator', () => {
        console.log('🐛 Testing incoming target indicator should NOT render');

        render(<EnhancedSwapCard swapData={realApiData} />);

        // Look for the incoming target indicator
        const incomingIcon = screen.queryByText('📥');
        const incomingCount = screen.queryByText('0'); // Should not show count of 0

        console.log('Incoming elements found:', {
            incomingIcon: !!incomingIcon,
            incomingCount: !!incomingCount
        });

        // The incoming indicator should NOT be present (count is 0)
        expect(incomingIcon).not.toBeInTheDocument();
    });

    it('should render targeting details toggle', () => {
        console.log('🐛 Testing targeting details toggle');

        render(<EnhancedSwapCard swapData={realApiData} />);

        // Look for the details toggle
        const detailsLink = screen.queryByText('details');

        console.log('Details link found:', !!detailsLink);

        expect(detailsLink).toBeInTheDocument();
    });

    it('should handle missing targeting data gracefully', () => {
        console.log('🐛 Testing missing targeting data handling');

        const dataWithoutTargeting = {
            ...realApiData,
            targeting: undefined
        } as any;

        render(<EnhancedSwapCard swapData={dataWithoutTargeting} />);

        // Should not show any targeting indicators
        const outgoingIcon = screen.queryByText('📤');
        const incomingIcon = screen.queryByText('📥');
        const detailsLink = screen.queryByText('details');

        console.log('Elements with no targeting:', {
            outgoingIcon: !!outgoingIcon,
            incomingIcon: !!incomingIcon,
            detailsLink: !!detailsLink
        });

        expect(outgoingIcon).not.toBeInTheDocument();
        expect(incomingIcon).not.toBeInTheDocument();
        expect(detailsLink).not.toBeInTheDocument();
    });

    it('should render with both incoming and outgoing targets', () => {
        console.log('🐛 Testing both incoming and outgoing targets');

        const dataWithBothTargets: EnhancedSwapCardData = {
            ...realApiData,
            targeting: {
                ...realApiData.targeting!,
                incomingTargets: [
                    {
                        targetId: "test-incoming-1",
                        sourceSwapId: "test-source-1",
                        sourceSwap: {
                            id: "test-source-1",
                            bookingDetails: {
                                id: "test-booking-1",
                                title: "Test Incoming Booking",
                                location: { city: "Test City", country: "Test Country" },
                                dateRange: {
                                    checkIn: new Date(),
                                    checkOut: new Date()
                                },
                                originalPrice: 500,
                                swapValue: 500
                            },
                            ownerId: "test-user-1",
                            ownerName: "Test User"
                        },
                        proposalId: "test-proposal-1",
                        status: "active",
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ],
                incomingTargetCount: 1
            }
        };

        render(<EnhancedSwapCard swapData={dataWithBothTargets} />);

        // Should show both indicators
        const outgoingIcon = screen.queryByText('📤');
        const incomingIcon = screen.queryByText('📥');
        const incomingCount = screen.queryByText('1');
        const detailsLink = screen.queryByText('details');

        console.log('Elements with both targets:', {
            outgoingIcon: !!outgoingIcon,
            incomingIcon: !!incomingIcon,
            incomingCount: !!incomingCount,
            detailsLink: !!detailsLink
        });

        expect(outgoingIcon).toBeInTheDocument();
        expect(incomingIcon).toBeInTheDocument();
        expect(incomingCount).toBeInTheDocument();
        expect(detailsLink).toBeInTheDocument();
    });

    it('should log debug information in development mode', () => {
        console.log('🐛 Testing debug logging');

        // Mock console.log to capture debug output
        const consoleSpy = vi.spyOn(console, 'log');

        render(<EnhancedSwapCard swapData={realApiData} />);

        // Check if debug logging occurred
        const debugLogs = consoleSpy.mock.calls.filter(call =>
            call[0] && call[0].includes && call[0].includes('🐛 SwapCard Targeting Debug')
        );

        console.log('Debug logs captured:', debugLogs.length);

        // Should have debug logs in development mode
        expect(debugLogs.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
    });
});