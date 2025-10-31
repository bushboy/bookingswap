import React from 'react';
import { Button } from './Button';
import { Card, CardContent, CardHeader } from './Card';
import { tokens } from '../../design-system/tokens';

// Validation error summary for forms
export interface ValidationErrorSummaryProps {
  errors: Record<string, string | string[]>;
  warnings?: Record<string, string | string[]>;
  title?: string;
  onFieldFocus?: (fieldName: string) => void;
  onDismiss?: () => void;
  maxErrors?: number;
  showFieldNames?: boolean;
  className?: string;
}

export const ValidationErrorSummary: React.FC<ValidationErrorSummaryProps> = ({
  errors,
  warnings = {},
  title = 'Please fix the following issues:',
  onFieldFocus,
  onDismiss,
  maxErrors = 10,
  showFieldNames = true,
  className = '',
}) => {
  const errorEntries = Object.entries(errors).filter(([, message]) => {
    if (Array.isArray(message)) {
      return message.length > 0;
    }
    return Boolean(message);
  });

  const warningEntries = Object.entries(warnings).filter(([, message]) => {
    if (Array.isArray(message)) {
      return message.length > 0;
    }
    return Boolean(message);
  });

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

  const formatMessages = (messages: string | string[]): string[] => {
    return Array.isArray(messages) ? messages : [messages];
  };

  const displayedErrors = errorEntries.slice(0, maxErrors);
  const remainingErrorCount = errorEntries.length - maxErrors;

  return (
    <Card 
      variant="outlined" 
      className={className}
      style={{
        backgroundColor: tokens.colors.error[50],
        borderColor: tokens.colors.error[200],
        marginBottom: tokens.spacing[4],
      }}
    >
      <CardHeader style={{ 
        padding: `${tokens.spacing[4]} ${tokens.spacing[4]} ${tokens.spacing[2]}`,
        borderBottom: `1px solid ${tokens.colors.error[200]}`,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
          }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <h4 style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.error[800],
              margin: 0,
            }}>
              {title}
            </h4>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.error[600],
                cursor: 'pointer',
                fontSize: '18px',
                padding: tokens.spacing[1],
              }}
              aria-label="Dismiss validation summary"
            >
              ×
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent style={{ padding: tokens.spacing[4] }}>
        {/* Errors */}
        {displayedErrors.length > 0 && (
          <div style={{ marginBottom: warningEntries.length > 0 ? tokens.spacing[4] : 0 }}>
            <ul style={{
              margin: 0,
              paddingLeft: tokens.spacing[4],
              listStyle: 'none',
            }}>
              {displayedErrors.map(([field, messages]) => {
                const messageList = formatMessages(messages);
                return (
                  <li key={field} style={{ marginBottom: tokens.spacing[3] }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: tokens.spacing[2],
                    }}>
                      <span style={{
                        color: tokens.colors.error[500],
                        fontSize: tokens.typography.fontSize.sm,
                        marginTop: '2px',
                        flexShrink: 0,
                      }}>
                        •
                      </span>
                      <div style={{ flex: 1 }}>
                        {onFieldFocus ? (
                          <button
                            onClick={() => onFieldFocus(field)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: tokens.colors.error[700],
                              cursor: 'pointer',
                              fontSize: tokens.typography.fontSize.sm,
                              textAlign: 'left',
                              padding: 0,
                              textDecoration: 'underline',
                              fontWeight: tokens.typography.fontWeight.medium,
                            }}
                            aria-label={`Focus on ${formatFieldName(field)} field`}
                          >
                            {showFieldNames && (
                              <strong>{formatFieldName(field)}: </strong>
                            )}
                            {messageList.join(', ')}
                          </button>
                        ) : (
                          <span style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.error[700],
                          }}>
                            {showFieldNames && (
                              <strong>{formatFieldName(field)}: </strong>
                            )}
                            {messageList.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {remainingErrorCount > 0 && (
              <div style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[600],
                fontStyle: 'italic',
                marginTop: tokens.spacing[2],
                paddingLeft: tokens.spacing[6],
              }}>
                And {remainingErrorCount} more error{remainingErrorCount !== 1 ? 's' : ''}...
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {warningEntries.length > 0 && (
          <div>
            <h5 style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.warning[700],
              margin: `0 0 ${tokens.spacing[2]} 0`,
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[2],
            }}>
              <span>⚡</span> Warnings:
            </h5>
            <ul style={{
              margin: 0,
              paddingLeft: tokens.spacing[4],
              listStyle: 'none',
            }}>
              {warningEntries.map(([field, messages]) => {
                const messageList = formatMessages(messages);
                return (
                  <li key={field} style={{ marginBottom: tokens.spacing[2] }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: tokens.spacing[2],
                    }}>
                      <span style={{
                        color: tokens.colors.warning[500],
                        fontSize: tokens.typography.fontSize.sm,
                        marginTop: '2px',
                        flexShrink: 0,
                      }}>
                        •
                      </span>
                      <div style={{ flex: 1 }}>
                        {onFieldFocus ? (
                          <button
                            onClick={() => onFieldFocus(field)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: tokens.colors.warning[700],
                              cursor: 'pointer',
                              fontSize: tokens.typography.fontSize.sm,
                              textAlign: 'left',
                              padding: 0,
                              textDecoration: 'underline',
                              fontWeight: tokens.typography.fontWeight.medium,
                            }}
                            aria-label={`Focus on ${formatFieldName(field)} field`}
                          >
                            {showFieldNames && (
                              <strong>{formatFieldName(field)}: </strong>
                            )}
                            {messageList.join(', ')}
                          </button>
                        ) : (
                          <span style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.warning[700],
                          }}>
                            {showFieldNames && (
                              <strong>{formatFieldName(field)}: </strong>
                            )}
                            {messageList.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Compact validation error display for inline use
export interface CompactValidationErrorsProps {
  errors: string[];
  warnings?: string[];
  maxDisplay?: number;
  className?: string;
}

export const CompactValidationErrors: React.FC<CompactValidationErrorsProps> = ({
  errors,
  warnings = [],
  maxDisplay = 3,
  className = '',
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  const displayedErrors = errors.slice(0, maxDisplay);
  const remainingCount = errors.length - maxDisplay;

  return (
    <div 
      className={className}
      style={{
        backgroundColor: tokens.colors.error[50],
        border: `1px solid ${tokens.colors.error[200]}`,
        borderRadius: tokens.borderRadius.md,
        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        marginTop: tokens.spacing[2],
      }}
      role="alert"
      aria-live="polite"
    >
      {displayedErrors.map((error, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.error[700],
            marginBottom: index < displayedErrors.length - 1 ? tokens.spacing[1] : 0,
          }}
        >
          <span style={{ marginTop: '2px', flexShrink: 0 }}>❌</span>
          <span>{error}</span>
        </div>
      ))}

      {remainingCount > 0 && (
        <div style={{
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.colors.error[600],
          fontStyle: 'italic',
          marginTop: tokens.spacing[1],
          paddingLeft: tokens.spacing[5],
        }}>
          +{remainingCount} more error{remainingCount !== 1 ? 's' : ''}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ marginTop: tokens.spacing[2] }}>
          {warnings.slice(0, 2).map((warning, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: tokens.spacing[2],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.warning[700],
                marginBottom: index < Math.min(warnings.length, 2) - 1 ? tokens.spacing[1] : 0,
              }}
            >
              <span style={{ marginTop: '2px', flexShrink: 0 }}>⚠️</span>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Progress indicator for form validation
export interface ValidationProgressProps {
  totalFields: number;
  validFields: number;
  errorFields: number;
  warningFields?: number;
  className?: string;
}

export const ValidationProgress: React.FC<ValidationProgressProps> = ({
  totalFields,
  validFields,
  errorFields,
  warningFields = 0,
  className = '',
}) => {
  if (totalFields === 0) {
    return null;
  }

  const validPercentage = (validFields / totalFields) * 100;
  const errorPercentage = (errorFields / totalFields) * 100;
  const warningPercentage = (warningFields / totalFields) * 100;

  return (
    <div className={className} style={{ marginBottom: tokens.spacing[4] }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: tokens.spacing[2],
      }}>
        <span style={{
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.neutral[700],
        }}>
          Form Validation Progress
        </span>
        <span style={{
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.neutral[600],
        }}>
          {validFields}/{totalFields} fields valid
        </span>
      </div>

      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: tokens.colors.neutral[200],
        borderRadius: tokens.borderRadius.full,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Valid fields */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${validPercentage}%`,
            backgroundColor: tokens.colors.success[500],
            transition: 'width 0.3s ease',
          }}
        />
        
        {/* Warning fields */}
        <div
          style={{
            position: 'absolute',
            left: `${validPercentage}%`,
            top: 0,
            height: '100%',
            width: `${warningPercentage}%`,
            backgroundColor: tokens.colors.warning[500],
            transition: 'width 0.3s ease, left 0.3s ease',
          }}
        />
        
        {/* Error fields */}
        <div
          style={{
            position: 'absolute',
            left: `${validPercentage + warningPercentage}%`,
            top: 0,
            height: '100%',
            width: `${errorPercentage}%`,
            backgroundColor: tokens.colors.error[500],
            transition: 'width 0.3s ease, left 0.3s ease',
          }}
        />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: tokens.spacing[2],
        fontSize: tokens.typography.fontSize.xs,
        color: tokens.colors.neutral[600],
      }}>
        <div style={{ display: 'flex', gap: tokens.spacing[4] }}>
          {validFields > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: tokens.colors.success[500],
                borderRadius: '50%',
              }} />
              <span>{validFields} valid</span>
            </div>
          )}
          
          {warningFields > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: tokens.colors.warning[500],
                borderRadius: '50%',
              }} />
              <span>{warningFields} warnings</span>
            </div>
          )}
          
          {errorFields > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: tokens.colors.error[500],
                borderRadius: '50%',
              }} />
              <span>{errorFields} errors</span>
            </div>
          )}
        </div>
        
        <span>
          {Math.round(validPercentage)}% complete
        </span>
      </div>
    </div>
  );
};