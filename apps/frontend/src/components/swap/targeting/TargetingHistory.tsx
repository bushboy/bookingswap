import React, { useState, useEffect, useMemo } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { tokens } from '@/design-system/tokens';
import {
    TargetingEvent,
    TargetingEventType,
    TargetingEventSeverity,
    TargetingHistoryFilters,
    TargetingHistorySorting,
    GroupedTargetingEvents,
    TargetingHistoryTimeline
} from '@booking-swap/shared';

export interface TargetingHistoryProps {
    swapId?: string;
    userId?: string;
    events: TargetingEvent[];
    isLoading?: boolean;
    error?: string;
    onLoadMore?: () => void;
    onFiltersChange?: (filters: TargetingHistoryFilters) => void;
    onSortingChange?: (sorting: TargetingHistorySorting) => void;
    hasMore?: boolean;
    className?: string;
    maxHeight?: string;
    showFilters?: boolean;
    showSearch?: boolean;
    groupByDate?: boolean;
    expandableDetails?: boolean;
}

/**
 * Timeline component for displaying targeting events chronologically
 * Shows targeting actions, status changes, and user interactions
 * Includes contextual information about targeting decisions
 */
export const TargetingHistory: React.FC<TargetingHistoryProps> = ({
    swapId,
    userId,
    events = [],
    isLoading = false,
    error,
    onLoadMore,
    onFiltersChange,
    onSortingChange,
    hasMore = false,
    className = '',
    maxHeight = '600px',
    showFilters = true,
    showSearch = true,
    groupByDate = true,
    expandableDetails = true,
}) => {
    // Local state for filters and search
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEventTypes, setSelectedEventTypes] = useState<TargetingEventType[]>([]);
    const [selectedSeverity, setSelectedSeverity] = useState<TargetingEventSeverity[]>([]);
    const [sortField, setSortField] = useState<'timestamp' | 'type' | 'actor' | 'severity'>('timestamp');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

    // Event type options for filtering
    const eventTypeOptions = [
        { value: 'targeting_created', label: 'Targeting Created' },
        { value: 'targeting_accepted', label: 'Targeting Accepted' },
        { value: 'targeting_rejected', label: 'Targeting Rejected' },
        { value: 'targeting_cancelled', label: 'Targeting Cancelled' },
        { value: 'targeting_retargeted', label: 'Retargeted' },
        { value: 'auction_started', label: 'Auction Started' },
        { value: 'auction_ended', label: 'Auction Ended' },
        { value: 'proposal_submitted', label: 'Proposal Submitted' },
        { value: 'proposal_withdrawn', label: 'Proposal Withdrawn' },
    ];

    const severityOptions = [
        { value: 'info', label: 'Info' },
        { value: 'warning', label: 'Warning' },
        { value: 'success', label: 'Success' },
        { value: 'error', label: 'Error' },
    ];

    // Filter and sort events
    const filteredAndSortedEvents = useMemo(() => {
        let filtered = events;

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(event =>
                event.title.toLowerCase().includes(query) ||
                event.description.toLowerCase().includes(query) ||
                event.actor.name.toLowerCase().includes(query) ||
                event.sourceSwap.bookingDetails.title.toLowerCase().includes(query) ||
                event.targetSwap.bookingDetails.title.toLowerCase().includes(query)
            );
        }

        // Apply event type filter
        if (selectedEventTypes.length > 0) {
            filtered = filtered.filter(event => selectedEventTypes.includes(event.type));
        }

        // Apply severity filter
        if (selectedSeverity.length > 0) {
            filtered = filtered.filter(event => selectedSeverity.includes(event.severity));
        }

        // Sort events
        filtered.sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'timestamp':
                    comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                    break;
                case 'type':
                    comparison = a.type.localeCompare(b.type);
                    break;
                case 'actor':
                    comparison = a.actor.name.localeCompare(b.actor.name);
                    break;
                case 'severity':
                    const severityOrder = { error: 0, warning: 1, success: 2, info: 3 };
                    comparison = severityOrder[a.severity] - severityOrder[b.severity];
                    break;
            }

            return sortDirection === 'desc' ? -comparison : comparison;
        });

        return filtered;
    }, [events, searchQuery, selectedEventTypes, selectedSeverity, sortField, sortDirection]);

    // Group events by date if enabled
    const groupedEvents: GroupedTargetingEvents[] = useMemo(() => {
        if (!groupByDate) {
            return [{ date: 'all', events: filteredAndSortedEvents }];
        }

        const groups: Record<string, TargetingEvent[]> = {};

        filteredAndSortedEvents.forEach(event => {
            const date = format(new Date(event.timestamp), 'yyyy-MM-dd');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(event);
        });

        return Object.entries(groups)
            .map(([date, events]) => ({ date, events }))
            .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
    }, [filteredAndSortedEvents, groupByDate]);

    // Handle filter changes
    useEffect(() => {
        if (onFiltersChange) {
            const filters: TargetingHistoryFilters = {
                searchQuery: searchQuery || undefined,
                eventTypes: selectedEventTypes.length > 0 ? selectedEventTypes : undefined,
                severity: selectedSeverity.length > 0 ? selectedSeverity : undefined,
            };
            onFiltersChange(filters);
        }
    }, [searchQuery, selectedEventTypes, selectedSeverity, onFiltersChange]);

    // Handle sorting changes
    useEffect(() => {
        if (onSortingChange) {
            onSortingChange({ field: sortField, direction: sortDirection });
        }
    }, [sortField, sortDirection, onSortingChange]);

    const toggleEventExpansion = (eventId: string) => {
        const newExpanded = new Set(expandedEvents);
        if (newExpanded.has(eventId)) {
            newExpanded.delete(eventId);
        } else {
            newExpanded.add(eventId);
        }
        setExpandedEvents(newExpanded);
    };

    const getEventIcon = (type: TargetingEventType): string => {
        const icons: Record<TargetingEventType, string> = {
            targeting_created: '🎯',
            targeting_accepted: '✅',
            targeting_rejected: '❌',
            targeting_cancelled: '🚫',
            targeting_retargeted: '🔄',
            auction_started: '🏁',
            auction_ended: '🏆',
            proposal_submitted: '📝',
            proposal_withdrawn: '↩️',
        };
        return icons[type] || '📋';
    };

    const getSeverityColor = (severity: TargetingEventSeverity): string => {
        const colors: Record<TargetingEventSeverity, string> = {
            info: tokens.colors.blue[500],
            warning: tokens.colors.yellow[500],
            success: tokens.colors.green[500],
            error: tokens.colors.red[500],
        };
        return colors[severity];
    };

    const formatDateGroup = (dateStr: string): string => {
        if (dateStr === 'all') return 'All Events';

        const date = parseISO(dateStr);
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'MMMM d, yyyy');
    };

    const formatEventTime = (timestamp: Date): string => {
        return format(new Date(timestamp), 'h:mm a');
    };

    if (error) {
        return (
            <Card className={`targeting-history-error ${className}`}>
                <div style={{ padding: tokens.spacing[4], textAlign: 'center' }}>
                    <p style={{ color: tokens.colors.red[600], marginBottom: tokens.spacing[2] }}>
                        Failed to load targeting history
                    </p>
                    <p style={{ color: tokens.colors.gray[600], fontSize: '0.9em' }}>
                        {error}
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <div className={`targeting-history ${className}`}>
            {/* Filters and Search */}
            {(showFilters || showSearch) && (
                <Card style={{ marginBottom: tokens.spacing[4] }}>
                    <div style={{ padding: tokens.spacing[3] }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: tokens.spacing[3],
                            alignItems: 'end'
                        }}>
                            {showSearch && (
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: tokens.spacing[1],
                                        fontSize: '0.9em',
                                        fontWeight: 500
                                    }}>
                                        Search Events
                                    </label>
                                    <Input
                                        type="text"
                                        placeholder="Search by title, description, or user..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            )}

                            {showFilters && (
                                <>
                                    <div>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: tokens.spacing[1],
                                            fontSize: '0.9em',
                                            fontWeight: 500
                                        }}>
                                            Event Types
                                        </label>
                                        <Select
                                            multiple
                                            value={selectedEventTypes}
                                            onChange={setSelectedEventTypes}
                                            options={eventTypeOptions}
                                            placeholder="All types"
                                        />
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: tokens.spacing[1],
                                            fontSize: '0.9em',
                                            fontWeight: 500
                                        }}>
                                            Severity
                                        </label>
                                        <Select
                                            multiple
                                            value={selectedSeverity}
                                            onChange={setSelectedSeverity}
                                            options={severityOptions}
                                            placeholder="All severities"
                                        />
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: tokens.spacing[1],
                                            fontSize: '0.9em',
                                            fontWeight: 500
                                        }}>
                                            Sort By
                                        </label>
                                        <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                                            <Select
                                                value={sortField}
                                                onChange={setSortField}
                                                options={[
                                                    { value: 'timestamp', label: 'Time' },
                                                    { value: 'type', label: 'Type' },
                                                    { value: 'actor', label: 'User' },
                                                    { value: 'severity', label: 'Severity' },
                                                ]}
                                            />
                                            <Button
                                                variant="outline"
                                                size="small"
                                                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                                                title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
                                            >
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Events Timeline */}
            <div
                style={{
                    maxHeight,
                    overflowY: 'auto',
                    border: `1px solid ${tokens.colors.gray[200]}`,
                    borderRadius: tokens.borderRadius.md,
                    backgroundColor: tokens.colors.white,
                }}
            >
                {isLoading && events.length === 0 ? (
                    <div style={{
                        padding: tokens.spacing[6],
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: tokens.spacing[2]
                    }}>
                        <Spinner size="medium" />
                        <p style={{ color: tokens.colors.gray[600] }}>Loading targeting history...</p>
                    </div>
                ) : filteredAndSortedEvents.length === 0 ? (
                    <div style={{
                        padding: tokens.spacing[6],
                        textAlign: 'center',
                        color: tokens.colors.gray[600]
                    }}>
                        <p>No targeting events found</p>
                        {(searchQuery || selectedEventTypes.length > 0 || selectedSeverity.length > 0) && (
                            <p style={{ fontSize: '0.9em', marginTop: tokens.spacing[2] }}>
                                Try adjusting your filters or search terms
                            </p>
                        )}
                    </div>
                ) : (
                    <div>
                        {groupedEvents.map((group) => (
                            <div key={group.date} style={{ marginBottom: tokens.spacing[4] }}>
                                {groupByDate && (
                                    <div style={{
                                        padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                                        backgroundColor: tokens.colors.gray[50],
                                        borderBottom: `1px solid ${tokens.colors.gray[200]}`,
                                        fontWeight: 600,
                                        fontSize: '0.9em',
                                        color: tokens.colors.gray[700],
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1,
                                    }}>
                                        {formatDateGroup(group.date)} ({group.events.length} event{group.events.length !== 1 ? 's' : ''})
                                    </div>
                                )}

                                {group.events.map((event, index) => {
                                    const isExpanded = expandedEvents.has(event.id);
                                    const isLast = index === group.events.length - 1;

                                    return (
                                        <div
                                            key={event.id}
                                            style={{
                                                padding: tokens.spacing[4],
                                                borderBottom: !isLast ? `1px solid ${tokens.colors.gray[100]}` : 'none',
                                                position: 'relative',
                                            }}
                                        >
                                            {/* Timeline connector */}
                                            {!isLast && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        left: `${parseInt(tokens.spacing[4]) + 12}px`,
                                                        top: '60px',
                                                        bottom: 0,
                                                        width: '2px',
                                                        backgroundColor: tokens.colors.gray[200],
                                                    }}
                                                />
                                            )}

                                            <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
                                                {/* Event icon and severity indicator */}
                                                <div style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    minWidth: '24px'
                                                }}>
                                                    <div
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            backgroundColor: getSeverityColor(event.severity),
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '12px',
                                                            position: 'relative',
                                                            zIndex: 2,
                                                        }}
                                                        title={`${event.severity} event`}
                                                    >
                                                        {getEventIcon(event.type)}
                                                    </div>
                                                </div>

                                                {/* Event content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start',
                                                        marginBottom: tokens.spacing[2]
                                                    }}>
                                                        <div style={{ flex: 1 }}>
                                                            <h4 style={{
                                                                margin: 0,
                                                                fontSize: '1em',
                                                                fontWeight: 600,
                                                                color: tokens.colors.gray[900]
                                                            }}>
                                                                {event.title}
                                                            </h4>
                                                            <p style={{
                                                                margin: `${tokens.spacing[1]} 0`,
                                                                color: tokens.colors.gray[600],
                                                                fontSize: '0.9em',
                                                                lineHeight: 1.4
                                                            }}>
                                                                {event.description}
                                                            </p>
                                                        </div>

                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: tokens.spacing[2],
                                                            marginLeft: tokens.spacing[2]
                                                        }}>
                                                            <Badge variant={event.severity} size="small">
                                                                {event.severity}
                                                            </Badge>
                                                            <span style={{
                                                                fontSize: '0.8em',
                                                                color: tokens.colors.gray[500],
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {formatEventTime(event.timestamp)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actor and basic info */}
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: tokens.spacing[2],
                                                        marginBottom: expandableDetails ? tokens.spacing[2] : 0
                                                    }}>
                                                        <Avatar
                                                            src={event.actor.avatar}
                                                            name={event.actor.name}
                                                            size="small"
                                                        />
                                                        <span style={{
                                                            fontSize: '0.9em',
                                                            color: tokens.colors.gray[700]
                                                        }}>
                                                            {event.actor.name}
                                                        </span>
                                                    </div>

                                                    {/* Expandable details */}
                                                    {expandableDetails && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="small"
                                                                onClick={() => toggleEventExpansion(event.id)}
                                                                style={{
                                                                    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                                                    fontSize: '0.8em'
                                                                }}
                                                            >
                                                                {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
                                                            </Button>

                                                            {isExpanded && (
                                                                <div style={{
                                                                    marginTop: tokens.spacing[3],
                                                                    padding: tokens.spacing[3],
                                                                    backgroundColor: tokens.colors.gray[50],
                                                                    borderRadius: tokens.borderRadius.sm,
                                                                    fontSize: '0.9em'
                                                                }}>
                                                                    <div style={{
                                                                        display: 'grid',
                                                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                                        gap: tokens.spacing[3]
                                                                    }}>
                                                                        <div>
                                                                            <strong>Source Swap:</strong>
                                                                            <p style={{ margin: `${tokens.spacing[1]} 0` }}>
                                                                                {event.sourceSwap.bookingDetails.title}
                                                                            </p>
                                                                            <p style={{
                                                                                margin: 0,
                                                                                fontSize: '0.8em',
                                                                                color: tokens.colors.gray[600]
                                                                            }}>
                                                                                Owner: {event.sourceSwap.ownerName}
                                                                            </p>
                                                                        </div>

                                                                        <div>
                                                                            <strong>Target Swap:</strong>
                                                                            <p style={{ margin: `${tokens.spacing[1]} 0` }}>
                                                                                {event.targetSwap.bookingDetails.title}
                                                                            </p>
                                                                            <p style={{
                                                                                margin: 0,
                                                                                fontSize: '0.8em',
                                                                                color: tokens.colors.gray[600]
                                                                            }}>
                                                                                Owner: {event.targetSwap.ownerName}
                                                                            </p>
                                                                        </div>

                                                                        {event.metadata && (
                                                                            <div style={{ gridColumn: '1 / -1' }}>
                                                                                <strong>Additional Details:</strong>
                                                                                <div style={{
                                                                                    marginTop: tokens.spacing[1],
                                                                                    display: 'flex',
                                                                                    flexWrap: 'wrap',
                                                                                    gap: tokens.spacing[2]
                                                                                }}>
                                                                                    {event.metadata.proposalId && (
                                                                                        <Badge variant="outline" size="small">
                                                                                            Proposal: {event.metadata.proposalId.slice(0, 8)}...
                                                                                        </Badge>
                                                                                    )}
                                                                                    {event.metadata.targetId && (
                                                                                        <Badge variant="outline" size="small">
                                                                                            Target: {event.metadata.targetId.slice(0, 8)}...
                                                                                        </Badge>
                                                                                    )}
                                                                                    {event.metadata.automaticAction && (
                                                                                        <Badge variant="info" size="small">
                                                                                            Automatic
                                                                                        </Badge>
                                                                                    )}
                                                                                    {event.metadata.auctionInfo && (
                                                                                        <Badge variant="warning" size="small">
                                                                                            Auction: {event.metadata.auctionInfo.bidCount} bids
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                                {event.metadata.reason && (
                                                                                    <p style={{
                                                                                        margin: `${tokens.spacing[2]} 0 0`,
                                                                                        fontStyle: 'italic',
                                                                                        color: tokens.colors.gray[600]
                                                                                    }}>
                                                                                        Reason: {event.metadata.reason}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                        {/* Load more button */}
                        {hasMore && (
                            <div style={{
                                padding: tokens.spacing[4],
                                textAlign: 'center',
                                borderTop: `1px solid ${tokens.colors.gray[200]}`
                            }}>
                                <Button
                                    variant="outline"
                                    onClick={onLoadMore}
                                    disabled={isLoading}
                                    style={{ minWidth: '120px' }}
                                >
                                    {isLoading ? (
                                        <>
                                            <Spinner size="small" style={{ marginRight: tokens.spacing[2] }} />
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More Events'
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TargetingHistory;