import React from 'react';
import { tokens } from '../../design-system/tokens';
import { useReducedMotion, useHighContrast } from '../../hooks/useAccessibility';

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = tokens.borderRadius.md,
  className,
  style,
  'aria-label': ariaLabel = 'Loading content'
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { isHighContrast } = useHighContrast();

  const skeletonStyles: React.CSSProperties = {
    width,
    height,
    borderRadius,
    backgroundColor: isHighContrast 
      ? '#333333' 
      : tokens.colors.neutral[200],
    position: 'relative',
    overflow: 'hidden',
    display: 'inline-block',
    ...style
  };

  // Animation styles (disabled for reduced motion preference)
  if (!prefersReducedMotion) {
    skeletonStyles.background = isHighContrast
      ? 'linear-gradient(90deg, #333333 25%, #555555 50%, #333333 75%)'
      : `linear-gradient(90deg, ${tokens.colors.neutral[200]} 25%, ${tokens.colors.neutral[300]} 50%, ${tokens.colors.neutral[200]} 75%)`;
    skeletonStyles.backgroundSize = '200% 100%';
    skeletonStyles.animation = 'skeleton-loading 1.5s ease-in-out infinite';
  }

  return (
    <>
      {/* CSS animation keyframes */}
      {!prefersReducedMotion && (
        <style>
          {`
            @keyframes skeleton-loading {
              0% {
                background-position: 200% 0;
              }
              100% {
                background-position: -200% 0;
              }
            }
          `}
        </style>
      )}
      
      <div
        className={className}
        style={skeletonStyles}
        role="status"
        aria-label={ariaLabel}
        aria-live="polite"
      />
    </>
  );
};

// Specialized skeleton components for common use cases
export const SwapCardSkeleton: React.FC = () => {
  return (
    <div
      style={{
        padding: tokens.spacing[4],
        border: `1px solid ${tokens.colors.neutral[200]}`,
        borderRadius: tokens.borderRadius.lg,
        backgroundColor: 'white'
      }}
      role="status"
      aria-label="Loading swap card"
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: tokens.spacing[4]
      }}>
        <SkeletonLoader width="120px" height="24px" aria-label="Loading status" />
        <SkeletonLoader width="80px" height="20px" aria-label="Loading date" />
      </div>

      {/* Swap direction indicator */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginBottom: tokens.spacing[4]
      }}>
        <SkeletonLoader width="100px" height="16px" aria-label="Loading swap direction" />
      </div>

      {/* Booking cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: tokens.spacing[4],
        marginBottom: tokens.spacing[4]
      }}>
        {[1, 2].map((index) => (
          <div
            key={index}
            style={{
              padding: tokens.spacing[3],
              border: `1px solid ${tokens.colors.neutral[200]}`,
              borderRadius: tokens.borderRadius.md
            }}
          >
            <SkeletonLoader width="60px" height="16px" style={{ marginBottom: tokens.spacing[2] }} />
            <SkeletonLoader width="100%" height="20px" style={{ marginBottom: tokens.spacing[2] }} />
            <SkeletonLoader width="80%" height="16px" style={{ marginBottom: tokens.spacing[2] }} />
            <SkeletonLoader width="60px" height="16px" />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ 
        display: 'flex', 
        gap: tokens.spacing[3], 
        justifyContent: 'flex-end' 
      }}>
        <SkeletonLoader width="100px" height="40px" borderRadius={tokens.borderRadius.md} />
        <SkeletonLoader width="120px" height="40px" borderRadius={tokens.borderRadius.md} />
      </div>
    </div>
  );
};

export const EligibleSwapSkeleton: React.FC = () => {
  return (
    <div
      style={{
        padding: tokens.spacing[4],
        border: `1px solid ${tokens.colors.neutral[200]}`,
        borderRadius: tokens.borderRadius.lg,
        backgroundColor: 'white'
      }}
      role="status"
      aria-label="Loading eligible swap"
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: tokens.spacing[3]
      }}>
        <div style={{ flex: 1 }}>
          <SkeletonLoader width="80%" height="20px" style={{ marginBottom: tokens.spacing[1] }} />
          <SkeletonLoader width="60%" height="16px" />
        </div>
        <SkeletonLoader width="20px" height="20px" borderRadius="50%" />
      </div>

      <div style={{ marginBottom: tokens.spacing[3] }}>
        {[1, 2, 3].map((index) => (
          <div key={index} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: tokens.spacing[2],
            marginBottom: tokens.spacing[1]
          }}>
            <SkeletonLoader width="16px" height="16px" />
            <SkeletonLoader width="120px" height="14px" />
          </div>
        ))}
      </div>

      <SkeletonLoader width="100%" height="32px" borderRadius={tokens.borderRadius.md} />
    </div>
  );
};

export const CompatibilityAnalysisSkeleton: React.FC = () => {
  return (
    <div
      style={{
        padding: tokens.spacing[4],
        border: `1px solid ${tokens.colors.neutral[200]}`,
        borderRadius: tokens.borderRadius.lg,
        backgroundColor: 'white'
      }}
      role="status"
      aria-label="Loading compatibility analysis"
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: tokens.spacing[4]
      }}>
        <SkeletonLoader width="180px" height="20px" />
        <SkeletonLoader width="60px" height="28px" borderRadius={tokens.borderRadius.full} />
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: tokens.spacing[3],
        marginBottom: tokens.spacing[4]
      }}>
        {[1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
              backgroundColor: tokens.colors.neutral[50],
              borderRadius: tokens.borderRadius.md,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <SkeletonLoader width="80px" height="14px" />
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
              <SkeletonLoader width="30px" height="14px" />
              <SkeletonLoader width="8px" height="8px" borderRadius="50%" />
            </div>
          </div>
        ))}
      </div>

      <div>
        <SkeletonLoader width="120px" height="16px" style={{ marginBottom: tokens.spacing[2] }} />
        {[1, 2, 3].map((index) => (
          <SkeletonLoader 
            key={index} 
            width="90%" 
            height="14px" 
            style={{ marginBottom: tokens.spacing[1] }} 
          />
        ))}
      </div>
    </div>
  );
};

export const ProposalFormSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading proposal form">
      {/* Swap comparison skeleton */}
      <div style={{ marginBottom: tokens.spacing[6] }}>
        <SkeletonLoader width="150px" height="24px" style={{ marginBottom: tokens.spacing[4] }} />
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: tokens.spacing[4]
        }}>
          {[1, 2].map((index) => (
            <div
              key={index}
              style={{
                padding: tokens.spacing[4],
                border: `1px solid ${tokens.colors.neutral[200]}`,
                borderRadius: tokens.borderRadius.lg
              }}
            >
              <SkeletonLoader width="80px" height="20px" style={{ marginBottom: tokens.spacing[3] }} />
              <SkeletonLoader width="100%" height="18px" style={{ marginBottom: tokens.spacing[2] }} />
              {[1, 2, 3, 4].map((i) => (
                <SkeletonLoader 
                  key={i} 
                  width="70%" 
                  height="14px" 
                  style={{ marginBottom: tokens.spacing[1] }} 
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Form fields skeleton */}
      <div style={{ marginBottom: tokens.spacing[4] }}>
        <SkeletonLoader width="120px" height="16px" style={{ marginBottom: tokens.spacing[2] }} />
        <SkeletonLoader width="100%" height="44px" borderRadius={tokens.borderRadius.md} />
      </div>

      <div style={{ marginBottom: tokens.spacing[4] }}>
        <SkeletonLoader width="100px" height="16px" style={{ marginBottom: tokens.spacing[2] }} />
        <SkeletonLoader width="100%" height="100px" borderRadius={tokens.borderRadius.md} />
      </div>

      {/* Action buttons skeleton */}
      <div style={{ 
        display: 'flex', 
        gap: tokens.spacing[3], 
        justifyContent: 'flex-end' 
      }}>
        <SkeletonLoader width="80px" height="44px" borderRadius={tokens.borderRadius.md} />
        <SkeletonLoader width="120px" height="44px" borderRadius={tokens.borderRadius.md} />
      </div>
    </div>
  );
};