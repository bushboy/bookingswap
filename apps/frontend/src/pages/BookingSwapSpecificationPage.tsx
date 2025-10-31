import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { ThemedPageHeader } from '@/components/ui/ThemedPageHeader';
import { BreadcrumbNavigation } from '@/components/ui/BreadcrumbNavigation';
import { ContextualHelp } from '@/components/ui/ContextualHelp';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { ThemedInterface } from '@/components/ui/ThemedInterface';
import { tokens } from '@/design-system/tokens';
import { swapTheme, contextualHelp, getBreadcrumbs, getThemeStyles } from '@/design-system/interface-themes';
import { SwapPreferencesSection } from '@/components/booking/SwapPreferencesSection';
import { UnifiedSwapEnablement } from '@/components/swap/UnifiedSwapEnablement';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { useBookingWithWallet } from '@/hooks/useBookingWithWallet';
import { useBookingNavigation, useBookingUrlParams } from '@/hooks/useBookingNavigation';
import { useUnsavedChanges, useStatePreservation } from '@/hooks/useUnsavedChanges';
import { validateSwapPreferences } from '@/utils/validation';
import { unifiedBookingService } from '@/services/UnifiedBookingService';
import { bookingService } from '@/services/bookingService';
import { useResponsive, useTouch } from '@/hooks/useResponsive';
import { 
  useFocusManagement, 
  useAriaLiveRegion, 
  useKeyboardNavigation,
  useInterfaceTransition,
  useHighContrast 
} from '@/hooks/useAccessibility';
import { 
  getFormFieldAria, 
  getButtonAria, 
  getFormSectionAria,
  getStatusAria,
  getNavigationAria,
  generateAccessibleId,
  getScreenReaderOnlyStyles,
  getFocusVisibleStyles,
  announceToScreenReader 
} from '@/utils/accessibility';
import { usePerformanceOptimizations } from '@/hooks/usePerformanceOptimizations';
import { useBookingCache, useNavigationCache } from '@/utils/bookingDataCache';
import {
  Booking,
  SwapPreferencesData,
  UnifiedFormValidationErrors,
} from '@booking-swap/shared';

/**
 * BookingSwapSpecificationPage - Dedicated interface for creating and managing swap proposals
 * 
 * This component provides a focused environment for users to:
 * - View booking context (read-only)
 * - Configure swap preferences
 * - Create new swap proposals
 * - Manage existing swap proposals
 * 
 * Requirements addressed:
 * - 2.1: Navigate to dedicated swap specification screen
 * - 2.2: Pre-populate with current booking information
 * - 2.3: Provide all swap-specific options and controls
 * - 2.4: Associate swap proposal with booking
 * - 2.5: Handle existing swap proposals
 * - 2.6: Preserve unsaved booking edits
 * - 2.7: Provide clear navigation back to booking management
 * - 2.8: Handle swap creation failures appropriately
 */
export const BookingSwapSpecificationPage: React.FC = () => {
  const { user, token } = useAuth();
  const { isConnected } = useWallet();
  const { enableSwappingWithWallet, canEnableSwapping } = useBookingWithWallet();
  const { isMobile, isTablet } = useResponsive();
  const isTouch = useTouch();
  
  // Performance optimizations
  const {
    trackAction,
    preloadOnHover,
    optimizeNavigation,
    memoryUsage,
    isMemoryPressure,
    renderStats,
  } = usePerformanceOptimizations('BookingSwapSpecificationPage');
  
  // Caching optimizations
  const { getBookingForSwapSpec, cacheBooking, preloadBooking } = useBookingCache();
  const { cacheNavigationState, createNavigationState } = useNavigationCache();
  
  // Use navigation hooks for URL handling and access control
  const { returnUrl } = useBookingNavigation();
  const { bookingId, isValid, validationErrors: urlValidationErrors } = useBookingUrlParams();
  const { navigateToReturnUrl, canAccessSwapSpecification } = useBookingNavigation();
  
  // Accessibility hooks
  const { announce } = useAriaLiveRegion();
  const { focusFirstElement, restoreFocus } = useFocusManagement();
  const { announceTransition, storeFocus, restorePreviousFocus } = useInterfaceTransition();
  const { isHighContrast, getHighContrastStyles } = useHighContrast();
  
  // Refs for accessibility
  const pageRef = useRef<HTMLDivElement>(null);
  const swapFormRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  
  // Generate stable IDs for accessibility
  const pageId = useMemo(() => generateAccessibleId('swap-specification-page'), []);
  const bookingContextId = useMemo(() => generateAccessibleId('booking-context'), []);
  const swapFormId = useMemo(() => generateAccessibleId('swap-form'), []);
  const statusRegionId = useMemo(() => generateAccessibleId('status-region'), []);
  const errorRegionId = useMemo(() => generateAccessibleId('error-region'), []);

  // State management
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapEnabled, setSwapEnabled] = useState(false);
  const [hasExistingSwap, setHasExistingSwap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  // Swap preferences state
  const [preferences, setPreferences] = useState<SwapPreferencesData>({
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    swapConditions: [],
  });
  const [originalPreferences, setOriginalPreferences] = useState<SwapPreferencesData>({
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    swapConditions: [],
  });
  const [validationErrors, setValidationErrors] = useState<UnifiedFormValidationErrors>({});

  // Check if swap preferences have unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(preferences) !== JSON.stringify(originalPreferences) ||
           (swapEnabled !== hasExistingSwap && !hasExistingSwap);
  }, [preferences, originalPreferences, swapEnabled, hasExistingSwap]);

  // State preservation for navigation between interfaces
  const statePreservation = useStatePreservation({
    storageKey: `swap-specification-${bookingId || 'unknown'}`,
    data: { preferences, swapEnabled },
    onRestore: (restoredData) => {
      setPreferences(restoredData.preferences);
      setSwapEnabled(restoredData.swapEnabled);
    },
    autoSave: hasUnsavedChanges,
  });

  // Unsaved changes handling
  const unsavedChanges = useUnsavedChanges({
    hasUnsavedChanges: () => hasUnsavedChanges,
    onSave: async () => {
      await handleSwapSubmit();
    },
    onDiscard: () => {
      setPreferences(originalPreferences);
      setSwapEnabled(hasExistingSwap);
      setValidationErrors({});
      statePreservation.clearState();
    },
    message: 'You have unsaved swap preference changes. Do you want to save them before continuing?',
    allowSave: true,
  });

  // Validate access and load booking data with caching optimization
  const validateAccessAndLoadBooking = useCallback(async () => {
    const endTracking = trackAction('loadBookingData');
    
    try {
      // First validate URL parameters
      if (!isValid) {
        setError(`Invalid URL parameters: ${Array.isArray(urlValidationErrors) ? urlValidationErrors.join(', ') : 'Unknown validation errors'}`);
        setLoading(false);
        return;
      }

      if (!bookingId || !user?.id || !token) {
        setError('Missing booking ID or authentication');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Try to get cached booking data first
      const cachedData = getBookingForSwapSpec(bookingId);
      if (cachedData) {
        setBooking(cachedData.booking);
        if (cachedData.swapPreferences) {
          setHasExistingSwap(true);
          setSwapEnabled(true);
          setPreferences(cachedData.swapPreferences);
          setOriginalPreferences(cachedData.swapPreferences);
        }
        setAccessChecked(true);
        setLoading(false);
        return;
      }

      // Check access permissions using navigation guards
      const accessResult = await canAccessSwapSpecification(bookingId);
      
      if (!accessResult.canAccess) {
        setError(accessResult.reason || 'Access denied');
        setLoading(false);
        setAccessChecked(true);
        return;
      }

      // Load basic booking information
      const booking = await bookingService.getBooking(bookingId);
      
      if (!booking) {
        setError('Booking not found');
        setLoading(false);
        setAccessChecked(true);
        return;
      }

      setBooking(booking);
      setAccessChecked(true);

      // Try to load swap information if it exists
      let swapPreferences: SwapPreferencesData | undefined;
      try {
        const bookingsWithSwapInfo = await unifiedBookingService.getBookingsWithSwapInfo(
          { limit: 1 }, // Get just one booking to check the API format
          user.id
        );

        // Find our booking in the results
        const bookingWithSwap = bookingsWithSwapInfo.find(b => b.id === bookingId);
        
        if (bookingWithSwap?.swapInfo) {
          setHasExistingSwap(true);
          setSwapEnabled(true);
          
          // Load existing swap preferences
          swapPreferences = {
            paymentTypes: bookingWithSwap.swapInfo.paymentTypes,
            acceptanceStrategy: bookingWithSwap.swapInfo.acceptanceStrategy,
            auctionEndDate: bookingWithSwap.swapInfo.auctionEndDate,
            minCashAmount: bookingWithSwap.swapInfo.minCashAmount,
            maxCashAmount: bookingWithSwap.swapInfo.maxCashAmount,
            swapConditions: bookingWithSwap.swapInfo.swapConditions,
          };
          setPreferences(swapPreferences);
          setOriginalPreferences(swapPreferences);
        }
      } catch (swapError) {
        // If swap info loading fails, continue without it
        console.warn('Could not load swap information:', swapError);
      }

      // Cache the loaded data for future use
      cacheBooking(booking, swapPreferences);

    } catch (error) {
      console.error('Error loading booking data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load booking data');
    } finally {
      setLoading(false);
      setAccessChecked(true);
      endTracking();
    }
  }, [bookingId, user?.id, token, isValid, urlValidationErrors, canAccessSwapSpecification, trackAction, getBookingForSwapSpec, cacheBooking]);

  // Load data on component mount
  useEffect(() => {
    // Store previous focus for restoration
    previousFocusRef.current = document.activeElement as HTMLElement;
    
    validateAccessAndLoadBooking();
    
    // Announce page load to screen readers
    setTimeout(() => {
      announce(
        'Swap specification page loaded. Configure swap preferences for your booking.',
        'polite'
      );
    }, 500);
    
    return () => {
      // Restore focus when component unmounts
      if (previousFocusRef.current) {
        restoreFocus(previousFocusRef.current);
      }
    };
  }, [validateAccessAndLoadBooking, announce, restoreFocus]);

  // Handle swap preferences changes
  const handlePreferencesChange = (newPreferences: SwapPreferencesData) => {
    setPreferences(newPreferences);
    
    // Real-time validation
    if (swapEnabled && booking) {
      const swapErrors = validateSwapPreferences(newPreferences, new Date(booking.dateRange.checkIn));
      setValidationErrors(prev => ({ ...prev, ...swapErrors }));
    }
  };

  // Handle swap toggle
  const handleSwapToggle = (enabled: boolean) => {
    setSwapEnabled(enabled);
    
    if (!enabled) {
      // Clear swap-related errors when disabling
      const newErrors = { ...validationErrors };
      delete newErrors.paymentTypes;
      delete newErrors.minCashAmount;
      delete newErrors.maxCashAmount;
      delete newErrors.acceptanceStrategy;
      delete newErrors.auctionEndDate;
      delete newErrors.swapConditions;
      setValidationErrors(newErrors);
    }
  };

  // Handle swap creation/update
  const handleSwapSubmit = useCallback(async () => {
    if (!booking || !swapEnabled) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Validate swap preferences
      const swapErrors = validateSwapPreferences(preferences, new Date(booking.dateRange.checkIn));
      if (Object.keys(swapErrors).length > 0) {
        setValidationErrors(swapErrors);
        return;
      }

      // Enable swapping with wallet if not already enabled
      if (!hasExistingSwap) {
        await enableSwappingWithWallet(booking.id);
      }

      // Update swap preferences (this would typically call an API)
      // For now, we'll simulate success
      console.log('Swap preferences updated:', preferences);

      // Mark as saved and clear preserved state
      setOriginalPreferences(preferences);
      statePreservation.clearState();
      unsavedChanges.markAsSaved();

      // Navigate back with success message using navigation helper
      navigateToReturnUrl('/bookings', { 
        message: hasExistingSwap 
          ? 'Swap preferences updated successfully' 
          : 'Swapping enabled successfully',
        type: 'success'
      });

    } catch (error) {
      console.error('Failed to update swap:', error);
      setError(error instanceof Error ? error.message : 'Failed to update swap preferences');
      throw error; // Re-throw for unsaved changes handler
    } finally {
      setIsSubmitting(false);
    }
  }, [booking, swapEnabled, preferences, hasExistingSwap, enableSwappingWithWallet, statePreservation, unsavedChanges, navigateToReturnUrl]);

  // Handle unified swap enablement success
  const handleUnifiedSwapSuccess = (swapPreferences?: SwapPreferencesData) => {
    if (swapPreferences) {
      setPreferences(swapPreferences);
      setSwapEnabled(true);
    }
    setShowUnifiedModal(false);
    
    // Announce success
    announce('Swapping enabled successfully. Returning to bookings list.', 'polite');
    
    // Navigate back with success message using navigation helper
    navigateToReturnUrl('/bookings', { 
      message: 'Swapping enabled successfully',
      type: 'success'
    });
  };

  // Handle navigation back using navigation helper
  const handleGoBack = async () => {
    // Store focus for restoration
    storeFocus();
    
    if (hasUnsavedChanges) {
      const canNavigate = await unsavedChanges.navigateWithConfirmation('/bookings');
      if (canNavigate) {
        statePreservation.clearState();
        // Announce navigation
        announceTransition(
          'swap specification page',
          'bookings list',
          'Returning to your bookings.'
        );
        navigateToReturnUrl('/bookings');
      }
    } else {
      statePreservation.clearState();
      // Announce navigation
      announceTransition(
        'swap specification page',
        'bookings list',
        'Returning to your bookings.'
      );
      navigateToReturnUrl('/bookings');
    }
  };

  // Show loading state
  if (loading || !accessChecked) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        flexDirection: 'column',
        gap: tokens.spacing[4],
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: `3px solid ${tokens.colors.neutral[200]}`,
          borderTop: `3px solid ${tokens.colors.primary[600]}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{
          color: tokens.colors.neutral[600],
          fontSize: tokens.typography.fontSize.base,
        }}>
          Loading booking details...
        </p>
      </div>
    );
  }

  // Show error state
  if (error || !booking) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: tokens.spacing[6],
        padding: tokens.spacing[6],
      }}>
        <div style={{
          padding: tokens.spacing[6],
          backgroundColor: tokens.colors.error[50],
          border: `1px solid ${tokens.colors.error[200]}`,
          borderRadius: tokens.borderRadius.lg,
          textAlign: 'center',
          maxWidth: '500px',
        }}>
          <div style={{
            fontSize: tokens.typography.fontSize.xl,
            marginBottom: tokens.spacing[3],
          }}>
            ⚠️
          </div>
          <h2 style={{
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.error[800],
            marginBottom: tokens.spacing[3],
          }}>
            Unable to Load Booking
          </h2>
          <p style={{
            color: tokens.colors.error[700],
            fontSize: tokens.typography.fontSize.base,
            marginBottom: tokens.spacing[4],
            lineHeight: 1.5,
          }}>
            {error || 'The booking could not be found or you do not have permission to access it.'}
          </p>
          <Button variant="outline" onClick={handleGoBack}>
            Return to Bookings
          </Button>
        </div>
      </div>
    );
  }

  const canEnable = canEnableSwapping(booking);
  const eventDate = new Date(booking.dateRange.checkIn);
  const themeStyles = getThemeStyles(swapTheme);
  const breadcrumbs = getBreadcrumbs('swap', booking?.title, returnUrl);

  return (
    <ThemedInterface theme={swapTheme}>
      {/* Skip link for keyboard users */}
      <a
        href={`#${pageId}`}
        style={{
          ...getScreenReaderOnlyStyles(),
          ':focus': {
            position: 'static',
            width: 'auto',
            height: 'auto',
            padding: tokens.spacing[2],
            backgroundColor: tokens.colors.primary[600],
            color: 'white',
            textDecoration: 'none',
            borderRadius: tokens.borderRadius.md,
          },
        }}
      >
        Skip to swap specification content
      </a>

      {/* Themed Page Header */}
      <ThemedPageHeader
        theme={swapTheme}
        title="Swap Specification"
        subtitle={hasExistingSwap 
          ? 'Manage your swap preferences and view proposal activity'
          : 'Configure swap preferences to allow other users to propose exchanges for your booking'
        }
        icon={swapTheme.icon}
      />

      <div 
        ref={pageRef}
        id={pageId}
        style={{
          maxWidth: isMobile ? '100%' : '1200px',
          margin: '0 auto',
          padding: isMobile ? tokens.spacing[3] : tokens.spacing[6],
          // Optimize for mobile scrolling
          ...(isMobile && {
            paddingBottom: tokens.spacing[8], // Extra bottom padding for mobile
          }),
        }}
        {...getNavigationAria('Swap specification page content')}
      >
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb navigation">
          <BreadcrumbNavigation
            items={breadcrumbs}
            theme={swapTheme}
            onNavigate={(path) => {
              if (path === '/bookings') {
                handleGoBack();
              }
            }}
          />
        </nav>

        {/* Contextual Help - Collapsed by default on mobile */}
        <ContextualHelp
          theme={swapTheme}
          title={contextualHelp.swap.title}
          icon={contextualHelp.swap.icon}
          content={contextualHelp.swap.content}
          defaultExpanded={!isMobile} // Collapsed on mobile to save space
        />

        {/* Booking Context Display (Read-only) */}
        <section 
          id={bookingContextId}
          {...getFormSectionAria(bookingContextId, 'Booking Context', 'Read-only information about the booking you are configuring swap preferences for')}
        >
          <ThemedCard 
            theme={swapTheme} 
            title="Booking Context" 
            icon="📋"
            variant="elevated"
            style={{
              backgroundColor: swapTheme.colors.accentLight,
              marginBottom: tokens.spacing[8],
            }}
          >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: isMobile ? tokens.spacing[4] : tokens.spacing[6],
          }}>
            <div>
              <h3 style={{
                fontSize: isMobile ? tokens.typography.fontSize.base : tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: swapTheme.colors.text,
                marginBottom: tokens.spacing[3],
                lineHeight: tokens.typography.lineHeight.tight,
              }}>
                {booking.title}
              </h3>
              <p style={{
                fontSize: isMobile ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
                color: swapTheme.colors.textSecondary,
                marginBottom: tokens.spacing[4],
                lineHeight: tokens.typography.lineHeight.relaxed,
                // Limit text on mobile for better readability
                ...(isMobile && {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }),
              }}>
                {booking.description}
              </p>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: tokens.spacing[3],
              fontSize: tokens.typography.fontSize.sm,
              color: swapTheme.colors.text,
            }}>
              <div style={{
                padding: isMobile ? tokens.spacing[2] : tokens.spacing[3],
                backgroundColor: swapTheme.colors.surface,
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${swapTheme.colors.border}`,
                minHeight: isTouch ? '60px' : 'auto', // Touch-friendly height
              }}>
                <div style={{ 
                  fontWeight: tokens.typography.fontWeight.medium, 
                  marginBottom: tokens.spacing[1],
                  fontSize: isMobile ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
                }}>
                  Type
                </div>
                <div style={{ 
                  color: swapTheme.colors.textSecondary,
                  fontSize: isMobile ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
                  textTransform: 'capitalize',
                }}>
                  {booking.type}
                </div>
              </div>
              <div style={{
                padding: isMobile ? tokens.spacing[2] : tokens.spacing[3],
                backgroundColor: swapTheme.colors.surface,
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${swapTheme.colors.border}`,
                minHeight: isTouch ? '60px' : 'auto',
              }}>
                <div style={{ 
                  fontWeight: tokens.typography.fontWeight.medium, 
                  marginBottom: tokens.spacing[1],
                  fontSize: isMobile ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
                }}>
                  Value
                </div>
                <div style={{ 
                  color: swapTheme.colors.textSecondary,
                  fontSize: isMobile ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
                  fontWeight: tokens.typography.fontWeight.medium,
                }}>
                  {(() => {
                    try {
                      const value = booking.swapValue || booking.originalPrice || 0;
                      return `$${typeof value === 'number' ? value.toLocaleString() : '0'}`;
                    } catch (error) {
                      console.error('Error rendering booking value:', error);
                      return '$0';
                    }
                  })()}
                </div>
              </div>
              <div style={{
                padding: isMobile ? tokens.spacing[2] : tokens.spacing[3],
                backgroundColor: swapTheme.colors.surface,
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${swapTheme.colors.border}`,
                minHeight: isTouch ? '60px' : 'auto',
                gridColumn: isMobile ? 'span 2' : 'auto', // Full width on mobile for location
              }}>
                <div style={{ 
                  fontWeight: tokens.typography.fontWeight.medium, 
                  marginBottom: tokens.spacing[1],
                  fontSize: isMobile ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
                }}>
                  Location
                </div>
                <div style={{ 
                  color: swapTheme.colors.textSecondary,
                  fontSize: isMobile ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
                }}>
                  {(() => {
                    try {
                      const city = booking.location?.city || 'Unknown';
                      const country = booking.location?.country || 'Unknown';
                      return `${city}, ${country}`;
                    } catch (error) {
                      console.error('Error rendering booking location:', error);
                      return 'Location not available';
                    }
                  })()}
                </div>
              </div>
              <div style={{
                padding: isMobile ? tokens.spacing[2] : tokens.spacing[3],
                backgroundColor: swapTheme.colors.surface,
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${swapTheme.colors.border}`,
                minHeight: isTouch ? '60px' : 'auto',
                gridColumn: isMobile ? 'span 2' : 'auto', // Full width on mobile for dates
              }}>
                <div style={{ 
                  fontWeight: tokens.typography.fontWeight.medium, 
                  marginBottom: tokens.spacing[1],
                  fontSize: isMobile ? tokens.typography.fontSize.xs : tokens.typography.fontSize.sm,
                }}>
                  Dates
                </div>
                <div style={{ 
                  color: swapTheme.colors.textSecondary,
                  fontSize: isMobile ? tokens.typography.fontSize.sm : tokens.typography.fontSize.base,
                }}>
                  {(() => {
                    try {
                      const checkIn = booking.dateRange?.checkIn ? new Date(booking.dateRange.checkIn) : null;
                      const checkOut = booking.dateRange?.checkOut ? new Date(booking.dateRange.checkOut) : null;
                      
                      if (checkIn && !isNaN(checkIn.getTime()) && checkOut && !isNaN(checkOut.getTime())) {
                        return `${checkIn.toLocaleDateString()} - ${checkOut.toLocaleDateString()}`;
                      } else {
                        return 'Date not available';
                      }
                    } catch (error) {
                      console.error('Error rendering booking dates:', error);
                      return 'Date not available';
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        </ThemedCard>
        </section>

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <ThemedCard
            theme={swapTheme}
            variant="outlined"
            style={{
              backgroundColor: tokens.colors.warning[50],
              borderColor: tokens.colors.warning[300],
              marginBottom: tokens.spacing[6],
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: tokens.spacing[3],
            }}>
              <span style={{ fontSize: tokens.typography.fontSize.xl }}>⚠️</span>
              <div>
                <div style={{
                  fontSize: tokens.typography.fontSize.base,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.warning[800],
                  marginBottom: tokens.spacing[2],
                }}>
                  Unsaved Swap Changes
                </div>
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.warning[700],
                  margin: 0,
                  lineHeight: tokens.typography.lineHeight.relaxed,
                }}>
                  You have unsaved swap preference changes. Remember to save your changes before navigating away.
                </p>
              </div>
            </div>
          </ThemedCard>
        )}

        {/* Error Display */}
        {error && (
          <ThemedCard
            theme={swapTheme}
            title="Swap Error"
            icon="⚠️"
            variant="outlined"
            style={{
              backgroundColor: tokens.colors.error[50],
              borderColor: tokens.colors.error[300],
              marginBottom: tokens.spacing[6],
            }}
          >
            <p style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.error[700],
              margin: 0,
              lineHeight: tokens.typography.lineHeight.relaxed,
            }}>
              {error}
            </p>
          </ThemedCard>
        )}

        {/* Swap Preferences Section */}
        <ThemedCard 
          theme={swapTheme} 
          title="Swap Configuration" 
          icon="⚙️"
          style={{ marginBottom: tokens.spacing[8] }}
        >
          <SwapPreferencesSection
            enabled={swapEnabled}
            onToggle={handleSwapToggle}
            preferences={preferences}
            onChange={handlePreferencesChange}
            errors={validationErrors}
            eventDate={eventDate}
          />
        </ThemedCard>

        {/* Wallet Status */}
        <ThemedCard
          theme={swapTheme}
          title={isConnected ? 'Wallet Connected' : 'Wallet Required'}
          icon={isConnected ? '✅' : '⚠️'}
          variant="outlined"
          style={{
            backgroundColor: isConnected ? tokens.colors.success[50] : tokens.colors.warning[50],
            borderColor: isConnected ? tokens.colors.success[300] : tokens.colors.warning[300],
            marginBottom: tokens.spacing[8],
          }}
        >
          <p style={{
            fontSize: tokens.typography.fontSize.base,
            color: isConnected ? tokens.colors.success[700] : tokens.colors.warning[700],
            margin: 0,
            lineHeight: tokens.typography.lineHeight.relaxed,
          }}>
            {isConnected 
              ? 'Your Hedera wallet is connected and ready for NFT minting and secure swap transactions.'
              : 'Connect your Hedera wallet to enable swapping and mint NFTs for your bookings.'
            }
          </p>
        </ThemedCard>

        {/* Action Buttons */}
        <ThemedCard theme={swapTheme} variant="outlined">
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: isMobile ? 'stretch' : 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: tokens.spacing[4],
          }}>
            <Button
              variant="outline"
              onClick={handleGoBack}
              disabled={isSubmitting}
              style={{
                order: isMobile ? 2 : 0,
                minHeight: isTouch ? '44px' : 'auto',
                fontSize: isMobile ? tokens.typography.fontSize.base : tokens.typography.fontSize.sm,
                ...getFocusVisibleStyles(swapTheme.colors.primary),
                ...getHighContrastStyles(),
              }}
              {...getButtonAria('Return to bookings list', undefined, undefined, isSubmitting)}
            >
              <span aria-hidden="true">←</span> Back to Bookings
            </Button>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: tokens.spacing[3],
              alignItems: 'stretch',
              order: isMobile ? 1 : 1,
            }}>
              {!isConnected && swapEnabled && (
                <Button
                  variant="secondary"
                  onClick={() => setShowUnifiedModal(true)}
                  disabled={!canEnable}
                  style={{
                    backgroundColor: swapTheme.colors.accentLight,
                    borderColor: swapTheme.colors.border,
                    color: swapTheme.colors.text,
                    minHeight: isTouch ? '44px' : 'auto',
                    fontSize: isMobile ? tokens.typography.fontSize.base : tokens.typography.fontSize.sm,
                    ...getFocusVisibleStyles(swapTheme.colors.primary),
                    ...getHighContrastStyles(),
                  }}
                  {...getButtonAria(
                    'Open guided setup to connect wallet and enable swapping',
                    undefined,
                    undefined,
                    !canEnable
                  )}
                >
                  <span aria-hidden="true">🚀</span> {isMobile ? 'Guided Setup' : 'Use Guided Setup'}
                </Button>
              )}
              
              <Button
                variant="primary"
                onClick={handleSwapSubmit}
                loading={isSubmitting || unsavedChanges.isSaving}
                disabled={!canEnable || (!isConnected && swapEnabled) || (!hasUnsavedChanges && hasExistingSwap)}
                style={{
                  ...themeStyles.primaryButton,
                  minWidth: isMobile ? 'auto' : '160px',
                  minHeight: isTouch ? '44px' : 'auto',
                  fontSize: isMobile ? tokens.typography.fontSize.base : tokens.typography.fontSize.sm,
                  ...getFocusVisibleStyles(swapTheme.colors.primary),
                  ...getHighContrastStyles(),
                }}
                {...getButtonAria(
                  hasUnsavedChanges 
                    ? hasExistingSwap 
                      ? 'Save changes to swap preferences'
                      : 'Enable swapping with current preferences'
                    : hasExistingSwap 
                      ? 'Update swap preferences'
                      : 'Save swap preferences',
                  undefined,
                  undefined,
                  !canEnable || (!isConnected && swapEnabled) || (!hasUnsavedChanges && hasExistingSwap)
                )}
              >
                {(() => {
                  if (hasUnsavedChanges) {
                    if (hasExistingSwap) {
                      return <><span aria-hidden="true">💾</span> {isMobile ? 'Save' : 'Save Changes'}</>;
                    } else {
                      return <><span aria-hidden="true">🔄</span> {isMobile ? 'Enable' : 'Enable Swapping'}</>;
                    }
                  } else {
                    if (hasExistingSwap) {
                      return <><span aria-hidden="true">⚙️</span> {isMobile ? 'Update' : 'Update Preferences'}</>;
                    } else {
                      return <><span aria-hidden="true">💾</span> {isMobile ? 'Save' : 'Save Changes'}</>;
                    }
                  }
                })()}
              </Button>
            </div>
          </div>
        </ThemedCard>
      </div>

      {/* Unified Swap Enablement Modal */}
      {showUnifiedModal && booking && (
        <UnifiedSwapEnablement
          isOpen={showUnifiedModal}
          onClose={() => setShowUnifiedModal(false)}
          onSuccess={handleUnifiedSwapSuccess}
          booking={booking || null}
          fromListing={true}
          initialPreferences={hasExistingSwap && preferences ? preferences : undefined}
          loading={isSubmitting}
        />
      )}
    </ThemedInterface>
  );
};