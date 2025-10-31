/**
 * Accessibility hooks specifically for swap-related components
 */

import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { useAriaLiveRegion } from './useAccessibility';
import {
  SwapFocusManager,
  SwapKeyboardNavigation,
  SwapHighContrastSupport,
  SwapScreenReader,
  swapAriaLabels,
} from '@/utils/swapAccessibility';

/**
 * Hook for managing swap preferences section accessibility
 */
export const useSwapPreferencesAccessibility = (
  enabled: boolean,
  onToggle: (enabled: boolean) => void
) => {
  const sectionId = useId('swap-preferences');
  const toggleId = useId('swap-toggle');
  const contentId = useId('swap-content');
  const { announce } = useAriaLiveRegion();

  const handleToggle = useCallback((newEnabled: boolean) => {
    onToggle(newEnabled);
    
    // Announce the change
    if (newEnabled) {
      announce('Swap preferences enabled. Configure your swap settings below.', 'polite');
    } else {
      announce('Swap preferences disabled. This booking will not be available for swapping.', 'polite');
    }
  }, [onToggle, announce]);

  const getToggleProps = useCallback(() => ({
    id: toggleId,
    'aria-describedby': `${sectionId}-description`,
    'aria-controls': contentId,
    'aria-expanded': enabled,
    'aria-label': swapAriaLabels.swapToggle,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleToggle(e.target.checked),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle(!enabled);
      }
    },
  }), [toggleId, sectionId, contentId, enabled, handleToggle]);

  const getSectionProps = useCallback(() => ({
    id: sectionId,
    role: 'region',
    'aria-labelledby': toggleId,
    'aria-label': swapAriaLabels.swapSection,
  }), [sectionId, toggleId]);

  const getContentProps = useCallback(() => ({
    id: contentId,
    'aria-labelledby': toggleId,
    'aria-hidden': !enabled,
    role: 'group',
  }), [contentId, toggleId, enabled]);

  return {
    sectionId,
    toggleId,
    contentId,
    getToggleProps,
    getSectionProps,
    getContentProps,
  };
};

/**
 * Hook for managing inline proposal form accessibility
 */
export const useInlineProposalAccessibility = (
  isOpen: boolean,
  onClose: () => void,
  bookingTitle: string
) => {
  const formId = useId('proposal-form');
  const titleId = useId('proposal-title');
  const { announce } = useAriaLiveRegion();
  const focusManager = SwapFocusManager.getInstance();
  const formRef = useRef<HTMLDivElement>(null);

  // Manage focus when form opens/closes
  useEffect(() => {
    if (isOpen) {
      focusManager.pushModal(formId);
      
      // Focus first interactive element
      if (formRef.current) {
        setTimeout(() => {
          focusManager.focusFirstInteractive(formRef.current!);
        }, 100);
      }
      
      announce(`Proposal form opened for ${bookingTitle}. Fill out the form to submit your swap proposal.`, 'polite');
    } else {
      focusManager.popModal();
    }
  }, [isOpen, formId, bookingTitle, announce, focusManager]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        onClose();
        announce('Proposal form closed', 'polite');
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose, announce]);

  const getFormProps = useCallback(() => ({
    ref: formRef,
    id: formId,
    role: 'dialog',
    'aria-labelledby': titleId,
    'aria-label': swapAriaLabels.proposalForm,
    'data-testid': 'inline-proposal-form',
  }), [formId, titleId]);

  const getTitleProps = useCallback(() => ({
    id: titleId,
    role: 'heading',
    'aria-level': 2,
  }), [titleId]);

  return {
    formId,
    titleId,
    formRef,
    getFormProps,
    getTitleProps,
  };
};

/**
 * Hook for managing proposal type selector accessibility
 */
export const useProposalTypeSelectorAccessibility = (
  options: Array<{ value: string; label: string; disabled: boolean }>,
  selected: string,
  onSelect: (value: string) => void
) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const groupId = useId('proposal-type-group');
  const { announce } = useAriaLiveRegion();

  // Find selected index
  useEffect(() => {
    const selectedIndex = options.findIndex(option => option.value === selected);
    if (selectedIndex !== -1) {
      setFocusedIndex(selectedIndex);
    }
  }, [selected, options]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    SwapKeyboardNavigation.handleProposalTypeNavigation(
      event.nativeEvent,
      options,
      focusedIndex,
      setFocusedIndex,
      (value) => {
        onSelect(value);
        const option = options.find(opt => opt.value === value);
        if (option) {
          announce(`Selected ${option.label}`, 'polite');
        }
      }
    );
  }, [options, focusedIndex, onSelect, announce]);

  const getGroupProps = useCallback(() => ({
    id: groupId,
    role: 'radiogroup',
    'aria-label': swapAriaLabels.proposalTypeSelector,
    onKeyDown: handleKeyDown,
  }), [groupId, handleKeyDown]);

  const getOptionProps = useCallback((option: { value: string; label: string; disabled: boolean }, index: number) => ({
    role: 'radio',
    'aria-checked': selected === option.value,
    'aria-disabled': option.disabled,
    tabIndex: index === focusedIndex ? 0 : -1,
    onClick: () => {
      if (!option.disabled) {
        onSelect(option.value);
        announce(`Selected ${option.label}`, 'polite');
      }
    },
    onFocus: () => setFocusedIndex(index),
  }), [selected, focusedIndex, onSelect, announce]);

  return {
    groupId,
    focusedIndex,
    getGroupProps,
    getOptionProps,
  };
};

/**
 * Hook for managing swap filter accessibility
 */
export const useSwapFilterAccessibility = (
  filters: Array<{ id: string; label: string; enabled: boolean }>,
  onToggle: (filterId: string) => void,
  resultCount: number
) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const groupId = useId('swap-filters');
  const { announce } = useAriaLiveRegion();

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    SwapKeyboardNavigation.handleFilterNavigation(
      event.nativeEvent,
      filters,
      focusedIndex,
      setFocusedIndex,
      (filterId) => {
        onToggle(filterId);
        const filter = filters.find(f => f.id === filterId);
        if (filter) {
          SwapScreenReader.announceFilterChange(filter.label, resultCount);
        }
      }
    );
  }, [filters, focusedIndex, onToggle, resultCount]);

  const getGroupProps = useCallback(() => ({
    id: groupId,
    role: 'group',
    'aria-label': 'Swap filters',
    'data-testid': 'swap-filters',
    onKeyDown: handleKeyDown,
  }), [groupId, handleKeyDown]);

  const getFilterProps = useCallback((filter: { id: string; label: string; enabled: boolean }, index: number) => ({
    'aria-pressed': filter.enabled,
    tabIndex: index === focusedIndex ? 0 : -1,
    onClick: () => {
      onToggle(filter.id);
      SwapScreenReader.announceFilterChange(filter.label, resultCount);
    },
    onFocus: () => setFocusedIndex(index),
  }), [focusedIndex, onToggle, resultCount]);

  return {
    groupId,
    focusedIndex,
    getGroupProps,
    getFilterProps,
  };
};

/**
 * Hook for managing swap status badge accessibility
 */
export const useSwapStatusBadgeAccessibility = (
  swapInfo?: {
    hasActiveProposals?: boolean;
    acceptanceStrategy?: 'first-match' | 'auction';
    paymentTypes?: ('booking' | 'cash')[];
    activeProposalCount?: number;
    timeRemaining?: number;
  }
) => {
  const badgeId = useId('swap-status-badge');
  
  const getStatusDescription = useCallback(() => {
    if (!swapInfo) {
      return 'Not available for swapping';
    }
    
    // Ensure we have a safe object with default values
    const safeSwapInfo = {
      hasActiveProposals: swapInfo.hasActiveProposals || false,
      acceptanceStrategy: swapInfo.acceptanceStrategy || 'first-match' as const,
      paymentTypes: swapInfo.paymentTypes || [],
      activeProposalCount: swapInfo.activeProposalCount || 0,
      timeRemaining: swapInfo.timeRemaining,
    };
    
    return SwapScreenReader.getSwapStatusDescription(safeSwapInfo);
  }, [swapInfo]);

  const getBadgeProps = useCallback(() => ({
    id: badgeId,
    role: 'status',
    'aria-label': swapAriaLabels.swapStatusBadge,
    'aria-describedby': `${badgeId}-description`,
    title: getStatusDescription(),
  }), [badgeId, getStatusDescription]);

  const getDescriptionProps = useCallback(() => ({
    id: `${badgeId}-description`,
    className: 'sr-only',
    children: getStatusDescription(),
  }), [badgeId, getStatusDescription]);

  return {
    badgeId,
    getBadgeProps,
    getDescriptionProps,
    statusDescription: getStatusDescription(),
  };
};

/**
 * Hook for managing high contrast mode for swap components
 */
export const useSwapHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const unsubscribe = SwapHighContrastSupport.subscribe(setIsHighContrast);
    return unsubscribe;
  }, []);

  const getSwapIndicatorStyles = useCallback((baseStyles: React.CSSProperties) => {
    return SwapHighContrastSupport.getSwapIndicatorStyles(baseStyles);
  }, [isHighContrast]);

  const getInteractiveStyles = useCallback((baseStyles: React.CSSProperties) => {
    return SwapHighContrastSupport.getInteractiveStyles(baseStyles);
  }, [isHighContrast]);

  return {
    isHighContrast,
    getSwapIndicatorStyles,
    getInteractiveStyles,
  };
};

/**
 * Hook for managing form field accessibility with swap-specific enhancements
 */
export const useSwapFormField = (
  fieldName: string,
  label: string,
  error?: string,
  description?: string,
  required = false
) => {
  const fieldId = useId(`swap-${fieldName}`);
  const labelId = useId(`swap-${fieldName}-label`);
  const errorId = useId(`swap-${fieldName}-error`);
  const descriptionId = useId(`swap-${fieldName}-description`);
  const { announce } = useAriaLiveRegion();

  // Announce validation errors
  useEffect(() => {
    if (error) {
      SwapScreenReader.announceValidationError(fieldName, error);
    }
  }, [error, fieldName]);

  const getFieldProps = useCallback(() => {
    const describedBy = [];
    if (description) describedBy.push(descriptionId);
    if (error) describedBy.push(errorId);

    return {
      id: fieldId,
      'aria-labelledby': labelId,
      'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
      'aria-invalid': error ? 'true' : undefined,
      'aria-required': required ? 'true' : undefined,
    };
  }, [fieldId, labelId, errorId, descriptionId, error, required, description]);

  const getLabelProps = useCallback(() => ({
    id: labelId,
    htmlFor: fieldId,
  }), [labelId, fieldId]);

  const getErrorProps = useCallback(() => ({
    id: errorId,
    role: 'alert',
    'aria-live': 'polite',
  }), [errorId]);

  const getDescriptionProps = useCallback(() => ({
    id: descriptionId,
  }), [descriptionId]);

  return {
    fieldId,
    getFieldProps,
    getLabelProps,
    getErrorProps,
    getDescriptionProps,
  };
};

/**
 * Hook for managing auction timer accessibility
 */
export const useAuctionTimerAccessibility = (
  timeRemaining?: number,
  bookingTitle?: string
) => {
  const timerId = useId('auction-timer');
  const { announce } = useAriaLiveRegion();
  const lastAnnouncementRef = useRef<number>(0);

  // Announce time warnings
  useEffect(() => {
    if (!timeRemaining || !bookingTitle) return;

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    // Announce at specific intervals to avoid spam
    const shouldAnnounce = (
      (hours === 1 && minutes === 0) || // 1 hour remaining
      (hours === 0 && minutes === 30) || // 30 minutes remaining
      (hours === 0 && minutes === 10) || // 10 minutes remaining
      (hours === 0 && minutes === 5) ||  // 5 minutes remaining
      (hours === 0 && minutes === 1)     // 1 minute remaining
    );

    if (shouldAnnounce && timeRemaining !== lastAnnouncementRef.current) {
      const timeString = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : `${minutes} minute${minutes > 1 ? 's' : ''}`;
      SwapScreenReader.announceSwapStatusChange('auction_ending', {
        bookingTitle,
        timeRemaining: timeString,
      });
      lastAnnouncementRef.current = timeRemaining;
    }
  }, [timeRemaining, bookingTitle, announce]);

  const getTimerProps = useCallback(() => ({
    id: timerId,
    role: 'timer',
    'aria-label': swapAriaLabels.auctionTimer,
    'aria-live': 'polite',
    'aria-atomic': 'true',
  }), [timerId]);

  return {
    timerId,
    getTimerProps,
  };
};