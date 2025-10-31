import React, { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useAccessibility';
import { tokens } from '../../design-system/tokens';

interface FadeTransitionProps {
  show: boolean;
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  onEnter?: () => void;
  onExit?: () => void;
}

export const FadeTransition: React.FC<FadeTransitionProps> = ({
  show,
  children,
  duration = 300,
  delay = 0,
  onEnter,
  onExit
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      setTimeout(() => {
        setIsVisible(true);
        onEnter?.();
      }, delay);
    } else {
      setIsVisible(false);
      onExit?.();
      setTimeout(() => {
        setShouldRender(false);
      }, prefersReducedMotion ? 0 : duration);
    }
  }, [show, delay, duration, prefersReducedMotion, onEnter, onExit]);

  if (!shouldRender) {
    return null;
  }

  const styles: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transition: prefersReducedMotion 
      ? 'none' 
      : `opacity ${duration}ms ease-in-out`,
  };

  return (
    <div style={styles}>
      {children}
    </div>
  );
};

interface SlideTransitionProps {
  show: boolean;
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  distance?: string;
}

export const SlideTransition: React.FC<SlideTransitionProps> = ({
  show,
  children,
  direction = 'up',
  duration = 300,
  distance = '20px'
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), prefersReducedMotion ? 0 : duration);
    }
  }, [show, duration, prefersReducedMotion]);

  if (!shouldRender) {
    return null;
  }

  const getTransform = () => {
    if (prefersReducedMotion) return 'none';
    
    const translateMap = {
      up: `translateY(${isVisible ? '0' : distance})`,
      down: `translateY(${isVisible ? '0' : `-${distance}`})`,
      left: `translateX(${isVisible ? '0' : distance})`,
      right: `translateX(${isVisible ? '0' : `-${distance}`})`
    };
    
    return translateMap[direction];
  };

  const styles: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: getTransform(),
    transition: prefersReducedMotion 
      ? 'none' 
      : `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
  };

  return (
    <div style={styles}>
      {children}
    </div>
  );
};

interface ScaleTransitionProps {
  show: boolean;
  children: React.ReactNode;
  duration?: number;
  scale?: number;
}

export const ScaleTransition: React.FC<ScaleTransitionProps> = ({
  show,
  children,
  duration = 200,
  scale = 0.95
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), prefersReducedMotion ? 0 : duration);
    }
  }, [show, duration, prefersReducedMotion]);

  if (!shouldRender) {
    return null;
  }

  const styles: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: prefersReducedMotion 
      ? 'none' 
      : `scale(${isVisible ? 1 : scale})`,
    transition: prefersReducedMotion 
      ? 'none' 
      : `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
  };

  return (
    <div style={styles}>
      {children}
    </div>
  );
};

interface StaggeredListProps {
  children: React.ReactNode[];
  show: boolean;
  staggerDelay?: number;
  itemDuration?: number;
}

export const StaggeredList: React.FC<StaggeredListProps> = ({
  children,
  show,
  staggerDelay = 100,
  itemDuration = 300
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [visibleItems, setVisibleItems] = useState<boolean[]>(
    new Array(children.length).fill(false)
  );

  useEffect(() => {
    if (show) {
      children.forEach((_, index) => {
        setTimeout(() => {
          setVisibleItems(prev => {
            const newState = [...prev];
            newState[index] = true;
            return newState;
          });
        }, prefersReducedMotion ? 0 : index * staggerDelay);
      });
    } else {
      setVisibleItems(new Array(children.length).fill(false));
    }
  }, [show, children.length, staggerDelay, prefersReducedMotion]);

  return (
    <div>
      {children.map((child, index) => (
        <div
          key={index}
          style={{
            opacity: visibleItems[index] ? 1 : 0,
            transform: prefersReducedMotion 
              ? 'none' 
              : `translateY(${visibleItems[index] ? '0' : '20px'})`,
            transition: prefersReducedMotion 
              ? 'none' 
              : `opacity ${itemDuration}ms ease-out, transform ${itemDuration}ms ease-out`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

interface ProgressBarProps {
  progress: number; // 0-100
  animated?: boolean;
  color?: string;
  height?: string;
  showLabel?: boolean;
  label?: string;
  'aria-label'?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  animated = true,
  color = tokens.colors.primary[500],
  height = '8px',
  showLabel = false,
  label,
  'aria-label': ariaLabel = 'Progress'
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayProgress(progress);
    } else {
      const timer = setTimeout(() => {
        setDisplayProgress(progress);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [progress, prefersReducedMotion]);

  const containerStyles: React.CSSProperties = {
    width: '100%',
    height,
    backgroundColor: tokens.colors.neutral[200],
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
    position: 'relative'
  };

  const barStyles: React.CSSProperties = {
    height: '100%',
    backgroundColor: color,
    width: `${displayProgress}%`,
    transition: prefersReducedMotion || !animated 
      ? 'none' 
      : 'width 0.5s ease-out',
    borderRadius: tokens.borderRadius.full
  };

  return (
    <div>
      {showLabel && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing[2],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.neutral[700]
        }}>
          <span>{label || ariaLabel}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div
        style={containerStyles}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <div style={barStyles} />
      </div>
    </div>
  );
};

interface PulseAnimationProps {
  children: React.ReactNode;
  active?: boolean;
  color?: string;
  duration?: number;
}

export const PulseAnimation: React.FC<PulseAnimationProps> = ({
  children,
  active = true,
  color = tokens.colors.primary[500],
  duration = 2000
}) => {
  const prefersReducedMotion = useReducedMotion();

  const pulseStyles: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block'
  };

  const pulseRingStyles: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: `2px solid ${color}`,
    opacity: active && !prefersReducedMotion ? 1 : 0,
    animation: active && !prefersReducedMotion 
      ? `pulse-ring ${duration}ms ease-out infinite` 
      : 'none'
  };

  return (
    <>
      {active && !prefersReducedMotion && (
        <style>
          {`
            @keyframes pulse-ring {
              0% {
                transform: translate(-50%, -50%) scale(0.8);
                opacity: 1;
              }
              100% {
                transform: translate(-50%, -50%) scale(1.2);
                opacity: 0;
              }
            }
          `}
        </style>
      )}
      <div style={pulseStyles}>
        <div style={pulseRingStyles} />
        {children}
      </div>
    </>
  );
};

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  'aria-label'?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = tokens.colors.primary[500],
  'aria-label': ariaLabel = 'Loading'
}) => {
  const prefersReducedMotion = useReducedMotion();
  
  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '32px'
  };

  const spinnerStyles: React.CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    border: `2px solid ${tokens.colors.neutral[200]}`,
    borderTop: `2px solid ${color}`,
    borderRadius: '50%',
    animation: prefersReducedMotion ? 'none' : 'spin 1s linear infinite',
    display: 'inline-block'
  };

  return (
    <>
      {!prefersReducedMotion && (
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      )}
      <div
        style={spinnerStyles}
        role="status"
        aria-label={ariaLabel}
      >
        <span className="sr-only">{ariaLabel}</span>
      </div>
    </>
  );
};

// Specialized transition for proposal workflow steps
interface ProposalStepTransitionProps {
  currentStep: number;
  children: React.ReactNode[];
}

export const ProposalStepTransition: React.FC<ProposalStepTransitionProps> = ({
  currentStep,
  children
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [previousStep, setPreviousStep] = useState(currentStep);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (currentStep !== previousStep) {
      setIsTransitioning(true);
      setTimeout(() => {
        setPreviousStep(currentStep);
        setIsTransitioning(false);
      }, prefersReducedMotion ? 0 : 300);
    }
  }, [currentStep, previousStep, prefersReducedMotion]);

  const containerStyles: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    minHeight: '400px'
  };

  const stepStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: isTransitioning ? 0 : 1,
    transform: prefersReducedMotion 
      ? 'none' 
      : `translateX(${isTransitioning ? '20px' : '0'})`,
    transition: prefersReducedMotion 
      ? 'none' 
      : 'opacity 300ms ease-out, transform 300ms ease-out',
  };

  return (
    <div style={containerStyles}>
      <div style={stepStyles}>
        {children[currentStep]}
      </div>
    </div>
  );
};

// Accessibility-friendly focus ring animation
interface FocusRingProps {
  children: React.ReactNode;
  color?: string;
  offset?: string;
}

export const FocusRing: React.FC<FocusRingProps> = ({
  children,
  color = tokens.colors.primary[500],
  offset = '2px'
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const containerStyles: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    outline: isFocused ? `2px solid ${color}` : 'none',
    outlineOffset: offset,
    borderRadius: tokens.borderRadius.md,
    transition: 'outline 0.2s ease'
  };

  return (
    <div
      style={containerStyles}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {children}
    </div>
  );
};