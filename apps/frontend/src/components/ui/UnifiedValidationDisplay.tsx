/**
 * Enhanced validation error display components for unified forms
 * Provides comprehensive error display with field-level and form-level feedback
 */

import React from 'react';
import { AlertTriangle, AlertCircle, Info, X, CheckCircle } from 'lucide-react';
import { UnifiedFormValidationErrors } from '@booking-swap/shared';
import { tokens } from '@/design-system/tokens';

export interface ValidationErrorDisplayProps {
  error?: string;
  errors?: string[];
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'error' | 'warning' | 'info';
}

export interface ValidationSummaryProps {
  errors: UnifiedFormValidationErrors;
  warnings?: Record<string, string>;
  showFieldNames?: boolean;
  maxErrors?: number;
  className?: string;
}

export interface FieldValidationDisplayProps {
  fieldName: string;
  error?: string;
  warning?: string;
  isValidating?: boolean;
  showValidIcon?: boolean;
  className?: string;
}

export interface ValidationTooltipProps {
  error?: string;
  warning?: string;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Individual validation error display component
 */
export const ValidationErrorDisplay: React.FC<ValidationErrorDisplayProps> = ({
  error,
  errors,
  showIcon = true,
  className = '',
  size = 'md',
  variant = 'error',
}) => {
  const errorList = errors || (error ? [error] : []);
  
  if (errorList.length === 0) {
    return null;
  }

  const getIcon = () => {
    switch (variant) {
      case 'error':
        return <AlertCircle className="validation-error__icon" />;
      case 'warning':
        return <AlertTriangle className="validation-warning__icon" />;
      case 'info':
        return <Info className="validation-info__icon" />;
      default:
        return <AlertCircle className="validation-error__icon" />;
    }
  };

  const baseClasses = `validation-display validation-display--${variant} validation-display--${size}`;
  const classes = `${baseClasses} ${className}`.trim();

  return (
    <div className={classes} role="alert" aria-live="polite">
      {showIcon && (
        <div className="validation-display__icon">
          {getIcon()}
        </div>
      )}
      <div className="validation-display__content">
        {errorList.length === 1 ? (
          <span className="validation-display__message">{errorList[0]}</span>
        ) : (
          <ul className="validation-display__list">
            {errorList.map((err, index) => (
              <li key={index} className="validation-display__item">
                {err}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * Field-level validation display with loading state
 */
export const FieldValidationDisplay: React.FC<FieldValidationDisplayProps> = ({
  fieldName,
  error,
  warning,
  isValidating = false,
  showValidIcon = false,
  className = '',
}) => {
  const hasError = Boolean(error);
  const hasWarning = Boolean(warning && !error);
  const isValid = !hasError && !hasWarning && !isValidating;

  if (!hasError && !hasWarning && !isValidating && !showValidIcon) {
    return null;
  }

  return (
    <div className={`field-validation ${className}`.trim()}>
      {isValidating && (
        <div className="field-validation__loading" aria-label={`Validating ${fieldName}`}>
          <div className="field-validation__spinner" />
          <span className="field-validation__loading-text">Validating...</span>
        </div>
      )}
      
      {hasError && (
        <ValidationErrorDisplay
          error={error}
          variant="error"
          size="sm"
          className="field-validation__error"
        />
      )}
      
      {hasWarning && (
        <ValidationErrorDisplay
          error={warning}
          variant="warning"
          size="sm"
          className="field-validation__warning"
        />
      )}
      
      {isValid && showValidIcon && (
        <div className="field-validation__success" aria-label={`${fieldName} is valid`}>
          <CheckCircle className="field-validation__success-icon" />
          <span className="sr-only">Valid</span>
        </div>
      )}
    </div>
  );
};

/**
 * Form-level validation summary component
 */
export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  warnings = {},
  showFieldNames = true,
  maxErrors = 5,
  className = '',
}) => {
  const errorEntries = Object.entries(errors).filter(([, message]) => message);
  const warningEntries = Object.entries(warnings).filter(([, message]) => message);
  
  if (errorEntries.length === 0 && warningEntries.length === 0) {
    return null;
  }

  const formatFieldName = (fieldName: string): string => {
    // Convert camelCase and dot notation to readable format
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/\./g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const displayedErrors = errorEntries.slice(0, maxErrors);
  const remainingErrorCount = errorEntries.length - maxErrors;

  return (
    <div className={`validation-summary ${className}`.trim()} role="alert" aria-live="polite">
      {displayedErrors.length > 0 && (
        <div className="validation-summary__errors">
          <div className="validation-summary__header">
            <AlertCircle className="validation-summary__icon validation-summary__icon--error" />
            <h4 className="validation-summary__title">
              {displayedErrors.length === 1 ? 'Please fix this error:' : 'Please fix these errors:'}
            </h4>
          </div>
          <ul className="validation-summary__list">
            {displayedErrors.map(([field, message]) => (
              <li key={field} className="validation-summary__item validation-summary__item--error">
                {showFieldNames && (
                  <strong className="validation-summary__field-name">
                    {formatFieldName(field)}:
                  </strong>
                )}{' '}
                {message}
              </li>
            ))}
          </ul>
          {remainingErrorCount > 0 && (
            <div className="validation-summary__more">
              And {remainingErrorCount} more error{remainingErrorCount !== 1 ? 's' : ''}...
            </div>
          )}
        </div>
      )}

      {warningEntries.length > 0 && (
        <div className="validation-summary__warnings">
          <div className="validation-summary__header">
            <AlertTriangle className="validation-summary__icon validation-summary__icon--warning" />
            <h4 className="validation-summary__title">Warnings:</h4>
          </div>
          <ul className="validation-summary__list">
            {warningEntries.map(([field, message]) => (
              <li key={field} className="validation-summary__item validation-summary__item--warning">
                {showFieldNames && (
                  <strong className="validation-summary__field-name">
                    {formatFieldName(field)}:
                  </strong>
                )}{' '}
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Inline validation tooltip component
 */
export const ValidationTooltip: React.FC<ValidationTooltipProps> = ({
  error,
  warning,
  children,
  placement = 'top',
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const message = error || warning;
  const variant = error ? 'error' : 'warning';

  if (!message) {
    return <>{children}</>;
  }

  return (
    <div 
      className="validation-tooltip"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div 
          className={`validation-tooltip__content validation-tooltip__content--${placement} validation-tooltip__content--${variant}`}
          role="tooltip"
          aria-live="polite"
        >
          <div className="validation-tooltip__arrow" />
          <div className="validation-tooltip__message">{message}</div>
        </div>
      )}
    </div>
  );
};

/**
 * Validation progress indicator for multi-step forms
 */
export interface ValidationProgressProps {
  totalFields: number;
  validFields: number;
  errorFields: number;
  className?: string;
}

export const ValidationProgress: React.FC<ValidationProgressProps> = ({
  totalFields,
  validFields,
  errorFields,
  className = '',
}) => {
  const progressPercentage = totalFields > 0 ? (validFields / totalFields) * 100 : 0;
  const errorPercentage = totalFields > 0 ? (errorFields / totalFields) * 100 : 0;

  return (
    <div className={`validation-progress ${className}`.trim()}>
      <div className="validation-progress__header">
        <span className="validation-progress__label">Form Completion</span>
        <span className="validation-progress__stats">
          {validFields}/{totalFields} fields valid
        </span>
      </div>
      <div className="validation-progress__bar">
        <div 
          className="validation-progress__fill validation-progress__fill--valid"
          style={{ width: `${progressPercentage}%` }}
        />
        <div 
          className="validation-progress__fill validation-progress__fill--error"
          style={{ width: `${errorPercentage}%` }}
        />
      </div>
      {errorFields > 0 && (
        <div className="validation-progress__errors">
          {errorFields} field{errorFields !== 1 ? 's' : ''} need{errorFields === 1 ? 's' : ''} attention
        </div>
      )}
    </div>
  );
};

/**
 * Dismissible validation alert component
 */
export interface ValidationAlertProps {
  type: 'error' | 'warning' | 'info' | 'success';
  title?: string;
  message: string;
  onDismiss?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  className?: string;
}

export const ValidationAlert: React.FC<ValidationAlertProps> = ({
  type,
  title,
  message,
  onDismiss,
  actions = [],
  className = '',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle className="validation-alert__icon" />;
      case 'warning':
        return <AlertTriangle className="validation-alert__icon" />;
      case 'info':
        return <Info className="validation-alert__icon" />;
      case 'success':
        return <CheckCircle className="validation-alert__icon" />;
      default:
        return <Info className="validation-alert__icon" />;
    }
  };

  return (
    <div 
      className={`validation-alert validation-alert--${type} ${className}`.trim()}
      role="alert"
      aria-live="polite"
    >
      <div className="validation-alert__content">
        <div className="validation-alert__icon-container">
          {getIcon()}
        </div>
        <div className="validation-alert__text">
          {title && (
            <h4 className="validation-alert__title">{title}</h4>
          )}
          <p className="validation-alert__message">{message}</p>
        </div>
      </div>
      
      {(actions.length > 0 || onDismiss) && (
        <div className="validation-alert__actions">
          {actions.map((action, index) => (
            <button
              key={index}
              type="button"
              className={`validation-alert__action validation-alert__action--${action.variant || 'secondary'}`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
          {onDismiss && (
            <button
              type="button"
              className="validation-alert__dismiss"
              onClick={onDismiss}
              aria-label="Dismiss alert"
            >
              <X className="validation-alert__dismiss-icon" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};