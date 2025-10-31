import React from 'react';
import { tokens } from '@/design-system/tokens';

interface LogoProps {
  variant?: 'light' | 'dark' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({
  variant = 'light',
  size = 'md',
  className = '',
  showText = true,
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const LogoIcon = () => (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield background */}
      <path
        d="M16 3L6 8V14C6 20 11 26 16 29C21 26 26 20 26 14V8L16 3Z"
        fill={variant === 'dark' ? '#334e68' : '#1e3a5f'}
      />

      {/* Swap arrows background */}
      <path
        d="M12 9L16 6L20 9L18 9L18 12L22 12L22 14L18 14L18 17L20 17L16 20L12 17L14 17L14 14L10 14L10 12L14 12L14 9L12 9Z"
        fill="#f4c430"
      />

      {/* Clock circle */}
      <circle
        cx="16"
        cy="14"
        r="4"
        fill="#f4c430"
        stroke={variant === 'dark' ? '#334e68' : '#1e3a5f'}
        strokeWidth="0.5"
      />

      {/* Checkmark */}
      <path
        d="M14 14L15 15L18 12"
        stroke={variant === 'dark' ? '#334e68' : '#1e3a5f'}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!showText) {
    return <LogoIcon />;
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[3] }}
      className={className}
    >
      <LogoIcon />
      <span
        style={{
          fontWeight: tokens.typography.fontWeight.bold,
          fontSize: textSizeClasses[size],
          color: variant === 'dark' ? '#ffffff' : tokens.colors.primary[800],
        }}
      >
        Booking Swap
      </span>
    </div>
  );
};

export default Logo;
