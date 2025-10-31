/**
 * Validation schemas and types for API requests
 * 
 * This module provides comprehensive validation schemas for all API request types,
 * including field-level validation rules, error handling, and type-safe validation
 * functions for proposal creation and swap operations.
 * 
 * Requirements satisfied:
 * - 3.2: Proper request payload formatting and validation
 * - Field-specific validation error display
 * - Type-safe validation throughout the application
 */

import { CreateProposalRequest, ValidationErrorDetails, FieldValidationState } from './api';

// ============================================================================
// Validation Rule Types
// ============================================================================

/**
 * Base validation rule interface
 * Common structure for all validation rules
 */
export interface BaseValidationRule {
  required?: boolean;
  message?: string;
}

/**
 * String validation rules
 * Rules specific to string fields
 */
export interface StringValidationRule extends BaseValidationRule {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  trim?: boolean;
}

/**
 * Array validation rules
 * Rules specific to array fields
 */
export interface ArrayValidationRule extends BaseValidationRule {
  minItems?: number;
  maxItems?: number;
  itemValidation?: ValidationRule;
}

/**
 * Boolean validation rules
 * Rules specific to boolean fields
 */
export interface BooleanValidationRule extends BaseValidationRule {
  mustBeTrue?: boolean;
}

/**
 * Union type for all validation rules
 * Allows type-safe rule definitions
 */
export type ValidationRule = StringValidationRule | ArrayValidationRule | BooleanValidationRule;

// ============================================================================
// Validation Schema Definitions
// ============================================================================

/**
 * Complete validation schema for proposal creation
 * Defines all validation rules for CreateProposalRequest
 */
export interface ProposalValidationSchema {
  sourceSwapId: StringValidationRule;
  message: StringValidationRule;
  conditions: ArrayValidationRule;
  agreedToTerms: BooleanValidationRule;
}

/**
 * Default validation schema for proposals
 * Pre-configured validation rules based on requirements
 */
export const DEFAULT_PROPOSAL_VALIDATION_SCHEMA: ProposalValidationSchema = {
  sourceSwapId: {
    required: true,
    minLength: 1,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: 'Source swap ID is required and must be valid',
    trim: true,
  },
  message: {
    required: false,
    maxLength: 1000,
    message: 'Message must be less than 1000 characters',
    trim: true,
  },
  conditions: {
    required: true,
    minItems: 1,
    maxItems: 10,
    message: 'At least one condition is required (maximum 10)',
    itemValidation: {
      required: true,
      minLength: 1,
      maxLength: 500,
      message: 'Each condition must be between 1 and 500 characters',
      trim: true,
    } as StringValidationRule,
  },
  agreedToTerms: {
    required: true,
    mustBeTrue: true,
    message: 'You must agree to the terms and conditions',
  },
};

/**
 * Validation schema for eligible swaps request options
 * Validates query parameters for fetching eligible swaps
 */
export interface EligibleSwapsValidationSchema {
  targetSwapId: StringValidationRule;
  limit: {
    required?: boolean;
    min?: number;
    max?: number;
    message?: string;
  };
  offset: {
    required?: boolean;
    min?: number;
    message?: string;
  };
  minCompatibilityScore: {
    required?: boolean;
    min?: number;
    max?: number;
    message?: string;
  };
}

/**
 * Default validation schema for eligible swaps requests
 */
export const DEFAULT_ELIGIBLE_SWAPS_VALIDATION_SCHEMA: EligibleSwapsValidationSchema = {
  targetSwapId: {
    required: true,
    minLength: 1,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: 'Target swap ID is required and must be valid',
    trim: true,
  },
  limit: {
    required: false,
    min: 1,
    max: 100,
    message: 'Limit must be between 1 and 100',
  },
  offset: {
    required: false,
    min: 0,
    message: 'Offset must be 0 or greater',
  },
  minCompatibilityScore: {
    required: false,
    min: 0,
    max: 100,
    message: 'Compatibility score must be between 0 and 100',
  },
};

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Comprehensive validation result
 * Contains all validation information for a form or request
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetails[];
  warnings?: string[];
  fieldStates?: Record<string, FieldValidationState>;
}

/**
 * Field-specific validation result
 * Result of validating a single field
 */
export interface FieldValidationResult {
  isValid: boolean;
  error?: ValidationErrorDetails;
  warning?: string;
}

/**
 * Validation context for complex validations
 * Provides additional context for validation rules
 */
export interface ValidationContext {
  userId?: string;
  targetSwapId?: string;
  existingProposals?: string[];
  userPermissions?: string[];
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a string field against string validation rules
 * @param value - The value to validate
 * @param rule - The validation rule to apply
 * @param fieldName - The name of the field being validated
 * @returns Validation result for the field
 */
export function validateStringField(
  value: any,
  rule: StringValidationRule,
  fieldName: string
): FieldValidationResult {
  const errors: ValidationErrorDetails[] = [];
  
  // Convert to string and trim if required
  let stringValue = value == null ? '' : String(value);
  if (rule.trim) {
    stringValue = stringValue.trim();
  }

  // Required validation
  if (rule.required && stringValue.length === 0) {
    errors.push({
      field: fieldName,
      message: rule.message || `${fieldName} is required`,
      code: 'REQUIRED',
    });
  }

  // Skip other validations if field is empty and not required
  if (!rule.required && stringValue.length === 0) {
    return { isValid: true };
  }

  // Length validations
  if (rule.minLength && stringValue.length < rule.minLength) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be at least ${rule.minLength} characters`,
      code: 'MIN_LENGTH',
    });
  }

  if (rule.maxLength && stringValue.length > rule.maxLength) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be no more than ${rule.maxLength} characters`,
      code: 'MAX_LENGTH',
    });
  }

  // Pattern validation
  if (rule.pattern && !rule.pattern.test(stringValue)) {
    errors.push({
      field: fieldName,
      message: rule.message || `${fieldName} format is invalid`,
      code: 'PATTERN',
    });
  }

  return {
    isValid: errors.length === 0,
    error: errors[0], // Return first error
  };
}

/**
 * Validate an array field against array validation rules
 * @param value - The array value to validate
 * @param rule - The validation rule to apply
 * @param fieldName - The name of the field being validated
 * @returns Validation result for the field
 */
export function validateArrayField(
  value: any,
  rule: ArrayValidationRule,
  fieldName: string
): FieldValidationResult {
  const errors: ValidationErrorDetails[] = [];
  
  // Ensure value is an array
  const arrayValue = Array.isArray(value) ? value : [];

  // Required validation
  if (rule.required && arrayValue.length === 0) {
    errors.push({
      field: fieldName,
      message: rule.message || `${fieldName} is required`,
      code: 'REQUIRED',
    });
  }

  // Skip other validations if array is empty and not required
  if (!rule.required && arrayValue.length === 0) {
    return { isValid: true };
  }

  // Length validations
  if (rule.minItems && arrayValue.length < rule.minItems) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must have at least ${rule.minItems} items`,
      code: 'MIN_ITEMS',
    });
  }

  if (rule.maxItems && arrayValue.length > rule.maxItems) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must have no more than ${rule.maxItems} items`,
      code: 'MAX_ITEMS',
    });
  }

  // Item validation
  if (rule.itemValidation && rule.itemValidation) {
    arrayValue.forEach((item, index) => {
      const itemResult = validateStringField(
        item,
        rule.itemValidation as StringValidationRule,
        `${fieldName}[${index}]`
      );
      if (!itemResult.isValid && itemResult.error) {
        errors.push(itemResult.error);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    error: errors[0], // Return first error
  };
}

/**
 * Validate a boolean field against boolean validation rules
 * @param value - The boolean value to validate
 * @param rule - The validation rule to apply
 * @param fieldName - The name of the field being validated
 * @returns Validation result for the field
 */
export function validateBooleanField(
  value: any,
  rule: BooleanValidationRule,
  fieldName: string
): FieldValidationResult {
  const errors: ValidationErrorDetails[] = [];
  
  const booleanValue = Boolean(value);

  // Required validation
  if (rule.required && !booleanValue) {
    errors.push({
      field: fieldName,
      message: rule.message || `${fieldName} is required`,
      code: 'REQUIRED',
    });
  }

  // Must be true validation
  if (rule.mustBeTrue && !booleanValue) {
    errors.push({
      field: fieldName,
      message: rule.message || `${fieldName} must be accepted`,
      code: 'MUST_BE_TRUE',
    });
  }

  return {
    isValid: errors.length === 0,
    error: errors[0], // Return first error
  };
}

/**
 * Validate a complete proposal request
 * @param data - The proposal data to validate
 * @param schema - The validation schema to use
 * @param context - Additional validation context
 * @returns Complete validation result
 */
export function validateProposalRequest(
  data: Partial<CreateProposalRequest>,
  schema: ProposalValidationSchema = DEFAULT_PROPOSAL_VALIDATION_SCHEMA,
  context?: ValidationContext
): ValidationResult {
  const errors: ValidationErrorDetails[] = [];
  const fieldStates: Record<string, FieldValidationState> = {};

  // Validate sourceSwapId
  const sourceSwapIdResult = validateStringField(data.sourceSwapId, schema.sourceSwapId, 'sourceSwapId');
  fieldStates.sourceSwapId = {
    value: data.sourceSwapId,
    isValid: sourceSwapIdResult.isValid,
    error: sourceSwapIdResult.error?.message,
    touched: true,
    dirty: true,
  };
  if (sourceSwapIdResult.error) {
    errors.push(sourceSwapIdResult.error);
  }

  // Validate message
  const messageResult = validateStringField(data.message, schema.message, 'message');
  fieldStates.message = {
    value: data.message,
    isValid: messageResult.isValid,
    error: messageResult.error?.message,
    touched: true,
    dirty: true,
  };
  if (messageResult.error) {
    errors.push(messageResult.error);
  }

  // Validate conditions
  const conditionsResult = validateArrayField(data.conditions, schema.conditions, 'conditions');
  fieldStates.conditions = {
    value: data.conditions,
    isValid: conditionsResult.isValid,
    error: conditionsResult.error?.message,
    touched: true,
    dirty: true,
  };
  if (conditionsResult.error) {
    errors.push(conditionsResult.error);
  }

  // Validate agreedToTerms
  const agreedToTermsResult = validateBooleanField(data.agreedToTerms, schema.agreedToTerms, 'agreedToTerms');
  fieldStates.agreedToTerms = {
    value: data.agreedToTerms,
    isValid: agreedToTermsResult.isValid,
    error: agreedToTermsResult.error?.message,
    touched: true,
    dirty: true,
  };
  if (agreedToTermsResult.error) {
    errors.push(agreedToTermsResult.error);
  }

  // Additional business logic validations
  if (context) {
    // Check for duplicate proposals
    if (context.existingProposals && data.sourceSwapId && context.existingProposals.includes(data.sourceSwapId)) {
      errors.push({
        field: 'sourceSwapId',
        message: 'You have already submitted a proposal for this swap',
        code: 'DUPLICATE_PROPOSAL',
      });
    }

    // Check if source and target are the same
    if (context.targetSwapId && data.sourceSwapId === context.targetSwapId) {
      errors.push({
        field: 'sourceSwapId',
        message: 'You cannot propose your own swap to itself',
        code: 'SELF_PROPOSAL',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldStates,
  };
}

/**
 * Create a field validation state object
 * @param value - The field value
 * @param isValid - Whether the field is valid
 * @param error - Error message if invalid
 * @param touched - Whether the field has been touched
 * @param dirty - Whether the field has been modified
 * @returns Field validation state
 */
export function createFieldValidationState(
  value: any,
  isValid: boolean = true,
  error?: string,
  touched: boolean = false,
  dirty: boolean = false
): FieldValidationState {
  return {
    value,
    isValid,
    error,
    touched,
    dirty,
  };
}

/**
 * Merge validation results
 * @param results - Array of validation results to merge
 * @returns Combined validation result
 */
export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const allErrors: ValidationErrorDetails[] = [];
  const allWarnings: string[] = [];
  const allFieldStates: Record<string, FieldValidationState> = {};

  results.forEach(result => {
    allErrors.push(...result.errors);
    if (result.warnings) {
      allWarnings.push(...result.warnings);
    }
    if (result.fieldStates) {
      Object.assign(allFieldStates, result.fieldStates);
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    fieldStates: Object.keys(allFieldStates).length > 0 ? allFieldStates : undefined,
  };
}