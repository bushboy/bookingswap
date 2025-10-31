import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import {
  BookingType,
  BookingLocation,
  BookingDateRange,
  BookingProviderDetails,
} from '@booking-swap/shared';
import {
  getBookingTypeOptions,
  EnabledBookingType
} from '@booking-swap/shared';

interface BookingFormData {
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
}

interface BookingFormProps {
  onSubmit: (data: BookingFormData) => void;
  loading?: boolean;
}

// Get booking types from centralized configuration
const BOOKING_TYPES = getBookingTypeOptions();

export const BookingForm: React.FC<BookingFormProps> = ({
  onSubmit,
  loading = false,
}) => {
  const [formData, setFormData] = useState<BookingFormData>({
    type: BOOKING_TYPES[0].value as BookingType,
    title: '',
    description: '',
    location: {
      city: '',
      country: '',
    },
    dateRange: {
      checkIn: new Date(),
      checkOut: new Date(),
    },
    originalPrice: 0,
    swapValue: 0,
    providerDetails: {
      provider: '',
      confirmationNumber: '',
      bookingReference: '',
    },
  });

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
    city?: string;
    country?: string;
    originalPrice?: string;
    swapValue?: string;
    provider?: string;
    confirmationNumber?: string;
    dateRange?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: {
      title?: string;
      description?: string;
      city?: string;
      country?: string;
      originalPrice?: string;
      swapValue?: string;
      provider?: string;
      confirmationNumber?: string;
      dateRange?: string;
    } = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.location.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.location.country.trim()) {
      newErrors.country = 'Country is required';
    }

    if (formData.originalPrice <= 0) {
      newErrors.originalPrice = 'Original price must be greater than 0';
    }

    if (formData.swapValue <= 0) {
      newErrors.swapValue = 'Swap value must be greater than 0';
    }

    if (!formData.providerDetails.provider.trim()) {
      newErrors.provider = 'Provider is required';
    }

    if (!formData.providerDetails.confirmationNumber.trim()) {
      newErrors.confirmationNumber = 'Confirmation number is required';
    }

    if (formData.dateRange.checkIn >= formData.dateRange.checkOut) {
      newErrors.dateRange = 'Check-out date must be after check-in date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateFormData = (field: keyof BookingFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (field === 'location') {
      setErrors(prev => ({ ...prev, city: undefined, country: undefined }));
    } else if (field === 'providerDetails') {
      setErrors(prev => ({
        ...prev,
        provider: undefined,
        confirmationNumber: undefined,
      }));
    } else {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
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
    minHeight: '100px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <h2
          style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          List Your Booking for Swap
        </h2>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[6],
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
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
                Booking Type
              </label>
              <select
                id="booking-type"
                value={formData.type}
                onChange={e =>
                  updateFormData('type', e.target.value as BookingType)
                }
                style={selectStyles}
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
              onChange={e => updateFormData('title', e.target.value)}
              error={errors.title}
              placeholder="e.g., Luxury Hotel in Paris"
            />
          </div>

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
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={e => updateFormData('description', e.target.value)}
              placeholder="Describe your booking details, amenities, and any special features..."
              style={textareaStyles}
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: tokens.spacing[4],
            }}
          >
            <Input
              label="City"
              value={formData.location.city}
              onChange={e =>
                updateFormData('location', {
                  ...formData.location,
                  city: e.target.value,
                })
              }
              error={errors.city}
              placeholder="e.g., Paris"
            />

            <Input
              label="Country"
              value={formData.location.country}
              onChange={e =>
                updateFormData('location', {
                  ...formData.location,
                  country: e.target.value,
                })
              }
              error={errors.country}
              placeholder="e.g., France"
            />
          </div>

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
              error={errors.dateRange}
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
            />
          </div>

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
              value={formData.originalPrice}
              onChange={e =>
                updateFormData('originalPrice', parseFloat(e.target.value) || 0)
              }
              error={errors.originalPrice}
              placeholder="0.00"
            />

            <Input
              label="Swap Value ($)"
              type="number"
              min="0"
              step="0.01"
              value={formData.swapValue}
              onChange={e =>
                updateFormData('swapValue', parseFloat(e.target.value) || 0)
              }
              error={errors.swapValue}
              placeholder="0.00"
              helperText="The value you're willing to accept in a swap"
            />
          </div>

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
              placeholder="e.g., REF789"
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: tokens.spacing[3],
            }}
          >
            <Button type="button" variant="outline">
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              List Booking for Swap
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
