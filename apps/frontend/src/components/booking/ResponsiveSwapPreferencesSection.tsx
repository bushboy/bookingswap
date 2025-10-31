import React, { useState } from 'react';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { SwapPreferencesData } from '@booking-swap/shared';
import { PaymentTypeSelector } from './PaymentTypeSelector';
import { CashAmountInput } from './CashAmountInput';
import { AcceptanceStrategySelector } from './AcceptanceStrategySelector';
import { AuctionEndDatePicker } from './AuctionEndDatePicker';
import { SwapConditionsInput } from './SwapConditionsInput';

// Fix for white color token
const whiteColor = '#ffffff';

interface ResponsiveSwapPreferencesSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  preferences?: SwapPreferencesData;
  onChange: (preferences: SwapPreferencesData) => void;
  errors: Record<string, string>;
  eventDate: Date;
}

// Mobile-optimized toggle component
const MobileSwapToggle: React.FC<{
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isExpanded: boolean;
  onExpandToggle: () => void;
}> = ({ enabled, onToggle, isExpanded, onExpandToggle }) => {
  const toggleContainerStyles: React.CSSProperties = {
    padding: tokens.spacing[4],
    backgroundColor: enabled ? tokens.colors.primary[50] : tokens.colors.neutral[50],
    border: `2px solid ${enabled ? tokens.colors.primary[200] : tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    marginBottom: enabled ? tokens.spacing[4] : 0,
  };

  const mainToggleStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    minHeight: '48px', // Touch-friendly height
  };

  const labelContainerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
    flex: 1,
  };

  const switchStyles: React.CSSProperties = {
    position: 'relative',
    width: '52px',
    height: '28px',
    backgroundColor: enabled ? tokens.colors.primary[500] : tokens.colors.neutral[300],
    borderRadius: tokens.borderRadius.full,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-in-out',
  };

  const switchKnobStyles: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: enabled ? '26px' : '2px',
    width: '24px',
    height: '24px',
    backgroundColor: whiteColor,
    borderRadius: '50%',
    transition: 'left 0.2s ease-in-out',
    boxShadow: tokens.shadows.sm,
  };

  const labelStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    margin: 0,
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginTop: tokens.spacing[1],
  };

  const expandButtonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: tokens.colors.primary[600],
    fontSize: tokens.typography.fontSize.xl,
    cursor: 'pointer',
    padding: tokens.spacing[2],
    borderRadius: tokens.borderRadius.md,
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={toggleContainerStyles}>
      <div style={mainToggleStyles} onClick={() => onToggle(!enabled)}>
        <div style={labelContainerStyles}>
          <div style={switchStyles}>
            <div style={switchKnobStyles} />
          </div>
          <div>
            <div style={labelStyles}>Make available for swapping</div>
            <div style={descriptionStyles}>
              Allow others to propose swaps for this booking
            </div>
          </div>
        </div>
      </div>
      
      {enabled && (
        <div style={{
          marginTop: tokens.spacing[3],
          paddingTop: tokens.spacing[3],
          borderTop: `1px solid ${tokens.colors.primary[200]}`,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            type="button"
            style={expandButtonStyles}
            onClick={onExpandToggle}
          >
            {isExpanded ? '▲ Hide Options' : '▼ Show Options'}
          </button>
        </div>
      )}
    </div>
  );
};

// Mobile-optimized payment type selector
const MobilePaymentTypeSelector: React.FC<{
  selected: ('booking' | 'cash')[];
  onChange: (types: ('booking' | 'cash')[]) => void;
  error?: string;
}> = ({ selected, onChange, error }) => {
  const containerStyles: React.CSSProperties = {
    marginBottom: tokens.spacing[5],
  };

  const labelStyles: React.CSSProperties = {
    display: 'block',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
  };

  const optionsStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing[3],
  };

  const optionStyles = (isSelected: boolean): React.CSSProperties => ({
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.lg,
    border: `2px solid ${isSelected ? tokens.colors.primary[500] : tokens.colors.neutral[300]}`,
    backgroundColor: isSelected ? tokens.colors.primary[50] : whiteColor,
    cursor: 'pointer',
    minHeight: '64px',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
    transition: 'all 0.2s ease-in-out',
  });

  const checkboxStyles: React.CSSProperties = {
    width: '20px',
    height: '20px',
    accentColor: tokens.colors.primary[600],
  };

  const optionContentStyles: React.CSSProperties = {
    flex: 1,
  };

  const optionTitleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  };

  const optionDescStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  const handleToggle = (type: 'booking' | 'cash') => {
    if (selected.includes(type)) {
      onChange(selected.filter(t => t !== type));
    } else {
      onChange([...selected, type]);
    }
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>What types of proposals will you accept?</label>
      <div style={optionsStyles}>
        <div
          style={optionStyles(selected.includes('booking'))}
          onClick={() => handleToggle('booking')}
        >
          <input
            type="checkbox"
            checked={selected.includes('booking')}
            onChange={() => handleToggle('booking')}
            style={checkboxStyles}
          />
          <div style={optionContentStyles}>
            <div style={optionTitleStyles}>🔄 Booking Exchange</div>
            <div style={optionDescStyles}>Accept other bookings in exchange</div>
          </div>
        </div>
        
        <div
          style={optionStyles(selected.includes('cash'))}
          onClick={() => handleToggle('cash')}
        >
          <input
            type="checkbox"
            checked={selected.includes('cash')}
            onChange={() => handleToggle('cash')}
            style={checkboxStyles}
          />
          <div style={optionContentStyles}>
            <div style={optionTitleStyles}>💰 Cash Offers</div>
            <div style={optionDescStyles}>Accept cash payments for your booking</div>
          </div>
        </div>
      </div>
      
      {error && (
        <div style={{
          marginTop: tokens.spacing[2],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.error[600],
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// Mobile-optimized cash amount inputs
const MobileCashAmountInputs: React.FC<{
  minAmount?: number;
  maxAmount?: number;
  onMinChange: (amount?: number) => void;
  onMaxChange: (amount?: number) => void;
  minError?: string;
  maxError?: string;
}> = ({ minAmount, maxAmount, onMinChange, onMaxChange, minError, maxError }) => {
  const containerStyles: React.CSSProperties = {
    marginBottom: tokens.spacing[5],
  };

  const labelStyles: React.CSSProperties = {
    display: 'block',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
  };

  const inputsContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing[4],
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>Cash Amount Range</label>
      <div style={inputsContainerStyles}>
        <CashAmountInput
          label="Minimum Amount"
          value={minAmount}
          onChange={onMinChange}
          error={minError}
          placeholder="0.00"
          required
        />
        <CashAmountInput
          label="Maximum Amount (Optional)"
          value={maxAmount}
          onChange={onMaxChange}
          error={maxError}
          placeholder="No limit"
        />
      </div>
    </div>
  );
};

// Mobile-optimized acceptance strategy selector
const MobileAcceptanceStrategySelector: React.FC<{
  selected: 'first-match' | 'auction';
  onChange: (strategy: 'first-match' | 'auction') => void;
  disabled?: boolean;
  eventDate: Date;
  error?: string;
}> = ({ selected, onChange, disabled, eventDate, error }) => {
  const isLastMinute = eventDate && new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000) <= new Date();

  const containerStyles: React.CSSProperties = {
    marginBottom: tokens.spacing[5],
  };

  const labelStyles: React.CSSProperties = {
    display: 'block',
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[3],
  };

  const optionsStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing[3],
  };

  const optionStyles = (isSelected: boolean, isDisabled: boolean): React.CSSProperties => ({
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.lg,
    border: `2px solid ${isSelected ? tokens.colors.primary[500] : tokens.colors.neutral[300]}`,
    backgroundColor: isDisabled ? tokens.colors.neutral[100] : isSelected ? tokens.colors.primary[50] : whiteColor,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    minHeight: '80px',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
    transition: 'all 0.2s ease-in-out',
  });

  const radioStyles: React.CSSProperties = {
    width: '20px',
    height: '20px',
    accentColor: tokens.colors.primary[600],
  };

  const optionContentStyles: React.CSSProperties = {
    flex: 1,
  };

  const optionTitleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  };

  const optionDescStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  const warningStyles: React.CSSProperties = {
    marginTop: tokens.spacing[2],
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.warning[50],
    border: `1px solid ${tokens.colors.warning[200]}`,
    borderRadius: tokens.borderRadius.md,
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.warning[700],
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>How should proposals be handled?</label>
      <div style={optionsStyles}>
        <div
          style={optionStyles(selected === 'first-match', disabled)}
          onClick={() => !disabled && onChange('first-match')}
        >
          <input
            type="radio"
            checked={selected === 'first-match'}
            onChange={() => !disabled && onChange('first-match')}
            style={radioStyles}
            disabled={disabled}
          />
          <div style={optionContentStyles}>
            <div style={optionTitleStyles}>⚡ First Match</div>
            <div style={optionDescStyles}>Accept the first suitable proposal</div>
          </div>
        </div>
        
        <div
          style={optionStyles(selected === 'auction', disabled || isLastMinute)}
          onClick={() => !disabled && !isLastMinute && onChange('auction')}
        >
          <input
            type="radio"
            checked={selected === 'auction'}
            onChange={() => !disabled && !isLastMinute && onChange('auction')}
            style={radioStyles}
            disabled={disabled || isLastMinute}
          />
          <div style={optionContentStyles}>
            <div style={optionTitleStyles}>🏆 Auction Mode</div>
            <div style={optionDescStyles}>
              {isLastMinute 
                ? 'Not available for last-minute bookings'
                : 'Let proposers compete for the best offer'
              }
            </div>
          </div>
        </div>
      </div>
      
      {isLastMinute && (
        <div style={warningStyles}>
          ⚠️ Auction mode is not available for bookings within one week of the event date.
        </div>
      )}
      
      {error && (
        <div style={{
          marginTop: tokens.spacing[2],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.error[600],
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

// Main responsive component
export const ResponsiveSwapPreferencesSection: React.FC<ResponsiveSwapPreferencesSectionProps> = ({
  enabled,
  onToggle,
  preferences,
  onChange,
  errors,
  eventDate,
}) => {
  const { isMobile } = useResponsive();
  const [isExpanded, setIsExpanded] = useState(enabled);

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

  // Mobile layout
  if (isMobile) {
    return (
      <div style={{ marginTop: tokens.spacing[6] }}>
        <MobileSwapToggle
          enabled={enabled}
          onToggle={handleToggle}
          isExpanded={isExpanded}
          onExpandToggle={() => setIsExpanded(!isExpanded)}
        />

        {enabled && isExpanded && (
          <div style={{
            padding: tokens.spacing[4],
            backgroundColor: whiteColor,
            borderRadius: tokens.borderRadius.lg,
            border: `1px solid ${tokens.colors.neutral[200]}`,
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[5],
          }}>
            <MobilePaymentTypeSelector
              selected={currentPreferences.paymentTypes}
              onChange={(types) => updatePreferences({ paymentTypes: types })}
              error={errors.paymentTypes}
            />

            {currentPreferences.paymentTypes.includes('cash') && (
              <MobileCashAmountInputs
                minAmount={currentPreferences.minCashAmount}
                maxAmount={currentPreferences.maxCashAmount}
                onMinChange={(amount) => updatePreferences({ minCashAmount: amount })}
                onMaxChange={(amount) => updatePreferences({ maxCashAmount: amount })}
                minError={errors.minCashAmount}
                maxError={errors.maxCashAmount}
              />
            )}

            <MobileAcceptanceStrategySelector
              selected={currentPreferences.acceptanceStrategy}
              onChange={(strategy) => updatePreferences({ acceptanceStrategy: strategy })}
              eventDate={eventDate}
              error={errors.acceptanceStrategy}
            />

            {currentPreferences.acceptanceStrategy === 'auction' && (
              <div style={{ marginBottom: tokens.spacing[5] }}>
                <AuctionEndDatePicker
                  value={currentPreferences.auctionEndDate}
                  onChange={(date) => updatePreferences({ auctionEndDate: date })}
                  minDate={new Date()}
                  maxDate={new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000)}
                  eventDate={eventDate}
                  error={errors.auctionEndDate}
                />
              </div>
            )}

            <SwapConditionsInput
              value={currentPreferences.swapConditions}
              onChange={(conditions) => updatePreferences({ swapConditions: conditions })}
              error={errors.swapConditions}
            />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout - use existing component
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
    <div style={sectionStyles}>
      <div style={headerStyles} onClick={() => enabled && setIsExpanded(!isExpanded)}>
        <div style={toggleStyles}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            style={checkboxStyles}
            id="swap-enabled"
          />
          <label htmlFor="swap-enabled" style={labelStyles}>
            Make available for swapping
          </label>
          <span style={tooltipStyles} title="Allow other users to propose swaps for this booking">
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
            style={{
              background: 'none',
              border: 'none',
              color: tokens.colors.neutral[600],
              fontSize: tokens.typography.fontSize.lg,
              cursor: 'pointer',
              padding: tokens.spacing[1],
            }}
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
      </div>

      {enabled && isExpanded && (
        <div style={contentStyles}>
          <PaymentTypeSelector
            selected={currentPreferences.paymentTypes}
            onChange={(types) => updatePreferences({ paymentTypes: types })}
            error={errors.paymentTypes}
          />

          {currentPreferences.paymentTypes.includes('cash') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.spacing[4] }}>
              <CashAmountInput
                label="Minimum Cash Amount"
                value={currentPreferences.minCashAmount}
                onChange={(amount) => updatePreferences({ minCashAmount: amount })}
                error={errors.minCashAmount}
                placeholder="0.00"
              />
              <CashAmountInput
                label="Maximum Cash Amount (Optional)"
                value={currentPreferences.maxCashAmount}
                onChange={(amount) => updatePreferences({ maxCashAmount: amount })}
                error={errors.maxCashAmount}
                placeholder="No limit"
              />
            </div>
          )}

          <AcceptanceStrategySelector
            selected={currentPreferences.acceptanceStrategy}
            onChange={(strategy) => updatePreferences({ acceptanceStrategy: strategy })}
            eventDate={eventDate}
            error={errors.acceptanceStrategy}
          />

          {currentPreferences.acceptanceStrategy === 'auction' && (
            <AuctionEndDatePicker
              value={currentPreferences.auctionEndDate}
              onChange={(date) => updatePreferences({ auctionEndDate: date })}
              minDate={new Date()}
              maxDate={new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000)}
              eventDate={eventDate}
              error={errors.auctionEndDate}
            />
          )}

          <SwapConditionsInput
            value={currentPreferences.swapConditions}
            onChange={(conditions) => updatePreferences({ swapConditions: conditions })}
            error={errors.swapConditions}
          />
        </div>
      )}
    </div>
  );
};