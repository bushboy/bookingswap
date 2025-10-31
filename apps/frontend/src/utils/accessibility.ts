/**
 * Accessibility utilities for ARIA attributes, roles, and labels
 */

/**
 * Keyboard key constants for accessibility
 */
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

export interface AriaAttributes {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean;
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-activedescendant'?: string;
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
  'aria-required'?: boolean;
  'aria-readonly'?: boolean;
  role?: string;
  tabIndex?: number;
}

/**
 * Generate ARIA attributes for form fields
 */
export const getFormFieldAria = (
  fieldId: string,
  label?: string,
  error?: string,
  helperText?: string,
  required?: boolean,
  disabled?: boolean
): AriaAttributes => {
  const attributes: AriaAttributes = {};

  if (label) {
    attributes['aria-label'] = label;
  }

  if (error) {
    attributes['aria-invalid'] = true;
    attributes['aria-describedby'] = `${fieldId}-error`;
  } else if (helperText) {
    attributes['aria-describedby'] = `${fieldId}-helper`;
  }

  if (required) {
    attributes['aria-required'] = true;
  }

  if (disabled) {
    attributes['aria-disabled'] = true;
  }

  return attributes;
};

/**
 * Generate ARIA attributes for buttons
 */
export const getButtonAria = (
  label: string,
  expanded?: boolean,
  controls?: string,
  disabled?: boolean,
  pressed?: boolean
): AriaAttributes => {
  const attributes: AriaAttributes = {
    'aria-label': label,
  };

  if (expanded !== undefined) {
    attributes['aria-expanded'] = expanded;
  }

  if (controls) {
    attributes['aria-controls'] = controls;
  }

  if (disabled) {
    attributes['aria-disabled'] = true;
  }

  if (pressed !== undefined) {
    attributes['aria-checked'] = pressed;
    attributes.role = 'switch';
  }

  return attributes;
};

/**
 * Generate ARIA attributes for navigation elements
 */
export const getNavigationAria = (
  label: string,
  current?: boolean,
  level?: number
): AriaAttributes => {
  const attributes: AriaAttributes = {
    'aria-label': label,
  };

  if (current) {
    attributes['aria-current'] = 'page' as any;
  }

  if (level) {
    attributes.role = 'heading';
    attributes['aria-level'] = level as any;
  }

  return attributes;
};

/**
 * Generate ARIA attributes for modal dialogs
 */
export const getModalAria = (
  titleId?: string,
  describedBy?: string
): AriaAttributes => {
  const attributes: AriaAttributes = {
    role: 'dialog',
    'aria-modal': true,
  };

  if (titleId) {
    attributes['aria-labelledby'] = titleId;
  }

  if (describedBy) {
    attributes['aria-describedby'] = describedBy;
  }

  return attributes;
};

/**
 * Generate ARIA attributes for status/alert regions
 */
export const getStatusAria = (
  type: 'status' | 'alert' | 'log',
  live: 'polite' | 'assertive' = 'polite',
  atomic: boolean = true
): AriaAttributes => {
  return {
    role: type,
    'aria-live': live,
    'aria-atomic': atomic,
  };
};

/**
 * Generate ARIA attributes for form sections
 */
export const getFormSectionAria = (
  sectionId: string,
  title: string,
  description?: string,
  required?: boolean
): AriaAttributes => {
  const attributes: AriaAttributes = {
    role: 'group',
    'aria-labelledby': `${sectionId}-title`,
  };

  if (description) {
    attributes['aria-describedby'] = `${sectionId}-description`;
  }

  if (required) {
    attributes['aria-required'] = true;
  }

  return attributes;
};

/**
 * Generate ARIA attributes for progress indicators
 */
export const getProgressAria = (
  label: string,
  value?: number,
  max?: number,
  indeterminate?: boolean
): AriaAttributes => {
  const attributes: AriaAttributes = {
    role: 'progressbar',
    'aria-label': label,
  };

  if (!indeterminate && value !== undefined) {
    attributes['aria-valuenow'] = value as any;
  }

  if (max !== undefined) {
    attributes['aria-valuemax'] = max as any;
  }

  if (indeterminate) {
    attributes['aria-busy'] = true;
  }

  return attributes;
};

/**
 * Generate unique IDs for accessibility
 */
export const generateAccessibleId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Screen reader text utility
 */
export const getScreenReaderOnlyStyles = (): React.CSSProperties => ({
  position: 'absolute',
  left: '-10000px',
  top: 'auto',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
});

/**
 * Skip link styles
 */
export const getSkipLinkStyles = (visible: boolean = false): React.CSSProperties => ({
  position: 'absolute',
  top: visible ? '0' : '-40px',
  left: '6px',
  background: '#000',
  color: '#fff',
  padding: '8px',
  textDecoration: 'none',
  zIndex: 100000,
  borderRadius: '0 0 4px 4px',
  transition: 'top 0.3s',
});

/**
 * Focus visible styles for keyboard navigation
 */
export const getFocusVisibleStyles = (color: string = '#005fcc'): React.CSSProperties => ({
  outline: `2px solid ${color}`,
  outlineOffset: '2px',
  boxShadow: `0 0 0 4px ${color}20`,
});

/**
 * High contrast mode styles
 */
export const getHighContrastStyles = (): React.CSSProperties => ({
  '@media (prefers-contrast: high)': {
    border: '2px solid',
    outline: '2px solid',
  },
  '@media (-ms-high-contrast: active)': {
    border: '2px solid',
    outline: '2px solid',
  },
});

/**
 * Reduced motion styles
 */
export const getRespectMotionPreferences = (
  animatedStyles: React.CSSProperties,
  staticStyles: React.CSSProperties = {}
): React.CSSProperties => ({
  ...animatedStyles,
  '@media (prefers-reduced-motion: reduce)': {
    ...staticStyles,
    animation: 'none',
    transition: 'none',
  },
});

/**
 * Live region manager for screen reader announcements
 */
class LiveRegionManager {
  private politeRegion: HTMLElement | null = null;
  private assertiveRegion: HTMLElement | null = null;

  constructor() {
    this.initializeRegions();
  }

  private initializeRegions(): void {
    if (typeof document === 'undefined') return;

    // Create polite live region
    this.politeRegion = document.createElement('div');
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    this.politeRegion.setAttribute('id', 'live-region-polite');
    this.politeRegion.style.position = 'absolute';
    this.politeRegion.style.left = '-10000px';
    this.politeRegion.style.width = '1px';
    this.politeRegion.style.height = '1px';
    this.politeRegion.style.overflow = 'hidden';
    document.body.appendChild(this.politeRegion);

    // Create assertive live region
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    this.assertiveRegion.setAttribute('id', 'live-region-assertive');
    this.assertiveRegion.style.position = 'absolute';
    this.assertiveRegion.style.left = '-10000px';
    this.assertiveRegion.style.width = '1px';
    this.assertiveRegion.style.height = '1px';
    this.assertiveRegion.style.overflow = 'hidden';
    document.body.appendChild(this.assertiveRegion);
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion;

    if (!region) {
      this.initializeRegions();
      return this.announce(message, priority);
    }

    // Clear previous message
    region.textContent = '';

    // Add new message after a brief delay to ensure screen readers pick it up
    setTimeout(() => {
      if (region) {
        region.textContent = message;
      }
    }, 100);

    // Clear message after announcement
    setTimeout(() => {
      if (region) {
        region.textContent = '';
      }
    }, 1000);
  }

  /**
   * Clear all live regions
   */
  clear(): void {
    if (this.politeRegion) {
      this.politeRegion.textContent = '';
    }
    if (this.assertiveRegion) {
      this.assertiveRegion.textContent = '';
    }
  }

  /**
   * Destroy live regions (cleanup)
   */
  destroy(): void {
    if (this.politeRegion && document.body.contains(this.politeRegion)) {
      document.body.removeChild(this.politeRegion);
      this.politeRegion = null;
    }
    if (this.assertiveRegion && document.body.contains(this.assertiveRegion)) {
      document.body.removeChild(this.assertiveRegion);
      this.assertiveRegion = null;
    }
  }
}

// Export singleton instance
export const liveRegionManager = new LiveRegionManager();

/**
 * Announce message to screen readers (legacy function, uses liveRegionManager internally)
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite'): void => {
  liveRegionManager.announce(message, priority);
};

/**
 * ARIA utilities object for generating ARIA attributes
 */
export const aria = {
  swapCard: (swap: any, mode: string): AriaAttributes => ({
    role: 'article',
    'aria-label': `Swap proposal: ${swap.sourceBooking?.title || 'Unknown booking'}`,
    'aria-describedby': `swap-${swap.id}-description`,
    tabIndex: 0,
  }),
  button: getButtonAria,
  formField: getFormFieldAria,
  navigation: getNavigationAria,
  modal: getModalAria,
  status: getStatusAria,
  formSection: getFormSectionAria,
  progress: getProgressAria,
};

/**
 * Screen reader utilities object
 */
export const screenReader = {
  describeSwapCard: (options: {
    title?: string;
    location?: string;
    status?: string;
    estimatedValue?: number;
    compatibilityScore?: number;
  }): string => {
    const { title, location, status, estimatedValue, compatibilityScore } = options;
    let description = `Swap proposal for ${title || 'unknown booking'}`;

    if (location) {
      description += ` in ${location}`;
    }

    if (status) {
      description += `, status: ${status}`;
    }

    if (estimatedValue) {
      description += `, estimated value: $${estimatedValue.toLocaleString()}`;
    }

    if (compatibilityScore) {
      description += `, compatibility score: ${Math.round(compatibilityScore * 100)}%`;
    }

    return description;
  },
  getOnlyStyles: getScreenReaderOnlyStyles,
};

/**
 * High contrast utilities object
 */
export const highContrast = {
  getStyles: (isHighContrast: boolean): React.CSSProperties =>
    isHighContrast ? getHighContrastStyles() : {},
  getFocusStyles: (isHighContrast: boolean): React.CSSProperties =>
    isHighContrast
      ? { outline: '3px solid #ffff00', outlineOffset: '2px' }
      : getFocusVisibleStyles(),
};

/**
 * Touch target utilities object
 */
export const touchTargets = {
  getMinimumSize: (): React.CSSProperties => ({
    minWidth: '44px',
    minHeight: '44px',
  }),
  getRecommendedSize: (): React.CSSProperties => ({
    minWidth: '48px',
    minHeight: '48px',
  }),
};