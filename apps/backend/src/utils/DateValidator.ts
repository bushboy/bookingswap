/**
 * Date validation utilities for auction creation
 * Provides robust date conversion and validation methods
 */

import { ValidationError } from '@booking-swap/shared';

export class DateValidator {
    /**
     * Validates and converts various date formats to Date objects
     * @param dateValue - The date value to validate (Date, string, or number)
     * @param fieldName - The name of the field for error messages
     * @returns A valid Date object
     * @throws ValidationError if the date is invalid
     */
    static validateAndConvertDate(dateValue: any, fieldName: string): Date {
        // Handle null/undefined
        if (dateValue === null || dateValue === undefined) {
            throw new ValidationError(`${fieldName} is required`);
        }

        // If already a Date object, validate it
        if (dateValue instanceof Date) {
            if (isNaN(dateValue.getTime())) {
                throw new ValidationError(`${fieldName} is not a valid date`);
            }
            return dateValue;
        }

        // If string, try to parse
        if (typeof dateValue === 'string') {
            if (dateValue.trim() === '') {
                throw new ValidationError(`${fieldName} cannot be empty`);
            }

            const parsed = new Date(dateValue);
            if (isNaN(parsed.getTime())) {
                throw new ValidationError(`${fieldName} "${dateValue}" is not a valid date string`);
            }
            return parsed;
        }

        // If number (timestamp), convert
        if (typeof dateValue === 'number') {
            const parsed = new Date(dateValue);
            if (isNaN(parsed.getTime())) {
                throw new ValidationError(`${fieldName} timestamp ${dateValue} is not valid`);
            }
            return parsed;
        }

        throw new ValidationError(`${fieldName} must be a Date object, string, or timestamp`);
    }

    /**
     * Validates that a date is in the future
     * @param date - The date to validate
     * @param fieldName - The name of the field for error messages
     * @throws ValidationError if the date is not in the future
     */
    static validateFutureDate(date: Date, fieldName: string): void {
        const now = new Date();
        if (date <= now) {
            throw new ValidationError(
                `${fieldName} must be in the future (received: ${date.toISOString()}, current: ${now.toISOString()})`
            );
        }
    }

    /**
     * Validates that a date is at least a specified number of milliseconds in the future
     * @param date - The date to validate
     * @param minimumFutureMs - Minimum milliseconds in the future
     * @param fieldName - The name of the field for error messages
     * @throws ValidationError if the date is not far enough in the future
     */
    static validateMinimumFutureDate(date: Date, minimumFutureMs: number, fieldName: string): void {
        const now = new Date();
        const minimumDate = new Date(now.getTime() + minimumFutureMs);

        if (date < minimumDate) {
            throw new ValidationError(
                `${fieldName} must be at least ${Math.round(minimumFutureMs / (1000 * 60 * 60))} hours in the future (received: ${date.toISOString()}, minimum: ${minimumDate.toISOString()})`
            );
        }
    }

    /**
     * Validates that one date is before another date
     * @param earlierDate - The date that should be earlier
     * @param laterDate - The date that should be later
     * @param earlierFieldName - Name of the earlier date field
     * @param laterFieldName - Name of the later date field
     * @throws ValidationError if the dates are in wrong order
     */
    static validateDateOrder(
        earlierDate: Date,
        laterDate: Date,
        earlierFieldName: string,
        laterFieldName: string
    ): void {
        if (earlierDate >= laterDate) {
            throw new ValidationError(
                `${earlierFieldName} (${earlierDate.toISOString()}) must be before ${laterFieldName} (${laterDate.toISOString()})`
            );
        }
    }

    /**
     * Validates that a date is within a reasonable range (not too far in past or future)
     * @param date - The date to validate
     * @param fieldName - The name of the field for error messages
     * @param maxPastYears - Maximum years in the past (default: 1)
     * @param maxFutureYears - Maximum years in the future (default: 5)
     * @throws ValidationError if the date is outside the reasonable range
     */
    static validateReasonableDateRange(
        date: Date,
        fieldName: string,
        maxPastYears: number = 1,
        maxFutureYears: number = 5
    ): void {
        const now = new Date();
        const maxPastDate = new Date(now.getFullYear() - maxPastYears, now.getMonth(), now.getDate());
        const maxFutureDate = new Date(now.getFullYear() + maxFutureYears, now.getMonth(), now.getDate());

        if (date < maxPastDate) {
            throw new ValidationError(
                `${fieldName} cannot be more than ${maxPastYears} year(s) in the past`
            );
        }

        if (date > maxFutureDate) {
            throw new ValidationError(
                `${fieldName} cannot be more than ${maxFutureYears} year(s) in the future`
            );
        }
    }

    /**
     * Safely converts a date to ISO string, handling potential errors
     * @param date - The date to convert
     * @param fieldName - The name of the field for error messages
     * @returns ISO string representation of the date
     * @throws ValidationError if conversion fails
     */
    static safeToISOString(date: Date, fieldName: string): string {
        try {
            if (!(date instanceof Date)) {
                throw new ValidationError(`${fieldName} must be a Date object`);
            }

            if (isNaN(date.getTime())) {
                throw new ValidationError(`${fieldName} is not a valid date`);
            }

            return date.toISOString();
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError(`Failed to convert ${fieldName} to ISO string: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validates and normalizes a date with timezone handling
     * Assumes UTC if no timezone information is provided
     * @param dateValue - The date value to normalize
     * @param fieldName - The name of the field for error messages
     * @returns A Date object normalized to UTC
     */
    static validateAndNormalizeToUTC(dateValue: any, fieldName: string): Date {
        const date = this.validateAndConvertDate(dateValue, fieldName);

        // If the date string doesn't include timezone info, treat as UTC
        if (typeof dateValue === 'string' && !dateValue.includes('Z') && !dateValue.includes('+') && !dateValue.includes('-')) {
            // Parse as UTC to avoid local timezone interpretation
            const utcDate = new Date(dateValue + 'Z');
            if (!isNaN(utcDate.getTime())) {
                return utcDate;
            }
        }

        return date;
    }
}