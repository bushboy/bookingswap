import React, { useState } from 'react';
import { tokens } from '@/design-system/tokens';
import { SwapPreferencesData } from '@booking-swap/shared';
import { PaymentTypeSelector } from './PaymentTypeSelector';
import { CashAmountInput } from './CashAmountInput';
import { AcceptanceStrategySelector } from './AcceptanceStrategySelector';
import { AuctionEndDatePicker } from './AuctionEndDatePicker';
import { SwapConditionsInput } from './SwapConditionsInput';
import { useSwapPreferencesAccessibility, useSwapHighContrast } from '@/hooks/useSwapAccessibility';

interface SwapPreferencesSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  preferences?: SwapPreferencesData;
  onChange: (preferences: SwapPreferencesData) => void;
  errors: Record<string, string>;
  eventDate: Date;
}

export const SwapPreferencesSection: React.FC<SwapPreferencesSectionProps> = ({
  enabled,
  onToggle,
  preferences,
  onChange,
  errors,
  eventDate,
}) => {
  const [isExpanded, setIsExpanded] = useState(enabled);
  
  // Accessibility hooks
  const {
    sectionId,
    toggleId,
    contentId,
    getToggleProps,
    getSectionProps,
    getContentProps,
  } = useSwapPreferencesAccessibility(enabled, onToggle);
  
  const { getSwapIndicatorStyles, getInteractiveStyles } = useSwapHighContrast();

  const isLastMinute = eventDate && new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000) <= new Date();

  const defaultPreferences: SwapPreferencesData = {
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    swapConditions: [],
  };

  const currentPreferences = preferences || defaultPreferences;

  const handleToggle = (checked: boolean) => {
    onToggle(checked);
    setIsExpanded(checked);
    if (checked && !preferences) {
      onChange(defaultPreferences);
    }
  };

  const updatePreferences = (updates: Partial<SwapPreferencesData>) => {
    onChange({ ...currentPreferences, ...updates });
  };

  const sectionStyles = {
    marginTop: tokens.spacing[6],
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    backgroundColor: tokens.colors.neutral[50],
  };

  const headerStyles = {
    padding: tokens.spacing[4],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    borderBottom: enabled ? `1px solid ${tokens.colors.neutral[200]}` : 'none',
  };

  const toggleStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
  };

  const labelStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const tooltipStyles = {
    color: tokens.colors.neutral[500],
    fontSize: tokens.typography.fontSize.sm,
    marginLeft: tokens.spacing[2],
  };

  const contentStyles = {
    padding: tokens.spacing[6],
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[6],
  };

  const checkboxStyles = {
    width: '18px',
    height: '18px',
    accentColor: tokens.colors.primary[600],
  };

  return (
    <div style={getSwapIndicatorStyles(sectionStyles)} {...getSectionProps()}>
      {/* Screen reader description */}
      <div id={`${sectionId}-description`} className="sr-only">
        Enable swap functionality to allow other users to propose exchanges for this booking. 
        You can configure payment types, acceptance strategy, and additional conditions.
      </div>
      
      <div 
        style={headerStyles} 
        onClick={() => enabled && setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={enabled ? 0 : -1}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && enabled) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-label={enabled ? `${isExpanded ? 'Collapse' : 'Expand'} swap preferences` : undefined}
      >
        <div style={toggleStyles}>
          <input
            type="checkbox"
            checked={enabled}
            style={getInteractiveStyles(checkboxStyles)}
            {...getToggleProps()}
          />
          <label htmlFor={toggleId} style={labelStyles}>
            Make available for swapping
          </label>
          <span 
            style={tooltipStyles} 
            title="Allow other users to propose swaps for this booking"
            aria-hidden="true"
          >
            ℹ️
          </span>
        </div>
        {enabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            style={getInteractiveStyles({
              background: 'none',
              border: 'none',
              color: tokens.colors.neutral[600],
              fontSize: tokens.typography.fontSize.lg,
              cursor: 'pointer',
              padding: tokens.spacing[1],
            })}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} swap preferences`}
            aria-expanded={isExpanded}
            aria-controls={contentId}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
      </div>

      {enabled && isExpanded && (
        <div style={contentStyles} {...getContentProps()}>
          <PaymentTypeSelector
            selected={currentPreferences.paymentTypes}
            onChange={(types) => updatePreferences({ paymentTypes: types })}
            error={errors.paymentTypes}
          />

          {currentPreferences.paymentTypes.includes('cash') && (
            <div 
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing[4] }}
              role="group"
              aria-labelledby="cash-amounts-label"
            >
              <div id="cash-amounts-label" className="sr-only">
                Cash amount settings for swap proposals
              </div>
              <CashAmountInput
                label="Minimum Cash Amount"
                value={currentPreferences.minCashAmount}
                onChange={(amount) => updatePreferences({ minCashAmount: amount })}
                error={errors.minCashAmount}
                placeholder="0.00"
                aria-describedby="min-cash-help"
              />
              <div id="min-cash-help" className="sr-only">
                Set the minimum cash amount you will accept for swap proposals
              </div>
              <CashAmountInput
                label="Maximum Cash Amount (Optional)"
                value={currentPreferences.maxCashAmount}
                onChange={(amount) => updatePreferences({ maxCashAmount: amount })}
                error={errors.maxCashAmount}
                placeholder="No limit"
                aria-describedby="max-cash-help"
              />
              <div id="max-cash-help" className="sr-only">
                Optionally set a maximum cash amount limit for proposals
              </div>
            </div>
          )}

          <AcceptanceStrategySelector
            selected={currentPreferences.acceptanceStrategy}
            onChange={(strategy) => updatePreferences({ acceptanceStrategy: strategy })}
            disabled={isLastMinute}
            eventDate={eventDate}
            error={errors.acceptanceStrategy}
            aria-describedby="strategy-help"
          />
          <div id="strategy-help" className="sr-only">
            Choose how swap proposals will be handled: first match accepts immediately, auction mode allows multiple proposals
          </div>

          {currentPreferences.acceptanceStrategy === 'auction' && !isLastMinute && (
            <AuctionEndDatePicker
              value={currentPreferences.auctionEndDate}
              onChange={(date) => updatePreferences({ auctionEndDate: date })}
              minDate={new Date()}
              maxDate={new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000)}
              eventDate={eventDate}
              error={errors.auctionEndDate}
              aria-describedby="auction-date-help"
            />
          )}
          <div id="auction-date-help" className="sr-only">
            Set when the auction should end. Must be at least one week before your event date.
          </div>

          <SwapConditionsInput
            value={currentPreferences.swapConditions}
            onChange={(conditions) => updatePreferences({ swapConditions: conditions })}
            error={errors.swapConditions}
            aria-describedby="conditions-help"
          />
          <div id="conditions-help" className="sr-only">
            Add any additional conditions or requirements for swap proposals
          </div>
        </div>
      )}
    </div>
  );
};