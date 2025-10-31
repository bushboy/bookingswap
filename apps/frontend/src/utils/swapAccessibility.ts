/**
 * Accessibility utilities specifically for swap-related components
 */

import { announceToScreenReader, liveRegionManager } from './accessibility';

/**
 * ARIA labels for swap-related controls
 */
export const swapAriaLabels = {
  // Swap preferences section
  swapToggle: 'Enable swap functionality for this booking',
  swapSection: 'Swap preferences configuration',
  paymentTypeSelector: 'Select accepted payment types for swap proposals',
  cashAmountInput: 'Set minimum cash amount for swap proposals',
  acceptanceStrategy: 'Choose how swap proposals will be handled',
  auctionEndDate: 'Set auction end date for swap proposals',
  swapConditions: 'Add additional conditions for swap proposals',

  // Inline proposal form
  proposalForm: 'Create swap proposal for this booking',
  proposalTypeSelector: 'Choose type of swap proposal to make',
  bookingSelector: 'Select your booking to offer in exchange',
  cashOfferInput: 'Enter cash amount to offer for this swap',
  proposalMessage: 'Add optional message to your swap proposal',
  submitProposal: 'Submit swap proposal',
  cancelProposal: 'Cancel swap proposal creation',

  // Swap status indicators
  swapStatusBadge: 'Swap availability status for this booking',
  auctionTimer: 'Time remaining for auction-based swap',
  proposalCount: 'Number of active swap proposals',

  // Filter controls
  swapAvailableFilter: 'Show only bookings available for swapping',
  cashAcceptingFilter: 'Show only bookings that accept cash offers',
  auctionModeFilter: 'Show only bookings with active auctions',

  // Keyboard shortcuts
  toggleSwapPreferences: 'Press Space or Enter to toggle swap preferences',
  navigateProposalOptions: 'Use arrow keys to navigate proposal options',
  submitWithEnter: 'Press Enter to submit proposal',
} as const;

/**
 * Screen reader announcements for swap status changes
 */
export const swapAnnouncements = {
  swapEnabled: (bookingTitle: string) =>
    `Swap functionality enabled for ${bookingTitle}. Other users can now propose swaps for this booking.`,
  
  swapDisabled: (bookingTitle: string) =>
    `Swap functionality disabled for ${bookingTitle}. This booking is no longer available for swapping.`,
  
  proposalSubmitted: (bookingTitle: string, proposalType: 'booking' | 'cash') =>
    `${proposalType === 'booking' ? 'Booking exchange' : 'Cash offer'} proposal submitted for ${bookingTitle}. You will be notified when the owner responds.`,
  
  proposalReceived: (count: number, bookingTitle: string) =>
    `New swap proposal received for ${bookingTitle}. You now have ${count} ${count === 1 ? 'proposal' : 'proposals'} to review.`,
  
  auctionEnding: (timeRemaining: string, bookingTitle: string) =>
    `Auction for ${bookingTitle} ending in ${timeRemaining}. Submit your proposal soon.`,
  
  auctionEnded: (bookingTitle: string, winningProposal?: string) =>
    winningProposal 
      ? `Auction for ${bookingTitle} has ended. Winning proposal: ${winningProposal}.`
      : `Auction for ${bookingTitle} has ended with no winning proposals.`,
  
  proposalAccepted: (bookingTitle: string) =>
    `Your swap proposal for ${bookingTitle} has been accepted. Check your dashboard for next steps.`,
  
  proposalRejected: (bookingTitle: string) =>
    `Your swap proposal for ${bookingTitle} has been declined. You can browse other available bookings.`,
  
  filterApplied: (filterType: string, resultCount: number) =>
    `${filterType} filter applied. Showing ${resultCount} ${resultCount === 1 ? 'booking' : 'bookings'}.`,
  
  validationError: (fieldName: string, error: string) =>
    `Validation error in ${fieldName}: ${error}`,
} as const;

/**
 * Enhanced focus management for swap components
 */
export class SwapFocusManager {
  private static instance: SwapFocusManager;
  private focusStack: HTMLElement[] = [];
  private modalStack: string[] = [];

  static getInstance(): SwapFocusManager {
    if (!SwapFocusManager.instance) {
      SwapFocusManager.instance = new SwapFocusManager();
    }
    return SwapFocusManager.instance;
  }

  /**
   * Save current focus before opening modal/inline form
   */
  saveFocus(): void {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      this.focusStack.push(activeElement);
    }
  }

  /**
   * Restore focus when closing modal/inline form
   */
  restoreFocus(): void {
    const elementToFocus = this.focusStack.pop();
    if (elementToFocus && typeof elementToFocus.focus === 'function') {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        elementToFocus.focus();
      }, 100);
    }
  }

  /**
   * Focus first interactive element in container
   */
  focusFirstInteractive(container: HTMLElement): boolean {
    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
      return true;
    }
    return false;
  }

  /**
   * Manage modal focus stack
   */
  pushModal(modalId: string): void {
    this.modalStack.push(modalId);
    this.saveFocus();
  }

  /**
   * Remove modal from stack and restore focus
   */
  popModal(): void {
    this.modalStack.pop();
    this.restoreFocus();
  }

  /**
   * Check if modal is currently active
   */
  isModalActive(modalId: string): boolean {
    return this.modalStack.includes(modalId);
  }
}

/**
 * Keyboard navigation handler for swap components
 */
export class SwapKeyboardNavigation {
  /**
   * Handle keyboard navigation in proposal type selector
   */
  static handleProposalTypeNavigation(
    event: KeyboardEvent,
    options: Array<{ value: string; disabled: boolean }>,
    currentIndex: number,
    onIndexChange: (index: number) => void,
    onSelect: (value: string) => void
  ): void {
    const { key } = event;
    
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      event.preventDefault();
      const nextIndex = SwapKeyboardNavigation.findNextEnabledOption(options, currentIndex, 1);
      if (nextIndex !== -1) {
        onIndexChange(nextIndex);
      }
    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
      event.preventDefault();
      const prevIndex = SwapKeyboardNavigation.findNextEnabledOption(options, currentIndex, -1);
      if (prevIndex !== -1) {
        onIndexChange(prevIndex);
      }
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const currentOption = options[currentIndex];
      if (currentOption && !currentOption.disabled) {
        onSelect(currentOption.value);
      }
    }
  }

  /**
   * Handle keyboard navigation in filter toggles
   */
  static handleFilterNavigation(
    event: KeyboardEvent,
    filters: Array<{ id: string; enabled: boolean }>,
    currentIndex: number,
    onIndexChange: (index: number) => void,
    onToggle: (filterId: string) => void
  ): void {
    const { key } = event;
    
    if (key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % filters.length;
      onIndexChange(nextIndex);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex === 0 ? filters.length - 1 : currentIndex - 1;
      onIndexChange(prevIndex);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const currentFilter = filters[currentIndex];
      if (currentFilter) {
        onToggle(currentFilter.id);
      }
    }
  }

  /**
   * Find next enabled option in a list
   */
  private static findNextEnabledOption(
    options: Array<{ disabled: boolean }>,
    currentIndex: number,
    direction: 1 | -1
  ): number {
    const length = options.length;
    let nextIndex = currentIndex;
    
    for (let i = 0; i < length; i++) {
      nextIndex = (nextIndex + direction + length) % length;
      if (!options[nextIndex].disabled) {
        return nextIndex;
      }
    }
    
    return -1; // No enabled options found
  }
}

/**
 * High contrast mode detection and support
 */
export class SwapHighContrastSupport {
  private static mediaQuery: MediaQueryList | null = null;
  private static callbacks: Array<(isHighContrast: boolean) => void> = [];

  /**
   * Initialize high contrast detection
   */
  static initialize(): void {
    if (typeof window === 'undefined') return;

    // Check for high contrast mode
    SwapHighContrastSupport.mediaQuery = window.matchMedia('(prefers-contrast: high)');
    
    SwapHighContrastSupport.mediaQuery.addEventListener('change', (e) => {
      SwapHighContrastSupport.callbacks.forEach(callback => callback(e.matches));
    });
  }

  /**
   * Check if high contrast mode is active
   */
  static isHighContrastMode(): boolean {
    return SwapHighContrastSupport.mediaQuery?.matches || false;
  }

  /**
   * Subscribe to high contrast mode changes
   */
  static subscribe(callback: (isHighContrast: boolean) => void): () => void {
    SwapHighContrastSupport.callbacks.push(callback);
    
    // Call immediately with current state
    callback(SwapHighContrastSupport.isHighContrastMode());
    
    // Return unsubscribe function
    return () => {
      const index = SwapHighContrastSupport.callbacks.indexOf(callback);
      if (index > -1) {
        SwapHighContrastSupport.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get high contrast styles for swap indicators
   */
  static getSwapIndicatorStyles(baseStyles: React.CSSProperties): React.CSSProperties {
    if (!SwapHighContrastSupport.isHighContrastMode()) {
      return baseStyles;
    }

    return {
      ...baseStyles,
      border: '2px solid currentColor',
      backgroundColor: 'transparent',
      color: 'inherit',
      fontWeight: 'bold',
    };
  }

  /**
   * Get high contrast styles for interactive elements
   */
  static getInteractiveStyles(baseStyles: React.CSSProperties): React.CSSProperties {
    if (!SwapHighContrastSupport.isHighContrastMode()) {
      return baseStyles;
    }

    return {
      ...baseStyles,
      border: '2px solid currentColor',
      outline: '2px solid transparent',
      outlineOffset: '2px',
    };
  }
}

/**
 * Screen reader utilities for swap components
 */
export class SwapScreenReader {
  /**
   * Announce swap status change
   */
  static announceSwapStatusChange(
    status: 'enabled' | 'disabled' | 'proposal_submitted' | 'proposal_received' | 'auction_ending' | 'auction_ended' | 'proposal_accepted' | 'proposal_rejected',
    context: {
      bookingTitle: string;
      proposalType?: 'booking' | 'cash';
      proposalCount?: number;
      timeRemaining?: string;
      winningProposal?: string;
    }
  ): void {
    let message: string;

    switch (status) {
      case 'enabled':
        message = swapAnnouncements.swapEnabled(context.bookingTitle);
        break;
      case 'disabled':
        message = swapAnnouncements.swapDisabled(context.bookingTitle);
        break;
      case 'proposal_submitted':
        message = swapAnnouncements.proposalSubmitted(context.bookingTitle, context.proposalType || 'booking');
        break;
      case 'proposal_received':
        message = swapAnnouncements.proposalReceived(context.proposalCount || 1, context.bookingTitle);
        break;
      case 'auction_ending':
        message = swapAnnouncements.auctionEnding(context.timeRemaining || 'soon', context.bookingTitle);
        break;
      case 'auction_ended':
        message = swapAnnouncements.auctionEnded(context.bookingTitle, context.winningProposal);
        break;
      case 'proposal_accepted':
        message = swapAnnouncements.proposalAccepted(context.bookingTitle);
        break;
      case 'proposal_rejected':
        message = swapAnnouncements.proposalRejected(context.bookingTitle);
        break;
      default:
        return;
    }

    liveRegionManager.announce(message, 'polite');
  }

  /**
   * Announce filter changes
   */
  static announceFilterChange(filterType: string, resultCount: number): void {
    const message = swapAnnouncements.filterApplied(filterType, resultCount);
    liveRegionManager.announce(message, 'polite');
  }

  /**
   * Announce validation errors
   */
  static announceValidationError(fieldName: string, error: string): void {
    const message = swapAnnouncements.validationError(fieldName, error);
    liveRegionManager.announce(message, 'assertive');
  }

  /**
   * Create descriptive text for swap status
   */
  static getSwapStatusDescription(swapInfo: {
    hasActiveProposals?: boolean;
    acceptanceStrategy?: 'first-match' | 'auction';
    paymentTypes?: ('booking' | 'cash')[];
    activeProposalCount?: number;
    timeRemaining?: number;
  }): string {
    if (!swapInfo || !swapInfo.hasActiveProposals) {
      return 'Not available for swapping';
    }

    const parts: string[] = ['Available for swapping'];
    
    // Payment types
    const paymentTypes = swapInfo.paymentTypes || [];
    if (paymentTypes.includes('booking') && paymentTypes.includes('cash')) {
      parts.push('accepts booking exchanges and cash offers');
    } else if (paymentTypes.includes('booking')) {
      parts.push('accepts booking exchanges only');
    } else if (paymentTypes.includes('cash')) {
      parts.push('accepts cash offers only');
    }

    // Acceptance strategy
    if (swapInfo.acceptanceStrategy === 'auction') {
      parts.push('using auction mode');
      if (swapInfo.timeRemaining) {
        const hours = Math.floor(swapInfo.timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((swapInfo.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) {
          parts.push(`${hours} hours ${minutes} minutes remaining`);
        } else {
          parts.push(`${minutes} minutes remaining`);
        }
      }
    } else {
      parts.push('first match wins');
    }

    // Proposal count
    if ((swapInfo.activeProposalCount || 0) > 0) {
      const count = swapInfo.activeProposalCount || 0;
      parts.push(`${count} active ${count === 1 ? 'proposal' : 'proposals'}`);
    }

    return parts.join(', ');
  }
}

/**
 * Initialize swap accessibility features
 */
export function initializeSwapAccessibility(): void {
  SwapHighContrastSupport.initialize();
  
  // Add global keyboard shortcuts for swap functionality
  document.addEventListener('keydown', (event) => {
    // Ctrl+Shift+S to focus swap filters
    if (event.ctrlKey && event.shiftKey && event.key === 'S') {
      event.preventDefault();
      const swapFilters = document.querySelector('[data-testid="swap-filters"]') as HTMLElement;
      if (swapFilters) {
        swapFilters.focus();
        announceToScreenReader('Focused on swap filters', 'polite');
      }
    }
    
    // Escape to close inline proposal forms
    if (event.key === 'Escape') {
      const activeProposalForm = document.querySelector('[data-testid="inline-proposal-form"]:not([hidden])') as HTMLElement;
      if (activeProposalForm) {
        const cancelButton = activeProposalForm.querySelector('[data-testid="cancel-proposal"]') as HTMLButtonElement;
        if (cancelButton) {
          cancelButton.click();
        }
      }
    }
  });
}