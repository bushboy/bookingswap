import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { SwapCardData, IncomingTargetInfo, SwapProposal, BookingDetails } from '@booking-swap/shared';
import { swapService } from '@/services/swapService';
import { FinancialDataHandler } from '@/utils/financialDataHandler';
import { proposalService } from '@/services/proposalService';
import { ProposalDetailsModal } from './ProposalDetailsModal';

interface SwapDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    swapData: SwapCardData;
    onProposalAction?: (proposalId: string, action: 'accept' | 'reject') => void;
}

interface EnhancedSwapDetails {
    title?: string;
    description?: string;
    paymentTypes?: any;
    acceptanceStrategy?: any;
    swapPreferences?: any;
    type?: string;
    eventDate?: Date;
}

interface ValidatedSwapData {
    basicInfo: {
        title: string;
        description: string;
        status: string;
        createdAt: Date;
        expiresAt?: Date;
    };
    financialInfo: {
        estimatedValue: string;
        currency: string;
        isValidPrice: boolean;
    };
    proposals: (IncomingTargetInfo | SwapProposal)[];
    proposalCount: number;
}

interface ExtendedBookingDetails extends BookingDetails {
    description?: string;
    type?: string;
    eventDate?: Date;
    currency?: string;
    estimatedValue?: number;
}

const formatDate = (date: Date | string): string => {
    try {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    } catch (error) {
        return 'Invalid date';
    }
};

const formatCurrency = (amount: any, currency: string = 'USD'): string => {
    // Use the validated financial data handler to prevent $NaN displays
    return FinancialDataHandler.formatCurrencyForContext(amount, currency, 'detail');
};

const validateAndSanitizeSwapData = (swapData: SwapCardData, enhancedDetails: EnhancedSwapDetails): ValidatedSwapData => {
    const { userSwap } = swapData;
    const bookingDetails = userSwap.bookingDetails as ExtendedBookingDetails;

    // Validate basic information
    const basicInfo = {
        title: enhancedDetails.title || bookingDetails.title || 'Untitled Swap',
        description: enhancedDetails.description || bookingDetails.description || '',
        status: userSwap.status || 'unknown',
        createdAt: userSwap.createdAt,
        expiresAt: userSwap.expiresAt
    };

    // Validate and format financial information
    const rawAmount = bookingDetails.estimatedValue || bookingDetails.swapValue;
    const currency = bookingDetails.currency || 'USD';
    const validatedAmount = FinancialDataHandler.validateAmount(rawAmount);

    const financialInfo = {
        estimatedValue: FinancialDataHandler.formatCurrencyForContext(rawAmount, currency, 'detail'),
        currency: currency,
        isValidPrice: validatedAmount !== null
    };

    // Validate proposals data
    const proposals = swapData.proposalsFromOthers || [];
    const proposalCount = swapData.proposalCount || 0;

    return {
        basicInfo,
        financialInfo,
        proposals,
        proposalCount
    };
};

export const SwapDetailsModal: React.FC<SwapDetailsModalProps> = ({
    isOpen,
    onClose,
    swapData,
    onProposalAction,
}) => {
    const { isMobile } = useResponsive();
    const { userSwap } = swapData;
    const bookingDetails = userSwap.bookingDetails as ExtendedBookingDetails;

    const [enhancedDetails, setEnhancedDetails] = useState<EnhancedSwapDetails>({});

    const [validatedData, setValidatedData] = useState<ValidatedSwapData | null>(null);
    const [detailedProposals, setDetailedProposals] = useState<(IncomingTargetInfo | SwapProposal)[]>([]);
    const [isLoadingProposals, setIsLoadingProposals] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch enhanced swap details when modal opens
    useEffect(() => {
        const fetchEnhancedDetails = async () => {
            if (!isOpen || !userSwap.id) return;


            setError(null);

            try {
                const fullSwap = await swapService.getSwap(userSwap.id);

                // Extract enhanced fields if available
                const enhanced = {
                    title: (fullSwap as any).title,
                    description: (fullSwap as any).description,
                    paymentTypes: (fullSwap as any).paymentTypes,
                    acceptanceStrategy: (fullSwap as any).acceptanceStrategy,
                    swapPreferences: (fullSwap as any).swapPreferences,
                    type: (fullSwap as any).type,
                    eventDate: (fullSwap as any).eventDate,
                };

                setEnhancedDetails(enhanced);

                // Validate and sanitize all data
                const validated = validateAndSanitizeSwapData(swapData, enhanced);
                setValidatedData(validated);

            } catch (error) {
                console.error('Failed to fetch enhanced swap details:', error);
                setError('Failed to load swap details. Some information may be incomplete.');

                // Still create validated data with available information
                const validated = validateAndSanitizeSwapData(swapData, {});
                setValidatedData(validated);
            } finally {
                // Enhanced details loading complete
            }
        };

        fetchEnhancedDetails();
    }, [isOpen, userSwap.id, swapData]);

    // Fetch detailed proposal information
    useEffect(() => {
        const fetchDetailedProposals = async () => {
            if (!isOpen || !userSwap.id || swapData.proposalCount === 0) return;

            setIsLoadingProposals(true);
            try {
                const proposals = await proposalService.getSwapProposals(userSwap.id);
                setDetailedProposals(proposals);
            } catch (error) {
                console.error('Failed to fetch detailed proposals:', error);
                // Use the basic proposal data from swapData as fallback
                setDetailedProposals(swapData.proposalsFromOthers || []);
            } finally {
                setIsLoadingProposals(false);
            }
        };

        fetchDetailedProposals();
    }, [isOpen, userSwap.id, swapData.proposalCount, swapData.proposalsFromOthers]);

    const handleProposalAction = (proposalId: string, action: 'accept' | 'reject') => {
        setSelectedProposalId(null);
        if (onProposalAction) {
            onProposalAction(proposalId, action);
        }
    };

    // Initialize validated data immediately if not set
    const currentValidatedData = validatedData || validateAndSanitizeSwapData(swapData, enhancedDetails);

    if (!isOpen) {
        return null;
    }

    // Get payment types from enhanced details or booking (if available)
    const paymentTypes = enhancedDetails.paymentTypes || (bookingDetails as any).paymentTypes;
    const acceptanceStrategy = enhancedDetails.acceptanceStrategy || (bookingDetails as any).acceptanceStrategy;
    const swapPreferences = enhancedDetails.swapPreferences || (bookingDetails as any).swapPreferences;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Swap Details"
                size="lg"
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing[6],
                        padding: isMobile ? tokens.spacing[4] : tokens.spacing[6],
                    }}
                >
                    {/* Error Display */}
                    {error && (
                        <div
                            style={{
                                padding: tokens.spacing[4],
                                backgroundColor: tokens.colors.warning[50],
                                borderRadius: tokens.borderRadius.md,
                                border: `1px solid ${tokens.colors.warning[200]}`,
                                color: tokens.colors.warning[700],
                            }}
                        >
                            <strong>⚠️ Warning:</strong> {error}
                        </div>
                    )}

                    {/* Basic Information */}
                    <section>
                        <h3
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                marginBottom: tokens.spacing[4],
                                paddingBottom: tokens.spacing[2],
                                borderBottom: `2px solid ${tokens.colors.primary[500]}`,
                            }}
                        >
                            Basic Information
                        </h3>

                        <div style={{ marginBottom: tokens.spacing[4] }}>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[700],
                                    marginBottom: tokens.spacing[2],
                                }}
                            >
                                Swap Title
                            </label>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.base,
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {currentValidatedData.basicInfo.title}
                            </div>
                        </div>

                        {currentValidatedData.basicInfo.description && (
                            <div style={{ marginBottom: tokens.spacing[4] }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: tokens.colors.neutral[700],
                                        marginBottom: tokens.spacing[2],
                                    }}
                                >
                                    Description
                                </label>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        color: tokens.colors.neutral[900],
                                        whiteSpace: 'pre-wrap',
                                    }}
                                >
                                    {currentValidatedData.basicInfo.description}
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: tokens.spacing[4] }}>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[700],
                                    marginBottom: tokens.spacing[2],
                                }}
                            >
                                Status
                            </label>
                            <div
                                style={{
                                    display: 'inline-block',
                                    padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                                    borderRadius: tokens.borderRadius.full,
                                    backgroundColor: `${tokens.colors.primary[100]}`,
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.primary[700],
                                    textTransform: 'capitalize',
                                }}
                            >
                                {currentValidatedData.basicInfo.status}
                            </div>
                        </div>

                        <div style={{ marginBottom: tokens.spacing[4] }}>
                            <label
                                style={{
                                    display: 'block',
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.medium,
                                    color: tokens.colors.neutral[700],
                                    marginBottom: tokens.spacing[2],
                                }}
                            >
                                Created On
                            </label>
                            <div
                                style={{
                                    fontSize: tokens.typography.fontSize.base,
                                    color: tokens.colors.neutral[900],
                                }}
                            >
                                {formatDate(currentValidatedData.basicInfo.createdAt)}
                            </div>
                        </div>

                        {currentValidatedData.basicInfo.expiresAt && (
                            <div style={{ marginBottom: tokens.spacing[4] }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: tokens.colors.neutral[700],
                                        marginBottom: tokens.spacing[2],
                                    }}
                                >
                                    Expires On
                                </label>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        color: tokens.colors.neutral[900],
                                    }}
                                >
                                    {formatDate(currentValidatedData.basicInfo.expiresAt)}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Booking Details */}
                    <section>
                        <h3
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                marginBottom: tokens.spacing[4],
                                paddingBottom: tokens.spacing[2],
                                borderBottom: `2px solid ${tokens.colors.primary[500]}`,
                            }}
                        >
                            Booking Details
                        </h3>

                        <Card variant="outlined" style={{ marginBottom: tokens.spacing[4] }}>
                            <CardContent>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: tokens.spacing[2],
                                        marginBottom: tokens.spacing[3],
                                    }}
                                >
                                    <span style={{ fontSize: '24px' }}>
                                        {bookingDetails.type === 'hotel' && '🏨'}
                                        {bookingDetails.type === 'event' && '🎫'}
                                        {bookingDetails.type === 'flight' && '✈️'}
                                        {bookingDetails.type === 'rental' && '🚗'}
                                        {!bookingDetails.type && '📋'}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: tokens.typography.fontSize.sm,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            color: tokens.colors.primary[600],
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        {bookingDetails.type || 'booking'}
                                    </span>
                                </div>

                                <h4
                                    style={{
                                        fontSize: tokens.typography.fontSize.lg,
                                        fontWeight: tokens.typography.fontWeight.semibold,
                                        color: tokens.colors.neutral[900],
                                        marginBottom: tokens.spacing[3],
                                    }}
                                >
                                    {bookingDetails.title}
                                </h4>

                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: tokens.spacing[2],
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: tokens.spacing[2],
                                            color: tokens.colors.neutral[600],
                                        }}
                                    >
                                        <span>📍</span>
                                        <span>
                                            {bookingDetails.location?.city || 'Unknown'}, {bookingDetails.location?.country || 'Unknown'}
                                        </span>
                                    </div>

                                    {bookingDetails.dateRange && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[2],
                                                color: tokens.colors.neutral[600],
                                            }}
                                        >
                                            <span>📅</span>
                                            <span>
                                                {formatDate(bookingDetails.dateRange.checkIn)} -{' '}
                                                {formatDate(bookingDetails.dateRange.checkOut)}
                                            </span>
                                        </div>
                                    )}

                                    {bookingDetails.eventDate && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[2],
                                                color: tokens.colors.neutral[600],
                                            }}
                                        >
                                            <span>📅</span>
                                            <span>{formatDate(bookingDetails.eventDate)}</span>
                                        </div>
                                    )}

                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: tokens.spacing[2],
                                            marginTop: tokens.spacing[2],
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: tokens.typography.fontSize.lg,
                                                fontWeight: tokens.typography.fontWeight.semibold,
                                                color: currentValidatedData.financialInfo.isValidPrice
                                                    ? tokens.colors.primary[600]
                                                    : tokens.colors.neutral[500],
                                            }}
                                        >
                                            {currentValidatedData.financialInfo.estimatedValue}
                                        </span>
                                        {!currentValidatedData.financialInfo.isValidPrice && (
                                            <span
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[500],
                                                    fontStyle: 'italic',
                                                }}
                                            >
                                                (Price validation failed)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    {/* Payment Types */}
                    {paymentTypes && (
                        <section>
                            <h3
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[900],
                                    marginBottom: tokens.spacing[4],
                                    paddingBottom: tokens.spacing[2],
                                    borderBottom: `2px solid ${tokens.colors.primary[500]}`,
                                }}
                            >
                                Payment Options
                            </h3>

                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: tokens.spacing[3],
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: tokens.spacing[2],
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: '20px',
                                        }}
                                    >
                                        {paymentTypes.bookingExchange ? '✅' : '❌'}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: tokens.typography.fontSize.base,
                                            color: tokens.colors.neutral[700],
                                        }}
                                    >
                                        Booking Exchange
                                    </span>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: tokens.spacing[2],
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: '20px',
                                        }}
                                    >
                                        {paymentTypes.cashPayment ? '✅' : '❌'}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: tokens.typography.fontSize.base,
                                            color: tokens.colors.neutral[700],
                                        }}
                                    >
                                        Cash Payment
                                    </span>
                                </div>

                                {paymentTypes.cashPayment && paymentTypes.minimumCashAmount && (
                                    <div
                                        style={{
                                            marginLeft: tokens.spacing[8],
                                            padding: tokens.spacing[3],
                                            backgroundColor: tokens.colors.neutral[50],
                                            borderRadius: tokens.borderRadius.md,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: tokens.typography.fontSize.sm,
                                                color: tokens.colors.neutral[700],
                                                marginBottom: tokens.spacing[1],
                                            }}
                                        >
                                            Minimum: {formatCurrency(paymentTypes.minimumCashAmount, currentValidatedData.financialInfo.currency)}
                                        </div>
                                        {paymentTypes.preferredCashAmount && (
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[700],
                                                }}
                                            >
                                                Preferred: {formatCurrency(paymentTypes.preferredCashAmount, currentValidatedData.financialInfo.currency)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Acceptance Strategy */}
                    {acceptanceStrategy && (
                        <section>
                            <h3
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[900],
                                    marginBottom: tokens.spacing[4],
                                    paddingBottom: tokens.spacing[2],
                                    borderBottom: `2px solid ${tokens.colors.primary[500]}`,
                                }}
                            >
                                Acceptance Strategy
                            </h3>

                            <div style={{ marginBottom: tokens.spacing[4] }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: tokens.typography.fontSize.sm,
                                        fontWeight: tokens.typography.fontWeight.medium,
                                        color: tokens.colors.neutral[700],
                                        marginBottom: tokens.spacing[2],
                                    }}
                                >
                                    Strategy Type
                                </label>
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        color: tokens.colors.neutral[900],
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {acceptanceStrategy.type === 'first_match' && '⚡ First Match'}
                                    {acceptanceStrategy.type === 'auction' && '🏛️ Auction'}
                                </div>
                            </div>

                            {acceptanceStrategy.type === 'auction' && acceptanceStrategy.auctionEndDate && (
                                <div style={{ marginBottom: tokens.spacing[4] }}>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: tokens.typography.fontSize.sm,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            color: tokens.colors.neutral[700],
                                            marginBottom: tokens.spacing[2],
                                        }}
                                    >
                                        Auction End Date
                                    </label>
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.base,
                                            color: tokens.colors.neutral[900],
                                        }}
                                    >
                                        {formatDate(acceptanceStrategy.auctionEndDate)}
                                    </div>
                                </div>
                            )}

                            {acceptanceStrategy.type === 'auction' && acceptanceStrategy.autoSelectHighest !== undefined && (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: tokens.spacing[2],
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: '20px',
                                        }}
                                    >
                                        {acceptanceStrategy.autoSelectHighest ? '✅' : '❌'}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: tokens.typography.fontSize.base,
                                            color: tokens.colors.neutral[700],
                                        }}
                                    >
                                        Auto-select highest bidder
                                    </span>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Swap Preferences */}
                    {swapPreferences && (
                        <section>
                            <h3
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[900],
                                    marginBottom: tokens.spacing[4],
                                    paddingBottom: tokens.spacing[2],
                                    borderBottom: `2px solid ${tokens.colors.primary[500]}`,
                                }}
                            >
                                Swap Preferences
                            </h3>

                            {swapPreferences.preferredLocations &&
                                swapPreferences.preferredLocations.length > 0 && (
                                    <div style={{ marginBottom: tokens.spacing[4] }}>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: tokens.typography.fontSize.sm,
                                                fontWeight: tokens.typography.fontWeight.medium,
                                                color: tokens.colors.neutral[700],
                                                marginBottom: tokens.spacing[2],
                                            }}
                                        >
                                            Preferred Locations
                                        </label>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: tokens.spacing[2],
                                            }}
                                        >
                                            {swapPreferences.preferredLocations.map((location: string, index: number) => (
                                                <span
                                                    key={index}
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                                                        backgroundColor: tokens.colors.primary[50],
                                                        color: tokens.colors.primary[700],
                                                        borderRadius: tokens.borderRadius.full,
                                                        fontSize: tokens.typography.fontSize.sm,
                                                    }}
                                                >
                                                    📍 {location}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {swapPreferences.preferredDates &&
                                swapPreferences.preferredDates.length > 0 && (
                                    <div style={{ marginBottom: tokens.spacing[4] }}>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: tokens.typography.fontSize.sm,
                                                fontWeight: tokens.typography.fontWeight.medium,
                                                color: tokens.colors.neutral[700],
                                                marginBottom: tokens.spacing[2],
                                            }}
                                        >
                                            Preferred Dates
                                        </label>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: tokens.spacing[2],
                                            }}
                                        >
                                            {swapPreferences.preferredDates.map((date: Date, index: number) => (
                                                <span
                                                    key={index}
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                                                        backgroundColor: tokens.colors.primary[50],
                                                        color: tokens.colors.primary[700],
                                                        borderRadius: tokens.borderRadius.full,
                                                        fontSize: tokens.typography.fontSize.sm,
                                                    }}
                                                >
                                                    📅 {formatDate(date)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {swapPreferences.additionalRequirements &&
                                swapPreferences.additionalRequirements.length > 0 && (
                                    <div style={{ marginBottom: tokens.spacing[4] }}>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontSize: tokens.typography.fontSize.sm,
                                                fontWeight: tokens.typography.fontWeight.medium,
                                                color: tokens.colors.neutral[700],
                                                marginBottom: tokens.spacing[2],
                                            }}
                                        >
                                            Additional Requirements
                                        </label>
                                        <ul
                                            style={{
                                                margin: 0,
                                                paddingLeft: tokens.spacing[6],
                                                listStyleType: 'disc',
                                            }}
                                        >
                                            {swapPreferences.additionalRequirements.map((req: string, index: number) => (
                                                <li
                                                    key={index}
                                                    style={{
                                                        fontSize: tokens.typography.fontSize.base,
                                                        color: tokens.colors.neutral[700],
                                                        marginBottom: tokens.spacing[1],
                                                    }}
                                                >
                                                    {req}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                        </section>
                    )}

                    {/* Complete Proposal Information Display */}
                    {currentValidatedData.proposalCount > 0 && (
                        <section>
                            <h3
                                style={{
                                    fontSize: tokens.typography.fontSize.lg,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[900],
                                    marginBottom: tokens.spacing[4],
                                    paddingBottom: tokens.spacing[2],
                                    borderBottom: `2px solid ${tokens.colors.primary[500]}`,
                                }}
                            >
                                Proposals Received ({currentValidatedData.proposalCount})
                            </h3>

                            {isLoadingProposals ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: tokens.spacing[6],
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    <div style={{ fontSize: '24px', marginBottom: tokens.spacing[2] }}>⏳</div>
                                    Loading proposal details...
                                </div>
                            ) : detailedProposals.length > 0 ? (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: tokens.spacing[4],
                                    }}
                                >
                                    {detailedProposals.map((proposal, index) => {
                                        // Handle both IncomingTargetInfo and SwapProposal types
                                        const isIncomingTarget = 'sourceSwap' in proposal;
                                        const proposalData = isIncomingTarget
                                            ? {
                                                id: (proposal as IncomingTargetInfo).sourceSwap.id,
                                                ownerName: (proposal as IncomingTargetInfo).sourceSwap.ownerName,
                                                bookingTitle: (proposal as IncomingTargetInfo).sourceSwap.bookingDetails.title,
                                                swapValue: (proposal as IncomingTargetInfo).sourceSwap.bookingDetails.swapValue,
                                                location: (proposal as IncomingTargetInfo).sourceSwap.bookingDetails.location,
                                                createdAt: proposal.createdAt,
                                                currency: ((proposal as IncomingTargetInfo).sourceSwap.bookingDetails as ExtendedBookingDetails).currency
                                            }
                                            : {
                                                id: proposal.id,
                                                ownerName: (proposal as SwapProposal).proposerName,
                                                bookingTitle: (proposal as SwapProposal).targetBookingDetails.title,
                                                swapValue: (proposal as SwapProposal).targetBookingDetails.swapValue,
                                                location: (proposal as SwapProposal).targetBookingDetails.location,
                                                createdAt: proposal.createdAt,
                                                currency: ((proposal as SwapProposal).targetBookingDetails as ExtendedBookingDetails).currency
                                            };

                                        return (
                                            <Card key={proposalData.id || index} variant="outlined">
                                                <CardContent>
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'flex-start',
                                                            marginBottom: tokens.spacing[3],
                                                        }}
                                                    >
                                                        <div>
                                                            <h4
                                                                style={{
                                                                    fontSize: tokens.typography.fontSize.base,
                                                                    fontWeight: tokens.typography.fontWeight.semibold,
                                                                    color: tokens.colors.neutral[900],
                                                                    margin: 0,
                                                                    marginBottom: tokens.spacing[1],
                                                                }}
                                                            >
                                                                {proposalData.ownerName || 'Unknown User'}
                                                            </h4>
                                                            <div
                                                                style={{
                                                                    fontSize: tokens.typography.fontSize.sm,
                                                                    color: tokens.colors.neutral[600],
                                                                }}
                                                            >
                                                                {proposalData.bookingTitle || 'Untitled Booking'}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: tokens.typography.fontSize.sm,
                                                                    color: tokens.colors.neutral[600],
                                                                    marginTop: tokens.spacing[1],
                                                                }}
                                                            >
                                                                Value: {FinancialDataHandler.formatCurrencyForContext(
                                                                    proposalData.swapValue,
                                                                    proposalData.currency || 'USD',
                                                                    'detail'
                                                                )}
                                                            </div>
                                                        </div>

                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setSelectedProposalId(proposalData.id)}
                                                            style={{
                                                                fontSize: tokens.typography.fontSize.sm,
                                                            }}
                                                        >
                                                            View Details
                                                        </Button>
                                                    </div>

                                                    <div
                                                        style={{
                                                            fontSize: tokens.typography.fontSize.sm,
                                                            color: tokens.colors.neutral[600],
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: tokens.spacing[2],
                                                        }}
                                                    >
                                                        <span>📍</span>
                                                        <span>
                                                            {proposalData.location?.city || 'Unknown'},{' '}
                                                            {proposalData.location?.country || 'Unknown'}
                                                        </span>
                                                    </div>

                                                    <div
                                                        style={{
                                                            fontSize: tokens.typography.fontSize.sm,
                                                            color: tokens.colors.neutral[500],
                                                            marginTop: tokens.spacing[2],
                                                        }}
                                                    >
                                                        Proposed on {formatDate(proposalData.createdAt)}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: tokens.spacing[6],
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    <div style={{ fontSize: '32px', marginBottom: tokens.spacing[2] }}>📭</div>
                                    No detailed proposal information available
                                </div>
                            )}
                        </section>
                    )}

                    {/* Actions */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: tokens.spacing[3],
                            paddingTop: tokens.spacing[4],
                            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
                        }}
                    >
                        <Button
                            variant="outline"
                            onClick={onClose}
                            style={{ minWidth: '120px' }}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Proposal Details Modal */}
            {selectedProposalId && (
                <ProposalDetailsModal
                    proposalId={selectedProposalId}
                    isOpen={!!selectedProposalId}
                    onClose={() => setSelectedProposalId(null)}
                    onAccept={(proposalId) => handleProposalAction(proposalId, 'accept')}
                    onReject={(proposalId) => handleProposalAction(proposalId, 'reject')}
                />
            )}
        </>
    );
};