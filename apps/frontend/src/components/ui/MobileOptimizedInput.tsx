import React, { forwardRef } from 'react';
import { tokens } from '@/design-system/tokens';
import { useResponsive, useTouch } from '@/hooks/useResponsive';

interface MobileOptimizedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'mobile-optimized';
  touchOptimized?: boolean;
}

/**
 * Mobile-optimized input component with enhanced touch interactions
 * and improved accessibility for mobile devices
 */
export const MobileOptimizedInput = forwardRef<HTMLInputElement, MobileOptimizedInputProps>(
  ({ 
    label, 
    error, 
    helperText, 
    variant = 'default',
    touchOptimized = true,
    className,
    style,
    ...props 
  }, ref) => {
    const { isMobile, isTablet } = useResponsive();
    const isTouch = useTouch();
    
    const shouldOptimize = touchOptimized && (isMobile || isTouch);
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const inputStyles: React.CSSProperties = {
      width: '100%',
      padding: shouldOptimize 
        ? `${tokens.spacing[4]} ${tokens.spacing[4]}` // Larger padding for touch
        : `${tokens.spacing[3]} ${tokens.spacing[4]}`,
      fontSize: shouldOptimize 
        ? tokens.typography.fontSize.lg // Larger text for mobile readability
        : tokens.typography.fontSize.base,
      lineHeight: tokens.typography.lineHeight.normal,
      border: `1px solid ${error ? tokens.colors.error[400] : tokens.colors.neutral[300]}`,
      borderRadius: tokens.borderRadius.md,
      backgroundColor: 'white',
      color: tokens.colors.neutral[900],
      outline: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      
      // Touch-specific optimizations
      ...(shouldOptimize && {
        minHeight: '44px', // Minimum touch target size
        WebkitAppearance: 'none', // Remove default iOS styling
        WebkitTapHighlightColor: 'transparent',
        // Prevent zoom on iOS when focusing inputs
        ...(props.type !== 'date' && props.type !== 'time' && {
          fontSize: '16px', // Prevents iOS zoom
        }),
      }),

      // Focus styles
      ':focus': {
        borderColor: tokens.colors.primary[500],
        boxShadow: `0 0 0 3px ${tokens.colors.primary[100]}`,
      },

      // Error styles
      ...(error && {
        borderColor: tokens.colors.error[400],
        backgroundColor: tokens.colors.error[50],
      }),

      // Disabled styles
      ...(props.disabled && {
        backgroundColor: tokens.colors.neutral[100],
        color: tokens.colors.neutral[500],
        cursor: 'not-allowed',
      }),

      ...style,
    };

    const labelStyles: React.CSSProperties = {
      display: 'block',
      fontSize: shouldOptimize 
        ? tokens.typography.fontSize.base 
        : tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      color: error ? tokens.colors.error[700] : tokens.colors.neutral[700],
      marginBottom: tokens.spacing[2],
      // Ensure labels are touch-friendly
      ...(shouldOptimize && {
        minHeight: '24px',
        display: 'flex',
        alignItems: 'center',
      }),
    };

    const helperTextStyles: React.CSSProperties = {
      fontSize: shouldOptimize 
        ? tokens.typography.fontSize.sm 
        : tokens.typography.fontSize.xs,
      color: error ? tokens.colors.error[600] : tokens.colors.neutral[600],
      marginTop: tokens.spacing[1],
      lineHeight: tokens.typography.lineHeight.relaxed,
    };

    return (
      <div style={{ marginBottom: tokens.spacing[4] }}>
        {label && (
          <label htmlFor={inputId} style={labelStyles}>
            {label}
            {props.required && (
              <span style={{ 
                color: tokens.colors.error[500], 
                marginLeft: tokens.spacing[1] 
              }}>
                *
              </span>
            )}
          </label>
        )}
        
        <input
          ref={ref}
          id={inputId}
          style={inputStyles}
          className={className}
          // Mobile-specific attributes
          {...(shouldOptimize && {
            autoComplete: props.autoComplete || 'off',
            autoCapitalize: props.autoCapitalize || 'none',
            autoCorrect: props.autoCorrect || 'off',
            spellCheck: props.spellCheck || false,
          })}
          {...props}
        />
        
        {(error || helperText) && (
          <div style={helperTextStyles}>
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

MobileOptimizedInput.displayName = 'MobileOptimizedInput';

/**
 * Mobile-optimized textarea component
 */
interface MobileOptimizedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  touchOptimized?: boolean;
  autoResize?: boolean;
}

export const MobileOptimizedTextarea = forwardRef<HTMLTextAreaElement, MobileOptimizedTextareaProps>(
  ({ 
    label, 
    error, 
    helperText, 
    touchOptimized = true,
    autoResize = false,
    style,
    ...props 
  }, ref) => {
    const { isMobile } = useResponsive();
    const isTouch = useTouch();
    
    const shouldOptimize = touchOptimized && (isMobile || isTouch);
    const textareaId = props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const textareaStyles: React.CSSProperties = {
      width: '100%',
      padding: shouldOptimize 
        ? `${tokens.spacing[4]} ${tokens.spacing[4]}`
        : `${tokens.spacing[3]} ${tokens.spacing[4]}`,
      fontSize: shouldOptimize 
        ? '16px' // Prevents iOS zoom
        : tokens.typography.fontSize.base,
      lineHeight: tokens.typography.lineHeight.relaxed,
      border: `1px solid ${error ? tokens.colors.error[400] : tokens.colors.neutral[300]}`,
      borderRadius: tokens.borderRadius.md,
      backgroundColor: 'white',
      color: tokens.colors.neutral[900],
      outline: 'none',
      fontFamily: 'inherit',
      minHeight: shouldOptimize ? '100px' : '120px',
      resize: shouldOptimize ? 'none' : 'vertical',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      
      // Touch-specific optimizations
      ...(shouldOptimize && {
        WebkitAppearance: 'none',
        WebkitTapHighlightColor: 'transparent',
      }),

      // Auto-resize functionality
      ...(autoResize && {
        resize: 'none',
        overflow: 'hidden',
      }),

      // Error styles
      ...(error && {
        borderColor: tokens.colors.error[400],
        backgroundColor: tokens.colors.error[50],
      }),

      ...style,
    };

    const labelStyles: React.CSSProperties = {
      display: 'block',
      fontSize: shouldOptimize 
        ? tokens.typography.fontSize.base 
        : tokens.typography.fontSize.sm,
      fontWeight: tokens.typography.fontWeight.medium,
      color: error ? tokens.colors.error[700] : tokens.colors.neutral[700],
      marginBottom: tokens.spacing[2],
    };

    const helperTextStyles: React.CSSProperties = {
      fontSize: shouldOptimize 
        ? tokens.typography.fontSize.sm 
        : tokens.typography.fontSize.xs,
      color: error ? tokens.colors.error[600] : tokens.colors.neutral[600],
      marginTop: tokens.spacing[1],
      lineHeight: tokens.typography.lineHeight.relaxed,
    };

    return (
      <div style={{ marginBottom: tokens.spacing[4] }}>
        {label && (
          <label htmlFor={textareaId} style={labelStyles}>
            {label}
            {props.required && (
              <span style={{ 
                color: tokens.colors.error[500], 
                marginLeft: tokens.spacing[1] 
              }}>
                *
              </span>
            )}
          </label>
        )}
        
        <textarea
          ref={ref}
          id={textareaId}
          style={textareaStyles}
          // Mobile-specific attributes
          {...(shouldOptimize && {
            autoComplete: 'off',
            autoCapitalize: 'sentences',
            autoCorrect: 'on',
            spellCheck: true,
          })}
          {...props}
        />
        
        {(error || helperText) && (
          <div style={helperTextStyles}>
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

MobileOptimizedTextarea.displayName = 'MobileOptimizedTextarea';