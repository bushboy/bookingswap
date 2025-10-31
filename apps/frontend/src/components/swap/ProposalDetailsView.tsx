import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { useId, useAnnouncements, useHighContrast } from '../../hooks/useAccessibility';
import { IncomingTargetInfo, BookingType } from '@booking-swap/shared';
import { FinancialDataHandler } from '../../utils/financialDataHandler';
import { proposalService, ProposalDetailsResponse } from '../../services/proposalService';
import { ProposalActionButtons } from './ProposalActionButtons';
import { ProposalStatusIndicator } from './ProposalStatusIndicator';
import { getButtonAria, getHighContrastStyles } from '../../utils/accessibility';

// Extended booking details interface for proposal display
interface ExtendedBookingDetails {
    id: string;
    title: string;
    description?: string;
    type?: BookingType;
    location: {
        city: string;
        country: string;
    };
    dateRange: {
        checkIn: Date;
        checkOut: Date;
    };
    originalPrice: number | null;
    swapValue: number | null;
    currency?: string;
    capacity?: number;
    amenities?: string[];
    formattedPrice?: string;
}

interface BlockchainTransaction {
    id: string;
    type: 'proposal_created' | 'proposal_accepted' | 'proposal_rejected' | 'payment_processed';
    transactionHash: string;
    timestamp: Date;
    status: 'pending' | 'confirmed' | 'failed';
    details?: Record<string, any>;
}

interface TransactionHistoryItem {
    id: string;
    type: 'proposal' | 'payment' | 'blockchain' | 'notification';
    action: string;
    timestamp: Date;
    status: 'success' | 'pending' | 'failed';
    description: string;
    metadata?: Record<string, any>;
}

interface ProposalDetailsViewProps {
    proposalId: string;
    onAccept?: (proposalId: string) => void;
    onReject?: (proposalId: string) => void;
    onClose?: () => void;
    showActions?: boolean;
}

const getBookingTypeIcon = (type: BookingType): string => {
    switch (type) {
        case 'hotel': return '🏨';
        case 'vacation_rental': return '🏠';
        case 'resort': return '🏖️';
        case 'hostel': return '🏠';
        case 'bnb': return '🏡';
        case 'event': return '🎫';
        case 'concert': return '🎵';
        case 'sports': return '⚽';
        case 'theater': return '🎭';
        case 'flight': return '✈️';
        case 'rental': return '🚗';
        default: return '📋';
    }
};

const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatDateTime = (date: Date): string => {
    return new Date(date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatBookingDates = (booking: any): string => {
    if (!booking) return 'Unknown dates';

    const bookingType = booking.type;

    switch (bookingType) {
        case 'event':
        case 'concert':
        case 'sports':
        case 'theater':
            if (booking.eventDate) {
                return formatDate(booking.eventDate);
            } else if (booking.startDate && booking.endDate) {
                return `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)}`;
            } else if (booking.startDate) {
                return formatDate(booking.startDate);
            } else if (booking.dateRange?.checkIn) {
                return formatDate(booking.dateRange.checkIn);
            }
            return 'Event date TBD';

        case 'hotel':
        case 'vacation_rental':
        case 'resort':
        case 'hostel':
        case 'bnb':
        default:
            if (booking.dateRange?.checkIn && booking.dateRange?.checkOut) {
                return `${formatDate(booking.dateRange.checkIn)} - ${formatDate(booking.dateRange.checkOut)}`;
            } else if (booking.checkInDate && booking.checkOutDate) {
                return `${formatDate(booking.checkInDate)} - ${formatDate(booking.checkOutDate)}`;
            }
            return 'Dates TBD';
    }
};

// Mock data generators for blockchain and transaction history
const generateMockBlockchainTransactions = (proposalId: string): BlockchainTransaction[] => {
    return [
        {
            id: `${proposalId}_blockchain_1`,
            type: 'proposal_created',
            transactionHash: '0x1234567890abcdef1234567890abcdef12345678',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
            status: 'confirmed',
            details: { proposalId, action: 'created' }
        }
    ];
};

const generateMockTransactionHistory = (proposalId: string): TransactionHistoryItem[] => {
    return [
        {
            id: `${proposalId}_history_1`,
            type: 'proposal',
            action: 'Proposal Created',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
            status: 'success',
            description: 'Proposal submitted and recorded on blockchain',
            metadata: { proposalId }
        },
        {
            id: `${proposalId}_history_2`,
            type: 'notification',
            action: 'Notification Sent',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
            status: 'success',
            description: 'Proposal notification sent to recipient',
            metadata: { channel: 'email' }
        }
    ];
};

export const ProposalDetailsView: React.FC<ProposalDetailsViewProps> = ({
    proposalId,
    onAccept,
    onReject,
    onClose,
    showActions = true,
}) => {
    const { isMobile } = useResponsive();
    const { announce } = useAnnouncements();
    const { isHighContrast } = useHighContrast();
    const viewId = useId('proposal-details-view');
    const titleId = useId('proposal-details-title');

    const [proposalDetails, setProposalDetails] = useState<ProposalDetailsResponse | null>(null);
    const [blockchainTransactions, setBlockchainTransactions] = useState<BlockchainTransaction[]>([]);
    const [transactionHistory, setTransactionHistory] = useState<TransactionHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'blockchain'>('details');
    const [isExporting, setIsExporting] = useState(false);

    // Load proposal details when component mounts
    useEffect(() => {
        if (proposalId) {
            loadProposalDetails();
        }
    }, [proposalId]);

    const loadProposalDetails = async () => {
        setLoading(true);
        setError(null);

        try {
            const details = await proposalService.getProposalDetails(proposalId);
            setProposalDetails(details);

            // Load mock blockchain and transaction data
            setBlockchainTransactions(generateMockBlockchainTransactions(proposalId));
            setTransactionHistory(generateMockTransactionHistory(proposalId));
        } catch (err: any) {
            setError(err.message || 'Failed to load proposal details');
            console.error('Failed to load proposal details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!proposalDetails) return;

        try {
            const result = await proposalService.acceptProposal({
                proposalId,
                targetId: proposalDetails.proposal.targetId,
                swapId: proposalDetails.proposal.sourceSwap.id
            });

            if (result.success) {
                announce(`Proposal from ${proposalDetails.proposal.sourceSwap.ownerName} accepted`, 'polite');

                // Add new transaction history entry
                const newHistoryItem: TransactionHistoryItem = {
                    id: `${proposalId}_accepted_${Date.now()}`,
                    type: 'proposal',
                    action: 'Proposal Accepted',
                    timestamp: new Date(),
                    status: 'success',
                    description: 'Proposal accepted successfully',
                    metadata: { action: 'accept' }
                };
                setTransactionHistory(prev => [newHistoryItem, ...prev]);

                // Add blockchain transaction
                const newBlockchainTx: BlockchainTransaction = {
                    id: `${proposalId}_blockchain_accept_${Date.now()}`,
                    type: 'proposal_accepted',
                    transactionHash: '0xabcdef1234567890abcdef1234567890abcdef12',
                    timestamp: new Date(),
                    status: 'pending',
                    details: { proposalId, action: 'accepted' }
                };
                setBlockchainTransactions(prev => [newBlockchainTx, ...prev]);

                onAccept?.(proposalId);

                // Reload details to get updated status
                await loadProposalDetails();
            } else {
                throw new Error(result.error || 'Failed to accept proposal');
            }
        } catch (error: any) {
            console.error('Error accepting proposal:', error);
            announce('Failed to accept proposal', 'assertive');
            setError(error.message || 'Failed to accept proposal');
        }
    };

    const handleReject = async () => {
        if (!proposalDetails) return;

        try {
            const result = await proposalService.rejectProposal({
                proposalId,
                targetId: proposalDetails.proposal.targetId,
                swapId: proposalDetails.proposal.sourceSwap.id,
                reason: 'Proposal rejected by user'
            });

            if (result.success) {
                announce(`Proposal from ${proposalDetails.proposal.sourceSwap.ownerName} rejected`, 'polite');

                // Add new transaction history entry
                const newHistoryItem: TransactionHistoryItem = {
                    id: `${proposalId}_rejected_${Date.now()}`,
                    type: 'proposal',
                    action: 'Proposal Rejected',
                    timestamp: new Date(),
                    status: 'success',
                    description: 'Proposal rejected by user',
                    metadata: { action: 'reject' }
                };
                setTransactionHistory(prev => [newHistoryItem, ...prev]);

                // Add blockchain transaction
                const newBlockchainTx: BlockchainTransaction = {
                    id: `${proposalId}_blockchain_reject_${Date.now()}`,
                    type: 'proposal_rejected',
                    transactionHash: '0xfedcba0987654321fedcba0987654321fedcba09',
                    timestamp: new Date(),
                    status: 'pending',
                    details: { proposalId, action: 'rejected' }
                };
                setBlockchainTransactions(prev => [newBlockchainTx, ...prev]);

                onReject?.(proposalId);

                // Reload details to get updated status
                await loadProposalDetails();
            } else {
                throw new Error(result.error || 'Failed to reject proposal');
            }
        } catch (error: any) {
            console.error('Error rejecting proposal:', error);
            announce('Failed to reject proposal', 'assertive');
            setError(error.message || 'Failed to reject proposal');
        }
    };

    const exportProposalData = async () => {
        if (!proposalDetails) return;

        setIsExporting(true);
        try {
            const exportData = {
                proposal: {
                    id: proposalId,
                    proposer: proposalDetails.proposal.sourceSwap.ownerName,
                    status: proposalDetails.proposal.status,
                    createdAt: proposalDetails.proposal.createdAt,
                    updatedAt: proposalDetails.proposal.updatedAt,
                    bookingDetails: proposalDetails.proposal.sourceSwap.bookingDetails
                },
                transactionHistory,
                blockchainTransactions,
                exportedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `proposal-${proposalId}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            announce('Proposal data exported successfully', 'polite');
        } catch (error: any) {
            console.error('Error exporting proposal data:', error);
            announce('Failed to export proposal data', 'assertive');
            setError('Failed to export proposal data');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: tokens.spacing[8],
                    minHeight: '400px',
                }}
            >
                <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>⏳</div>
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        color: tokens.colors.neutral[600],
                    }}
                >
                    Loading proposal details...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card
                variant="outlined"
                style={{
                    ...(isHighContrast ? getHighContrastStyles() : {}),
                }}
            >
                <CardContent
                    style={{
                        padding: tokens.spacing[6],
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            fontSize: '48px',
                            marginBottom: tokens.spacing[4],
                            color: tokens.colors.error[500],
                        }}
                    >
                        ❌
                    </div>
                    <h3
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.error[700],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        Error Loading Proposal
                    </h3>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[600],
                            margin: `0 0 ${tokens.spacing[4]} 0`,
                        }}
                    >
                        {error}
                    </p>
                    <Button
                        variant="outline"
                        onClick={loadProposalDetails}
                        {...getButtonAria('Retry loading proposal details')}
                    >
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!proposalDetails) {
        return null;
    }

    const canTakeAction = proposalDetails.proposal.status === 'active' && showActions;

    return (
        <div
            id={viewId}
            style={{
                width: '100%',
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[6],
            }}
        >
            {/* Header */}
            <Card
                variant="outlined"
                style={{
                    ...(isHighContrast ? getHighContrastStyles() : {}),
                }}
            >
                <CardHeader
                    style={{
                        padding: tokens.spacing[6],
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'flex-start' : 'center',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: tokens.spacing[4],
                        }}
                    >
                        <div>
                            <h1
                                id={titleId}
                                style={{
                                    fontSize: tokens.typography.fontSize['2xl'],
                                    fontWeight: tokens.typography.fontWeight.bold,
                                    color: tokens.colors.neutral[900],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}
                            >
                                Proposal Details
                            </h1>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: tokens.spacing[3],
                                    flexWrap: 'wrap',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[600],
                                    }}
                                >
                                    ID: {proposalId}
                                </div>
                                <ProposalStatusIndicator
                                    status={proposalDetails.proposal.status}
                                    size="sm"
                                />
                            </div>
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                gap: tokens.spacing[3],
                                alignItems: 'center',
                                flexWrap: 'wrap',
                            }}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={exportProposalData}
                                disabled={isExporting}
                                {...getButtonAria('Export proposal data')}
                            >
                                {isExporting ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                        <span>⏳</span>
                                        Exporting...
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                        <span>📥</span>
                                        Export
                                    </div>
                                )}
                            </Button>

                            {onClose && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    {...getButtonAria('Close proposal details')}
                                >
                                    ✕
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Tab Navigation */}
            <Card
                variant="outlined"
                style={{
                    ...(isHighContrast ? getHighContrastStyles() : {}),
                }}
            >
                <CardHeader
                    style={{
                        padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`,
                        borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            gap: tokens.spacing[1],
                            overflowX: 'auto',
                        }}
                        role="tablist"
                    >
                        {[
                            { key: 'details', label: 'Proposal Details', icon: '📋' },
                            { key: 'history', label: 'Transaction History', icon: '📜' },
                            { key: 'blockchain', label: 'Blockchain Records', icon: '🔗' },
                        ].map((tab) => (
                            <Button
                                key={tab.key}
                                variant={activeTab === tab.key ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => setActiveTab(tab.key as any)}
                                role="tab"
                                aria-selected={activeTab === tab.key}
                                {...getButtonAria(`View ${tab.label}`)}
                                style={{
                                    minWidth: 'fit-content',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                                    <span>{tab.icon}</span>
                                    {tab.label}
                                </div>
                            </Button>
                        ))}
                    </div>
                </CardHeader>

                <CardContent
                    style={{
                        padding: tokens.spacing[6],
                    }}
                    role="tabpanel"
                >
                    {activeTab === 'details' && (
                        <ProposalDetailsTab
                            proposalDetails={proposalDetails}
                            isMobile={isMobile}
                        />
                    )}

                    {activeTab === 'history' && (
                        <TransactionHistoryTab
                            transactionHistory={transactionHistory}
                            isMobile={isMobile}
                        />
                    )}

                    {activeTab === 'blockchain' && (
                        <BlockchainRecordsTab
                            blockchainTransactions={blockchainTransactions}
                            isMobile={isMobile}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Action Buttons */}
            {canTakeAction && (
                <Card
                    variant="outlined"
                    style={{
                        ...(isHighContrast ? getHighContrastStyles() : {}),
                        border: `2px solid ${tokens.colors.primary[200]}`,
                        backgroundColor: tokens.colors.primary[50],
                    }}
                >
                    <CardContent
                        style={{
                            padding: tokens.spacing[6],
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: tokens.spacing[4],
                            }}
                        >
                            <div>
                                <h3
                                    style={{
                                        fontSize: tokens.typography.fontSize.lg,
                                        fontWeight: tokens.typography.fontWeight.semibold,
                                        color: tokens.colors.neutral[900],
                                        margin: `0 0 ${tokens.spacing[2]} 0`,
                                    }}
                                >
                                    Ready to make a decision?
                                </h3>
                                <p
                                    style={{
                                        fontSize: tokens.typography.fontSize.base,
                                        color: tokens.colors.neutral[700],
                                        margin: 0,
                                    }}
                                >
                                    Review all the details above and choose your action. This decision will be recorded on the blockchain.
                                </p>
                            </div>

                            <ProposalActionButtons
                                proposalId={proposalId}
                                onAccept={handleAccept}
                                onReject={handleReject}
                                canAccept={proposalDetails.canAccept}
                                canReject={proposalDetails.canReject}
                                size="lg"
                                showLabels={true}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// Sub-components for different tabs
const ProposalDetailsTab: React.FC<{
    proposalDetails: ProposalDetailsResponse;
    isMobile: boolean;
}> = ({ proposalDetails, isMobile }) => {
    const proposal = proposalDetails.proposal;
    const bookingDetails = proposal.sourceSwap.bookingDetails as ExtendedBookingDetails;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[6],
            }}
        >
            {/* Proposer Information */}
            <div>
                <h3
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: `0 0 ${tokens.spacing[4]} 0`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span>👤</span>
                    Proposer Information
                </h3>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[4],
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.lg,
                    }}
                >
                    <div
                        style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: tokens.colors.primary[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.primary[700],
                            border: `3px solid ${tokens.colors.primary[200]}`,
                        }}
                    >
                        {proposal.sourceSwap.ownerAvatar ? (
                            <img
                                src={proposal.sourceSwap.ownerAvatar}
                                alt={`${proposal.sourceSwap.ownerName}'s avatar`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                }}
                            />
                        ) : (
                            proposal.sourceSwap.ownerName.charAt(0).toUpperCase()
                        )}
                    </div>

                    <div>
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.xl,
                                fontWeight: tokens.typography.fontWeight.bold,
                                color: tokens.colors.neutral[900],
                                margin: 0,
                                marginBottom: tokens.spacing[1],
                            }}
                        >
                            {proposal.sourceSwap.ownerName}
                        </h4>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                color: tokens.colors.neutral[600],
                            }}
                        >
                            Proposed on {formatDate(proposal.createdAt)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Details */}
            <div>
                <h3
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: `0 0 ${tokens.spacing[4]} 0`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span>{getBookingTypeIcon(bookingDetails.type || 'hotel')}</span>
                    Proposed Booking
                </h3>

                <div
                    style={{
                        padding: tokens.spacing[5],
                        backgroundColor: 'white',
                        border: `2px solid ${tokens.colors.neutral[200]}`,
                        borderRadius: tokens.borderRadius.lg,
                    }}
                >
                    <h4
                        style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.bold,
                            color: tokens.colors.neutral[900],
                            margin: `0 0 ${tokens.spacing[3]} 0`,
                        }}
                    >
                        {bookingDetails.title || 'Untitled Booking'}
                    </h4>

                    {bookingDetails.description && (
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                color: tokens.colors.neutral[700],
                                lineHeight: tokens.typography.lineHeight.relaxed,
                                margin: `0 0 ${tokens.spacing[4]} 0`,
                            }}
                        >
                            {bookingDetails.description}
                        </p>
                    )}

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                            gap: tokens.spacing[4],
                            marginBottom: tokens.spacing[4],
                        }}
                    >
                        <div>
                            <h5
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}
                            >
                                Location & Dates
                            </h5>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: tokens.spacing[2],
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <span>📍</span>
                                    <span>
                                        {bookingDetails.location?.city || 'Unknown'},{' '}
                                        {bookingDetails.location?.country || 'Unknown'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <span>📅</span>
                                    <span>{formatBookingDates(bookingDetails)}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h5
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}
                            >
                                Value & Details
                            </h5>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: tokens.spacing[2],
                                    fontSize: tokens.typography.fontSize.sm,
                                    color: tokens.colors.neutral[600],
                                }}
                            >
                                <div>
                                    <strong>Value:</strong> {FinancialDataHandler.formatCurrencyForContext(
                                        bookingDetails.swapValue,
                                        bookingDetails.currency,
                                        'detail'
                                    )}
                                </div>
                                {bookingDetails.capacity && (
                                    <div>
                                        <strong>Capacity:</strong> {bookingDetails.capacity} guests
                                    </div>
                                )}
                                <div>
                                    <strong>Type:</strong> {bookingDetails.type || 'Unknown'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {bookingDetails.amenities && bookingDetails.amenities.length > 0 && (
                        <div>
                            <h5
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.neutral[800],
                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                }}
                            >
                                Amenities
                            </h5>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: tokens.spacing[2],
                                }}
                            >
                                {bookingDetails.amenities.map((amenity, index) => (
                                    <span
                                        key={index}
                                        style={{
                                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                            backgroundColor: tokens.colors.primary[100],
                                            color: tokens.colors.primary[700],
                                            borderRadius: tokens.borderRadius.full,
                                            fontSize: tokens.typography.fontSize.xs,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                        }}
                                    >
                                        {amenity}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Proposal Terms */}
            <div>
                <h3
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: `0 0 ${tokens.spacing[4]} 0`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span>📋</span>
                    Proposal Terms
                </h3>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                        gap: tokens.spacing[4],
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.lg,
                    }}
                >
                    <div>
                        <h5
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[800],
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                            }}
                        >
                            Proposal Status
                        </h5>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                            }}
                        >
                            <div><strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{proposal.status}</span></div>
                            <div><strong>Created:</strong> {formatDateTime(proposal.createdAt)}</div>
                            <div><strong>Updated:</strong> {formatDateTime(proposal.updatedAt)}</div>
                        </div>
                    </div>

                    <div>
                        <h5
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[800],
                                margin: `0 0 ${tokens.spacing[2]} 0`,
                            }}
                        >
                            Exchange Details
                        </h5>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[600],
                            }}
                        >
                            <div><strong>Type:</strong> Direct booking swap</div>
                            <div><strong>Value:</strong> {FinancialDataHandler.formatCurrencyForContext(
                                bookingDetails.swapValue,
                                bookingDetails.currency,
                                'summary'
                            )}</div>
                            <div><strong>Duration:</strong> {formatBookingDates(bookingDetails)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Restrictions */}
            {proposalDetails.restrictions && proposalDetails.restrictions.length > 0 && (
                <div
                    style={{
                        padding: tokens.spacing[4],
                        backgroundColor: tokens.colors.warning[50],
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${tokens.colors.warning[200]}`,
                    }}
                >
                    <h5
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.warning[800],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}
                    >
                        <span>⚠️</span>
                        Action Restrictions
                    </h5>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: tokens.spacing[4],
                            color: tokens.colors.warning[700],
                            fontSize: tokens.typography.fontSize.sm,
                        }}
                    >
                        {proposalDetails.restrictions.map((restriction, index) => (
                            <li key={index}>{restriction}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const TransactionHistoryTab: React.FC<{
    transactionHistory: TransactionHistoryItem[];
    isMobile: boolean;
}> = ({ transactionHistory, isMobile }) => {
    const getStatusIcon = (status: string): string => {
        switch (status) {
            case 'success': return '✅';
            case 'pending': return '⏳';
            case 'failed': return '❌';
            default: return '❓';
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'success': return tokens.colors.success[500];
            case 'pending': return tokens.colors.warning[500];
            case 'failed': return tokens.colors.error[500];
            default: return tokens.colors.neutral[500];
        }
    };

    const getTypeIcon = (type: string): string => {
        switch (type) {
            case 'proposal': return '📋';
            case 'payment': return '💳';
            case 'blockchain': return '🔗';
            case 'notification': return '📧';
            default: return '📄';
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[4],
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: tokens.spacing[2],
                }}
            >
                <h3
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span>📜</span>
                    Transaction History
                </h3>
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                    }}
                >
                    {transactionHistory.length} events
                </div>
            </div>

            {transactionHistory.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: tokens.spacing[8],
                        color: tokens.colors.neutral[600],
                    }}
                >
                    <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>📜</div>
                    No transaction history available
                </div>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing[3],
                    }}
                >
                    {transactionHistory.map((item, index) => (
                        <div
                            key={item.id}
                            style={{
                                padding: tokens.spacing[4],
                                backgroundColor: 'white',
                                border: `1px solid ${tokens.colors.neutral[200]}`,
                                borderRadius: tokens.borderRadius.lg,
                                position: 'relative',
                            }}
                        >
                            {/* Timeline connector */}
                            {index < transactionHistory.length - 1 && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: '24px',
                                        top: '60px',
                                        bottom: '-12px',
                                        width: '2px',
                                        backgroundColor: tokens.colors.neutral[200],
                                    }}
                                />
                            )}

                            <div
                                style={{
                                    display: 'flex',
                                    gap: tokens.spacing[3],
                                    alignItems: 'flex-start',
                                }}
                            >
                                <div
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        backgroundColor: `${getStatusColor(item.status)}20`,
                                        border: `2px solid ${getStatusColor(item.status)}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        flexShrink: 0,
                                        position: 'relative',
                                        zIndex: 1,
                                    }}
                                >
                                    {getTypeIcon(item.type)}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: tokens.spacing[2],
                                            flexDirection: isMobile ? 'column' : 'row',
                                            gap: tokens.spacing[2],
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
                                                {item.action}
                                            </h4>
                                            <p
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[600],
                                                    margin: 0,
                                                    lineHeight: tokens.typography.lineHeight.relaxed,
                                                }}
                                            >
                                                {item.description}
                                            </p>
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[2],
                                                flexShrink: 0,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: tokens.spacing[1],
                                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                                    borderRadius: tokens.borderRadius.full,
                                                    backgroundColor: `${getStatusColor(item.status)}20`,
                                                    border: `1px solid ${getStatusColor(item.status)}`,
                                                }}
                                            >
                                                <span style={{ fontSize: '12px' }}>{getStatusIcon(item.status)}</span>
                                                <span
                                                    style={{
                                                        fontSize: tokens.typography.fontSize.xs,
                                                        fontWeight: tokens.typography.fontWeight.medium,
                                                        color: getStatusColor(item.status),
                                                        textTransform: 'capitalize',
                                                    }}
                                                >
                                                    {item.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.xs,
                                            color: tokens.colors.neutral[500],
                                        }}
                                    >
                                        {formatDateTime(item.timestamp)}
                                    </div>

                                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                                        <div
                                            style={{
                                                marginTop: tokens.spacing[2],
                                                padding: tokens.spacing[2],
                                                backgroundColor: tokens.colors.neutral[50],
                                                borderRadius: tokens.borderRadius.sm,
                                                fontSize: tokens.typography.fontSize.xs,
                                                color: tokens.colors.neutral[600],
                                            }}
                                        >
                                            <strong>Details:</strong> {JSON.stringify(item.metadata, null, 2)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const BlockchainRecordsTab: React.FC<{
    blockchainTransactions: BlockchainTransaction[];
    isMobile: boolean;
}> = ({ blockchainTransactions, isMobile }) => {
    const getStatusIcon = (status: string): string => {
        switch (status) {
            case 'confirmed': return '✅';
            case 'pending': return '⏳';
            case 'failed': return '❌';
            default: return '❓';
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'confirmed': return tokens.colors.success[500];
            case 'pending': return tokens.colors.warning[500];
            case 'failed': return tokens.colors.error[500];
            default: return tokens.colors.neutral[500];
        }
    };

    const getTypeIcon = (type: string): string => {
        switch (type) {
            case 'proposal_created': return '📝';
            case 'proposal_accepted': return '✅';
            case 'proposal_rejected': return '❌';
            case 'payment_processed': return '💳';
            default: return '🔗';
        }
    };

    const truncateHash = (hash: string): string => {
        if (hash.length <= 16) return hash;
        return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: tokens.spacing[4],
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: tokens.spacing[2],
                }}
            >
                <h3
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[2],
                    }}
                >
                    <span>🔗</span>
                    Blockchain Records
                </h3>
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.neutral[600],
                    }}
                >
                    {blockchainTransactions.length} transactions
                </div>
            </div>

            {blockchainTransactions.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: tokens.spacing[8],
                        color: tokens.colors.neutral[600],
                    }}
                >
                    <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>🔗</div>
                    No blockchain transactions recorded
                </div>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: tokens.spacing[3],
                    }}
                >
                    {blockchainTransactions.map((transaction, index) => (
                        <div
                            key={transaction.id}
                            style={{
                                padding: tokens.spacing[4],
                                backgroundColor: 'white',
                                border: `1px solid ${tokens.colors.neutral[200]}`,
                                borderRadius: tokens.borderRadius.lg,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    gap: tokens.spacing[3],
                                    alignItems: 'flex-start',
                                }}
                            >
                                <div
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        backgroundColor: `${getStatusColor(transaction.status)}20`,
                                        border: `2px solid ${getStatusColor(transaction.status)}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        flexShrink: 0,
                                    }}
                                >
                                    {getTypeIcon(transaction.type)}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: tokens.spacing[3],
                                            flexDirection: isMobile ? 'column' : 'row',
                                            gap: tokens.spacing[2],
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
                                                    textTransform: 'capitalize',
                                                }}
                                            >
                                                {transaction.type.replace(/_/g, ' ')}
                                            </h4>
                                            <div
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    color: tokens.colors.neutral[600],
                                                    fontFamily: 'monospace',
                                                }}
                                            >
                                                <strong>Hash:</strong> {isMobile ? truncateHash(transaction.transactionHash) : transaction.transactionHash}
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: tokens.spacing[1],
                                                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                                borderRadius: tokens.borderRadius.full,
                                                backgroundColor: `${getStatusColor(transaction.status)}20`,
                                                border: `1px solid ${getStatusColor(transaction.status)}`,
                                            }}
                                        >
                                            <span style={{ fontSize: '12px' }}>{getStatusIcon(transaction.status)}</span>
                                            <span
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    fontWeight: tokens.typography.fontWeight.medium,
                                                    color: getStatusColor(transaction.status),
                                                    textTransform: 'capitalize',
                                                }}
                                            >
                                                {transaction.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                            gap: tokens.spacing[3],
                                            fontSize: tokens.typography.fontSize.sm,
                                            color: tokens.colors.neutral[600],
                                        }}
                                    >
                                        <div>
                                            <strong>Timestamp:</strong> {formatDateTime(transaction.timestamp)}
                                        </div>
                                        <div>
                                            <strong>Transaction ID:</strong> {transaction.id}
                                        </div>
                                    </div>

                                    {transaction.details && Object.keys(transaction.details).length > 0 && (
                                        <div
                                            style={{
                                                marginTop: tokens.spacing[3],
                                                padding: tokens.spacing[3],
                                                backgroundColor: tokens.colors.neutral[50],
                                                borderRadius: tokens.borderRadius.sm,
                                            }}
                                        >
                                            <h5
                                                style={{
                                                    fontSize: tokens.typography.fontSize.sm,
                                                    fontWeight: tokens.typography.fontWeight.semibold,
                                                    color: tokens.colors.neutral[800],
                                                    margin: `0 0 ${tokens.spacing[2]} 0`,
                                                }}
                                            >
                                                Transaction Details
                                            </h5>
                                            <pre
                                                style={{
                                                    fontSize: tokens.typography.fontSize.xs,
                                                    color: tokens.colors.neutral[600],
                                                    margin: 0,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {JSON.stringify(transaction.details, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProposalDetailsView;