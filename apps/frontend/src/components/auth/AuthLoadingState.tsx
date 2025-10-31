import React from 'react';
import { tokens } from '@/design-system/tokens';

export interface AuthLoadingStateProps {
  isLoading: boolean;
  loadingMessage?: string;
  progress?: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AuthLoadingState: React.FC<AuthLoadingStateProps> = ({
  isLoading,
  loadingMessage = 'Processing...',
  progress,
  showProgress = false,
  size = 'md',
  className = '',
}) => {
  if (!isLoading) return null;

  const sizeConfig = {
    sm: {
      spinner: '16px',
      fontSize: tokens.typography.fontSize.sm,
      padding: tokens.spacing[3],
    },
    md: {
      spinner: '24px',
      fontSize: tokens.typography.fontSize.base,
      padding: tokens.spacing[4],
    },
    lg: {
      spinner: '32px',
      fontSize: tokens.typography.fontSize.lg,
      padding: tokens.spacing[6],
    },
  };

  const config = sizeConfig[size];

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-label={loadingMessage}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: config.padding,
        textAlign: 'center',
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: config.spinner,
          height: config.spinner,
          border: `2px solid ${tokens.colors.neutral[200]}`,
          borderTop: `2px solid ${tokens.colors.primary[500]}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: tokens.spacing[3],
        }}
        aria-hidden="true"
      />

      {/* Loading message */}
      <p
        style={{
          margin: 0,
          fontSize: config.fontSize,
          color: tokens.colors.neutral[600],
          fontWeight: tokens.typography.fontWeight.medium,
        }}
      >
        {loadingMessage}
      </p>

      {/* Progress bar */}
      {showProgress && typeof progress === 'number' && (
        <div style={{ width: '100%', marginTop: tokens.spacing[3] }}>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: tokens.colors.neutral[200],
              borderRadius: tokens.borderRadius.full,
              overflow: 'hidden',
              marginBottom: tokens.spacing[2],
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                height: '100%',
                backgroundColor: tokens.colors.primary[500],
                borderRadius: tokens.borderRadius.full,
                transition: 'width 0.3s ease-in-out',
              }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <span
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[500],
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
};

export interface AuthButtonLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
  style?: React.CSSProperties;
}

export const AuthButtonLoading: React.FC<AuthButtonLoadingProps> = ({
  isLoading,
  children,
  loadingText,
  disabled,
  onClick,
  type = 'button',
  variant = 'primary',
  className = '',
  style,
}) => {
  const variantStyles = {
    primary: {
      backgroundColor: tokens.colors.primary[600],
      color: 'white',
      border: `1px solid ${tokens.colors.primary[600]}`,
      ':hover': tokens.colors.primary[700],
    },
    secondary: {
      backgroundColor: tokens.colors.neutral[100],
      color: tokens.colors.neutral[900],
      border: `1px solid ${tokens.colors.neutral[300]}`,
      ':hover': tokens.colors.neutral[200],
    },
    outline: {
      backgroundColor: 'transparent',
      color: tokens.colors.primary[600],
      border: `1px solid ${tokens.colors.primary[300]}`,
      ':hover': tokens.colors.primary[50],
    },
  };

  const currentVariant = variantStyles[variant];
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacing[2],
        width: '100%',
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        fontSize: tokens.typography.fontSize.base,
        fontWeight: tokens.typography.fontWeight.medium,
        borderRadius: tokens.borderRadius.md,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'all 0.2s ease-in-out',
        ...currentVariant,
        ...style,
      }}
      aria-disabled={isDisabled}
      aria-describedby={isLoading ? 'loading-description' : undefined}
    >
      {isLoading && (
        <>
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid transparent',
              borderTop: '2px solid currentColor',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
            aria-hidden="true"
          />
          <span id="loading-description" className="sr-only">
            Loading, please wait
          </span>
        </>
      )}
      <span>
        {isLoading && loadingText ? loadingText : children}
      </span>
    </button>
  );
};

export interface AuthStepIndicatorProps {
  steps: Array<{
    id: string;
    label: string;
    status: 'pending' | 'current' | 'completed' | 'error';
  }>;
  className?: string;
}

export const AuthStepIndicator: React.FC<AuthStepIndicatorProps> = ({
  steps,
  className = '',
}) => {
  return (
    <div
      className={className}
      role="progressbar"
      aria-label="Authentication progress"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacing[2],
        marginBottom: tokens.spacing[4],
      }}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        
        const getStepColor = () => {
          switch (step.status) {
            case 'completed':
              return tokens.colors.success[500];
            case 'current':
              return tokens.colors.primary[500];
            case 'error':
              return tokens.colors.error[500];
            default:
              return tokens.colors.neutral[300];
          }
        };

        const getStepIcon = () => {
          switch (step.status) {
            case 'completed':
              return '✓';
            case 'current':
              return '';
            case 'error':
              return '✗';
            default:
              return '';
          }
        };

        return (
          <React.Fragment key={step.id}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: tokens.spacing[1],
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: getStepColor(),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.semibold,
                  position: 'relative',
                }}
                aria-label={`Step ${index + 1}: ${step.label} - ${step.status}`}
              >
                {step.status === 'current' && (
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                    aria-hidden="true"
                  />
                )}
                {step.status !== 'current' && (
                  <span>{getStepIcon() || (index + 1)}</span>
                )}
              </div>
              
              <span
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: step.status === 'current' 
                    ? tokens.colors.primary[700] 
                    : tokens.colors.neutral[600],
                  fontWeight: step.status === 'current' 
                    ? tokens.typography.fontWeight.semibold 
                    : tokens.typography.fontWeight.normal,
                  textAlign: 'center',
                  maxWidth: '80px',
                }}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                style={{
                  width: '24px',
                  height: '2px',
                  backgroundColor: step.status === 'completed' 
                    ? tokens.colors.success[300] 
                    : tokens.colors.neutral[300],
                  marginBottom: tokens.spacing[6],
                }}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};