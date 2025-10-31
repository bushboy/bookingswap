import React from 'react';
import { tokens } from '@/design-system/tokens';
import { useResponsive, useTouch } from '@/hooks/useResponsive';
import { useTouchGestures } from '@/hooks/useTouchGestures';

interface MobileNavigationProps {
  onBack?: () => void;
  onNext?: () => void;
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
  currentStep?: number;
  totalSteps?: number;
  enableSwipeNavigation?: boolean;
  theme?: {
    colors: {
      background: string;
      text: string;
      textSecondary: string;
      border: string;
    };
  };
}

/**
 * Mobile-optimized navigation component with swipe gestures
 * and touch-friendly controls
 */
export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  onBack,
  onNext,
  title,
  subtitle,
  showProgress = false,
  currentStep = 1,
  totalSteps = 1,
  enableSwipeNavigation = true,
  theme,
}) => {
  const { isMobile } = useResponsive();
  const isTouch = useTouch();
  
  // Set up swipe gestures for navigation
  const { attachGestures } = useTouchGestures({
    onSwipeRight: enableSwipeNavigation && onBack ? onBack : undefined,
    onSwipeLeft: enableSwipeNavigation && onNext ? onNext : undefined,
    swipeThreshold: 100, // Require more deliberate swipe
  });

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (enableSwipeNavigation && containerRef.current) {
      return attachGestures(containerRef.current);
    }
  }, [attachGestures, enableSwipeNavigation]);

  if (!isMobile && !isTouch) {
    return null; // Only show on mobile/touch devices
  }

  const progressPercentage = showProgress ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: theme?.colors.background || 'white',
        borderBottom: `1px solid ${theme?.colors.border || tokens.colors.neutral[200]}`,
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        // Add subtle shadow for depth
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Progress bar */}
      {showProgress && (
        <div style={{
          width: '100%',
          height: '3px',
          backgroundColor: tokens.colors.neutral[200],
          borderRadius: tokens.borderRadius.full,
          marginBottom: tokens.spacing[3],
          overflow: 'hidden',
        }}>
          <div
            style={{
              width: `${progressPercentage}%`,
              height: '100%',
              backgroundColor: tokens.colors.primary[500],
              borderRadius: tokens.borderRadius.full,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Navigation header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '44px', // Touch-friendly height
      }}>
        {/* Back button */}
        <button
          onClick={onBack}
          disabled={!onBack}
          style={{
            background: 'none',
            border: 'none',
            padding: tokens.spacing[2],
            borderRadius: tokens.borderRadius.md,
            color: onBack 
              ? (theme?.colors.text || tokens.colors.neutral[700])
              : tokens.colors.neutral[400],
            cursor: onBack ? 'pointer' : 'default',
            fontSize: tokens.typography.fontSize.lg,
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Touch feedback
            ...(onBack && {
              ':active': {
                backgroundColor: tokens.colors.neutral[100],
              },
            }),
          }}
          aria-label="Go back"
        >
          ←
        </button>

        {/* Title and subtitle */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          padding: `0 ${tokens.spacing[3]}`,
        }}>
          {title && (
            <h1 style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: theme?.colors.text || tokens.colors.neutral[900],
              margin: 0,
              lineHeight: tokens.typography.lineHeight.tight,
            }}>
              {title}
            </h1>
          )}
          {subtitle && (
            <p style={{
              fontSize: tokens.typography.fontSize.sm,
              color: theme?.colors.textSecondary || tokens.colors.neutral[600],
              margin: 0,
              marginTop: tokens.spacing[1],
              lineHeight: tokens.typography.lineHeight.normal,
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Next button or step indicator */}
        <div style={{
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {onNext ? (
            <button
              onClick={onNext}
              style={{
                background: 'none',
                border: 'none',
                padding: tokens.spacing[2],
                borderRadius: tokens.borderRadius.md,
                color: theme?.colors.text || tokens.colors.neutral[700],
                cursor: 'pointer',
                fontSize: tokens.typography.fontSize.lg,
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Go forward"
            >
              →
            </button>
          ) : showProgress ? (
            <span style={{
              fontSize: tokens.typography.fontSize.sm,
              color: theme?.colors.textSecondary || tokens.colors.neutral[600],
              fontWeight: tokens.typography.fontWeight.medium,
            }}>
              {currentStep}/{totalSteps}
            </span>
          ) : null}
        </div>
      </div>

      {/* Swipe hint */}
      {enableSwipeNavigation && (onBack || onNext) && (
        <div style={{
          textAlign: 'center',
          marginTop: tokens.spacing[2],
          fontSize: tokens.typography.fontSize.xs,
          color: theme?.colors.textSecondary || tokens.colors.neutral[500],
        }}>
          {onBack && onNext 
            ? '← Swipe to navigate →'
            : onBack 
              ? '← Swipe right to go back'
              : '← Swipe left to continue'
          }
        </div>
      )}
    </div>
  );
};

/**
 * Mobile-optimized sticky action bar for forms
 */
interface MobileActionBarProps {
  primaryAction?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  theme?: {
    colors: {
      background: string;
      primary: string;
      text: string;
      border: string;
    };
  };
}

export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  primaryAction,
  secondaryAction,
  theme,
}) => {
  const { isMobile } = useResponsive();
  const isTouch = useTouch();

  if (!isMobile && !isTouch) {
    return null;
  }

  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: theme?.colors.background || 'white',
      borderTop: `1px solid ${theme?.colors.border || tokens.colors.neutral[200]}`,
      padding: tokens.spacing[4],
      // Add shadow for depth
      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
      // Safe area padding for devices with home indicator
      paddingBottom: `calc(${tokens.spacing[4]} + env(safe-area-inset-bottom))`,
    }}>
      <div style={{
        display: 'flex',
        gap: tokens.spacing[3],
        maxWidth: '400px',
        margin: '0 auto',
      }}>
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            style={{
              flex: 1,
              padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.medium,
              border: `1px solid ${theme?.colors.border || tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              backgroundColor: 'white',
              color: theme?.colors.text || tokens.colors.neutral[700],
              cursor: secondaryAction.disabled ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              opacity: secondaryAction.disabled ? 0.6 : 1,
            }}
          >
            {secondaryAction.label}
          </button>
        )}
        
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            style={{
              flex: secondaryAction ? 1 : 2,
              padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.medium,
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              backgroundColor: theme?.colors.primary || tokens.colors.primary[600],
              color: 'white',
              cursor: (primaryAction.disabled || primaryAction.loading) ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              opacity: (primaryAction.disabled || primaryAction.loading) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: tokens.spacing[2],
            }}
          >
            {primaryAction.loading && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
            )}
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};