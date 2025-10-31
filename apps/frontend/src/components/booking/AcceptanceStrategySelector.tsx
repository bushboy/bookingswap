import React from 'react';
import { tokens } from '@/design-system/tokens';

interface AcceptanceStrategySelectorProps {
  selected: 'first-match' | 'auction';
  onChange: (strategy: 'first-match' | 'auction') => void;
  disabled?: boolean;
  eventDate: Date;
  error?: string;
}

export const AcceptanceStrategySelector: React.FC<AcceptanceStrategySelectorProps> = ({
  selected,
  onChange,
  disabled = false,
  eventDate,
  error,
}) => {
  const isLastMinute = eventDate && new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000) <= new Date();

  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[3],
  };

  const labelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing[2],
  };

  const optionsStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[3],
  };

  const optionStyles = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.2s ease-in-out',
  };

  const selectedOptionStyles = {
    ...optionStyles,
    borderColor: tokens.colors.primary[500],
    backgroundColor: tokens.colors.primary[50],
  };

  const radioStyles = {
    width: '16px',
    height: '16px',
    accentColor: tokens.colors.primary[600],
    marginTop: '2px',
  };

  const optionContentStyles = {
    flex: 1,
  };

  const optionTitleStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    margin: 0,
    marginBottom: tokens.spacing[1],
  };

  const optionDescriptionStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    lineHeight: tokens.typography.lineHeight.relaxed,
  };

  const warningStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.warning[700],
    backgroundColor: tokens.colors.warning[50],
    padding: tokens.spacing[2],
    borderRadius: tokens.borderRadius.md,
    marginTop: tokens.spacing[2],
  };

  const errorStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
    marginTop: tokens.spacing[1],
  };

  const handleOptionClick = (strategy: 'first-match' | 'auction') => {
    if (!disabled && !(strategy === 'auction' && isLastMinute)) {
      onChange(strategy);
    }
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>
        Deal Acceptance Strategy
      </label>
      <div style={optionsStyles}>
        <div
          style={selected === 'first-match' ? selectedOptionStyles : optionStyles}
          onClick={() => handleOptionClick('first-match')}
        >
          <input
            type="radio"
            name="acceptance-strategy"
            value="first-match"
            checked={selected === 'first-match'}
            onChange={() => handleOptionClick('first-match')}
            style={radioStyles}
            disabled={disabled}
            id="strategy-first-match"
          />
          <div style={optionContentStyles}>
            <h4 style={optionTitleStyles}>First Match</h4>
            <p style={optionDescriptionStyles}>
              Accept the first suitable proposal that meets your criteria. 
              Quick and simple - perfect for when you want to swap as soon as possible.
            </p>
          </div>
        </div>

        <div
          style={
            selected === 'auction' 
              ? selectedOptionStyles 
              : { ...optionStyles, opacity: isLastMinute ? 0.4 : 1 }
          }
          onClick={() => handleOptionClick('auction')}
        >
          <input
            type="radio"
            name="acceptance-strategy"
            value="auction"
            checked={selected === 'auction'}
            onChange={() => handleOptionClick('auction')}
            style={radioStyles}
            disabled={disabled || isLastMinute}
            id="strategy-auction"
          />
          <div style={optionContentStyles}>
            <h4 style={optionTitleStyles}>Auction Mode</h4>
            <p style={optionDescriptionStyles}>
              Collect multiple proposals and choose the best one before your deadline. 
              Great for maximizing value and having more options to choose from.
            </p>
            {isLastMinute && (
              <div style={warningStyles}>
                ⚠️ Auction mode is not available for events within one week. 
                Use "First Match" for last-minute bookings.
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <div style={errorStyles}>{error}</div>}
    </div>
  );
};