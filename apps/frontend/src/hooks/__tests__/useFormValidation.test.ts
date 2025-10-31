import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from '../useFormValidation';
import { ValidationRules } from '../../utils/validation';

describe('useFormValidation', () => {
  const mockValidationSchema = {
    title: [ValidationRules.required(), ValidationRules.minLength(3)],
    email: [ValidationRules.required(), ValidationRules.email()],
    price: [ValidationRules.required(), ValidationRules.min(0)],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty values and no errors', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    expect(result.current.values).toEqual({});
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('should initialize with provided initial values', () => {
    const initialValues = { title: 'Test Title', email: 'test@example.com' };
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, initialValues)
    );

    expect(result.current.values).toEqual(initialValues);
  });

  it('should update values and validate on change', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    act(() => {
      result.current.setValue('title', 'Te');
    });

    expect(result.current.values.title).toBe('Te');
    expect(result.current.errors.title).toBeDefined();
    expect(result.current.isValid).toBe(false);
  });

  it('should validate all fields and return validation state', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    act(() => {
      result.current.setValue('title', 'Valid Title');
      result.current.setValue('email', 'valid@example.com');
      result.current.setValue('price', 100);
    });

    expect(result.current.isValid).toBe(true);
    expect(Object.keys(result.current.errors)).toHaveLength(0);
  });

  it('should handle form submission with validation', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    // Set valid values
    act(() => {
      result.current.setValue('title', 'Valid Title');
      result.current.setValue('email', 'valid@example.com');
      result.current.setValue('price', 100);
    });

    await act(async () => {
      await result.current.handleSubmit(onSubmit)();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Valid Title',
      email: 'valid@example.com',
      price: 100,
    });
  });

  it('should prevent submission with invalid data', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    // Set invalid values
    act(() => {
      result.current.setValue('title', '');
      result.current.setValue('email', 'invalid-email');
    });

    await act(async () => {
      await result.current.handleSubmit(onSubmit)();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.title).toBeDefined();
    expect(result.current.errors.email).toBeDefined();
  });

  it('should handle submission errors', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'));
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    // Set valid values
    act(() => {
      result.current.setValue('title', 'Valid Title');
      result.current.setValue('email', 'valid@example.com');
      result.current.setValue('price', 100);
    });

    await act(async () => {
      await result.current.handleSubmit(onSubmit)();
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('should reset form to initial values', () => {
    const initialValues = { title: 'Initial Title' };
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, initialValues)
    );

    act(() => {
      result.current.setValue('title', 'Changed Title');
      result.current.setValue('email', 'test@example.com');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
  });

  it('should validate single field', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    act(() => {
      result.current.validateField('title', '');
    });

    expect(result.current.errors.title).toBeDefined();

    act(() => {
      result.current.validateField('title', 'Valid Title');
    });

    expect(result.current.errors.title).toBeUndefined();
  });

  it('should clear field error', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    act(() => {
      result.current.setValue('title', '');
    });

    expect(result.current.errors.title).toBeDefined();

    act(() => {
      result.current.clearFieldError('title');
    });

    expect(result.current.errors.title).toBeUndefined();
  });

  it('should set multiple values at once', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    const newValues = {
      title: 'New Title',
      email: 'new@example.com',
      price: 200,
    };

    act(() => {
      result.current.setValues(newValues);
    });

    expect(result.current.values).toEqual(newValues);
  });

  it('should handle touch state for fields', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockValidationSchema, {})
    );

    act(() => {
      result.current.setFieldTouched('title', true);
    });

    expect(result.current.touched.title).toBe(true);
  });
});
