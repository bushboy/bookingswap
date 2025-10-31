import React from 'react';
import { Input } from '@/components/ui/Input';
import { tokens } from '@/design-system/tokens';

interface AuctionEndDatePickerProps {
  value?: Date;
  onChange: (date?: Date) => void;
  minDate: Date;
  maxDate: Date;
  eventDate: Date;
  error?: string;
}

export const AuctionEndDatePicker: React.FC<AuctionEndDatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  eventDate,
  error,
}) => {
  const formatDateForInput = (date?: Date): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const selectedDate = new Date(dateValue);
      // Set time to end of day for auction end
      selectedDate.setHours(23, 59, 59, 999);
      onChange(selectedDate);
    } else {
      onChange(undefined);
    }
  };

  const getValidationError = (): string | undefined => {
    if (error) return error;
    
    if (value) {
      const oneWeekBeforeEvent = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      if (value < minDate) {
        return 'Auction end date cannot be in the past';
      }
      
      if (value > oneWeekBeforeEvent) {
        return 'Auction must end at least one week before the event';
      }
    }
    
    return undefined;
  };

  const formatEventDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const helperTextStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginTop: tokens.spacing[1],
  };

  const validationError = getValidationError();
  const helperText = `Auction will end at 11:59 PM on the selected date. Event date: ${formatEventDate(eventDate)}`;

  return (
    <div>
      <Input
        label="Auction End Date"
        type="date"
        value={formatDateForInput(value)}
        onChange={handleDateChange}
        min={formatDateForInput(minDate)}
        max={formatDateForInput(maxDate)}
        error={validationError}
        helperText={!validationError ? helperText : undefined}
      />
    </div>
  );
};