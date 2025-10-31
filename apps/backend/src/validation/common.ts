/**
 * Common validation functions for API endpoints
 */

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(limit: number, offset: number): {
    isValid: boolean;
    error?: string;
    limit: number;
    offset: number;
} {
    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 1000) {
        return {
            isValid: false,
            error: 'Limit must be a number between 1 and 1000',
            limit: 50,
            offset: 0
        };
    }

    // Validate offset
    if (isNaN(offset) || offset < 0) {
        return {
            isValid: false,
            error: 'Offset must be a non-negative number',
            limit,
            offset: 0
        };
    }

    return {
        isValid: true,
        limit,
        offset
    };
}

/**
 * Validate date range parameters
 */
export function validateDateRange(dateFrom?: string, dateTo?: string): {
    isValid: boolean;
    error?: string;
    dateFrom?: Date;
    dateTo?: Date;
} {
    let parsedDateFrom: Date | undefined;
    let parsedDateTo: Date | undefined;

    // Parse dateFrom if provided
    if (dateFrom) {
        parsedDateFrom = new Date(dateFrom);
        if (isNaN(parsedDateFrom.getTime())) {
            return {
                isValid: false,
                error: 'Invalid dateFrom format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
            };
        }
    }

    // Parse dateTo if provided
    if (dateTo) {
        parsedDateTo = new Date(dateTo);
        if (isNaN(parsedDateTo.getTime())) {
            return {
                isValid: false,
                error: 'Invalid dateTo format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
            };
        }
    }

    // Validate date range
    if (parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo) {
        return {
            isValid: false,
            error: 'dateFrom must be earlier than or equal to dateTo'
        };
    }

    // Validate date range is not too large (e.g., more than 1 year)
    if (parsedDateFrom && parsedDateTo) {
        const daysDiff = (parsedDateTo.getTime() - parsedDateFrom.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
            return {
                isValid: false,
                error: 'Date range cannot exceed 365 days'
            };
        }
    }

    return {
        isValid: true,
        dateFrom: parsedDateFrom,
        dateTo: parsedDateTo
    };
}

/**
 * Validate array of UUIDs
 */
export function validateUUIDArray(uuids: string[]): {
    isValid: boolean;
    error?: string;
    invalidUUIDs: string[];
} {
    const invalidUUIDs: string[] = [];

    for (const uuid of uuids) {
        if (!validateUUID(uuid)) {
            invalidUUIDs.push(uuid);
        }
    }

    return {
        isValid: invalidUUIDs.length === 0,
        error: invalidUUIDs.length > 0 ? `Invalid UUID format: ${invalidUUIDs.join(', ')}` : undefined,
        invalidUUIDs
    };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate string length
 */
export function validateStringLength(str: string, minLength: number, maxLength: number): {
    isValid: boolean;
    error?: string;
} {
    if (str.length < minLength) {
        return {
            isValid: false,
            error: `String must be at least ${minLength} characters long`
        };
    }

    if (str.length > maxLength) {
        return {
            isValid: false,
            error: `String must be no more than ${maxLength} characters long`
        };
    }

    return {
        isValid: true
    };
}

/**
 * Validate numeric range
 */
export function validateNumericRange(value: number, min: number, max: number): {
    isValid: boolean;
    error?: string;
} {
    if (isNaN(value)) {
        return {
            isValid: false,
            error: 'Value must be a valid number'
        };
    }

    if (value < min) {
        return {
            isValid: false,
            error: `Value must be at least ${min}`
        };
    }

    if (value > max) {
        return {
            isValid: false,
            error: `Value must be no more than ${max}`
        };
    }

    return {
        isValid: true
    };
}