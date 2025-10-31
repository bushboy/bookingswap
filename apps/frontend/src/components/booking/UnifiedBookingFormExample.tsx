import React, { useState } from 'react';
import { SwapPreferencesSection } from './SwapPreferencesSection';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';
import { UnifiedBookingData, UnifiedFormValidationErrors } from '@booking-swap/shared';

interface UnifiedBookingFormExampleProps {
  onSubmit: (data: UnifiedBookingData) => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Example implementation showing how SwapPreferencesSection integrates
 * into a unified booking form. This demonstrates the task requirements.
 */
export const UnifiedBookingFormExample: React.FC<UnifiedBookingFormExampleProps> = ({
  onSubmit,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<UnifiedBookingData>({
    type: 'hotel',
    title: '',
    description: '',
    location: { city: '', country: '' },
    dateRange: { 
      checkIn: new Date(), 
      checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000) 
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

  const [errors, setErrors] = useState<UnifiedFormValidationErrors>({});

  const handleSwapToggle = (enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      swapEnabled: enabled,
      swapPreferences: enabled ? {
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first-match',
        swapConditions: [],
      } : undefined,
    }));
  };

  const handleSwapPreferencesChange = (preferences: any) => {
    setFormData(prev => ({
      ...prev,
      swapPreferences: preferences,
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: UnifiedFormValidationErrors = {};

    // Basic booking validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.originalPrice <= 0) {
      newErrors.originalPrice = 'Original price must be greater than 0';
    }

    // Swap validation when enabled
    if (formData.swapEnabled && formData.swapPreferences) {
      if (!formData.swapPreferences.paymentTypes || formData.swapPreferences.paymentTypes.length === 0) {
        newErrors.paymentTypes = 'At least one payment type must be selected';
      }

      if (formData.swapPreferences.paymentTypes.includes('cash') && !formData.swapPreferences.minCashAmount) {
        newErrors.minCashAmount = 'Minimum cash amount is required for cash swaps';
      }

      if (formData.swapPreferences.acceptanceStrategy === 'auction' && !formData.swapPreferences.auctionEndDate) {
        newErrors.auctionEndDate = 'Auction end date is required';
      }
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

  const formStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[6],
  };

  const gridStyles = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacing[4],
  };

  const actionsStyles = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[6],
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <h2 style={{
          fontSize: tokens.typography.fontSize.xl,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.neutral[900],
          margin: 0,
        }}>
          Create Booking {formData.swapEnabled && '& Enable Swapping'}
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} style={formStyles}>
          {/* Basic Booking Fields */}
          <div style={gridStyles}>
            <Input
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              error={errors.title}
              placeholder="e.g., Luxury Hotel in Paris"
            />
            <Input
              label="Original Price ($)"
              type="number"
              min="0"
              step="0.01"
              value={formData.originalPrice}
              onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: parseFloat(e.target.value) || 0 }))}
              error={errors.originalPrice}
              placeholder="0.00"
            />
          </div>

          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            error={errors.description}
            placeholder="Describe your booking details..."
          />

          {/* Integrated Swap Preferences Section */}
          <SwapPreferencesSection
            enabled={formData.swapEnabled}
            onToggle={handleSwapToggle}
            preferences={formData.swapPreferences}
            onChange={handleSwapPreferencesChange}
            errors={errors}
            eventDate={formData.dateRange.checkIn}
          />

          {/* Form Actions */}
          <div style={actionsStyles}>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {formData.swapEnabled ? 'Create Booking & Enable Swapping' : 'Create Booking'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};