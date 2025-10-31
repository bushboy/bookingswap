import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import {
    detectSchemaError,
    handleSchemaError,
    SchemaErrorFactory,
    SchemaErrorCodes,
    validateDatabaseFunctions,
    getSchemaErrorResolution
} from '../schemaErrorHandling';

describe('schemaErrorHandling', () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
    });

    describe('detectSchemaError', () => {
        it('should detect column not found errors (42703)', () => {
            const error = {
                code: '42703',
                message: 'column "owner_id" does not exist'
            };

            const schemaError = detectSchemaError(error);

            expect(schemaError).toBeDefined();
            expect(schemaError?.code).toBe(SchemaErrorCodes.COLUMN_NOT_FOUND);
            expect(schemaError?.category).toBe('schema_migration');
            expect(schemaError?.message).toContain('owner_id');
        });

        it('should detect function not found errors (42883)', () => {
            const error = {
                code: '42883',
                message: 'function find_eligible_swaps_optimized does not exist'
            };

            const schemaError = detectSchemaError(error);

            expect(schemaError).toBeDefined();
            expect(schemaError?.code).toBe(SchemaErrorCodes.FUNCTION_NOT_FOUND);
            expect(schemaError?.category).toBe('function_update');
            expect(schemaError?.message).toContain('find_eligible_swaps_optimized');
        });

        it('should detect relation not found errors (42P01)', () => {
            const error = {
                code: '42P01',
                message: 'relation "old_table" does not exist'
            };

            const schemaError = detectSchemaError(error);

            expect(schemaError).toBeDefined();
            expect(schemaError?.code).toBe(SchemaErrorCodes.RELATION_NOT_FOUND);
            expect(schemaError?.category).toBe('schema_migration');
            expect(schemaError?.message).toContain('old_table');
        });

        it('should return null for non-schema errors', () => {
            const error = {
                code: '23505',
                message: 'duplicate key value violates unique constraint'
            };

            const schemaError = detectSchemaError(error);

            expect(schemaError).toBeNull();
        });

        it('should return null for errors without code', () => {
            const error = {
                message: 'some generic error'
            };

            const schemaError = detectSchemaError(error);

            expect(schemaError).toBeNull();
        });
    });

    describe('SchemaErrorFactory', () => {
        it('should create column not found error', () => {
            const error = SchemaErrorFactory.createColumnNotFoundError('owner_id', 'swaps');

            expect(error.code).toBe(SchemaErrorCodes.COLUMN_NOT_FOUND);
            expect(error.message).toContain('owner_id');
            expect(error.message).toContain('swaps');
            expect(error.category).toBe('schema_migration');
            expect(error.statusCode).toBe(500);
            expect(error.retryable).toBe(false);
        });

        it('should create function not found error', () => {
            const error = SchemaErrorFactory.createFunctionNotFoundError('find_eligible_swaps_optimized');

            expect(error.code).toBe(SchemaErrorCodes.FUNCTION_NOT_FOUND);
            expect(error.message).toContain('find_eligible_swaps_optimized');
            expect(error.category).toBe('function_update');
            expect(error.statusCode).toBe(500);
            expect(error.retryable).toBe(false);
        });

        it('should create permission denied error', () => {
            const error = SchemaErrorFactory.createPermissionDeniedError('SELECT on table users');

            expect(error.code).toBe(SchemaErrorCodes.PERMISSION_DENIED);
            expect(error.message).toContain('SELECT on table users');
            expect(error.category).toBe('permission');
            expect(error.statusCode).toBe(500);
            expect(error.retryable).toBe(false);
        });
    });

    describe('handleSchemaError', () => {
        it('should handle schema errors and return true', () => {
            const error = {
                code: '42703',
                message: 'column "owner_id" does not exist'
            };

            const context = {
                operation: 'findEligibleSwaps',
                userId: 'user-123',
                requestId: 'req-456'
            };

            const handled = handleSchemaError(error, mockResponse as Response, context);

            expect(handled).toBe(true);
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({
                        code: '42703',
                        category: 'schema_migration',
                        retryable: false
                    }),
                    metadata: expect.objectContaining({
                        requestId: 'req-456',
                        operation: 'findEligibleSwaps',
                        requirement: '3.2'
                    })
                })
            );
        });

        it('should return false for non-schema errors', () => {
            const error = {
                code: '23505',
                message: 'duplicate key value violates unique constraint'
            };

            const context = {
                operation: 'createSwap',
                userId: 'user-123',
                requestId: 'req-456'
            };

            const handled = handleSchemaError(error, mockResponse as Response, context);

            expect(handled).toBe(false);
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
        });
    });

    describe('validateDatabaseFunctions', () => {
        it('should validate function availability', async () => {
            const mockPool = {
                query: vi.fn()
                    .mockResolvedValueOnce({ rows: [{ exists: true }] })  // find_eligible_swaps_optimized exists
                    .mockResolvedValueOnce({ rows: [{ exists: false }] }) // has_existing_proposal_optimized missing
            };

            const requiredFunctions = ['find_eligible_swaps_optimized', 'has_existing_proposal_optimized'];
            const result = await validateDatabaseFunctions(mockPool, requiredFunctions);

            expect(result.available).toEqual(['find_eligible_swaps_optimized']);
            expect(result.missing).toEqual(['has_existing_proposal_optimized']);
        });

        it('should handle query errors gracefully', async () => {
            const mockPool = {
                query: vi.fn()
                    .mockResolvedValueOnce({ rows: [{ exists: true }] })  // First function exists
                    .mockRejectedValueOnce(new Error('Connection failed'))  // Second function query fails
            };

            const requiredFunctions = ['find_eligible_swaps_optimized', 'has_existing_proposal_optimized'];
            const result = await validateDatabaseFunctions(mockPool, requiredFunctions);

            expect(result.available).toEqual(['find_eligible_swaps_optimized']);
            expect(result.missing).toEqual(['has_existing_proposal_optimized']);
        });
    });

    describe('getSchemaErrorResolution', () => {
        it('should return resolution for removed columns pattern', () => {
            const errorMessage = 'column "owner_id" does not exist';
            const resolution = getSchemaErrorResolution(errorMessage);

            expect(resolution).toBeDefined();
            expect(resolution?.resolution).toContain('removed in schema simplification');
            expect(resolution?.migrationRequired).toBe('030_update_database_functions_for_simplified_schema.sql');
        });

        it('should return resolution for outdated functions pattern', () => {
            const errorMessage = 'function "find_eligible_swaps_optimized" does not exist';
            const resolution = getSchemaErrorResolution(errorMessage);

            expect(resolution).toBeDefined();
            expect(resolution?.resolution).toContain('Database functions need to be updated');
            expect(resolution?.migrationRequired).toBe('030_update_database_functions_for_simplified_schema.sql');
        });

        it('should return null for unrecognized patterns', () => {
            const errorMessage = 'some other database error';
            const resolution = getSchemaErrorResolution(errorMessage);

            expect(resolution).toBeNull();
        });
    });
});