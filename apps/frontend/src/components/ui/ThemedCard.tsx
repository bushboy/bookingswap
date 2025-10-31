import React from 'react';
import { tokens } from '@/design-system/tokens';
import { InterfaceTheme, getThemeStyles } from '@/design-system/interface-themes';

interface ThemedCardProps {
  theme: InterfaceTheme;
  title?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'elevated' | 'outlined';
}

/**
 * ThemedCard - Provides themed card components for separated interfaces
 * 
 * Requirements addressed:
 * - 3.1: Distinct visual styling for booking-focused functionality
 * - 3.2: Distinct visual styling for swap-focused functionality
 */
export const ThemedCard: React.FC<ThemedCardProps> = ({
  theme,
  title,
  icon,
  children,
  className,
  style,
  variant = 'default',
}) => {
  const themeStyles = getThemeStyles(theme);
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          ...themeStyles.card,
          boxShadow: theme.shadows.modal,
          transform: 'translateY(-2px)',
        };
      case 'outlined':
        return {
          ...themeStyles.card,
          borderWidth: '2px',
          boxShadow: 'none',
        };
      default:
        return themeStyles.card;
    }
  };

  return (
    <div
      className={`themed-card ${className || ''}`}
      style={{
        ...getVariantStyles(),
        padding: tokens.spacing[6],
        ...style,
      }}
    >
      {(title || icon) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[3],
          marginBottom: tokens.spacing[4],
          paddingBottom: tokens.spacing[3],
          borderBottom: `1px solid ${theme.colors.border}`,
        }}>
          {icon && (
            <span style={{
              fontSize: tokens.typography.fontSize.xl,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
            }}>
              {icon}
            </span>
          )}
          {title && (
            <h2 style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: theme.colors.text,
              margin: 0,
            }}>
              {title}
            </h2>
          )}
        </div>
      )}
      {children}
    </div>
  );
};