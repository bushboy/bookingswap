import React, { useState, useEffect, useCallback } from 'react';
import { tokens } from '../../design-system/tokens';
import { useAnnouncements, useReducedMotion } from '../../hooks/useAccessibility';
import { SkeletonLoader } from './SkeletonLoader';
import { aria } from '../../utils/accessibility';

interface ProgressiveLoaderProps<T> {
  loadData: () => Promise<T>;
  renderContent: (data: T) => React.ReactNode;
  renderSkeleton: () => React.ReactNode;
  loadingMessage?: string;
  errorMessage?: string;
  retryMessage?: string;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
  delay?: number; // Minimum loading time to prevent flashing
  children?: React.ReactNode;
}

interface LoadingState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retryCount: number;
}

export function ProgressiveLoader<T>({
  loadData,
  renderContent,
  renderSkeleton,
  loadingMessage = 'Loading content',
  errorMessage = 'Failed to load content',
  retryMessage = 'Retry loading',
  onError,
  onSuccess,
  delay = 300,
  children
}: ProgressiveLoaderProps<T>) {
  const { announce } = useAnnouncements();
  const prefersReducedMotion = useReducedMotion();
  
  const [state, setState] = useState<LoadingState<T>>({
    data: null,
    loading: true,
    error: null,
    retryCount: 0
  });

  const loadDataWithDelay = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    const startTime = Date.now();
    
    try {
      const data = await loadData();
      
      // Ensure minimum loading time to prevent flashing
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, delay - elapsed);
      
      if (remainingDelay > 0 && !prefersReducedMotion) {
        await new Promise(resolve => setTimeout(resolve, remainingDelay));
      }
      
      setState(prev => ({ ...prev, data, loading: false, error: null }));
      onSuccess?.(data);
      announce('Content loaded successfully', 'polite');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: err,
        retryCount: prev.retryCount + 1
      }));
      onError?.(err);
      announce(`${errorMessage}. ${retryMessage} available.`, 'assertive');
    }
  }, [loadData, delay, prefersReducedMotion, onSuccess, onError, errorMessage, retryMessage, announce]);

  useEffect(() => {
    loadDataWithDelay();
  }, [loadDataWithDelay]);

  const handleRetry = () => {
    announce('Retrying to load content', 'polite');
    loadDataWithDelay();
  };

  if (state.loading) {
    return (
      <div role="status" aria-label={loadingMessage}>
        {renderSkeleton()}
        <div className="sr-only">{loadingMessage}</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div
        role="alert"
        style={{
          padding: tokens.spacing[4],
          border: `1px solid ${tokens.colors.error[300]}`,
          borderRadius: tokens.borderRadius.md,
          backgroundColor: tokens.colors.error[50],
          textAlign: 'center'
        }}
      >
        <div style={{
          fontSize: '48px',
          marginBottom: tokens.spacing[3]
        }}>
          ⚠️
        </div>
        <h3 style={{
          fontSize: tokens.typography.fontSize.lg,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.error[700],
          margin: `0 0 ${tokens.spacing[2]} 0`
        }}>
          {errorMessage}
        </h3>
        <p style={{
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.error[600],
          margin: `0 0 ${tokens.spacing[4]} 0`
        }}>
          {state.error.message}
        </p>
        <button
          onClick={handleRetry}
          style={{
            padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
            backgroundColor: tokens.colors.error[600],
            color: 'white',
            border: 'none',
            borderRadius: tokens.borderRadius.md,
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            cursor: 'pointer',
            minHeight: '44px', // Touch target
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = tokens.colors.error[700];
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = tokens.colors.error[600];
          }}
          aria-label={`${retryMessage}. Attempt ${state.retryCount + 1}`}
        >
          {retryMessage}
        </button>
      </div>
    );
  }

  if (state.data) {
    return <>{renderContent(state.data)}</>;
  }

  return null;
}

// Specialized progressive loaders for common use cases
interface EligibleSwapsLoaderProps {
  userId: string;
  targetSwapId: string;
  onSwapsLoaded?: (swaps: any[]) => void;
  children: (swaps: any[]) => React.ReactNode;
}

export const EligibleSwapsLoader: React.FC<EligibleSwapsLoaderProps> = ({
  userId,
  targetSwapId,
  onSwapsLoaded,
  children
}) => {
  const loadEligibleSwaps = useCallback(async () => {
    // Use the correct token key that matches the auth system
    const token = localStorage.getItem('auth_token') || localStorage.getItem('authToken');
    const response = await fetch(`/api/swaps/user/eligible?targetSwapId=${targetSwapId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load eligible swaps');
    }
    
    const data = await response.json();
    return data.eligibleSwaps || [];
  }, [targetSwapId]);

  return (
    <ProgressiveLoader
      loadData={loadEligibleSwaps}
      renderContent={children}
      renderSkeleton={() => (
        <div style={{ display: 'grid', gap: tokens.spacing[4] }}>
          {[1, 2, 3].map(i => (
            <div key={i}>
              <SkeletonLoader width="100%" height="120px" />
            </div>
          ))}
        </div>
      )}
      loadingMessage="Loading your eligible swaps"
      errorMessage="Failed to load eligible swaps"
      retryMessage="Retry loading swaps"
      onSuccess={onSwapsLoaded}
    />
  );
};

interface CompatibilityLoaderProps {
  sourceSwapId: string;
  targetSwapId: string;
  onAnalysisLoaded?: (analysis: any) => void;
  children: (analysis: any) => React.ReactNode;
}

export const CompatibilityLoader: React.FC<CompatibilityLoaderProps> = ({
  sourceSwapId,
  targetSwapId,
  onAnalysisLoaded,
  children
}) => {
  const loadCompatibility = useCallback(async () => {
    // Mock API call - replace with actual API
    const response = await fetch(`/api/swaps/${sourceSwapId}/compatibility/${targetSwapId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to analyze compatibility');
    }
    
    const data = await response.json();
    return data.compatibility;
  }, [sourceSwapId, targetSwapId]);

  return (
    <ProgressiveLoader
      loadData={loadCompatibility}
      renderContent={children}
      renderSkeleton={() => (
        <div style={{
          padding: tokens.spacing[4],
          border: `1px solid ${tokens.colors.neutral[200]}`,
          borderRadius: tokens.borderRadius.lg
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: tokens.spacing[4] 
          }}>
            <SkeletonLoader width="180px" height="20px" />
            <SkeletonLoader width="60px" height="28px" />
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: tokens.spacing[3]
          }}>
            {[1, 2, 3, 4, 5].map(i => (
              <SkeletonLoader key={i} width="100%" height="40px" />
            ))}
          </div>
        </div>
      )}
      loadingMessage="Analyzing swap compatibility"
      errorMessage="Failed to analyze compatibility"
      retryMessage="Retry analysis"
      onSuccess={onAnalysisLoaded}
      delay={800} // Longer delay for analysis to feel more substantial
    />
  );
};

// Progressive disclosure component for complex forms
interface ProgressiveDisclosureProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  level?: 'primary' | 'secondary';
}

export const ProgressiveDisclosure: React.FC<ProgressiveDisclosureProps> = ({
  title,
  children,
  defaultExpanded = false,
  onToggle,
  level = 'primary'
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { announce } = useAnnouncements();
  const prefersReducedMotion = useReducedMotion();
  
  const contentId = `disclosure-content-${Math.random().toString(36).substr(2, 9)}`;
  const buttonId = `disclosure-button-${Math.random().toString(36).substr(2, 9)}`;

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
    announce(
      `${title} section ${newExpanded ? 'expanded' : 'collapsed'}`,
      'polite'
    );
  };

  const buttonStyles: React.CSSProperties = {
    width: '100%',
    padding: tokens.spacing[3],
    backgroundColor: 'transparent',
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    fontSize: level === 'primary' 
      ? tokens.typography.fontSize.base 
      : tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'left',
    minHeight: '44px',
    transition: prefersReducedMotion ? 'none' : 'all 0.2s ease'
  };

  const contentStyles: React.CSSProperties = {
    overflow: 'hidden',
    transition: prefersReducedMotion ? 'none' : 'max-height 0.3s ease, opacity 0.3s ease',
    maxHeight: isExpanded ? '1000px' : '0',
    opacity: isExpanded ? 1 : 0,
    marginTop: isExpanded ? tokens.spacing[3] : 0
  };

  return (
    <div>
      <button
        id={buttonId}
        style={buttonStyles}
        onClick={handleToggle}
        {...aria.expandableSection(isExpanded, contentId)}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = tokens.colors.neutral[50];
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = `2px solid ${tokens.colors.primary[500]}`;
          e.currentTarget.style.outlineOffset = '2px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      >
        <span>{title}</span>
        <span
          style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
            fontSize: '18px'
          }}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      
      <div
        id={contentId}
        style={contentStyles}
        aria-labelledby={buttonId}
        role="region"
      >
        {isExpanded && (
          <div style={{ padding: `${tokens.spacing[3]} 0` }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
};