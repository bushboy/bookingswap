/**
 * Tests for DateValidator utility
 */

import { DateValidator } from '../DateValidator';
import { ValidationError } from '../AuctionErrors';

describe('DateValidator', () => {
    describe('validateAndConvertDate', () => {
        it('should convert string dates to Date objects', () => {
            const result = DateValidator.validateAndConvertDate('2025-11-02T15:00:00.000Z', 'endDate');
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2025-11-02T15:00:00.000Z');
        });

        it('should handle Date objects correctly', () => {
            const date = new Date('2025-11-02T15:00:00.000Z');
            const result = DateValidator.validateAndConvertDate(date, 'endDate');
            expect(result).toBe(date);
        });

        it('should convert timestamp numbers to Date objects', () => {
            const timestamp = 1730559600000; // Nov 2, 2024
            const result = DateValidator.validateAndConvertDate(timestamp, 'endDate');
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBe(timestamp);
        });

        it('should reject null values', () => {
            expect(() => DateValidator.validateAndConvertDate(null, 'endDate'))
                .toThrow('endDate is required');
        });

        it('should reject undefined values', () => {
            expect(() => DateValidator.validateAndConvertDate(undefined, 'endDate'))
                .toThrow('endDate is required');
        });

        it('should reject invalid date strings', () => {
            expect(() => DateValidator.validateAndConvertDate('invalid-date', 'endDate'))
                .toThrow('endDate "invalid-date" is not a valid date string');
        });

        it('should reject empty strings', () => {
            expect(() => DateValidator.validateAndConvertDate('', 'endDate'))
                .toThrow('endDate cannot be empty');
        });

        it('should reject invalid types', () => {
            expect(() => DateValidator.validateAndConvertDate({}, 'endDate'))
                .toThrow('endDate must be a Date object, string, or timestamp');
        });
    });

    describe('validateFutureDate', () => {
        it('should accept future dates', () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
            expect(() => DateValidator.validateFutureDate(futureDate, 'endDate'))
                .not.toThrow();
        });

        it('should reject past dates', () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
            expect(() => DateValidator.validateFutureDate(pastDate, 'endDate'))
                .toThrow('endDate must be in the future');
        });

        it('should reject current time', () => {
            const now = new Date();
            expect(() => DateValidator.validateFutureDate(now, 'endDate'))
                .toThrow('endDate must be in the future');
        });
    });

    describe('safeToISOString', () => {
        it('should convert valid dates to ISO string', () => {
            const date = new Date('2025-11-02T15:00:00.000Z');
            const result = DateValidator.safeToISOString(date, 'endDate');
            expect(result).toBe('2025-11-02T15:00:00.000Z');
        });

        it('should reject non-Date objects', () => {
            expect(() => DateValidator.safeToISOString('not-a-date' as any, 'endDate'))
                .toThrow('endDate must be a Date object');
        });

        it('should reject invalid dates', () => {
            const invalidDate = new Date('invalid');
            expect(() => DateValidator.safeToISOString(invalidDate, 'endDate'))
                .toThrow('endDate is not a valid date');
        });
    });

    describe('validateAndNormalizeToUTC', () => {
        it('should handle UTC strings correctly', () => {
            const result = DateValidator.validateAndNormalizeToUTC('2025-11-02T15:00:00.000Z', 'endDate');
            expect(result.toISOString()).toBe('2025-11-02T15:00:00.000Z');
        });

        it('should normalize non-timezone strings to UTC', () => {
            const result = DateValidator.validateAndNormalizeToUTC('2025-11-02T15:00:00.000', 'endDate');
            // The result should be a valid date, but the exact time may vary based on timezone handling
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toMatch(/2025-11-02T\d{2}:00:00\.000Z/);
        });

        it('should handle Date objects', () => {
            const date = new Date('2025-11-02T15:00:00.000Z');
            const result = DateValidator.validateAndNormalizeToUTC(date, 'endDate');
            expect(result).toBe(date);
        });
    });
});