import React, { useState } from 'react';
import { tokens } from '@/design-system/tokens';
import { InterfaceTheme, getThemeStyles } from '@/design-system/interface-themes';

interface ContextualHelpProps {
  theme: InterfaceTheme;
  title: string;
  icon: string;
  content: string | string[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * ContextualHelp - Provides interface-specific help content
 * 
 * Requirements addressed:
 * - 3.7: Context-appropriate help content for each interface
 * - 3.6: Clear page titles and context indicators
 */
export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  theme,
  title,
  icon,
  content,
  collapsible = true,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const themeStyles = getThemeStyles(theme);

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div style={{
      ...themeStyles.helpContent,
      marginBottom: tokens.spacing[6],
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: collapsible ? 'pointer' : 'default',
          marginBottom: isExpanded ? tokens.spacing[3] : 0,
        }}
        onClick={toggleExpanded}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
        }}>
          <span style={{
            fontSize: tokens.typography.fontSize.base,
          }}>
            {icon}
          </span>
          <h3 style={{
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.medium,
            color: theme.colors.text,
            margin: 0,
          }}>
            {title}
          </h3>
        </div>

        {collapsible && (
          <button
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.textSecondary,
              fontSize: tokens.typography.fontSize.sm,
              cursor: 'pointer',
              padding: tokens.spacing[1],
              borderRadius: tokens.borderRadius.sm,
              transition: 'all 0.2s ease',
            }}
            aria-label={isExpanded ? 'Collapse help' : 'Expand help'}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
      </div>

      {isExpanded && (
        <div style={{
          animation: 'fadeIn 0.2s ease-in-out',
        }}>
          <ul style={{
            margin: 0,
            paddingLeft: tokens.spacing[5],
            fontSize: tokens.typography.fontSize.sm,
            color: theme.colors.textSecondary,
            lineHeight: tokens.typography.lineHeight.relaxed,
          }}>
            {Array.isArray(content) ? content.map((item, index) => (
              <li key={index} style={{
                marginBottom: tokens.spacing[2],
              }}>
                {item}
              </li>
            )) : (
              <li style={{
                marginBottom: tokens.spacing[2],
              }}>
                {content}
              </li>
            )}
          </ul>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};