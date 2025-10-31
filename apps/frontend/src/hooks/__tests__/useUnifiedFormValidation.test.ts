/**
 * Tests for unified form validation hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useUnifiedFormValidation,
  useFieldValidation,
  useAuctionTimingValidation,
  useInlineProposalValidation,
} from '../useUnifiedFormValidation';
import { UnifiedBookingData, SwapPreferencesData } from '@booking-swap/shared';

// Mock the debounce hook
vi.mock('../useDebounce', () => ({
  useDebounce: (value: any, delay: number) => value,
}));

describe('useUnifiedFormValidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const validBookingData: UnifiedBookingData = {
    type: 'hotel',
    title: 'Test Hotel Booking',
    description: 'A nice hotel booking for testing',
    location: {
      city: 'New York',
      country: 'USA',
    },
    dateRange: {
      checkIn: new Date('2024-12-01'),
      checkOut: new Date('2024-12-05'),
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF456',
    },
    swapEnabled: false,
  };

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [state] = result.current;

    expect(state.errors).toEqual({});
    expect(state.warnings).toEqual({});
    expect(state.isValid).toBe(true);
    expect(state.isValidating).toBe(false);
    expect(state.hasBeenSubmitted).toBe(false);
    expect(state.touchedFields.size).toBe(0);
  });

  it('should validate form successfully', async () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    let isValid: boolean;
    await act(async () => {
      isValid = await actions.validateForm(validBookingData);
    });

    expect(isValid!).toBe(true);
    expect(result.current[0].isValid).toBe(true);
    expect(result.current[0].hasBeenSubmitted).toBe(true);
  });

  it('should detect form validation errors', async () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    const invalidData = { ...validBookingData, title: '' };

    let isValid: boolean;
    await act(async () => {
      isValid = await actions.validateForm(invalidData);
    });

    expect(isValid!).toBe(false);
    expect(result.current[0].isValid).toBe(false);
    expect(result.current[0].errors.title).toBeDefined();
  });

  it('should validate individual fields', async () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    await act(async () => {
      await actions.validateField('title', '');
    });

    // Should not show error until field is touched or form is submitted
    expect(result.current[0].errors.title).toBeUndefined();

    await act(async () => {
      actions.markFieldTouched('title');
      await actions.validateField('title', '');
    });

    expect(result.current[0].errors.title).toBeDefined();
  });

  it('should validate swap preferences', () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    const preferences: SwapPreferencesData = {
      paymentTypes: [],
      acceptanceStrategy: 'first-match',
      swapConditions: [],
    };

    act(() => {
      actions.validateSwapPreferences(preferences, new Date());
    });

    expect(result.current[0].errors.paymentTypes).toBeDefined();
  });

  it('should clear field errors', () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    act(() => {
      actions.setFieldError('title', 'Test error');
    });

    expect(result.current[0].errors.title).toBe('Test error');

    act(() => {
      actions.clearFieldError('title');
    });

    expect(result.current[0].errors.title).toBeUndefined();
  });

  it('should clear all errors', () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    act(() => {
      actions.setFieldError('title', 'Error 1');
      actions.setFieldError('description', 'Error 2');
    });

    expect(Object.keys(result.current[0].errors)).toHaveLength(2);

    act(() => {
      actions.clearAllErrors();
    });

    expect(Object.keys(result.current[0].errors)).toHaveLength(0);
  });

  it('should reset form state', () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    act(() => {
      actions.setFieldError('title', 'Test error');
      actions.markFieldTouched('title');
      actions.markFormSubmitted();
    });

    expect(result.current[0].errors.title).toBeDefined();
    expect(result.current[0].hasBeenSubmitted).toBe(true);
    expect(result.current[0].touchedFields.has('title')).toBe(true);

    act(() => {
      actions.reset();
    });

    expect(result.current[0].errors).toEqual({});
    expect(result.current[0].hasBeenSubmitted).toBe(false);
    expect(result.current[0].touchedFields.size).toBe(0);
  });

  it('should provide utility functions', () => {
    const { result } = renderHook(() => useUnifiedFormValidation());
    const [, actions] = result.current;

    act(() => {
      actions.setFieldError('title', 'Test error');
    });

    expect(actions.hasErrors()).toBe(true);
    expect(actions.getErrorCount()).toBe(1);
    expect(actions.getFieldError('title')).toBe('Test error');
  });
});

describe('useFieldValidation', () => {
  it('should initialize with provided value', () => {
    const { result } = renderHook(() => 
      useFieldValidation('title', 'Initial Value')
    );

    expect(result.current.value).toBe('Initial Value');
    expect(result.current.error).toBe('');
    expect(result.current.isTouched).toBe(false);
  });

  it('should update value on change', () => {
    const { result } = renderHook(() => 
      useFieldValidation('title', '')
    );

    act(() => {
      result.current.setValue('New Value');
    });

    expect(result.current.value).toBe('New Value');
  });

  it('should validate on blur when touched', () => {
    const { result } = renderHook(() => 
      useFieldValidation('title', '')
    );

    act(() => {
      result.current.onBlur();
    });

    expect(result.current.isTouched).toBe(true);
    expect(result.current.error).toBeDefined();
  });

  it('should reset field state', () => {
    const { result } = renderHook(() => 
      useFieldValidation('title', 'Initial')
    );

    act(() => {
      result.current.setValue('Changed');
      result.current.onBlur();
    });

    expect(result.current.value).toBe('Changed');
    expect(result.current.isTouched).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.value).toBe('Initial');
    expect(result.current.isTouched).toBe(false);
    expect(result.current.error).toBe('');
  });
});

describe('useAuctionTimingValidation', () => {
  it('should initialize with valid state', () => {
    const { result } = renderHook(() => useAuctionTimingValidation());

    expect(result.current.auctionEndDate).toBeNull();
    expect(result.current.validation.isValid).toBe(true);
    expect(result.current.validation.errors).toHaveLength(0);
  });

  it('should validate auction timing', () => {
    const eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const { result } = renderHook(() => useAuctionTimingValidation(eventDate));

    const auctionEndDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now

    act(() => {
      result.current.setAuctionEndDate(auctionEndDate);
    });

    expect(result.current.validation.isValid).toBe(true);
    expect(result.current.validation.errors).toHaveLength(0);
  });

  it('should detect invalid auction timing', () => {
    const eventDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    const { result } = renderHook(() => useAuctionTimingValidation(eventDate));

    const auctionEndDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days from now

    act(() => {
      result.current.setAuctionEndDate(auctionEndDate);
    });

    expect(result.current.validation.isValid).toBe(false);
    expect(result.current.validation.errors.length).toBeGreaterThan(0);
  });

  it('should detect last-minute events', () => {
    const eventDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const { result } = renderHook(() => useAuctionTimingValidation(eventDate));

    expect(result.current.isLastMinute).toBe(true);
  });
});

describe('useInlineProposalValidation', () => {
  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useInlineProposalValidation());

    expect(result.current.proposalData).toEqual({});
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  it('should update proposal fields', () => {
    const { result } = renderHook(() => useInlineProposalValidation());

    act(() => {
      result.current.updateField('type', 'cash');
      result.current.updateField('cashAmount', 200);
    });

    expect(result.current.proposalData.type).toBe('cash');
    expect(result.current.proposalData.cashAmount).toBe(200);
  });

  it('should validate proposal data', () => {
    const { result } = renderHook(() => useInlineProposalValidation());

    const proposalData = {
      type: 'cash' as const,
      cashAmount: 200,
      paymentMethodId: 'pm-123',
      message: 'Test proposal',
      conditions: [],
    };

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateProposal(proposalData);
    });

    expect(isValid!).toBe(true);
    expect(result.current.isValid).toBe(true);
  });

  it('should detect validation errors', () => {
    const { result } = renderHook(() => useInlineProposalValidation(100));

    const proposalData = {
      type: 'cash' as const,
      cashAmount: 50, // Below minimum
      paymentMethodId: 'pm-123',
      message: 'Test proposal',
      conditions: [],
    };

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateProposal(proposalData);
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.cashAmount).toBeDefined();
  });

  it('should clear field errors on update', () => {
    const { result } = renderHook(() => useInlineProposalValidation());

    // Set an error first
    act(() => {
      result.current.validateProposal({
        type: 'cash',
        paymentMethodId: 'pm-123',
        message: 'Test',
        conditions: [],
      });
    });

    expect(result.current.errors.cashAmount).toBeDefined();

    // Update the field
    act(() => {
      result.current.updateField('cashAmount', 200);
    });

    expect(result.current.errors.cashAmount).toBeUndefined();
  });

  it('should reset proposal state', () => {
    const { result } = renderHook(() => useInlineProposalValidation());

    act(() => {
      result.current.updateField('type', 'cash');
      result.current.validateProposal({
        type: 'cash',
        message: 'Test',
        conditions: [],
      });
    });

    expect(result.current.proposalData.type).toBe('cash');
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.proposalData).toEqual({});
    expect(result.current.errors).toEqual({});
  });
});