import React, { useEffect, useState } from 'react';
import { tokens } from '../../design-system/tokens';
import { SwapWithBookings, SwapEvent } from '../../services/swapService';
import { useSwapWebSocket } from '../../hooks/useSwapWebSocket';

interface SwapTimelineProps {
  swap: SwapWithBookings;
  events: SwapEvent[];
}

const getEventIcon = (eventType: SwapEvent['type']): string => {
  switch (eventType) {
    case 'created':
      return '🆕';
    case 'proposed':
      return '📝';
    case 'accepted':
      return '✅';
    case 'rejected':
      return '❌';
    case 'completed':
      return '🎉';
    case 'cancelled':
      return '⚪';
    default:
      return '📋';
  }
};

const getEventColor = (eventType: SwapEvent['type']): string => {
  switch (eventType) {
    case 'created':
      return tokens.colors.primary[500];
    case 'proposed':
      return tokens.colors.warning[500];
    case 'accepted':
      return tokens.colors.success[500];
    case 'rejected':
      return tokens.colors.error[500];
    case 'completed':
      return tokens.colors.primary[600];
    case 'cancelled':
      return tokens.colors.neutral[500];
    default:
      return tokens.colors.neutral[400];
  }
};

const getEventDescription = (event: SwapEvent): string => {
  switch (event.type) {
    case 'created':
      return 'Swap proposal was created';
    case 'proposed':
      return 'Counter-proposal was submitted';
    case 'accepted':
      return 'Swap proposal was accepted';
    case 'rejected':
      return `Swap proposal was rejected${event.data.reason ? `: ${event.data.reason}` : ''}`;
    case 'completed':
      return 'Swap was completed successfully';
    case 'cancelled':
      return 'Swap was cancelled';
    default:
      return 'Unknown event occurred';
  }
};

const formatTimestamp = (timestamp: Date): string => {
  const now = new Date();
  const eventTime = new Date(timestamp);
  const diffMs = now.getTime() - eventTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return eventTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: eventTime.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

export const SwapTimeline: React.FC<SwapTimelineProps> = ({ swap, events }) => {
  const [liveEvents, setLiveEvents] = useState<SwapEvent[]>(events);

  // Real-time WebSocket updates
  const { isConnected } = useSwapWebSocket({
    swapId: swap.id,
    autoJoinRoom: true,
    onSwapUpdate: (swapId, event) => {
      if (swapId === swap.id) {
        setLiveEvents(prev => {
          // Check if event already exists to avoid duplicates
          const eventExists = prev.some(e => e.id === event.id);
          if (!eventExists) {
            return [...prev, event].sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            );
          }
          return prev;
        });
      }
    },
  });

  useEffect(() => {
    setLiveEvents(events);
  }, [events]);

  // Sort events by timestamp (newest first)
  const sortedEvents = [...liveEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '600px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          marginBottom: tokens.spacing[4],
        }}
      >
        <h3
          style={{
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          Timeline
        </h3>
        <div
          style={{
            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
            borderRadius: tokens.borderRadius.full,
            backgroundColor: tokens.colors.neutral[100],
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.neutral[600],
          }}
        >
          {sortedEvents.length} events
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          paddingLeft: tokens.spacing[8],
        }}
      >
        {/* Timeline line */}
        <div
          style={{
            position: 'absolute',
            left: tokens.spacing[4],
            top: tokens.spacing[2],
            bottom: tokens.spacing[2],
            width: '2px',
            backgroundColor: tokens.colors.neutral[200],
          }}
        />

        {sortedEvents.map((event, index) => {
          const eventColor = getEventColor(event.type);
          const isLatest = index === 0;

          return (
            <div
              key={event.id}
              style={{
                position: 'relative',
                marginBottom:
                  index === sortedEvents.length - 1 ? 0 : tokens.spacing[6],
                opacity: isLatest ? 1 : 0.8,
              }}
            >
              {/* Event dot */}
              <div
                style={{
                  position: 'absolute',
                  left: `-${tokens.spacing[6]}`,
                  top: tokens.spacing[1],
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: eventColor,
                  border: `3px solid white`,
                  boxShadow: `0 0 0 2px ${eventColor}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  zIndex: 1,
                }}
              >
                <span style={{ fontSize: '10px' }}>
                  {getEventIcon(event.type)}
                </span>
              </div>

              {/* Event content */}
              <div
                style={{
                  padding: tokens.spacing[4],
                  backgroundColor: isLatest
                    ? tokens.colors.neutral[50]
                    : 'white',
                  borderRadius: tokens.borderRadius.md,
                  border: `1px solid ${isLatest ? eventColor + '40' : tokens.colors.neutral[200]}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: tokens.colors.neutral[900],
                      textTransform: 'capitalize',
                    }}
                  >
                    {event.type.replace('_', ' ')}
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.colors.neutral[500],
                      fontWeight: tokens.typography.fontWeight.medium,
                    }}
                  >
                    {formatTimestamp(event.timestamp)}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[700],
                    lineHeight: tokens.typography.lineHeight.relaxed,
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  {getEventDescription(event)}
                </div>

                {/* Additional event data */}
                {event.data && Object.keys(event.data).length > 0 && (
                  <div
                    style={{
                      padding: tokens.spacing[3],
                      backgroundColor: tokens.colors.neutral[100],
                      borderRadius: tokens.borderRadius.sm,
                      marginTop: tokens.spacing[2],
                    }}
                  >
                    {Object.entries(event.data).map(([key, value]) => (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.colors.neutral[600],
                          marginBottom: tokens.spacing[1],
                        }}
                      >
                        <span
                          style={{
                            fontWeight: tokens.typography.fontWeight.medium,
                          }}
                        >
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                        </span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Real-time indicator for latest event */}
                {isLatest && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[1],
                      marginTop: tokens.spacing[2],
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.colors.success[600],
                      fontWeight: tokens.typography.fontWeight.medium,
                    }}
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: tokens.colors.success[500],
                        animation: 'pulse 2s infinite',
                      }}
                    />
                    Latest update
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {sortedEvents.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: tokens.spacing[8],
              color: tokens.colors.neutral[500],
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: tokens.spacing[4] }}>
              📋
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.md,
                fontWeight: tokens.typography.fontWeight.medium,
                marginBottom: tokens.spacing[2],
              }}
            >
              No events yet
            </div>
            <div style={{ fontSize: tokens.typography.fontSize.sm }}>
              Timeline events will appear here as the swap progresses
            </div>
          </div>
        )}
      </div>

      {/* Status summary */}
      <div
        style={{
          marginTop: tokens.spacing[6],
          padding: tokens.spacing[4],
          backgroundColor: tokens.colors.neutral[50],
          borderRadius: tokens.borderRadius.md,
          border: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[900],
                marginBottom: tokens.spacing[1],
              }}
            >
              Current Status
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[600],
              }}
            >
              Last updated {formatTimestamp(new Date(swap.updatedAt))}
            </div>
          </div>
          <div
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
              borderRadius: tokens.borderRadius.full,
              backgroundColor: `${getEventColor(swap.status as any)}20`,
              border: `1px solid ${getEventColor(swap.status as any)}`,
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: getEventColor(swap.status as any),
              textTransform: 'capitalize',
            }}
          >
            {swap.status}
          </div>
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};
