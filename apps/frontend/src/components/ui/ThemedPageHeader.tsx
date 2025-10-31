import React from 'react';
import { tokens } from '@/design-system/tokens';
import { InterfaceTheme, getThemeStyles } from '@/design-system/interface-themes';

interface ThemedPageHeaderProps {
  theme: InterfaceTheme;
  title: string;
  subtitle?: string;
  icon?: string;
  children?: React.ReactNode;
}

/**
 * ThemedPageHeader - Provides distinct visual headers for separated interfaces
 * 
 * Requirements addressed:
 * - 3.1: Distinct visual styling for booking-focused functionality
 * - 3.2: Distinct visual styling for swap-focused functionality
 * - 3.6: Clear page titles and context indicators
 */
export const ThemedPageHeader: React.FC<ThemedPageHeaderProps> = ({
  theme,
  title,
  subtitle,
  icon,
  children,
}) => {
  const themeStyles = getThemeStyles(theme);

  return (
    <div style={themeStyles.pageHeader}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: `0 ${tokens.spacing[6]}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: tokens.spacing[4],
        }}>
          <div>
            <h1 style={{
              fontSize: tokens.typography.fontSize['3xl'],
              fontWeight: tokens.typography.fontWeight.bold,
              color: tokens.colors.white,
              margin: 0,
              marginBottom: tokens.spacing[2],
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[3],
            }}>
              {icon && (
                <span style={{
                  fontSize: tokens.typography.fontSize['2xl'],
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                }}>
                  {icon}
                </span>
              )}
              {title}
            </h1>
            {subtitle && (
              <p style={{
                fontSize: tokens.typography.fontSize.lg,
                color: tokens.colors.white,
                opacity: 0.9,
                margin: 0,
                lineHeight: tokens.typography.lineHeight.relaxed,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {children && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[3],
            }}>
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};