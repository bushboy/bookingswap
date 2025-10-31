import React from 'react';
import { tokens } from '@/design-system/tokens';

interface ValidationFeedbackProps {
  isValid?: boolean;
  errors?: string[];
  warnings?: string[];
  loading?: boolean;
  showSuccess?: boolean;
  successMessage?: string;
  className?: string;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  isValid = true,
  errors = [],
  warnings = [],
  loading = false,
  showSuccess = false,
  successMessage = 'Looks good!',
  className = '',
}) => {
  if (loading) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          marginTop: tokens.spacing[1],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.neutral[600],
        }}
      >
        <div
          style={{
            width: '12px',
            height: '12px',
            border: `2px solid ${tokens.colors.neutral[300]}`,
            borderTop: `2px solid ${tokens.colors.primary[500]}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span>Validating...</span>
      </div>
    );
  }

  if (errors.length > 0) {
    return (
      <div className={className} style={{ marginTop: tokens.spacing[1] }}>
        {errors.map((error, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: tokens.spacing[2],
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.error[600],
              marginBottom: errors.length > 1 ? tokens.spacing[1] : 0,
            }}
          >
            <span style={{ marginTop: '1px' }}>❌</span>
            <span>{error}</span>
          </div>
        ))}
      </div>
    );
  }

  if (warnings.length > 0) {
    return (
      <div className={className} style={{ marginTop: tokens.spacing[1] }}>
        {warnings.map((warning, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: tokens.spacing[2],
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.warning[600],
              marginBottom: warnings.length > 1 ? tokens.spacing[1] : 0,
            }}
          >
            <span style={{ marginTop: '1px' }}>⚠️</span>
            <span>{warning}</span>
          </div>
        ))}
      </div>
    );
  }

  if (showSuccess && isValid) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          marginTop: tokens.spacing[1],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.success[600],
        }}
      >
        <span>✅</span>
        <span>{successMessage}</span>
      </div>
    );
  }

  return null;
};

interface RealTimeValidationProps {
  fieldName: string;
  value: any;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  touched: boolean;
  loading?: boolean;
  className?: string;
}

export const RealTimeValidation: React.FC<RealTimeValidationProps> = ({
  fieldName,
  value,
  validation,
  touched,
  loading = false,
  className = '',
}) => {
  // Don't show validation feedback until field is touched or has errors
  if (!touched && validation.isValid) {
    return null;
  }

  return (
    <ValidationFeedback
      isValid={validation.isValid}
      errors={validation.errors}
      warnings={validation.warnings}
      loading={loading}
      showSuccess={touched && validation.isValid && value}
      className={className}
    />
  );
};

interface ProgressiveValidationProps {
  steps: Array<{
    label: string;
    isValid: boolean;
    errors: string[];
    warnings: string[];
    completed: boolean;
  }>;
  currentStep: number;
  className?: string;
}

export const ProgressiveValidation: React.FC<ProgressiveValidationProps> = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.neutral[50],
        border: `1px solid ${tokens.colors.neutral[200]}`,
        borderRadius: tokens.borderRadius.md,
      }}
    >
      <h4
        style={{
          fontSize: tokens.typography.fontSize.base,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.neutral[900],
          margin: `0 0 ${tokens.spacing[3]} 0`,
        }}
      >
        Validation Progress
      </h4>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[2],
        }}
      >
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isPast = index < currentStep;
          const isFuture = index > currentStep;

          let statusIcon = '⭕';
          let statusColor = tokens.colors.neutral[400];

          if (step.completed && step.isValid) {
            statusIcon = '✅';
            statusColor = tokens.colors.success[600];
          } else if (step.completed && !step.isValid) {
            statusIcon = '❌';
            statusColor = tokens.colors.error[600];
          } else if (isActive) {
            statusIcon = '🔄';
            statusColor = tokens.colors.primary[600];
          }

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: tokens.spacing[3],
                opacity: isFuture ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  fontSize: '16px',
                  color: statusColor,
                  marginTop: '2px',
                }}
              >
                {statusIcon}
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: isActive
                      ? tokens.typography.fontWeight.semibold
                      : tokens.typography.fontWeight.normal,
                    color: isActive
                      ? tokens.colors.primary[700]
                      : tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[1],
                  }}
                >
                  {step.label}
                </div>

                {(isActive || step.completed) && (
                  <ValidationFeedback
                    isValid={step.isValid}
                    errors={step.errors}
                    warnings={step.warnings}
                    showSuccess={step.completed && step.isValid}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ValidationTooltipProps {
  children: React.ReactNode;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  show: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const ValidationTooltip: React.FC<ValidationTooltipProps> = ({
  children,
  validation,
  show,
  position = 'top',
  className = '',
}) => {
  if (!show || (validation.isValid && validation.warnings.length === 0)) {
    return <>{children}</>;
  }

  const tooltipContent = [
    ...validation.errors.map(error => ({ type: 'error', message: error })),
    ...validation.warnings.map(warning => ({
      type: 'warning',
      message: warning,
    })),
  ];

  const positionStyles = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: tokens.spacing[2],
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: tokens.spacing[2],
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: tokens.spacing[2],
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: tokens.spacing[2],
    },
  };

  return (
    <div
      className={className}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {children}

      <div
        style={{
          position: 'absolute',
          zIndex: 1000,
          minWidth: '200px',
          maxWidth: '300px',
          padding: tokens.spacing[3],
          backgroundColor: 'white',
          border: `1px solid ${validation.errors.length > 0 ? tokens.colors.error[300] : tokens.colors.warning[300]}`,
          borderRadius: tokens.borderRadius.md,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          fontSize: tokens.typography.fontSize.sm,
          ...positionStyles[position],
        }}
      >
        {tooltipContent.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: tokens.spacing[2],
              color:
                item.type === 'error'
                  ? tokens.colors.error[700]
                  : tokens.colors.warning[700],
              marginBottom:
                index < tooltipContent.length - 1 ? tokens.spacing[2] : 0,
            }}
          >
            <span style={{ marginTop: '1px' }}>
              {item.type === 'error' ? '❌' : '⚠️'}
            </span>
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
