import React from 'react';
import { tokens } from '@/design-system/tokens';
import { BreadcrumbItem, InterfaceTheme } from '@/design-system/interface-themes';

interface BreadcrumbNavigationProps {
  items: BreadcrumbItem[];
  theme: InterfaceTheme;
  onNavigate?: (path: string) => void;
}

/**
 * BreadcrumbNavigation - Provides contextual navigation breadcrumbs
 * 
 * Requirements addressed:
 * - 3.3: Clear breadcrumbs and navigation indicators
 * - 3.6: Clear page titles and context indicators
 */
export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  items,
  theme,
  onNavigate,
}) => {
  const handleNavigate = (item: BreadcrumbItem) => {
    if (item.path && onNavigate) {
      onNavigate(item.path);
    }
  };

  return (
    <nav 
      style={{
        marginBottom: tokens.spacing[6],
        padding: `${tokens.spacing[3]} 0`,
      }}
      aria-label="Breadcrumb navigation"
    >
      <ol style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        margin: 0,
        padding: 0,
        listStyle: 'none',
        fontSize: tokens.typography.fontSize.sm,
      }}>
        {items.map((item, index) => (
          <li key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
          }}>
            {index > 0 && (
              <span style={{
                color: tokens.colors.neutral[400],
                fontSize: tokens.typography.fontSize.xs,
              }}>
                /
              </span>
            )}
            
            {item.current ? (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                color: theme.colors.text,
                fontWeight: tokens.typography.fontWeight.medium,
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                backgroundColor: theme.colors.accentLight,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: tokens.borderRadius.md,
              }}>
                {item.icon && (
                  <span style={{ fontSize: tokens.typography.fontSize.sm }}>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => handleNavigate(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                  background: 'none',
                  border: 'none',
                  color: theme.colors.primary,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: tokens.typography.fontSize.sm,
                  padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                  borderRadius: tokens.borderRadius.sm,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.accentLight;
                  e.currentTarget.style.textDecoration = 'none';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
              >
                {item.icon && (
                  <span style={{ fontSize: tokens.typography.fontSize.sm }}>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};