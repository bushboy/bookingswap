import React from 'react';
import { tokens } from '@/design-system/tokens';

export interface PasswordStrengthCriteria {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface PasswordStrengthValidatorProps {
  password: string;
  onStrengthChange?: (strength: number, isValid: boolean) => void;
  showProgress?: boolean;
  className?: string;
}

export const PasswordStrengthValidator: React.FC<PasswordStrengthValidatorProps> = ({
  password,
  onStrengthChange,
  showProgress = true,
  className = '',
}) => {
  const criteria: PasswordStrengthCriteria = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const criteriaList = [
    { key: 'minLength', label: 'At least 8 characters', met: criteria.minLength },
    { key: 'hasLowercase', label: 'One lowercase letter (a-z)', met: criteria.hasLowercase },
    { key: 'hasUppercase', label: 'One uppercase letter (A-Z)', met: criteria.hasUppercase },
    { key: 'hasNumber', label: 'One number (0-9)', met: criteria.hasNumber },
    { key: 'hasSpecialChar', label: 'One special character (!@#$%^&*)', met: criteria.hasSpecialChar },
  ];

  const metCriteria = criteriaList.filter(c => c.met).length;
  const totalCriteria = criteriaList.length;
  const strengthPercentage = (metCriteria / totalCriteria) * 100;
  const isValid = metCriteria === totalCriteria;

  // Notify parent of strength changes
  React.useEffect(() => {
    onStrengthChange?.(strengthPercentage, isValid);
  }, [strengthPercentage, isValid, onStrengthChange]);

  const getStrengthColor = () => {
    if (strengthPercentage < 40) return tokens.colors.error[500];
    if (strengthPercentage < 80) return tokens.colors.warning[500];
    return tokens.colors.success[500];
  };

  const getStrengthLabel = () => {
    if (strengthPercentage < 40) return 'Weak';
    if (strengthPercentage < 80) return 'Fair';
    return 'Strong';
  };

  if (!password) return null;

  return (
    <div 
      className={className}
      role="region"
      aria-label="Password strength requirements"
    >
      {showProgress && (
        <div style={{ marginBottom: tokens.spacing[3] }}>
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
              Password Strength
            </span>
            <span style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: getStrengthColor(),
            }}>
              {getStrengthLabel()}
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: tokens.colors.neutral[200],
            borderRadius: tokens.borderRadius.full,
            overflow: 'hidden',
          }}>
            <div
              style={{
                width: `${strengthPercentage}%`,
                height: '100%',
                backgroundColor: getStrengthColor(),
                transition: 'all 0.3s ease-in-out',
                borderRadius: tokens.borderRadius.full,
              }}
              role="progressbar"
              aria-valuenow={strengthPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Password strength: ${Math.round(strengthPercentage)}%`}
            />
          </div>
        </div>
      )}

      <div style={{ marginBottom: tokens.spacing[2] }}>
        <span style={{
          fontSize: tokens.typography.fontSize.sm,
          fontWeight: tokens.typography.fontWeight.medium,
          color: tokens.colors.neutral[700],
        }}>
          Password Requirements:
        </span>
      </div>

      <ul 
        style={{ 
          listStyle: 'none', 
          padding: 0, 
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[1],
        }}
        role="list"
        aria-label="Password requirements checklist"
      >
        {criteriaList.map((criterion) => (
          <li
            key={criterion.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[2],
              fontSize: tokens.typography.fontSize.sm,
              color: criterion.met ? tokens.colors.success[600] : tokens.colors.neutral[500],
              transition: 'color 0.2s ease-in-out',
            }}
            role="listitem"
          >
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: criterion.met ? tokens.colors.success[500] : tokens.colors.neutral[300],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'white',
                transition: 'all 0.2s ease-in-out',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {criterion.met ? '✓' : ''}
            </span>
            <span>
              {criterion.label}
            </span>
            <span className="sr-only">
              {criterion.met ? 'Requirement met' : 'Requirement not met'}
            </span>
          </li>
        ))}
      </ul>

      {isValid && (
        <div
          style={{
            marginTop: tokens.spacing[3],
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.success[50],
            border: `1px solid ${tokens.colors.success[200]}`,
            borderRadius: tokens.borderRadius.md,
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
          }}
          role="status"
          aria-live="polite"
        >
          <span style={{ color: tokens.colors.success[600], fontSize: '16px' }}>✅</span>
          <span style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.success[700],
            fontWeight: tokens.typography.fontWeight.medium,
          }}>
            Password meets all requirements!
          </span>
        </div>
      )}
    </div>
  );
};