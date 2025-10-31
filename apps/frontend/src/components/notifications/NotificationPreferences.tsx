import React, { useState, useEffect } from 'react';
import { tokens } from '../../design-system/tokens';
import {
  NotificationPreferences as INotificationPreferences,
  NotificationType,
} from '@booking-swap/shared';

interface NotificationPreferencesProps {
  preferences: INotificationPreferences;
  onSave: (preferences: INotificationPreferences) => void;
  onCancel: () => void;
}

export const NotificationPreferences: React.FC<
  NotificationPreferencesProps
> = ({ preferences, onSave, onCancel }) => {
  const [localPreferences, setLocalPreferences] =
    useState<INotificationPreferences>(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const isChanged =
      JSON.stringify(preferences) !== JSON.stringify(localPreferences);
    setHasChanges(isChanged);
  }, [preferences, localPreferences]);

  const handleChannelToggle = (
    channel: keyof Omit<INotificationPreferences, 'channels'>
  ) => {
    setLocalPreferences(prev => ({
      ...prev,
      [channel]: !prev[channel],
    }));
  };

  const handleNotificationTypeToggle = (
    notificationType: NotificationType,
    channel: 'email' | 'sms' | 'push' | 'in_app'
  ) => {
    setLocalPreferences(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [notificationType]: prev.channels[notificationType].includes(channel)
          ? prev.channels[notificationType].filter(c => c !== channel)
          : [...prev.channels[notificationType], channel],
      },
    }));
  };

  const handleSave = () => {
    onSave(localPreferences);
  };

  const notificationTypes: Array<{
    type: NotificationType;
    label: string;
    description: string;
  }> = [
    {
      type: 'swap_proposal',
      label: 'Swap Proposals',
      description: 'When someone proposes a swap for your booking',
    },
    {
      type: 'swap_accepted',
      label: 'Swap Accepted',
      description: 'When your swap proposal is accepted',
    },
    {
      type: 'swap_rejected',
      label: 'Swap Rejected',
      description: 'When your swap proposal is rejected',
    },
    {
      type: 'swap_expired',
      label: 'Swap Expired',
      description: 'When a swap proposal expires',
    },
    {
      type: 'swap_cancelled',
      label: 'Swap Cancelled',
      description: 'When a swap is cancelled',
    },
    {
      type: 'booking_verified',
      label: 'Booking Verified',
      description: 'When your booking is verified',
    },
    {
      type: 'booking_expired',
      label: 'Booking Expired',
      description: 'When your booking is about to expire',
    },
  ];

  const channels = [
    { key: 'email' as const, label: 'Email', icon: '📧' },
    { key: 'sms' as const, label: 'SMS', icon: '📱' },
    { key: 'push' as const, label: 'Push', icon: '🔔' },
    { key: 'in_app' as const, label: 'In-App', icon: '💬' },
  ];

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: tokens.spacing[6],
        backgroundColor: tokens.colors.white,
        borderRadius: tokens.borderRadius.lg,
        boxShadow: tokens.shadows.md,
      }}
    >
      <div
        style={{
          marginBottom: tokens.spacing[6],
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.bold,
            color: tokens.colors.neutral[900],
          }}
        >
          Notification Preferences
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.base,
            color: tokens.colors.neutral[600],
            lineHeight: tokens.typography.lineHeight.relaxed,
          }}
        >
          Choose how you want to be notified about swap activities and booking
          updates.
        </p>
      </div>

      {/* Global Channel Settings */}
      <div
        style={{
          marginBottom: tokens.spacing[6],
          padding: tokens.spacing[4],
          backgroundColor: tokens.colors.neutral[50],
          borderRadius: tokens.borderRadius.md,
        }}
      >
        <h3
          style={{
            margin: 0,
            marginBottom: tokens.spacing[3],
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
          }}
        >
          Global Settings
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: tokens.spacing[3],
          }}
        >
          {channels.map(channel => (
            <label
              key={channel.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                cursor: 'pointer',
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.white,
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[200]}`,
              }}
            >
              <input
                type="checkbox"
                checked={localPreferences[channel.key]}
                onChange={() => handleChannelToggle(channel.key)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: tokens.colors.primary[500],
                }}
              />
              <span style={{ fontSize: '18px' }}>{channel.icon}</span>
              <span
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                }}
              >
                {channel.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Notification Type Settings */}
      <div
        style={{
          marginBottom: tokens.spacing[6],
        }}
      >
        <h3
          style={{
            margin: 0,
            marginBottom: tokens.spacing[4],
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
          }}
        >
          Notification Types
        </h3>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[4],
          }}
        >
          {notificationTypes.map(notificationType => (
            <div
              key={notificationType.type}
              style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.white,
                border: `1px solid ${tokens.colors.neutral[200]}`,
                borderRadius: tokens.borderRadius.md,
              }}
            >
              <div
                style={{
                  marginBottom: tokens.spacing[3],
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    marginBottom: tokens.spacing[1],
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.neutral[900],
                  }}
                >
                  {notificationType.label}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                  }}
                >
                  {notificationType.description}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: tokens.spacing[3],
                  flexWrap: 'wrap',
                }}
              >
                {channels.map(channel => (
                  <label
                    key={`${notificationType.type}-${channel.key}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                      cursor: localPreferences[channel.key]
                        ? 'pointer'
                        : 'not-allowed',
                      opacity: localPreferences[channel.key] ? 1 : 0.5,
                      padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                      backgroundColor: localPreferences.channels[
                        notificationType.type
                      ].includes(channel.key)
                        ? tokens.colors.primary[50]
                        : tokens.colors.neutral[50],
                      border: `1px solid ${
                        localPreferences.channels[
                          notificationType.type
                        ].includes(channel.key)
                          ? tokens.colors.primary[200]
                          : tokens.colors.neutral[200]
                      }`,
                      borderRadius: tokens.borderRadius.md,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={localPreferences.channels[
                        notificationType.type
                      ].includes(channel.key)}
                      disabled={!localPreferences[channel.key]}
                      onChange={() =>
                        handleNotificationTypeToggle(
                          notificationType.type,
                          channel.key
                        )
                      }
                      style={{
                        width: '14px',
                        height: '14px',
                        accentColor: tokens.colors.primary[500],
                      }}
                    />
                    <span style={{ fontSize: '14px' }}>{channel.icon}</span>
                    <span
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.neutral[700],
                      }}
                    >
                      {channel.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: tokens.spacing[3],
          paddingTop: tokens.spacing[4],
          borderTop: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            border: `1px solid ${tokens.colors.neutral[300]}`,
            borderRadius: tokens.borderRadius.md,
            backgroundColor: 'transparent',
            color: tokens.colors.neutral[700],
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges}
          style={{
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            border: 'none',
            borderRadius: tokens.borderRadius.md,
            backgroundColor: hasChanges
              ? tokens.colors.primary[500]
              : tokens.colors.neutral[300],
            color: tokens.colors.white,
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            cursor: hasChanges ? 'pointer' : 'not-allowed',
          }}
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
};
