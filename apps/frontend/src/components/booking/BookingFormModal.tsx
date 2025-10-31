import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { BookingErrorDisplay } from '@/components/ui/BookingErrorDisplay';
import { tokens } from '@/design-system/tokens';
import {
  parseBookingApiError,
  logBookingError,
  EnhancedBookingError
} from '@/utils/bookingErrorHandler';
import {
  BookingType,
  BookingLocation,
  BookingDateRange,
  BookingProviderDetails,
  Booking,
} from '@booking-swap/shared';
import {
  getBookingTypeOptions,
  EnabledBookingType
} from '@booking-swap/shared';

export interface CreateBookingRequest {
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
  documents?: File[];
  status?: string; // Preserve status when editing
  id?: string; // Include ID when editing
}

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBookingRequest) => Promise<void>;
  booking?: Booking; // For editing existing booking
  loading?: boolean;
}

// Get booking types from centralized configuration
const BOOKING_TYPES = getBookingTypeOptions();

const POPULAR_LOCATIONS = [
  'Paris, France',
  'London, UK',
  'New York, USA',
  'Tokyo, Japan',
  'Barcelona, Spain',
  'Rome, Italy',
  'Amsterdam, Netherlands',
  'Berlin, Germany',
];

export const BookingFormModal: React.FC<BookingFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  booking,
  loading = false,
}) => {
  const [formData, setFormData] = useState<CreateBookingRequest>({
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
    documents: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<EnhancedBookingError | null>(null);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Initialize form data when editing
  useEffect(() => {
    if (booking && isOpen) {
      // Convert the booking data to form format
      const checkInDate = booking.checkInDate
        ? new Date(booking.checkInDate)
        : new Date();
      const checkOutDate = booking.checkOutDate
        ? new Date(booking.checkOutDate)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      setFormData({
        type: booking.type,
        title: booking.title,
        description: booking.description || '',
        location: {
          city: booking.city || '',
          country: booking.country || '',
        },
        dateRange: {
          checkIn: checkInDate,
          checkOut: checkOutDate,
        },
        originalPrice: booking.originalPrice,
        swapValue: booking.swapValue,
        providerDetails: {
          provider: booking.provider || '',
          confirmationNumber: booking.confirmationNumber || '',
          bookingReference: booking.bookingReference || '',
        },
        documents: [],
        status: booking.status, // Preserve existing status
        id: booking.id, // Include ID for editing
      });
      const locationString = `${booking.city || ''}, ${booking.country || ''}`
        .replace(', ,', '')
        .trim();
      setLocationQuery(locationString);
      console.log('Editing booking - initialized form data:', {
        city: booking.city,
        country: booking.country,
        provider: booking.provider,
        confirmationNumber: booking.confirmationNumber,
        locationString,
      });
    } else if (!booking && isOpen) {
      // Reset form for new booking
      setFormData({
        type: BOOKING_TYPES[0].value as BookingType,
        title: '',
        description: '',
        location: { city: '', country: '' },
        dateRange: {
          checkIn: new Date(),
          checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        originalPrice: 0,
        swapValue: 0,
        providerDetails: {
          provider: '',
          confirmationNumber: '',
          bookingReference: '',
        },
        documents: [],
      });
      setLocationQuery('');
      setErrors({});
      setApiError(null);
    }
  }, [booking, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required field validation (matching backend requirements)
    if (!formData.type) {
      newErrors.type = 'Booking type is required';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.length > 255) {
      newErrors.title = 'Title must be less than 255 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters';
    }

    // Location validation (required nested object)
    if (!formData.location.city.trim()) {
      newErrors.city = 'City is required';
    } else if (formData.location.city.length < 2) {
      newErrors.city = 'City must be at least 2 characters';
    } else if (formData.location.city.length > 100) {
      newErrors.city = 'City must be less than 100 characters';
    }

    if (!formData.location.country.trim()) {
      newErrors.country = 'Country is required';
    } else if (formData.location.country.length < 2) {
      newErrors.country = 'Country must be at least 2 characters';
    } else if (formData.location.country.length > 100) {
      newErrors.country = 'Country must be less than 100 characters';
    }

    // Date validation (required nested object)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!formData.dateRange.checkIn) {
      newErrors.checkIn = 'Check-in date is required';
    } else if (formData.dateRange.checkIn < today) {
      newErrors.checkIn = 'Check-in date cannot be in the past';
    }

    if (!formData.dateRange.checkOut) {
      newErrors.checkOut = 'Check-out date is required';
    } else if (formData.dateRange.checkOut <= formData.dateRange.checkIn) {
      newErrors.checkOut = 'Check-out date must be after check-in date';
    }

    // Price validation (required positive numbers)
    if (!formData.originalPrice || formData.originalPrice <= 0) {
      newErrors.originalPrice = 'Original price must be greater than 0';
    } else if (formData.originalPrice > 100000) {
      newErrors.originalPrice = 'Original price seems too high (max $100,000)';
    }

    if (!formData.swapValue || formData.swapValue <= 0) {
      newErrors.swapValue = 'Swap value must be greater than 0';
    } else if (formData.swapValue > 100000) {
      newErrors.swapValue = 'Swap value seems too high (max $100,000)';
    }

    // Provider details validation (required nested object)
    if (!formData.providerDetails.provider.trim()) {
      newErrors.provider = 'Provider is required';
    } else if (formData.providerDetails.provider.length > 100) {
      newErrors.provider = 'Provider name must be less than 100 characters';
    }

    if (!formData.providerDetails.confirmationNumber.trim()) {
      newErrors.confirmationNumber = 'Confirmation number is required';
    } else if (formData.providerDetails.confirmationNumber.length < 3) {
      newErrors.confirmationNumber =
        'Confirmation number must be at least 3 characters';
    } else if (formData.providerDetails.confirmationNumber.length > 100) {
      newErrors.confirmationNumber =
        'Confirmation number must be less than 100 characters';
    }

    // Booking reference is optional, but validate length if provided
    if (formData.providerDetails.bookingReference.trim() &&
      formData.providerDetails.bookingReference.length > 100) {
      newErrors.bookingReference =
        'Booking reference must be less than 100 characters';
    }

    const daysDiff = Math.ceil(
      (formData.dateRange.checkOut.getTime() -
        formData.dateRange.checkIn.getTime()) /
      (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 365) {
      newErrors.checkOut = 'Booking duration cannot exceed 1 year';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear any previous API errors
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
      // Only close the modal if submission succeeds
      onClose();
    } catch (error) {
      console.error('Failed to submit booking:', error);

      // Parse and display enhanced error information
      const enhancedError = parseBookingApiError(error);
      setApiError(enhancedError);

      // Log error for monitoring
      logBookingError(enhancedError, {
        bookingId: booking?.id,
        action: booking ? 'update' : 'create'
      });

      // Don't close the modal - let the user see the error and try again
    }
  };

  const validateField = (
    field: string,
    value: any,
    currentFormData?: any
  ): string => {
    const data = currentFormData || formData;

    switch (field) {
      case 'title':
        if (!value?.trim()) return 'Title is required';
        if (value.length < 3) return 'Title must be at least 3 characters';
        if (value.length > 255) return 'Title must be less than 255 characters';
        return '';

      case 'description':
        if (!value?.trim()) return 'Description is required';
        if (value.length < 10)
          return 'Description must be at least 10 characters';
        if (value.length > 1000)
          return 'Description must be less than 1000 characters';
        return '';

      case 'city':
        if (!value?.trim()) return 'City is required';
        if (value.length < 2) return 'City must be at least 2 characters';
        if (value.length > 100) return 'City must be less than 100 characters';
        return '';

      case 'country':
        if (!value?.trim()) return 'Country is required';
        if (value.length < 2) return 'Country must be at least 2 characters';
        if (value.length > 100)
          return 'Country must be less than 100 characters';
        return '';

      case 'originalPrice':
        if (!value || value <= 0)
          return 'Original price must be greater than 0';
        if (value > 100000)
          return 'Original price seems too high (max $100,000)';
        return '';

      case 'swapValue':
        if (!value || value <= 0) return 'Swap value must be greater than 0';
        if (value > 100000) return 'Swap value seems too high (max $100,000)';
        return '';

      case 'provider':
        if (!value?.trim()) return 'Provider is required';
        if (value.length > 100)
          return 'Provider name must be less than 100 characters';
        return '';

      case 'confirmationNumber':
        if (!value?.trim()) return 'Confirmation number is required';
        if (value.length < 3)
          return 'Confirmation number must be at least 3 characters';
        if (value.length > 100)
          return 'Confirmation number must be less than 100 characters';
        return '';

      case 'bookingReference':
        // Booking reference is optional
        if (value?.trim() && value.length > 100)
          return 'Booking reference must be less than 100 characters';
        return '';

      case 'checkIn':
        if (!value) return 'Check-in date is required';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(value) < today)
          return 'Check-in date cannot be in the past';
        return '';

      case 'checkOut':
        if (!value) return 'Check-out date is required';
        const checkInDate =
          data.dateRange?.checkIn || formData.dateRange.checkIn;
        if (checkInDate && new Date(value) <= new Date(checkInDate)) {
          return 'Check-out date must be after check-in date';
        }
        return '';

      default:
        return '';
    }
  };

  const updateFormData = (field: keyof CreateBookingRequest, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Real-time validation for specific fields
    const newErrors = { ...errors };

    if (field === 'location') {
      // Validate city and country
      if (value.city !== undefined) {
        newErrors.city = validateField('city', value.city, newFormData);
      }
      if (value.country !== undefined) {
        newErrors.country = validateField(
          'country',
          value.country,
          newFormData
        );
      }
    } else if (field === 'dateRange') {
      // Validate check-in and check-out dates
      if (value.checkIn !== undefined) {
        newErrors.checkIn = validateField(
          'checkIn',
          value.checkIn,
          newFormData
        );
      }
      if (value.checkOut !== undefined) {
        newErrors.checkOut = validateField(
          'checkOut',
          value.checkOut,
          newFormData
        );
      }
      // Re-validate check-in if check-out changed
      if (value.checkOut !== undefined && newFormData.dateRange.checkIn) {
        newErrors.checkIn = validateField(
          'checkIn',
          newFormData.dateRange.checkIn,
          newFormData
        );
      }
    } else if (field === 'providerDetails') {
      // Validate provider details
      if (value.provider !== undefined) {
        newErrors.provider = validateField(
          'provider',
          value.provider,
          newFormData
        );
      }
      if (value.confirmationNumber !== undefined) {
        newErrors.confirmationNumber = validateField(
          'confirmationNumber',
          value.confirmationNumber,
          newFormData
        );
      }
      if (value.bookingReference !== undefined) {
        newErrors.bookingReference = validateField(
          'bookingReference',
          value.bookingReference,
          newFormData
        );
      }
    } else {
      // Validate single field
      newErrors[field as string] = validateField(
        field as string,
        value,
        newFormData
      );
    }

    setErrors(newErrors);
  };

  const handleLocationSelect = (location: string) => {
    const [city, country] = location.split(', ');
    updateFormData('location', { city: city.trim(), country: country.trim() });
    setLocationQuery(location);
    setShowLocationSuggestions(false);
  };

  const handleLocationInputChange = (value: string) => {
    setLocationQuery(value);
    setShowLocationSuggestions(value.length > 0);

    // Try to parse city and country from input
    if (value.includes(',')) {
      const [city, country] = value.split(',');
      updateFormData('location', {
        city: city.trim(),
        country: country.trim(),
      });
    } else {
      updateFormData('location', {
        city: value.trim(),
        country: formData.location.country,
      });
    }
  };

  const filteredLocations = POPULAR_LOCATIONS.filter(location =>
    location.toLowerCase().includes(locationQuery.toLowerCase())
  );

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={booking ? 'Edit Booking' : 'Create New Booking'}
      size="lg"
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxHeight: '80vh', // Ensure modal doesn't exceed viewport
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            paddingRight: tokens.spacing[2], // Space for scrollbar
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing[6],
            }}
          >
            {/* Helper Text */}
            <div
              style={{
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.primary[50],
                border: `1px solid ${tokens.colors.primary[200]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[800],
              }}
            >
              💡 Fill out all required fields (*) to create your booking
              listing. Validation happens in real-time as you type.
            </div>

            {/* API Error Display */}
            {apiError && (
              <BookingErrorDisplay
                error={apiError}
                onRetry={() => {
                  setApiError(null);
                  // Optionally trigger form resubmission
                }}
                onDismiss={() => setApiError(null)}
              />
            )}

            {/* Validation Summary */}
            {Object.keys(errors).some(key => errors[key]) && (
              <div
                style={{
                  padding: tokens.spacing[4],
                  backgroundColor: tokens.colors.error[50],
                  border: `1px solid ${tokens.colors.error[200]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              >
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.error[800],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  ⚠️ Please fix the following errors:
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: tokens.spacing[4],
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.error[700],
                  }}
                >
                  {Object.entries(errors).map(
                    ([field, error]) =>
                      error && (
                        <li
                          key={field}
                          style={{ marginBottom: tokens.spacing[1] }}
                        >
                          {error}
                        </li>
                      )
                  )}
                </ul>
              </div>
            )}
            {/* Booking Type and Title */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '200px 1fr',
                gap: tokens.spacing[4],
              }}
            >
              <div>
                <label
                  htmlFor="booking-type"
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Booking Type *
                </label>
                <select
                  id="booking-type"
                  value={formData.type}
                  onChange={e => {
                    const selectedType = e.target.value as BookingType;
                    updateFormData('type', selectedType);

                    // Clear API error when user changes booking type
                    if (apiError?.type === 'booking_type') {
                      setApiError(null);
                    }

                    // Real-time validation feedback
                    const newErrors = { ...errors };
                    if (selectedType) {
                      delete newErrors.type;
                    } else {
                      newErrors.type = 'Booking type is required';
                    }
                    setErrors(newErrors);
                  }}
                  style={{
                    ...selectStyles,
                    borderColor: errors.type
                      ? tokens.colors.error[400]
                      : tokens.colors.neutral[300],
                  }}
                >
                  {BOOKING_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.error[600],
                      marginTop: tokens.spacing[1],
                    }}
                  >
                    {errors.type}
                  </div>
                )}
              </div>

              <Input
                label="Title"
                id="title"
                value={formData.title}
                onChange={e => updateFormData('title', e.target.value)}
                error={errors.title}
                placeholder="e.g., Luxury Hotel in Paris"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Description *
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={e => updateFormData('description', e.target.value)}
                placeholder="Describe your booking details, amenities, and any special features..."
                style={{
                  ...textareaStyles,
                  borderColor: errors.description
                    ? tokens.colors.error[400]
                    : tokens.colors.neutral[300],
                }}
                required
              />
              {errors.description && (
                <div
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.error[600],
                    marginTop: tokens.spacing[1],
                  }}
                >
                  {errors.description}
                </div>
              )}
            </div>

            {/* Location with Autocomplete */}
            <div>
              <label
                htmlFor="location"
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Location *
              </label>
              <div style={{ position: 'relative' }}>
                <Input
                  id="location"
                  value={locationQuery}
                  onChange={e => handleLocationInputChange(e.target.value)}
                  placeholder="e.g., Paris, France"
                  error={errors.city || errors.country}
                  leftIcon={<span>📍</span>}
                  required
                />

                {showLocationSuggestions && filteredLocations.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: `1px solid ${tokens.colors.neutral[300]}`,
                      borderRadius: tokens.borderRadius.md,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      zIndex: 10,
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}
                  >
                    {filteredLocations.map((location, index) => (
                      <button
                        key={location}
                        type="button"
                        onClick={() => handleLocationSelect(location)}
                        style={{
                          width: '100%',
                          padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                          textAlign: 'left',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontSize: tokens.typography.fontSize.sm,
                          borderBottom:
                            index < filteredLocations.length - 1
                              ? `1px solid ${tokens.colors.neutral[200]}`
                              : 'none',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor =
                            tokens.colors.neutral[50];
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        📍 {location}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: tokens.spacing[4],
              }}
            >
              <Input
                label="Check-in Date"
                type="date"
                value={formData.dateRange.checkIn.toISOString().split('T')[0]}
                onChange={e =>
                  updateFormData('dateRange', {
                    ...formData.dateRange,
                    checkIn: new Date(e.target.value),
                  })
                }
                error={errors.checkIn}
                required
              />

              <Input
                label="Check-out Date"
                type="date"
                value={formData.dateRange.checkOut.toISOString().split('T')[0]}
                onChange={e =>
                  updateFormData('dateRange', {
                    ...formData.dateRange,
                    checkOut: new Date(e.target.value),
                  })
                }
                error={errors.checkOut}
                required
              />
            </div>

            {/* Pricing */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: tokens.spacing[4],
              }}
            >
              <Input
                label="Original Price ($)"
                type="number"
                min="0"
                step="0.01"
                value={formData.originalPrice || ''}
                onChange={e =>
                  updateFormData(
                    'originalPrice',
                    parseFloat(e.target.value) || 0
                  )
                }
                error={errors.originalPrice}
                placeholder="0.00"
                required
              />

              <Input
                label="Swap Value ($)"
                type="number"
                min="0"
                step="0.01"
                value={formData.swapValue || ''}
                onChange={e =>
                  updateFormData('swapValue', parseFloat(e.target.value) || 0)
                }
                error={errors.swapValue}
                placeholder="0.00"
                helperText="The value you're willing to accept in a swap"
                required
              />
            </div>

            {/* Provider Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: tokens.spacing[4],
              }}
            >
              <Input
                label="Provider"
                value={formData.providerDetails.provider}
                onChange={e =>
                  updateFormData('providerDetails', {
                    ...formData.providerDetails,
                    provider: e.target.value,
                  })
                }
                error={errors.provider}
                placeholder="e.g., Booking.com"
                required
              />

              <Input
                label="Confirmation Number"
                value={formData.providerDetails.confirmationNumber}
                onChange={e =>
                  updateFormData('providerDetails', {
                    ...formData.providerDetails,
                    confirmationNumber: e.target.value,
                  })
                }
                error={errors.confirmationNumber}
                placeholder="e.g., ABC123456"
                required
              />

              <Input
                label="Booking Reference"
                value={formData.providerDetails.bookingReference}
                onChange={e =>
                  updateFormData('providerDetails', {
                    ...formData.providerDetails,
                    bookingReference: e.target.value,
                  })
                }
                error={errors.bookingReference}
                placeholder="e.g., REF789"
                required
              />
            </div>

            {/* Document Upload */}
            <FileUpload
              label="Verification Documents"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple={true}
              maxSize={5}
              maxFiles={3}
              onFilesChange={files => updateFormData('documents', files)}
              helperText="Upload booking confirmations, receipts, or other verification documents (PDF, JPG, PNG)"
            />
          </form>
        </div>

        {/* Fixed Form Actions at Bottom */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: tokens.spacing[3],
            padding: `${tokens.spacing[4]} 0 0 0`,
            borderTop: `1px solid ${tokens.colors.neutral[200]}`,
            backgroundColor: 'white',
            flexShrink: 0, // Prevent shrinking
            position: 'sticky',
            bottom: 0,
            zIndex: 1,
          }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading || Object.values(errors).some(error => error)}
            onClick={handleSubmit}
          >
            {booking ? 'Update Booking' : 'Create Booking'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
