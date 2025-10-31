import React from 'react';
import { tokens } from '@/design-system/tokens';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = tokens.colors.primary[500],
  className = '',
}) => {
  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '32px',
    xl: '48px',
  };

  const spinnerSize = sizeMap[size];

  return (
    <div
      className={className}
      style={{
        width: spinnerSize,
        height: spinnerSize,
        border: `2px solid ${tokens.colors.neutral[200]}`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
      role="status"
      aria-label="Loading"
    />
  );
};

export interface LoadingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  size = 'md',
  color = tokens.colors.primary[500],
  className = '',
}) => {
  const sizeMap = {
    sm: '4px',
    md: '6px',
    lg: '8px',
  };

  const dotSize = sizeMap[size];

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
  };

  const dotStyles: React.CSSProperties = {
    width: dotSize,
    height: dotSize,
    backgroundColor: color,
    borderRadius: '50%',
    animation: 'pulse 1.4s ease-in-out infinite both',
  };

  return (
    <div
      className={className}
      style={containerStyles}
      role="status"
      aria-label="Loading"
    >
      <div style={{ ...dotStyles, animationDelay: '-0.32s' }} />
      <div style={{ ...dotStyles, animationDelay: '-0.16s' }} />
      <div style={dotStyles} />
    </div>
  );
};

export interface LoadingBarProps {
  progress?: number;
  indeterminate?: boolean;
  height?: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({
  progress = 0,
  indeterminate = false,
  height = '4px',
  color = tokens.colors.primary[500],
  backgroundColor = tokens.colors.neutral[200],
  className = '',
}) => {
  const containerStyles: React.CSSProperties = {
    width: '100%',
    height,
    backgroundColor,
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
    position: 'relative',
  };

  const barStyles: React.CSSProperties = {
    height: '100%',
    backgroundColor: color,
    borderRadius: tokens.borderRadius.full,
    transition: indeterminate ? 'none' : 'width 0.3s ease',
    width: indeterminate ? '30%' : `${Math.max(0, Math.min(100, progress))}%`,
    animation: indeterminate ? 'indeterminate 2s linear infinite' : 'none',
  };

  return (
    <div
      className={className}
      style={containerStyles}
      role="progressbar"
      aria-valuenow={progress}
    >
      <div style={barStyles} />
    </div>
  );
};

export interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
  showProgress?: boolean;
  children?: React.ReactNode;
  backdrop?: boolean;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message,
  progress,
  showProgress = false,
  children,
  backdrop = true,
  className = '',
}) => {
  if (!isVisible) return null;

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: backdrop ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const contentStyles: React.CSSProperties = {
    backgroundColor: 'white',
    padding: tokens.spacing[6],
    borderRadius: tokens.borderRadius.lg,
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacing[4],
    minWidth: '200px',
    maxWidth: '400px',
  };

  return (
    <div className={className} style={overlayStyles}>
      <div style={contentStyles}>
        {children || <LoadingSpinner size="lg" />}

        {message && (
          <p
            style={{
              margin: 0,
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.neutral[700],
              textAlign: 'center',
            }}
          >
            {message}
          </p>
        )}

        {showProgress && typeof progress === 'number' && (
          <div style={{ width: '100%' }}>
            <LoadingBar progress={progress} />
            <p
              style={{
                margin: `${tokens.spacing[2]} 0 0 0`,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                textAlign: 'center',
              }}
            >
              {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = tokens.borderRadius.md,
  className = '',
}) => {
  const skeletonStyles: React.CSSProperties = {
    width,
    height,
    backgroundColor: tokens.colors.neutral[200],
    borderRadius,
    animation: 'skeleton 1.5s ease-in-out infinite alternate',
  };

  return <div className={className} style={skeletonStyles} />;
};

export interface LoadingCardSkeletonProps {
  showImage?: boolean;
  lines?: number;
  className?: string;
}

export const LoadingCardSkeleton: React.FC<LoadingCardSkeletonProps> = ({
  showImage = true,
  lines = 3,
  className = '',
}) => {
  const cardStyles: React.CSSProperties = {
    padding: tokens.spacing[4],
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing[3],
  };

  return (
    <div className={className} style={cardStyles}>
      {showImage && <LoadingSkeleton height="200px" />}

      <LoadingSkeleton height="24px" width="70%" />

      {Array.from({ length: lines }).map((_, index) => (
        <LoadingSkeleton
          key={index}
          height="16px"
          width={index === lines - 1 ? '60%' : '100%'}
        />
      ))}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: tokens.spacing[2],
        }}
      >
        <LoadingSkeleton height="32px" width="80px" />
        <LoadingSkeleton height="32px" width="100px" />
      </div>
    </div>
  );
};

export interface LoadingStateProps {
  isLoading: boolean;
  error?: Error | null;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  onRetry?: () => void;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  error,
  children,
  loadingComponent,
  errorComponent,
  onRetry,
}) => {
  if (error) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }

    return (
      <div
        style={{
          padding: tokens.spacing[6],
          textAlign: 'center',
          backgroundColor: tokens.colors.error[50],
          border: `1px solid ${tokens.colors.error[200]}`,
          borderRadius: tokens.borderRadius.md,
        }}
      >
        <div
          style={{
            fontSize: '2rem',
            marginBottom: tokens.spacing[3],
          }}
        >
          ⚠️
        </div>

        <h3
          style={{
            margin: `0 0 ${tokens.spacing[2]} 0`,
            color: tokens.colors.error[700],
          }}
        >
          Something went wrong
        </h3>

        <p
          style={{
            margin: `0 0 ${tokens.spacing[4]} 0`,
            color: tokens.colors.error[600],
          }}
        >
          {error.message || 'An unexpected error occurred'}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
              backgroundColor: tokens.colors.error[600],
              color: 'white',
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              cursor: 'pointer',
              fontSize: tokens.typography.fontSize.sm,
            }}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div
        style={{
          padding: tokens.spacing[6],
          textAlign: 'center',
        }}
      >
        <LoadingSpinner size="lg" />
        <p
          style={{
            marginTop: tokens.spacing[3],
            color: tokens.colors.neutral[600],
          }}
        >
          Loading...
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

// CSS animations (should be added to global styles)
export const loadingAnimations = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

@keyframes skeleton {
  0% {
    opacity: 0.6;
  }
  100% {
    opacity: 1;
  }
}
`;
