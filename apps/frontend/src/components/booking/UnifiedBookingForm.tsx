import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { tokens } from '@/design-system/tokens';
import { UnifiedSwapEnablement } from '@/components/swap/UnifiedSwapEnablement';
import { validateField, validateSwapPreferences, getValidationErrorCount } from '@/utils/validation';
import { useWallet } from '@/hooks/useWallet';
import {
  UnifiedBookingData,
  UnifiedFormValidationErrors,
  SwapPreferencesData,
  BookingType,
  Booking,
} from '@booking-swap/shared';
import {
  getBookingTypeOptions,
  EnabledBookingType
} from '@booking-swap/shared';

export interface UnifiedBookingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UnifiedBookingData) => Promise<void>;
  booking?: Booking; // For editing existing booking
  mode: 'create' | 'edit';
  loading?: boolean;
}

// Get booking types from centralized configuration
const BOOKING_TYPES = getBookingTypeOptions();

const getDefaultFormData = (): UnifiedBookingData => ({
  type: BOOKING_TYPES[0].value as BookingType,
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
  swapEnabled: false,
});

const mapBookingToFormData = (booking: Booking): UnifiedBookingData => ({
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
  swapEnabled: false, // Will be set based on existing swap data
});

export const UnifiedBookingForm: React.FC<UnifiedBookingFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  booking,
  mode,
  loading = false,
}) => {
  // Wallet connection is now handled by UnifiedSwapEnablement component

  const [formData, setFormData] = useState<UnifiedBookingData>(
    booking ? mapBookingToFormData(booking) : getDefaultFormData()
  );
  const [validationErrors, setValidationErrors] = useState<UnifiedFormValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleActualSubmit = async () => {
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Failed to submit booking:', error);
      // Error handling could be enhanced here
    }
  };

  // Wallet connection effects are now handled by UnifiedSwapEnablement component

  // Initialize form data when booking changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (booking && mode === 'edit') {
        setFormData(mapBookingToFormData(booking));
      } else if (mode === 'create') {
        setFormData(getDefaultFormData());
      }
      setValidationErrors({});
      setTouched({});
    }
  }, [booking, mode, isOpen]);



  const validateForm = (): boolean => {
    const errors: UnifiedFormValidationErrors = {};

    // Validate booking fields
    errors.title = validateField('title', formData.title, formData);
    errors.description = validateField('description', formData.description, formData);
    errors.location = validateField('city', formData.location.city, formData) ||
      validateField('country', formData.location.country, formData);
    errors.originalPrice = validateField('originalPrice', formData.originalPrice, formData);
    errors.dateRange = validateField('checkIn', formData.dateRange.checkIn, formData) ||
      validateField('checkOut', formData.dateRange.checkOut, formData);
    errors.providerDetails = validateField('provider', formData.providerDetails.provider, formData) ||
      validateField('confirmationNumber', formData.providerDetails.confirmationNumber, formData);

    // Validate swap preferences if enabled
    if (formData.swapEnabled && formData.swapPreferences) {
      const swapErrors = validateSwapPreferences(formData.swapPreferences, formData.dateRange.checkIn);
      Object.assign(errors, swapErrors);
    }

    // Remove empty errors
    Object.keys(errors).forEach(key => {
      if (!errors[key as keyof UnifiedFormValidationErrors]) {
        delete errors[key as keyof UnifiedFormValidationErrors];
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (field: keyof UnifiedBookingData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));

    // Real-time validation for touched fields
    if (touched[field]) {
      const newErrors = { ...validationErrors };

      if (field === 'location') {
        newErrors.location = validateField('city', value.city, formData) || validateField('country', value.country, formData);
      } else if (field === 'dateRange') {
        newErrors.dateRange = validateField('checkIn', value.checkIn, formData) || validateField('checkOut', value.checkOut, formData);
      } else if (field === 'providerDetails') {
        newErrors.providerDetails = validateField('provider', value.provider, formData) ||
          validateField('confirmationNumber', value.confirmationNumber, formData);
      } else {
        newErrors[field as keyof UnifiedFormValidationErrors] = validateField(field as string, value, formData);
      }

      setValidationErrors(newErrors);
    }
  };

  // Swap toggle and preferences are now handled by UnifiedSwapEnablement component

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation display
    const allFields = ['title', 'description', 'location', 'dateRange', 'originalPrice', 'providerDetails'];
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));

    if (!validateForm()) {
      return;
    }

    // Wallet connection is now handled by UnifiedSwapEnablement component

    await handleActualSubmit();
  };

  const selectStyles = {
    width: '100%',
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.base,
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
  };

  const textareaStyles = {
    ...selectStyles,
    minHeight: '120px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  };

  const errorCount = getValidationErrorCount(validationErrors);

  return (
    <>
      {/* Main Booking Form Modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={mode === 'create' ? 'Create New Booking' : 'Edit Booking'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '80vh', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', paddingRight: tokens.spacing[2] }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[6] }}>

              {/* Helper Text */}
              <div style={{
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.primary[50],
                border: `1px solid ${tokens.colors.primary[200]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[800],
              }}>
                💡 Fill out all required fields (*) to create your booking listing.
                {formData.swapEnabled && ' Enable swapping to allow other users to propose exchanges.'}
              </div>

              {/* Validation Summary */}
              {errorCount > 0 && (
                <div style={{
                  padding: tokens.spacing[4],
                  backgroundColor: tokens.colors.error[50],
                  border: `1px solid ${tokens.colors.error[200]}`,
                  borderRadius: tokens.borderRadius.md,
                }}>
                  <div style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.error[800],
                    marginBottom: tokens.spacing[2],
                  }}>
                    ⚠️ Please fix {errorCount} error{errorCount > 1 ? 's' : ''}:
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
                          {error}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {/* Booking Type and Title */}
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: tokens.spacing[4] }}>
                <div>
                  <label htmlFor="booking-type" style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
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
                      borderColor: validationErrors.title ? tokens.colors.error[400] : tokens.colors.neutral[300],
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
                  id="title"
                  value={formData.title}
                  onChange={e => handleFieldChange('title', e.target.value)}
                  error={validationErrors.title}
                  placeholder="e.g., Luxury Hotel in Paris"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}>
                  Description *
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={e => handleFieldChange('description', e.target.value)}
                  placeholder="Describe your booking details, amenities, and any special features..."
                  style={{
                    ...textareaStyles,
                    borderColor: validationErrors.description ? tokens.colors.error[400] : tokens.colors.neutral[300],
                  }}
                  required
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

              {/* Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing[4] }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing[4] }}>
                <Input
                  label="Check-in Date"
                  type="date"
                  value={formData.dateRange.checkIn.toISOString().split('T')[0]}
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
                  value={formData.dateRange.checkOut.toISOString().split('T')[0]}
                  onChange={e => handleFieldChange('dateRange', {
                    ...formData.dateRange,
                    checkOut: new Date(e.target.value),
                  })}
                  required
                />
              </div>

              {/* Pricing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing[4] }}>
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
                  placeholder="0.00"
                  helperText="The value you're willing to accept in a swap"
                />
              </div>

              {/* Provider Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: tokens.spacing[4] }}>
                <Input
                  label="Provider"
                  value={formData.providerDetails.provider}
                  onChange={e => handleFieldChange('providerDetails', {
                    ...formData.providerDetails,
                    provider: e.target.value,
                  })}
                  error={validationErrors.providerDetails}
                  placeholder="e.g., Booking.com"
                  required
                />
                <Input
                  label="Confirmation Number"
                  value={formData.providerDetails.confirmationNumber}
                  onChange={e => handleFieldChange('providerDetails', {
                    ...formData.providerDetails,
                    confirmationNumber: e.target.value,
                  })}
                  placeholder="e.g., ABC123456"
                  required
                />
                <Input
                  label="Booking Reference"
                  value={formData.providerDetails.bookingReference}
                  onChange={e => handleFieldChange('providerDetails', {
                    ...formData.providerDetails,
                    bookingReference: e.target.value,
                  })}
                  placeholder="e.g., REF789 (optional)"
                />
              </div>

              {/* Unified Swap Enablement Component */}
              <UnifiedSwapEnablement
                isOpen={true}
                onClose={() => { }}
                onSuccess={(swapPreferences) => {
                  setFormData(prev => ({
                    ...prev,
                    swapEnabled: !!swapPreferences,
                    swapPreferences: swapPreferences,
                  }));
                }}
                booking={{
                  id: 'temp-id',
                  type: formData.type,
                  title: formData.title,
                  description: formData.description,
                  location: formData.location,
                  dateRange: formData.dateRange,
                  originalPrice: formData.originalPrice,
                  swapValue: formData.swapValue,
                  providerDetails: formData.providerDetails,
                  status: 'available',
                  userId: '',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  verification: {
                    status: 'verified',
                    verifiedAt: new Date(),
                    verifiedBy: '',
                  },
                }}
                integrated={true}
                initialPreferences={formData.swapPreferences}
              />

              {/* Form Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: tokens.spacing[3],
                marginTop: tokens.spacing[6],
                paddingTop: tokens.spacing[4],
                borderTop: `1px solid ${tokens.colors.neutral[200]}`,
              }}>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading}>
                  {mode === 'create'
                    ? (formData.swapEnabled ? 'Create Booking & Enable Swapping' : 'Create Booking')
                    : (formData.swapEnabled ? 'Update Booking & Swap Settings' : 'Update Booking')
                  }
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </>
  );
};