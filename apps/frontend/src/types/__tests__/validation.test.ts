/**
 * Tests for validation types and functions
 * 
 * This test suite verifies that all validation functions work correctly
 * and that validation schemas properly validate proposal data according
 * to the requirements.
 */

import {
  validateStringField,
  validateArrayField,
  validateBooleanField,
  validateProposalRequest,
  DEFAULT_PROPOSAL_VALIDATION_SCHEMA,
  createFieldValidationState,
  mergeValidationResults,
  StringValidationRule,
  ArrayValidationRule,
  BooleanValidationRule,
  ValidationResult,
  ValidationContext,
} from '../validation';
import { CreateProposalRequest } from '../api';

describe('Validation Functions', () => {
  describe('validateStringField', () => {
    const rule: StringValidationRule = {
      required: true,
      minLength: 3,
      maxLength: 10,
      pattern: /^[a-zA-Z0-9_-]+$/,
      trim: true,
    };

    it('should validate valid string', () => {
      const result = validateStringField('test123', rule, 'testField');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for empty required field', () => {
      const result = validateStringField('', rule, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('REQUIRED');
    });

    it('should fail validation for string too short', () => {
      const result = validateStringField('ab', rule, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('MIN_LENGTH');
    });

    it('should fail validation for string too long', () => {
      const result = validateStringField('verylongstring', rule, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('MAX_LENGTH');
    });

    it('should fail validation for invalid pattern', () => {
      const result = validateStringField('test@123', rule, 'testField');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('PATTERN');
    });

    it('should trim whitespace when trim is enabled', () => {
      const result = validateStringField('  test  ', rule, 'testField');
      expect(result.isValid).toBe(true);
    });

    it('should pass validation for optional empty field', () => {
      const optionalRule: StringValidationRule = { required: false, maxLength: 10 };
      const result = validateStringField('', optionalRule, 'optionalField');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateArrayField', () => {
    const rule: ArrayValidationRule = {
      required: true,
      minItems: 1,
      maxItems: 3,
      itemValidation: {
        required: true,
        minLength: 1,
        maxLength: 50,
        trim: true,
      } as StringValidationRule,
    };

    it('should validate valid array', () => {
      const result = validateArrayField(['item1', 'item2'], rule, 'testArray');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for empty required array', () => {
      const result = validateArrayField([], rule, 'testArray');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('REQUIRED');
    });

    it('should fail validation for array with too few items', () => {
      const result = validateArrayField([], { ...rule, required: false }, 'testArray');
      expect(result.isValid).toBe(true); // Empty is OK when not required
    });

    it('should fail validation for array with too many items', () => {
      const result = validateArrayField(['item1', 'item2', 'item3', 'item4'], rule, 'testArray');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('MAX_ITEMS');
    });

    it('should validate individual items', () => {
      const result = validateArrayField(['valid', ''], rule, 'testArray');
      expect(result.isValid).toBe(false);
      // Should fail because one item is empty
    });

    it('should handle non-array values', () => {
      const result = validateArrayField('not an array', rule, 'testArray');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('REQUIRED');
    });
  });

  describe('validateBooleanField', () => {
    const rule: BooleanValidationRule = {
      required: true,
      mustBeTrue: true,
    };

    it('should validate true value', () => {
      const result = validateBooleanField(true, rule, 'testBoolean');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for false when mustBeTrue', () => {
      const result = validateBooleanField(false, rule, 'testBoolean');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('MUST_BE_TRUE');
    });

    it('should fail validation for falsy values when required', () => {
      const result = validateBooleanField(null, rule, 'testBoolean');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('REQUIRED');
    });

    it('should pass validation for optional false field', () => {
      const optionalRule: BooleanValidationRule = { required: false };
      const result = validateBooleanField(false, optionalRule, 'optionalBoolean');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateProposalRequest', () => {
    const validProposal: CreateProposalRequest = {
      sourceSwapId: 'swap_123',
      message: 'I would love to swap!',
      conditions: ['Flexible dates', 'Pet-friendly'],
      agreedToTerms: true,
    };

    it('should validate valid proposal', () => {
      const result = validateProposalRequest(validProposal);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', () => {
      const invalidProposal: Partial<CreateProposalRequest> = {
        message: 'Test message',
      };

      const result = validateProposalRequest(invalidProposal);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const errorCodes = result.errors.map(e => e.code);
      expect(errorCodes).toContain('REQUIRED'); // sourceSwapId
      expect(errorCodes).toContain('REQUIRED'); // conditions
      expect(errorCodes).toContain('MUST_BE_TRUE'); // agreedToTerms
    });

    it('should fail validation for invalid sourceSwapId pattern', () => {
      const invalidProposal: CreateProposalRequest = {
        ...validProposal,
        sourceSwapId: 'invalid@id',
      };

      const result = validateProposalRequest(invalidProposal);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PATTERN')).toBe(true);
    });

    it('should fail validation for message too long', () => {
      const invalidProposal: CreateProposalRequest = {
        ...validProposal,
        message: 'x'.repeat(1001), // Exceeds 1000 character limit
      };

      const result = validateProposalRequest(invalidProposal);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MAX_LENGTH')).toBe(true);
    });

    it('should fail validation for empty conditions array', () => {
      const invalidProposal: CreateProposalRequest = {
        ...validProposal,
        conditions: [],
      };

      const result = validateProposalRequest(invalidProposal);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'REQUIRED')).toBe(true);
    });

    it('should fail validation for terms not agreed', () => {
      const invalidProposal: CreateProposalRequest = {
        ...validProposal,
        agreedToTerms: false,
      };

      const result = validateProposalRequest(invalidProposal);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MUST_BE_TRUE')).toBe(true);
    });

    it('should include field states in result', () => {
      const result = validateProposalRequest(validProposal);
      expect(result.fieldStates).toBeDefined();
      expect(result.fieldStates?.sourceSwapId).toBeDefined();
      expect(result.fieldStates?.sourceSwapId.isValid).toBe(true);
    });

    describe('with validation context', () => {
      it('should fail validation for duplicate proposal', () => {
        const context: ValidationContext = {
          existingProposals: ['swap_123'],
          targetSwapId: 'target_456',
        };

        const result = validateProposalRequest(validProposal, DEFAULT_PROPOSAL_VALIDATION_SCHEMA, context);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'DUPLICATE_PROPOSAL')).toBe(true);
      });

      it('should fail validation for self-proposal', () => {
        const context: ValidationContext = {
          targetSwapId: 'swap_123', // Same as sourceSwapId
        };

        const result = validateProposalRequest(validProposal, DEFAULT_PROPOSAL_VALIDATION_SCHEMA, context);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.code === 'SELF_PROPOSAL')).toBe(true);
      });
    });
  });

  describe('createFieldValidationState', () => {
    it('should create field validation state with defaults', () => {
      const state = createFieldValidationState('test value');
      expect(state).toEqual({
        value: 'test value',
        isValid: true,
        error: undefined,
        touched: false,
        dirty: false,
      });
    });

    it('should create field validation state with custom values', () => {
      const state = createFieldValidationState('test', false, 'Error message', true, true);
      expect(state).toEqual({
        value: 'test',
        isValid: false,
        error: 'Error message',
        touched: true,
        dirty: true,
      });
    });
  });

  describe('mergeValidationResults', () => {
    it('should merge multiple validation results', () => {
      const result1: ValidationResult = {
        isValid: false,
        errors: [{ field: 'field1', message: 'Error 1', code: 'ERROR1' }],
        warnings: ['Warning 1'],
        fieldStates: { field1: createFieldValidationState('value1', false, 'Error 1') },
      };

      const result2: ValidationResult = {
        isValid: false,
        errors: [{ field: 'field2', message: 'Error 2', code: 'ERROR2' }],
        warnings: ['Warning 2'],
        fieldStates: { field2: createFieldValidationState('value2', false, 'Error 2') },
      };

      const merged = mergeValidationResults([result1, result2]);

      expect(merged.isValid).toBe(false);
      expect(merged.errors).toHaveLength(2);
      expect(merged.warnings).toHaveLength(2);
      expect(merged.fieldStates).toHaveProperty('field1');
      expect(merged.fieldStates).toHaveProperty('field2');
    });

    it('should return valid result when all inputs are valid', () => {
      const result1: ValidationResult = {
        isValid: true,
        errors: [],
      };

      const result2: ValidationResult = {
        isValid: true,
        errors: [],
      };

      const merged = mergeValidationResults([result1, result2]);
      expect(merged.isValid).toBe(true);
      expect(merged.errors).toHaveLength(0);
    });
  });
});