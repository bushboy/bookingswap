import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ContextualHelp } from '@/components/ui/ContextualHelp';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { ThemedInterface } from '@/components/ui/ThemedInterface';
import { tokens } from '@/design-system/tokens';
import { bookingTheme, contextualHelp } from '@/design-system/interface-themes';
import {
  validateField,
  getValidationErrorCount,
  validateCustomProvider,
  validateProviderSelection,
  createDebouncedValidator
} from '@/utils/validation';
import { useUnsavedChanges, useStatePreservation } from '@/hooks/useUnsavedChanges';
import { useResponsive, useTouch } from '@/hooks/useResponsive';
import {
  useFocusManagement,
  useAriaLiveRegion,
  useHighContrast
} from '@/hooks/useAccessibility';
import {
  getFormFieldAria,
  getButtonAria,
  getFormSectionAria,
  getStatusAria,
  generateAccessibleId,
  getScreenReaderOnlyStyles,
  getFocusVisibleStyles
} from '@/utils/accessibility';
import { usePerformanceOptimizations } from '@/hooks/usePerformanceOptimizations';
import { useBookingCache } from '@/utils/bookingDataCache';
import {
  BookingType,
  Booking,
} from '@booking-swap/shared';
import {
  getBookingTypeOptions,
  EnabledBookingType
} from '@booking-swap/shared';

// Pure booking data interface (no swap fields)
export interface BookingEditData {
  type: BookingType;
  title: string;
  description: string;
  location: {
    city: string;
    country: string;
    coordinates?: [number, number];
  };
  dateRange: {
    checkIn: Date;
    checkOut: Date;
  };
  originalPrice: number;
  swapValue: number;
  providerDetails: {
    provider: string;
    confirmationNumber: string;
    bookingReference: string;
  };
}

// Validation errors for booking-only fields
export interface BookingEditErrors {
  title?: string;
  description?: string;
  location?: string;
  dateRange?: string;
  originalPrice?: string;
  swapValue?: string;
  providerDetails?: string;
  [key: string]: string | undefined;
}

export interface BookingEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BookingEditData) => Promise<void>;
  booking?: Booking;
  loading?: boolean;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
}

// Get booking types from centralized configuration
const BOOKING_TYPES = getBookingTypeOptions();

/**
 * Common booking providers for dropdown selection
 * 
 * This list includes the most popular booking platforms and services ordered by popularity.
 * Users can select from these predefined options or choose "Other" to enter a custom provider name.
 * The list is organized by category: OTAs, Vacation Rentals, Meta-search, Hotel Chains, and Direct booking.
 */
const BOOKING_PROVIDERS: { value: string; label: string; icon: string }[] = [
  // Online Travel Agencies (OTAs) - Most popular first
  { value: 'Booking.com', label: 'Booking.com', icon: '🌐' },
  { value: 'Expedia', label: 'Expedia', icon: '✈️' },
  { value: 'Hotels.com', label: 'Hotels.com', icon: '🏨' },
  { value: 'Agoda', label: 'Agoda', icon: '🌏' },
  { value: 'Priceline', label: 'Priceline', icon: '💰' },

  // Vacation Rentals
  { value: 'Airbnb', label: 'Airbnb', icon: '🏠' },
  { value: 'Vrbo', label: 'Vrbo', icon: '🏡' },

  // Meta-search Engines
  { value: 'Kayak', label: 'Kayak', icon: '🛶' },
  { value: 'Trivago', label: 'Trivago', icon: '🔍' },
  { value: 'TripAdvisor', label: 'TripAdvisor', icon: '🦉' },

  // Hotel Chains
  { value: 'Marriott', label: 'Marriott', icon: '🏨' },
  { value: 'Hilton', label: 'Hilton', icon: '🏨' },
  { value: 'Hyatt', label: 'Hyatt', icon: '🏨' },
  { value: 'IHG', label: 'IHG (InterContinental)', icon: '🏨' },

  // Direct Booking
  { value: 'Direct', label: 'Hotel Direct', icon: '📞' },

  // Custom Entry
  { value: 'Other', label: 'Other', icon: '📝' },
];

const getDefaultFormData = (): BookingEditData => ({
  type: 'hotel',
  title: '',
  description: '',
  location: {
    city: '',
    country: '',
  },
  dateRange: {
    checkIn: new Date(),
    checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  },
  originalPrice: 0,
  swapValue: 0,
  providerDetails: {
    provider: '',
    confirmationNumber: '',
    bookingReference: '',
  },
});

const mapBookingToFormData = (booking: Booking): BookingEditData => ({
  type: booking.type,
  title: booking.title,
  description: booking.description || '',
  location: {
    city: booking.location.city || '',
    country: booking.location.country || '',
    coordinates: booking.location.coordinates,
  },
  dateRange: {
    checkIn: booking.dateRange.checkIn ? new Date(booking.dateRange.checkIn) : new Date(),
    checkOut: booking.dateRange.checkOut ? new Date(booking.dateRange.checkOut) : new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  originalPrice: booking.originalPrice,
  swapValue: booking.swapValue,
  providerDetails: {
    provider: booking.providerDetails.provider || '',
    confirmationNumber: booking.providerDetails.confirmationNumber || '',
    bookingReference: booking.providerDetails.bookingReference || '',
  },
});

export const BookingEditForm: React.FC<BookingEditFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  booking,
  loading = false,
  onUnsavedChangesChange,
}) => {
  const { isMobile, isTablet } = useResponsive();
  const isTouch = useTouch();

  // Performance optimizations
  usePerformanceOptimizations('BookingEditForm');

  // Caching optimizations
  useBookingCache();

  // Accessibility hooks
  const { announce } = useAriaLiveRegion();
  const { restoreFocus } = useFocusManagement();
  const { getHighContrastStyles } = useHighContrast();

  // Refs for accessibility
  const formRef = useRef<HTMLFormElement>(null);
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Generate stable IDs for accessibility
  const formId = useMemo(() => generateAccessibleId('booking-edit-form'), []);
  const titleFieldId = useMemo(() => generateAccessibleId('booking-title'), []);
  const descriptionFieldId = useMemo(() => generateAccessibleId('booking-description'), []);
  const errorSummaryId = useMemo(() => generateAccessibleId('error-summary'), []);
  const unsavedChangesId = useMemo(() => generateAccessibleId('unsaved-changes'), []);

  const [formData, setFormData] = useState<BookingEditData>(
    booking ? mapBookingToFormData(booking) : getDefaultFormData()
  );
  const [validationErrors, setValidationErrors] = useState<BookingEditErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [originalFormData, setOriginalFormData] = useState<BookingEditData>(
    booking ? mapBookingToFormData(booking) : getDefaultFormData()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for handling "Other" provider option
  const [isOtherProvider, setIsOtherProvider] = useState(false);
  const [customProvider, setCustomProvider] = useState('');
  const [customProviderError, setCustomProviderError] = useState('');

  // Create debounced validator for real-time custom provider validation
  const debouncedCustomProviderValidator = useMemo(
    () => createDebouncedValidator((value: string) => {
      const error = validateCustomProvider(value);
      setCustomProviderError(error);
      return error;
    }, 300),
    []
  );

  // Check if form has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalFormData);
  }, [formData, originalFormData]);

  // Memoize the onRestore callback to prevent infinite loops
  const handleRestore = useCallback((restoredData: typeof formData) => {
    setFormData(restoredData);
    setTouched({}); // Reset touched state when restoring
  }, []); // Empty deps - this callback doesn't depend on any external values

  // State preservation for navigation between interfaces
  const statePreservation = useStatePreservation({
    storageKey: `booking-edit-${booking?.id || 'new'}`,
    data: formData,
    onRestore: handleRestore,
    autoSave: hasUnsavedChanges, // Only save when there are changes
  });

  // Unsaved changes handling
  const unsavedChanges = useUnsavedChanges({
    hasUnsavedChanges: () => hasUnsavedChanges,
    onSave: async () => {
      await handleActualSubmit();
    },
    onDiscard: () => {
      setFormData(originalFormData);
      setValidationErrors({});
      setTouched({});
      statePreservation.clearState();
    },
    message: 'You have unsaved booking changes. Do you want to save them before continuing?',
    allowSave: true,
  });

  const handleActualSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Mark as saved and clear preserved state
      setOriginalFormData(formData);
      statePreservation.clearState();
      unsavedChanges.markAsSaved();
      onClose();
    } catch (error) {
      console.error('Failed to submit booking:', error);
      throw error; // Re-throw for unsaved changes handler
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, onClose, statePreservation, unsavedChanges]);

  // Initialize form data when booking changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const initialData = booking ? mapBookingToFormData(booking) : getDefaultFormData();

      // Store previous focus for restoration
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Check if provider is in the predefined list or if it's a custom provider
      const providerValue = initialData.providerDetails.provider;
      const isProviderInList = BOOKING_PROVIDERS.some(provider => provider.value === providerValue);

      if (providerValue && !isProviderInList) {
        // Custom provider - set to "Other" and store the custom value
        setIsOtherProvider(true);
        setCustomProvider(providerValue);
        initialData.providerDetails.provider = 'Other';
      } else {
        setIsOtherProvider(providerValue === 'Other');
        setCustomProvider('');
      }

      // Check if we have preserved state to restore
      if (statePreservation.hasSavedState()) {
        // Restore will be handled by the statePreservation hook
        // But we still need to set original data for comparison
        setOriginalFormData(initialData);
      } else {
        setFormData(initialData);
        setOriginalFormData(initialData);
      }

      setValidationErrors({});
      setTouched({});
      setCustomProviderError(''); // Reset custom provider error

      // Announce form opening to screen readers
      setTimeout(() => {
        announce(
          `Booking edit form opened. ${booking ? 'Editing existing booking' : 'Creating new booking'}. Form contains booking details only.`,
          'polite'
        );

        // Focus the first form field
        if (titleFieldRef.current) {
          titleFieldRef.current.focus();
        }
      }, 100);
    } else {
      // Restore focus when modal closes
      if (previousFocusRef.current) {
        restoreFocus(previousFocusRef.current);
      }
    }
  }, [booking, isOpen, announce, restoreFocus]);

  // Notify parent component about unsaved changes
  // Using a ref to avoid infinite loops if the callback isn't memoized by the parent
  const onUnsavedChangesChangeRef = useRef(onUnsavedChangesChange);
  useEffect(() => {
    onUnsavedChangesChangeRef.current = onUnsavedChangesChange;
  }, [onUnsavedChangesChange]);

  useEffect(() => {
    if (onUnsavedChangesChangeRef.current) {
      onUnsavedChangesChangeRef.current(hasUnsavedChanges);
    }
  }, [hasUnsavedChanges]); // Only re-run when hasUnsavedChanges changes, not when callback changes

  const validateForm = (): boolean => {
    const errors: BookingEditErrors = {};

    // Validate booking fields only (no swap validation)
    const titleError = validateField('title', formData.title, formData as any);
    const descriptionError = validateField('description', formData.description, formData as any);
    const cityError = validateField('city', formData.location.city, formData as any);
    const countryError = validateField('country', formData.location.country, formData as any);
    const originalPriceError = validateField('originalPrice', formData.originalPrice, formData as any);
    const swapValueError = validateField('swapValue', formData.swapValue, formData as any);
    const checkInError = validateField('checkIn', formData.dateRange.checkIn, formData as any);
    const checkOutError = validateField('checkOut', formData.dateRange.checkOut, formData as any);

    // Enhanced provider validation with comprehensive rules
    const providerError = validateProviderSelection(
      formData.providerDetails.provider,
      customProvider,
      isOtherProvider
    );

    const confirmationError = validateField('confirmationNumber', formData.providerDetails.confirmationNumber, formData as any);

    if (titleError) errors.title = titleError;
    if (descriptionError) errors.description = descriptionError;
    if (cityError || countryError) errors.location = cityError || countryError;
    if (originalPriceError) errors.originalPrice = originalPriceError;
    if (swapValueError) errors.swapValue = swapValueError;
    if (checkInError || checkOutError) errors.dateRange = checkInError || checkOutError;
    if (providerError || confirmationError) errors.providerDetails = providerError || confirmationError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (field: keyof BookingEditData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));

    // Real-time validation for touched fields
    if (touched[field]) {
      const newErrors = { ...validationErrors };

      if (field === 'location') {
        newErrors.location = validateField('city', value.city, formData as any) || validateField('country', value.country, formData as any);
      } else if (field === 'dateRange') {
        newErrors.dateRange = validateField('checkIn', value.checkIn, formData as any) || validateField('checkOut', value.checkOut, formData as any);
      } else if (field === 'providerDetails') {
        // Enhanced provider validation for real-time feedback
        const providerError = validateProviderSelection(
          value.provider,
          customProvider,
          isOtherProvider
        );
        const confirmationError = validateField('confirmationNumber', value.confirmationNumber, formData as any);
        newErrors.providerDetails = providerError || confirmationError;
      } else {
        newErrors[field as keyof BookingEditErrors] = validateField(field as string, value, formData as any);
      }

      setValidationErrors(newErrors);
    }
  };

  const handleProviderChange = (selectedProvider: string) => {
    if (selectedProvider === 'Other') {
      setIsOtherProvider(true);
      setCustomProviderError(''); // Reset custom provider error
      // Don't update the form data yet - wait for custom input
      setFormData(prev => ({
        ...prev,
        providerDetails: {
          ...prev.providerDetails,
          provider: customProvider || '', // Use existing custom value or empty
        }
      }));

      // Announce provider change to screen readers
      announce(
        'Other provider selected. Custom provider input field is now available.',
        'polite'
      );
    } else {
      setIsOtherProvider(false);
      setCustomProvider('');
      setCustomProviderError(''); // Reset custom provider error
      setFormData(prev => ({
        ...prev,
        providerDetails: {
          ...prev.providerDetails,
          provider: selectedProvider,
        }
      }));

      // Announce provider selection to screen readers
      const selectedProviderLabel = BOOKING_PROVIDERS.find(p => p.value === selectedProvider)?.label || selectedProvider;
      announce(
        `Provider changed to ${selectedProviderLabel}`,
        'polite'
      );
    }
    setTouched(prev => ({ ...prev, providerDetails: true }));
  };

  const handleCustomProviderChange = (value: string) => {
    setCustomProvider(value);
    setFormData(prev => ({
      ...prev,
      providerDetails: {
        ...prev.providerDetails,
        provider: value,
      }
    }));
    setTouched(prev => ({ ...prev, providerDetails: true }));

    // Real-time validation for custom provider with debouncing
    debouncedCustomProviderValidator(value);

    // Update form validation errors in real-time
    if (touched.providerDetails) {
      const newErrors = { ...validationErrors };
      const providerError = validateProviderSelection(
        formData.providerDetails.provider,
        value,
        isOtherProvider
      );
      const confirmationError = validateField('confirmationNumber', formData.providerDetails.confirmationNumber, formData as any);
      newErrors.providerDetails = providerError || confirmationError;
      setValidationErrors(newErrors);
    }

    // Announce custom provider changes to screen readers (debounced)
    if (value.trim().length > 0) {
      setTimeout(() => {
        announce(`Custom provider name: ${value}`, 'polite');
      }, 500); // Debounce to avoid too many announcements while typing
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    const allFields = ['title', 'description', 'location', 'dateRange', 'originalPrice', 'swapValue', 'providerDetails'];
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    if (!validateForm()) {
      // Announce validation errors to screen readers
      const errorCount = getValidationErrorCount(validationErrors);
      announce(
        `Form submission failed. ${errorCount} validation error${errorCount !== 1 ? 's' : ''} found. Please review and correct the highlighted fields.`,
        'assertive'
      );

      // Focus the first field with an error
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField && formRef.current) {
        const errorElement = formRef.current.querySelector(`[data-field="${firstErrorField}"]`) as HTMLElement;
        if (errorElement) {
          errorElement.focus();
        }
      }
      return;
    }

    // Announce form submission
    announce('Submitting booking changes...', 'polite');

    try {
      await handleActualSubmit();
    } catch (error) {
      // Error is already handled by handleActualSubmit and parent component
      // Just prevent the form from closing by not re-throwing
      console.log('Form submission failed, keeping modal open for user to retry');

      // Announce error to screen readers
      announce('Booking submission failed. Please review any error messages and try again.', 'assertive');
    }
  };



  const handleClose = async () => {
    if (hasUnsavedChanges) {
      const canClose = await unsavedChanges.navigateWithConfirmation('/bookings');
      if (canClose) {
        statePreservation.clearState();
        // Announce form closure
        announce('Booking edit form closed. Returning to bookings list.', 'polite');
        onClose();
      }
    } else {
      statePreservation.clearState();
      // Announce form closure
      announce('Booking edit form closed. Returning to bookings list.', 'polite');
      onClose();
    }
  };

  // Mobile-optimized styles with enhanced accessibility
  const selectStyles: React.CSSProperties = {
    width: '100%',
    padding: isMobile
      ? `${tokens.spacing[4]} ${tokens.spacing[4]}` // Larger touch targets on mobile
      : `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: isMobile
      ? tokens.typography.fontSize.lg // Larger text on mobile for readability
      : tokens.typography.fontSize.base,
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
    // Ensure minimum height for accessibility
    minHeight: isTouch ? '48px' : '44px',
    // Enhanced touch-friendly styling
    ...(isTouch && {
      WebkitAppearance: 'none' as any, // Remove default iOS styling
      WebkitTapHighlightColor: 'transparent',
      // Prevent zoom on iOS when focusing inputs
      fontSize: '16px',
    }),
    // High contrast mode support
    ...getHighContrastStyles(),
  };

  const textareaStyles = {
    ...selectStyles,
    minHeight: isMobile ? '100px' : '120px', // Slightly smaller on mobile to save space
    resize: isMobile ? 'none' as const : 'vertical' as const, // Disable resize on mobile
    fontFamily: 'inherit',
  };

  const errorCount = getValidationErrorCount(validationErrors);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Booking Details"
      size={isMobile ? "xl" : "lg"} // Full width on mobile

    >
      <ThemedInterface theme={bookingTheme}>
        <style>
          {`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            .booking-edit-modal {
              --modal-background: ${bookingTheme.colors.background};
              --modal-border: ${bookingTheme.colors.border};
            }
            
            .skip-link:focus {
              position: static !important;
              width: auto !important;
              height: auto !important;
              padding: ${tokens.spacing[2]} !important;
              background-color: ${tokens.colors.primary[600]} !important;
              color: white !important;
              text-decoration: none !important;
              border-radius: ${tokens.borderRadius.md} !important;
            }
            
            /* Enhanced focus styles for provider dropdown */
            #provider-select:focus {
              outline: 2px solid ${bookingTheme.colors.primary} !important;
              outline-offset: 2px !important;
              box-shadow: 0 0 0 4px ${bookingTheme.colors.primary}20 !important;
            }
            
            /* Touch-friendly hover states on non-touch devices */
            @media (hover: hover) and (pointer: fine) {
              #provider-select:hover {
                border-color: ${bookingTheme.colors.primary} !important;
              }
            }
            
            /* High contrast mode enhancements */
            @media (prefers-contrast: high) {
              #provider-select {
                border: 2px solid !important;
              }
              
              #provider-select:focus {
                outline: 3px solid !important;
                outline-offset: 2px !important;
              }
              
              .booking-edit-modal {
                border: 2px solid !important;
                background: ButtonFace !important;
                color: ButtonText !important;
              }
            }
            
            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
              * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
              }
            }
          `}
        </style>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxHeight: isMobile ? '90vh' : '80vh', // More height on mobile
          overflow: 'hidden',
        }}>
          <div style={{
            flex: 1,
            overflow: 'auto',
            paddingRight: isMobile ? 0 : tokens.spacing[2], // No right padding on mobile
            // Enable momentum scrolling on iOS
            WebkitOverflowScrolling: 'touch',
            // Improve scrolling performance
            transform: 'translateZ(0)',
          }}>
            {/* Skip links for keyboard users */}
            <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
              <a
                href={`#${formId}`}
                className="skip-link"
                style={getScreenReaderOnlyStyles()}
              >
                Skip to booking form
              </a>
              <a
                href="#provider-section"
                className="skip-link"
                style={getScreenReaderOnlyStyles()}
              >
                Skip to provider information
              </a>
            </div>

            {/* Contextual Help - Collapsed by default on mobile */}
            <ContextualHelp
              theme={bookingTheme}
              title={contextualHelp.booking.title}
              icon={contextualHelp.booking.icon}
              content={contextualHelp.booking.content}
              defaultExpanded={!isMobile} // Collapsed on mobile to save space
            />

            <form
              ref={formRef}
              id={formId}
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[6] }}
              {...getFormSectionAria(formId, 'Booking Edit Form', 'Edit your booking details. This form focuses only on booking information.')}
            >

              {/* Context Indicator - Booking Focused */}
              <div
                style={{
                  padding: tokens.spacing[3],
                  backgroundColor: bookingTheme.colors.background,
                  border: `1px solid ${bookingTheme.colors.border}`,
                  borderRadius: tokens.borderRadius.md,
                  fontWeight: tokens.typography.fontWeight.medium,
                }}
                {...getStatusAria('status', 'polite')}
              >
                <span aria-hidden="true">📝</span>
                <span>Booking Edit Mode - Focus on your booking details only</span>
              </div>

              {/* Unsaved Changes Indicator */}
              {hasUnsavedChanges && (
                <ThemedCard
                  theme={bookingTheme}
                  variant="outlined"
                  style={{
                    backgroundColor: tokens.colors.warning[50],
                    borderColor: tokens.colors.warning[300],
                  }}
                >
                  <div
                    id={unsavedChangesId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[3],
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.warning[800],
                    }}
                    {...getStatusAria('alert', 'polite')}
                  >
                    <span aria-hidden="true" style={{ fontSize: tokens.typography.fontSize.lg }}>⚠️</span>
                    <div>
                      <div style={{
                        fontWeight: tokens.typography.fontWeight.medium,
                        marginBottom: tokens.spacing[1],
                      }}>
                        Unsaved Booking Changes
                      </div>
                      <p style={{ margin: 0, color: tokens.colors.warning[700] }}>
                        Remember to save your changes before navigating away or enabling swapping.
                      </p>
                    </div>
                  </div>
                </ThemedCard>
              )}

              {/* Validation Summary */}
              {errorCount > 0 && (
                <ThemedCard
                  theme={bookingTheme}
                  title={`Booking Validation Errors (${errorCount})`}
                  icon="⚠️"
                  variant="outlined"
                  style={{
                    backgroundColor: tokens.colors.error[50],
                    borderColor: tokens.colors.error[300],
                  }}
                >
                  <div
                    id={errorSummaryId}
                    {...getStatusAria('alert', 'assertive')}
                  >
                    <div style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.error[700],
                      marginBottom: tokens.spacing[3],
                    }}>
                      Please fix the following booking field errors before saving:
                    </div>
                    <ul style={{
                      margin: 0,
                      paddingLeft: tokens.spacing[4],
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.error[700],
                    }}>
                      {Object.entries(validationErrors).map(([field, error]) =>
                        error && (
                          <li key={field} style={{ marginBottom: tokens.spacing[1] }}>
                            <strong>{field}:</strong> {error}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </ThemedCard>
              )}

              {/* Booking Details Section */}
              <ThemedCard theme={bookingTheme} title="Booking Information" icon="📝">
                {/* Booking Type and Title */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '200px 1fr',
                  gap: tokens.spacing[4],
                  marginBottom: tokens.spacing[4]
                }}>
                  <div>
                    <label htmlFor="booking-type" style={{
                      display: 'block',
                      fontSize: tokens.typography.fontSize.sm,
                      fontWeight: tokens.typography.fontWeight.medium,
                      color: bookingTheme.colors.text,
                      marginBottom: tokens.spacing[2],
                    }}>
                      Booking Type *
                    </label>
                    <select
                      id="booking-type"
                      value={formData.type}
                      onChange={e => handleFieldChange('type', e.target.value as BookingType)}
                      style={{
                        ...selectStyles,
                        borderColor: validationErrors.title ? tokens.colors.error[400] : bookingTheme.colors.border,
                      }}
                    >
                      {BOOKING_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="Title"
                    id={titleFieldId}
                    value={formData.title}
                    onChange={e => handleFieldChange('title', e.target.value)}
                    error={validationErrors.title}
                    placeholder="e.g., Luxury Hotel in Paris"
                    required
                    data-field="title"
                    {...getFormFieldAria(
                      titleFieldId,
                      'Booking title',
                      validationErrors.title,
                      undefined,
                      true
                    )}
                  />
                </div>

                {/* Description */}
                <div style={{ marginBottom: tokens.spacing[4] }}>
                  <label htmlFor="description" style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: bookingTheme.colors.text,
                    marginBottom: tokens.spacing[2],
                  }}>
                    Description *
                  </label>
                  <textarea
                    id={descriptionFieldId}
                    value={formData.description}
                    onChange={e => handleFieldChange('description', e.target.value)}
                    placeholder="Describe your booking details, amenities, and any special features..."
                    style={{
                      ...textareaStyles,
                      borderColor: validationErrors.description ? tokens.colors.error[400] : bookingTheme.colors.border,
                      ...getFocusVisibleStyles(bookingTheme.colors.primary),
                      ...getHighContrastStyles(),
                    }}
                    required
                    data-field="description"
                    {...getFormFieldAria(
                      descriptionFieldId,
                      'Booking description',
                      validationErrors.description,
                      'Describe your booking details, amenities, and any special features',
                      true
                    )}
                  />
                  {validationErrors.description && (
                    <div style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.error[600],
                      marginTop: tokens.spacing[1],
                    }}>
                      {validationErrors.description}
                    </div>
                  )}
                </div>
              </ThemedCard>

              {/* Location & Dates Section */}
              <ThemedCard theme={bookingTheme} title="Location & Schedule" icon="📍">
                {/* Location */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: tokens.spacing[4],
                  marginBottom: tokens.spacing[4]
                }}>
                  <Input
                    label="City"
                    value={formData.location.city}
                    onChange={e => handleFieldChange('location', { ...formData.location, city: e.target.value })}
                    error={validationErrors.location}
                    placeholder="e.g., Paris"
                    required
                  />
                  <Input
                    label="Country"
                    value={formData.location.country}
                    onChange={e => handleFieldChange('location', { ...formData.location, country: e.target.value })}
                    placeholder="e.g., France"
                    required
                  />
                </div>

                {/* Dates */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: tokens.spacing[4]
                }}>
                  <Input
                    label="Check-in Date"
                    type="date"
                    value={(() => {
                      try {
                        const checkIn = formData.dateRange.checkIn;
                        if (checkIn instanceof Date) {
                          return checkIn.toISOString().split('T')[0];
                        } else if (typeof checkIn === 'string') {
                          return new Date(checkIn).toISOString().split('T')[0];
                        } else {
                          return new Date().toISOString().split('T')[0];
                        }
                      } catch (error) {
                        console.error('Error formatting check-in date:', error);
                        return new Date().toISOString().split('T')[0];
                      }
                    })()}
                    onChange={e => handleFieldChange('dateRange', {
                      ...formData.dateRange,
                      checkIn: new Date(e.target.value),
                    })}
                    error={validationErrors.dateRange}
                    required
                  />
                  <Input
                    label="Check-out Date"
                    type="date"
                    value={(() => {
                      try {
                        const checkOut = formData.dateRange.checkOut;
                        if (checkOut instanceof Date) {
                          return checkOut.toISOString().split('T')[0];
                        } else if (typeof checkOut === 'string') {
                          return new Date(checkOut).toISOString().split('T')[0];
                        } else {
                          return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        }
                      } catch (error) {
                        console.error('Error formatting check-out date:', error);
                        return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      }
                    })()}
                    onChange={e => handleFieldChange('dateRange', {
                      ...formData.dateRange,
                      checkOut: new Date(e.target.value),
                    })}
                    required
                  />
                </div>
              </ThemedCard>

              {/* Pricing Section */}
              <ThemedCard theme={bookingTheme} title="Pricing Information" icon="💰">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: tokens.spacing[4]
                }}>
                  <Input
                    label="Original Price ($)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.originalPrice || ''}
                    onChange={e => handleFieldChange('originalPrice', parseFloat(e.target.value) || 0)}
                    error={validationErrors.originalPrice}
                    placeholder="0.00"
                    required
                  />
                  <Input
                    label="Swap Value ($)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.swapValue || ''}
                    onChange={e => handleFieldChange('swapValue', parseFloat(e.target.value) || 0)}
                    error={validationErrors.swapValue}
                    placeholder="0.00"
                    helperText="The value you're willing to accept in a swap"
                    required
                  />
                </div>
              </ThemedCard>

              {/* Provider Details Section */}
              <div id="provider-section">
                <ThemedCard
                  theme={bookingTheme}
                  title="Provider Information"
                  icon="🏢"
                >
                  {/* Keyboard navigation instructions for screen readers */}
                  <div
                    id="provider-section-instructions"
                    style={getScreenReaderOnlyStyles()}
                    aria-live="polite"
                  >
                    Provider section. Use Tab to navigate between fields. Use arrow keys to navigate dropdown options. Press Escape to close dropdown or return to provider selection from custom input.
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      // Enhanced responsive grid layout for better mobile experience
                      gridTemplateColumns: isMobile
                        ? '1fr' // Single column on mobile for better touch interaction
                        : isTablet
                          ? isOtherProvider ? '1fr 1fr' : '1fr 1fr' // Two columns on tablet
                          : isOtherProvider ? '1fr 1fr 1fr' : '1fr 1fr 1fr', // Three columns on desktop
                      gap: tokens.spacing[4],
                      // Ensure proper spacing and alignment
                      alignItems: 'start',
                    }}
                    role="group"
                    aria-labelledby="provider-section-title"
                    aria-describedby="provider-section-instructions"
                  >
                    {/* Provider Dropdown with Enhanced Accessibility */}
                    <div>
                      <label htmlFor="provider-select" style={{
                        display: 'block',
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: bookingTheme.colors.text,
                        marginBottom: tokens.spacing[2],
                      }}>
                        Provider *
                      </label>
                      <select
                        id="provider-select"
                        value={isOtherProvider ? 'Other' : formData.providerDetails.provider}
                        onChange={e => handleProviderChange(e.target.value)}
                        onKeyDown={(e) => {
                          // Enhanced keyboard navigation for provider dropdown
                          if (e.key === 'Enter' || e.key === ' ') {
                            // Let the browser handle the dropdown opening
                            return;
                          }

                          // Arrow key navigation with screen reader announcements
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            // The browser will handle the selection change
                            // We'll announce the change in the onChange handler
                            return;
                          }

                          // Escape key to close dropdown
                          if (e.key === 'Escape') {
                            (e.target as HTMLSelectElement).blur();
                          }
                        }}
                        style={{
                          ...selectStyles,
                          borderColor: validationErrors.providerDetails ? tokens.colors.error[400] : bookingTheme.colors.border,
                        }}
                        required
                        data-field="providerDetails"
                        {...getFormFieldAria(
                          'provider-select',
                          'Booking provider',
                          validationErrors.providerDetails,
                          'Select your booking provider or choose Other for custom entry. Use arrow keys to navigate options.',
                          true
                        )}
                        aria-expanded={false} // Will be managed by browser for select elements
                        aria-haspopup="listbox"
                      >
                        <option value="">Select a provider...</option>
                        {BOOKING_PROVIDERS.map(provider => (
                          <option key={provider.value} value={provider.value}>
                            {provider.icon} {provider.label}
                          </option>
                        ))}
                      </select>

                      {/* Live region for provider selection announcements */}
                      <div
                        id="provider-selection-status"
                        aria-live="polite"
                        aria-atomic="true"
                        style={getScreenReaderOnlyStyles()}
                      />

                      {validationErrors.providerDetails && !isOtherProvider && (
                        <div
                          id="provider-select-error"
                          role="alert"
                          aria-live="assertive"
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.error[600],
                            marginTop: tokens.spacing[1],
                          }}
                        >
                          {validationErrors.providerDetails}
                        </div>
                      )}
                    </div>

                    {/* Custom Provider Input (shown when "Other" is selected) */}
                    {isOtherProvider && (
                      <div style={{
                        gridColumn: isMobile ? '1' : '2',
                        // Smooth transition for better UX
                        animation: 'fadeIn 0.2s ease-in-out',
                      }}>
                        <Input
                          label="Custom Provider"
                          value={customProvider}
                          onChange={e => handleCustomProviderChange(e.target.value)}
                          placeholder="Enter provider name (e.g., Hotel Direct, Travel Agent)"
                          required
                          autoFocus={isOtherProvider} // Auto-focus when "Other" is selected
                          maxLength={100} // Reasonable limit for provider names
                          error={customProviderError || (validationErrors.providerDetails && isOtherProvider ? validationErrors.providerDetails : '')}
                          style={{
                            // Enhanced touch-friendly sizing
                            minHeight: isTouch ? '48px' : '44px',
                            fontSize: isMobile ? '16px' : tokens.typography.fontSize.base, // Prevent zoom on iOS
                          }}
                          aria-describedby="custom-provider-help custom-provider-validation"
                          onKeyDown={(e) => {
                            // Enhanced keyboard navigation
                            if (e.key === 'Escape') {
                              // Allow users to escape back to provider dropdown
                              const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
                              if (providerSelect) {
                                providerSelect.focus();
                              }
                            }
                          }}
                        />

                        {/* Helper text for custom provider */}
                        <div
                          id="custom-provider-help"
                          style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.colors.neutral[600],
                            marginTop: tokens.spacing[1],
                          }}
                        >
                          Enter the name of your booking provider (2-100 characters). Only letters, numbers, spaces, hyphens, periods, apostrophes, and ampersands are allowed.
                        </div>

                        {/* Real-time validation feedback */}
                        <div
                          id="custom-provider-validation"
                          aria-live="polite"
                          aria-atomic="true"
                          style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: customProviderError ? tokens.colors.error[600] : tokens.colors.success[600],
                            marginTop: tokens.spacing[1],
                            minHeight: '1.2em', // Reserve space to prevent layout shift
                            opacity: customProvider.length > 0 ? 1 : 0,
                            transition: 'opacity 0.2s ease-in-out',
                          }}
                        >
                          {customProviderError || (customProvider.length >= 2 && !customProviderError ? '✓ Valid provider name' : '')}
                        </div>

                        {/* Live region for screen reader announcements */}
                        <div
                          id="custom-provider-status"
                          aria-live="polite"
                          aria-atomic="true"
                          style={getScreenReaderOnlyStyles()}
                        />
                      </div>
                    )}
                    <Input
                      label="Confirmation Number"
                      value={formData.providerDetails.confirmationNumber}
                      onChange={e => handleFieldChange('providerDetails', {
                        ...formData.providerDetails,
                        confirmationNumber: e.target.value,
                      })}
                      placeholder="e.g., ABC123456"
                      required
                      style={{
                        // Enhanced touch-friendly sizing
                        minHeight: isTouch ? '48px' : '44px',
                        fontSize: isMobile ? '16px' : tokens.typography.fontSize.base, // Prevent zoom on iOS
                      }}
                    />
                    <Input
                      label="Booking Reference"
                      value={formData.providerDetails.bookingReference}
                      onChange={e => handleFieldChange('providerDetails', {
                        ...formData.providerDetails,
                        bookingReference: e.target.value,
                      })}
                      placeholder="e.g., REF789 (optional)"
                      style={{
                        // Enhanced touch-friendly sizing
                        minHeight: isTouch ? '48px' : '44px',
                        fontSize: isMobile ? '16px' : tokens.typography.fontSize.base, // Prevent zoom on iOS
                      }}
                    />
                  </div>
                </ThemedCard>
              </div>

              {/* Form Actions */}
              <ThemedCard theme={bookingTheme} variant="outlined">
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: tokens.spacing[3],
                  flexDirection: isMobile ? 'column-reverse' : 'row',
                }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    style={{
                      minHeight: isTouch ? '44px' : 'auto',
                      fontSize: isMobile ? tokens.typography.fontSize.base : tokens.typography.fontSize.sm,
                    }}
                    {...getButtonAria('Cancel booking edit and return to bookings list')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={loading || isSubmitting || unsavedChanges.isSaving}
                    disabled={!hasUnsavedChanges && !booking}
                    style={{
                      backgroundColor: bookingTheme.colors.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: tokens.borderRadius.md,
                      padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                      minWidth: isMobile ? 'auto' : '140px',
                      minHeight: isTouch ? '44px' : 'auto',
                      fontSize: isMobile ? tokens.typography.fontSize.base : tokens.typography.fontSize.sm,
                    }}
                    {...getButtonAria(
                      hasUnsavedChanges
                        ? 'Save booking changes and update the booking'
                        : 'Update booking with current information'
                    )}
                  >
                    {hasUnsavedChanges ? 'Save Changes' : 'Update Booking'}
                  </Button>
                </div>
              </ThemedCard>
            </form>
          </div>
        </div>
      </ThemedInterface>
    </Modal >
  );
};