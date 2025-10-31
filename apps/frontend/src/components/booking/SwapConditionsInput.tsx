import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { tokens } from '@/design-system/tokens';

interface SwapConditionsInputProps {
  value: string[];
  onChange: (conditions: string[]) => void;
  error?: string;
}

export const SwapConditionsInput: React.FC<SwapConditionsInputProps> = ({
  value,
  onChange,
  error,
}) => {
  const [newCondition, setNewCondition] = useState('');

  const addCondition = () => {
    const trimmedCondition = newCondition.trim();
    if (trimmedCondition && !value.includes(trimmedCondition)) {
      onChange([...value, trimmedCondition]);
      setNewCondition('');
    }
  };

  const removeCondition = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCondition();
    }
  };

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

  const inputContainerStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    alignItems: 'flex-end',
  };

  const conditionsListStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[2],
  };

  const conditionItemStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[100],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const conditionTextStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[800],
    flex: 1,
  };

  const removeButtonStyles = {
    background: 'none',
    border: 'none',
    color: tokens.colors.error[600],
    cursor: 'pointer',
    padding: tokens.spacing[1],
    borderRadius: tokens.borderRadius.sm,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const errorStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
    marginTop: tokens.spacing[1],
  };

  const emptyStateStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[500],
    fontStyle: 'italic',
    padding: tokens.spacing[3],
    textAlign: 'center' as const,
    border: `1px dashed ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
  };

  const commonConditions = [
    'Must be same or higher star rating',
    'Prefer city center location',
    'Must include breakfast',
    'Pool/spa facilities required',
    'Flexible check-in/out times',
    'Pet-friendly accommodation',
  ];

  const suggestionsStyles = {
    marginTop: tokens.spacing[2],
  };

  const suggestionsTitleStyles = {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[2],
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const suggestionsListStyles = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: tokens.spacing[2],
  };

  const suggestionButtonStyles = {
    fontSize: tokens.typography.fontSize.xs,
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    backgroundColor: tokens.colors.neutral[100],
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.sm,
    color: tokens.colors.neutral[700],
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  };

  const addSuggestion = (suggestion: string) => {
    if (!value.includes(suggestion)) {
      onChange([...value, suggestion]);
    }
  };

  return (
    <div style={containerStyles}>
      <label style={labelStyles}>
        Additional Swap Conditions (Optional)
      </label>
      
      <div style={inputContainerStyles}>
        <div style={{ flex: 1 }}>
          <Input
            value={newCondition}
            onChange={(e) => setNewCondition(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Must include breakfast"
            helperText="Add specific requirements for potential swaps"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addCondition}
          disabled={!newCondition.trim() || value.includes(newCondition.trim())}
        >
          Add
        </Button>
      </div>

      {value.length === 0 ? (
        <div style={emptyStateStyles}>
          No additional conditions specified. Your booking will be available for any suitable swap.
        </div>
      ) : (
        <div style={conditionsListStyles}>
          {value.map((condition, index) => (
            <div key={index} style={conditionItemStyles}>
              <span style={conditionTextStyles}>{condition}</span>
              <button
                type="button"
                onClick={() => removeCondition(index)}
                style={removeButtonStyles}
                title="Remove condition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length < 3 && (
        <div style={suggestionsStyles}>
          <div style={suggestionsTitleStyles}>Common conditions:</div>
          <div style={suggestionsListStyles}>
            {commonConditions
              .filter(suggestion => !value.includes(suggestion))
              .slice(0, 4)
              .map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => addSuggestion(suggestion)}
                  style={suggestionButtonStyles}
                >
                  + {suggestion}
                </button>
              ))}
          </div>
        </div>
      )}

      {error && <div style={errorStyles}>{error}</div>}
    </div>
  );
};