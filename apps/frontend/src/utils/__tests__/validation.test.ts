import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ValidationRules,
  ValidationEngine,
  BookingValidationSchema,
  SwapValidationSchema,
  createBookingValidator,
  createSwapValidator,
  formatValidationErrors,
  parseServerValidationErrors,
} from '../validation';
import { ERROR_CODES, ValidationError } from '@booking-swap/shared';

describe('ValidationRules', () => {
  describe('required', () => {
    it('should validate required fields correctly', () => {
      const rule = ValidationRules.required();

      expect(rule.validator('')).toBe(false);
      expect(rule.validator('  ')).toBe(false);
      expect(rule.validator(null)).toBe(false);
      expect(rule.validator(undefined)).toBe(false);
      expect(rule.validator([])).toBe(false);

      expect(rule.validator('test')).toBe(true);
      expect(rule.validator(['item'])).toBe(true);
      expect(rule.validator(0)).toBe(true);
      expect(rule.validator(false)).toBe(true);
    });
  });

  describe('minLength', () => {
    it('should validate minimum length correctly', () => {
      const rule = ValidationRules.minLength(3);

      expect(rule.validator('')).toBe(true); // Empty is valid (use required for that)
      expect(rule.validator('ab')).toBe(false);
      expect(rule.validator('abc')).toBe(true);
      expect(rule.validator('abcd')).toBe(true);
    });
  });

  describe('maxLength', () => {
    it('should validate maximum length correctly', () => {
      const rule = ValidationRules.maxLength(5);

      expect(rule.validator('')).toBe(true);
      expect(rule.validator('abc')).toBe(true);
      expect(rule.validator('abcde')).toBe(true);
      expect(rule.validator('abcdef')).toBe(false);
    });
  });

  describe('email', () => {
    it('should validate email addresses correctly', () => {
      const rule = ValidationRules.email();

      expect(rule.validator('')).toBe(true); // Empty is valid
      expect(rule.validator('test@example.com')).toBe(true);
      expect(rule.validator('user.name+tag@domain.co.uk')).toBe(true);

      expect(rule.validator('invalid')).toBe(false);
      expect(rule.validator('test@')).toBe(false);
      expect(rule.validator('@example.com')).toBe(false);
      expect(rule.validator('test@.com')).toBe(false);
    });
  });

  describe('positiveNumber', () => {
    it('should validate positive numbers correctly', () => {
      const rule = ValidationRules.positiveNumber();

      expect(rule.validator('')).toBe(true); // Empty is valid
      expect(rule.validator('0')).toBe(false);
      expect(rule.validator('-1')).toBe(false);
      expect(rule.validator('1')).toBe(true);
      expect(rule.validator('1.5')).toBe(true);
      expect(rule.validator(1)).toBe(true);
      expect(rule.validator(0)).toBe(false);
      expect(rule.validator(-1)).toBe(false);
    });
  });

  describe('dateNotPast', () => {
    it('should validate dates are not in the past', () => {
      const rule = ValidationRules.dateNotPast();
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      expect(rule.validator('')).toBe(true); // Empty is valid
      expect(rule.validator(yesterday)).toBe(false);
      expect(rule.validator(today)).toBe(true);
      expect(rule.validator(tomorrow)).toBe(true);
    });
  });

  describe('fileSize', () => {
    it('should validate file sizes correctly', () => {
      const rule = ValidationRules.fileSize(1); // 1MB limit

      const smallFile = { size: 500 * 1024 } as File; // 500KB
      const largeFile = { size: 2 * 1024 * 1024 } as File; // 2MB

      expect(rule.validator([])).toBe(true); // Empty is valid
      expect(rule.validator([smallFile])).toBe(true);
      expect(rule.validator([largeFile])).toBe(false);
      expect(rule.validator([smallFile, largeFile])).toBe(false);
    });
  });

  describe('fileType', () => {
    it('should validate file types correctly', () => {
      const rule = ValidationRules.fileType(['jpg', 'png', 'pdf']);

      const jpgFile = { name: 'image.jpg' } as File;
      const pngFile = { name: 'image.PNG' } as File; // Case insensitive
      const pdfFile = { name: 'document.pdf' } as File;
      const txtFile = { name: 'document.txt' } as File;

      expect(rule.validator([])).toBe(true); // Empty is valid
      expect(rule.validator([jpgFile])).toBe(true);
      expect(rule.validator([pngFile])).toBe(true);
      expect(rule.validator([pdfFile])).toBe(true);
      expect(rule.validator([txtFile])).toBe(false);
      expect(rule.validator([jpgFile, txtFile])).toBe(false);
    });
  });

  describe('custom', () => {
    it('should handle custom validation rules', () => {
      const rule = ValidationRules.custom(
        (value, formData) => value === formData?.expectedValue,
        'Value must match expected value'
      );

      expect(rule.validator('test', { expectedValue: 'test' })).toBe(true);
      expect(rule.validator('wrong', { expectedValue: 'test' })).toBe(false);
    });
  });
});

describe('ValidationEngine', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine({
      title: {
        rules: [
          ValidationRules.required('Title is required'),
          ValidationRules.minLength(3, 'Title must be at least 3 characters'),
        ],
        required: true,
      },
      email: {
        rules: [ValidationRules.email('Invalid email format')],
      },
      price: {
        rules: [
          ValidationRules.positiveNumber('Price must be positive'),
          ValidationRules.maxValue(1000, 'Price too high'),
        ],
      },
    });
  });

  describe('validateField', () => {
    it('should validate a single field correctly', async () => {
      // Valid field
      let result = await engine.validateField('title', 'Valid Title');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Invalid field - required
      result = await engine.validateField('title', '');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Title is required');

      // Invalid field - min length
      result = await engine.validateField('title', 'ab');
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        'Title must be at least 3 characters'
      );

      // Optional field - valid
      result = await engine.validateField('email', 'test@example.com');
      expect(result.isValid).toBe(true);

      // Optional field - invalid
      result = await engine.validateField('email', 'invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toBe('Invalid email format');
    });

    it('should handle non-existent fields', async () => {
      const result = await engine.validateField('nonexistent', 'value');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateForm', () => {
    it('should validate entire form correctly', async () => {
      // Valid form
      let result = await engine.validateForm({
        title: 'Valid Title',
        email: 'test@example.com',
        price: 100,
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Invalid form - multiple errors
      result = await engine.validateForm({
        title: '', // Required field missing
        email: 'invalid-email', // Invalid format
        price: -10, // Negative number
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('should handle nested field paths', async () => {
      const nestedEngine = new ValidationEngine({
        'user.name': {
          rules: [ValidationRules.required('Name is required')],
          required: true,
        },
        'user.email': {
          rules: [ValidationRules.email('Invalid email')],
        },
      });

      const result = await nestedEngine.validateForm({
        user: {
          name: '',
          email: 'invalid',
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('validateFieldDebounced', () => {
    it('should debounce validation calls', done => {
      const callback = vi.fn();

      // Make multiple rapid calls
      engine.validateFieldDebounced('title', 'test1', {}, callback);
      engine.validateFieldDebounced('title', 'test2', {}, callback);
      engine.validateFieldDebounced('title', 'test3', {}, callback);

      // Should only call callback once after debounce
      setTimeout(() => {
        expect(callback).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });
  });
});

describe('BookingValidationSchema', () => {
  let validator: ValidationEngine;

  beforeEach(() => {
    validator = createBookingValidator();
  });

  it('should validate booking title correctly', async () => {
    const result = await validator.validateField(
      'title',
      'Valid Hotel Booking'
    );
    expect(result.isValid).toBe(true);

    const invalidResult = await validator.validateField('title', '');
    expect(invalidResult.isValid).toBe(false);
  });

  it('should validate booking prices correctly', async () => {
    const formData = { originalPrice: 100 };

    // Valid swap value
    let result = await validator.validateField('swapValue', 120, formData);
    expect(result.isValid).toBe(true);

    // Invalid swap value (too high)
    result = await validator.validateField('swapValue', 200, formData);
    expect(result.isValid).toBe(false);
  });

  it('should validate date ranges correctly', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    const formData = {
      dateRange: {
        checkIn: tomorrow,
        checkOut: dayAfter,
      },
    };

    // Valid check-out date
    let result = await validator.validateField(
      'dateRange.checkOut',
      dayAfter,
      formData
    );
    expect(result.isValid).toBe(true);

    // Invalid check-out date (before check-in)
    result = await validator.validateField(
      'dateRange.checkOut',
      tomorrow,
      formData
    );
    expect(result.isValid).toBe(false);
  });
});

describe('SwapValidationSchema', () => {
  let validator: ValidationEngine;

  beforeEach(() => {
    validator = createSwapValidator();
  });

  it('should validate swap conditions correctly', async () => {
    const validConditions = ['Condition 1', 'Condition 2'];
    let result = await validator.validateField('conditions', validConditions);
    expect(result.isValid).toBe(true);

    // Too many conditions
    const tooManyConditions = Array(15).fill('Condition');
    result = await validator.validateField('conditions', tooManyConditions);
    expect(result.isValid).toBe(false);

    // Empty condition
    const emptyConditions = ['Valid condition', ''];
    result = await validator.validateField('conditions', emptyConditions);
    expect(result.isValid).toBe(false);
  });

  it('should validate expiration dates correctly', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    let result = await validator.validateField('expiresAt', tomorrow);
    expect(result.isValid).toBe(true);

    // Past date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    result = await validator.validateField('expiresAt', yesterday);
    expect(result.isValid).toBe(false);

    // Too far in future
    const tooFar = new Date();
    tooFar.setDate(tooFar.getDate() + 100);
    result = await validator.validateField('expiresAt', tooFar);
    expect(result.isValid).toBe(false);
  });
});

describe('Utility Functions', () => {
  describe('formatValidationErrors', () => {
    it('should format validation errors correctly', () => {
      const errors = [
        {
          field: 'title',
          message: 'Title is required',
          code: 'REQUIRED',
          type: 'error' as const,
        },
        {
          field: 'email',
          message: 'Invalid email',
          code: 'INVALID_FORMAT',
          type: 'error' as const,
        },
      ];

      const formatted = formatValidationErrors(errors);
      expect(formatted).toEqual({
        title: 'Title is required',
        email: 'Invalid email',
      });
    });
  });

  describe('parseServerValidationErrors', () => {
    it('should parse Joi validation errors from server', () => {
      const serverError = {
        response: {
          data: {
            error: {
              details: {
                errors: [
                  {
                    field: 'title',
                    message: 'Title is required',
                    code: 'REQUIRED',
                  },
                  {
                    field: 'price',
                    message: 'Price must be positive',
                    code: 'INVALID_FORMAT',
                  },
                ],
              },
            },
          },
        },
      };

      const parsed = parseServerValidationErrors(serverError);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].field).toBe('title');
      expect(parsed[0].message).toBe('Title is required');
    });

    it('should handle ValidationError instances', () => {
      const validationError = new ValidationError('Invalid input', {
        field: 'test',
      });
      const parsed = parseServerValidationErrors(validationError);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].field).toBe('general');
      expect(parsed[0].message).toBe('Invalid input');
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      const parsed = parseServerValidationErrors(genericError);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].field).toBe('general');
      expect(parsed[0].message).toBe('Something went wrong');
    });
  });
});
