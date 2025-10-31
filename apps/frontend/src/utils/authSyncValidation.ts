import { User as AuthContextUser } from '@/contexts/AuthContext';

// Redux User interface (from authSlice)
interface ReduxUser {
    id: string;
    walletAddress: string;
    displayName?: string;
    email?: string;
    verificationLevel: 'basic' | 'verified' | 'premium';
}

// Validation result interface
interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates AuthContext user data structure and content
 */
export const validateAuthContextUser = (user: any): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!user) {
        return { isValid: false, errors: ['User is null or undefined'], warnings };
    }

    // Required fields validation
    if (!user.id || typeof user.id !== 'string' || user.id.trim().length === 0) {
        errors.push('User ID is missing or invalid');
    }

    if (!user.username || typeof user.username !== 'string' || user.username.trim().length === 0) {
        errors.push('Username is missing or invalid');
    }

    if (!user.email || typeof user.email !== 'string' || user.email.trim().length === 0) {
        errors.push('Email is missing or invalid');
    }

    // Email format validation (basic)
    if (user.email && typeof user.email === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
            warnings.push('Email format appears invalid');
        }
    }

    // Verification level validation
    if (!user.verificationLevel || typeof user.verificationLevel !== 'string') {
        warnings.push('Verification level is missing or invalid');
    }

    // Created date validation
    if (!user.createdAt || typeof user.createdAt !== 'string') {
        warnings.push('Created date is missing or invalid');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};

/**
 * Validates Redux user data structure and content
 */
export const validateReduxUser = (user: any): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!user) {
        return { isValid: false, errors: ['User is null or undefined'], warnings };
    }

    // Required fields validation
    if (!user.id || typeof user.id !== 'string' || user.id.trim().length === 0) {
        errors.push('User ID is missing or invalid');
    }

    // Wallet address can be empty initially
    if (user.walletAddress !== undefined && typeof user.walletAddress !== 'string') {
        warnings.push('Wallet address should be a string');
    }

    // Display name validation
    if (user.displayName !== undefined && (typeof user.displayName !== 'string' || user.displayName.trim().length === 0)) {
        warnings.push('Display name should be a non-empty string if provided');
    }

    // Email validation
    if (user.email !== undefined && (typeof user.email !== 'string' || user.email.trim().length === 0)) {
        warnings.push('Email should be a non-empty string if provided');
    }

    // Verification level validation
    const validVerificationLevels = ['basic', 'verified', 'premium'];
    if (!user.verificationLevel || !validVerificationLevels.includes(user.verificationLevel)) {
        warnings.push('Verification level should be one of: basic, verified, premium');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};

/**
 * Converts AuthContext user to Redux user format with validation
 */
export const convertAuthContextUserToRedux = (authUser: AuthContextUser): { user: ReduxUser | null; validation: ValidationResult } => {
    const validation = validateAuthContextUser(authUser);

    if (!validation.isValid) {
        return { user: null, validation };
    }

    const reduxUser: ReduxUser = {
        id: authUser.id,
        walletAddress: '', // Will be set by wallet context
        displayName: authUser.username,
        email: authUser.email,
        verificationLevel: (authUser.verificationLevel as 'basic' | 'verified' | 'premium') || 'basic',
    };

    // Validate the converted user
    const reduxValidation = validateReduxUser(reduxUser);

    return {
        user: reduxValidation.isValid ? reduxUser : null,
        validation: {
            isValid: reduxValidation.isValid,
            errors: [...validation.errors, ...reduxValidation.errors],
            warnings: [...validation.warnings, ...reduxValidation.warnings],
        }
    };
};

/**
 * Checks if two user objects represent the same user with same data
 */
export const areUsersEqual = (authUser: AuthContextUser | null, reduxUser: ReduxUser | null): boolean => {
    // Both null/undefined
    if (!authUser && !reduxUser) {
        return true;
    }

    // One is null, other is not
    if (!authUser || !reduxUser) {
        return false;
    }

    // Compare key fields
    return (
        authUser.id === reduxUser.id &&
        authUser.email === reduxUser.email &&
        authUser.username === reduxUser.displayName
    );
};

/**
 * Validates sync operation parameters
 */
export const validateSyncOperation = (
    authUser: AuthContextUser | null,
    token: string | null,
    reduxUser: ReduxUser | null
): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // If auth user exists, token should also exist
    if (authUser && !token) {
        errors.push('AuthContext user exists but token is missing');
    }

    // If token exists, auth user should also exist
    if (token && !authUser) {
        errors.push('Token exists but AuthContext user is missing');
    }

    // Validate auth user if present
    if (authUser) {
        const authValidation = validateAuthContextUser(authUser);
        errors.push(...authValidation.errors);
        warnings.push(...authValidation.warnings);
    }

    // Validate redux user if present
    if (reduxUser) {
        const reduxValidation = validateReduxUser(reduxUser);
        errors.push(...reduxValidation.errors);
        warnings.push(...reduxValidation.warnings);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};