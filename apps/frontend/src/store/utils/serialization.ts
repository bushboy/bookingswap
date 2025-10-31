/**
 * Serialization utilities for Redux state management
 * Ensures all state values are serializable by converting Date objects to ISO strings
 */

/**
 * Checks if a value is serializable according to Redux requirements
 */
export const isSerializable = (value: any): boolean => {
    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return true;
    }

    if (value instanceof Date) {
        return false; // Date objects are not serializable
    }

    if (Array.isArray(value)) {
        return value.every(isSerializable);
    }

    if (typeof value === 'object') {
        return Object.values(value).every(isSerializable);
    }

    return false;
};

/**
 * Finds non-serializable values in an object and returns their paths
 */
export const findNonSerializableValues = (obj: any, path = ''): string[] => {
    const nonSerializable: string[] = [];

    if (obj === null || obj === undefined) {
        return nonSerializable;
    }

    if (obj instanceof Date) {
        nonSerializable.push(path || 'root');
        return nonSerializable;
    }

    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            const itemPath = path ? `${path}[${index}]` : `[${index}]`;
            nonSerializable.push(...findNonSerializableValues(item, itemPath));
        });
        return nonSerializable;
    }

    if (typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
            const keyPath = path ? `${path}.${key}` : key;
            nonSerializable.push(...findNonSerializableValues(value, keyPath));
        });
    }

    return nonSerializable;
};

/**
 * Converts Date objects to ISO strings recursively
 */
export const serializeDates = <T>(obj: T): T => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (obj instanceof Date) {
        return obj.toISOString() as unknown as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(serializeDates) as unknown as T;
    }

    if (typeof obj === 'object') {
        const serialized: any = {};
        Object.entries(obj).forEach(([key, value]) => {
            serialized[key] = serializeDates(value);
        });
        return serialized;
    }

    return obj;
};

/**
 * Converts ISO strings back to Date objects recursively
 * Only converts strings that match ISO date format
 */
export const deserializeDates = <T>(obj: T, dateFields: string[] = []): T => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string' && isISODateString(obj)) {
        return new Date(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deserializeDates(item, dateFields)) as unknown as T;
    }

    if (typeof obj === 'object') {
        const deserialized: any = {};
        Object.entries(obj).forEach(([key, value]) => {
            if (dateFields.includes(key) && typeof value === 'string') {
                deserialized[key] = new Date(value);
            } else {
                deserialized[key] = deserializeDates(value, dateFields);
            }
        });
        return deserialized;
    }

    return obj;
};

/**
 * Checks if a string is a valid ISO date string
 */
const isISODateString = (str: string): boolean => {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return isoDateRegex.test(str) && !isNaN(Date.parse(str));
};

/**
 * Validates that an object is serializable and logs warnings for non-serializable values
 */
export const validateSerializable = (obj: any, actionType: string): void => {
    const nonSerializableValues = findNonSerializableValues(obj);

    if (nonSerializableValues.length > 0) {
        console.warn(
            `Non-serializable values found in action ${actionType}:`,
            nonSerializableValues.map(path => `  - ${path}`).join('\n')
        );

        if (process.env.NODE_ENV === 'development') {
            console.warn('Consider using serializeDates() to convert Date objects to ISO strings');
        }
    }
};