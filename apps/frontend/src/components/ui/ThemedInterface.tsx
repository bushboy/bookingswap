import React from 'react';
import { InterfaceTheme, getThemeStyles } from '@/design-system/interface-themes';
import '@/design-system/interface-themes.css';

interface ThemedInterfaceProps {
  theme: InterfaceTheme;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ThemedInterface - Wrapper component that applies theme-specific styling and classes
 * 
 * Requirements addressed:
 * - 3.1: Distinct visual styling for booking-focused functionality
 * - 3.2: Distinct visual styling for swap-focused functionality
 * - 3.6: Clear page titles and context indicators
 */
export const ThemedInterface: React.FC<ThemedInterfaceProps> = ({
  theme,
  children,
  className = '',
  style = {},
}) => {
  const themeStyles = getThemeStyles(theme);
  const interfaceClass = `${theme.name}-interface`;

  return (
    <div
      className={`${interfaceClass} ${className}`}
      style={{
        ...themeStyles.pageContainer,
        ...style,
      }}
    >
      {children}
    </div>
  );
};