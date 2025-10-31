/**
 * Redux middleware to detect and warn about non-serializable values in actions and state
 */

import { Middleware } from '@reduxjs/toolkit';
import { validateSerializable, findNonSerializableValues } from '../utils/serialization';

/**
 * Middleware that validates action payloads for serializable values
 * Logs warnings in development when non-serializable values are detected
 */
export const serializationValidationMiddleware: Middleware = (store) => (next) => (action) => {
    // Only run validation in development
    if (process.env.NODE_ENV === 'development') {
        // Validate action payload
        if (action.payload !== undefined) {
            validateSerializable(action.payload, action.type);
        }

        // Validate entire action object
        const actionNonSerializable = findNonSerializableValues(action);
        if (actionNonSerializable.length > 0) {
            console.warn(
                `Non-serializable values in action object ${action.type}:`,
                actionNonSerializable
            );
        }
    }

    // Continue with the action
    const result = next(action);

    // Validate state after action (only in development and for specific slices)
    if (process.env.NODE_ENV === 'development') {
        const state = store.getState();

        // Check wallet and auth slices specifically
        if (action.type.startsWith('wallet/') || action.type.startsWith('auth/')) {
            const walletNonSerializable = findNonSerializableValues(state.wallet, 'wallet');
            const authNonSerializable = findNonSerializableValues(state.auth, 'auth');

            if (walletNonSerializable.length > 0) {
                console.warn(
                    `Non-serializable values in wallet state after ${action.type}:`,
                    walletNonSerializable
                );
            }

            if (authNonSerializable.length > 0) {
                console.warn(
                    `Non-serializable values in auth state after ${action.type}:`,
                    authNonSerializable
                );
            }
        }
    }

    return result;
};

/**
 * Enhanced serializable check configuration for Redux Toolkit
 */
export const serializableCheckConfig = {
    // Ignore these action types completely
    ignoredActions: [
        'persist/PERSIST',
        'persist/REHYDRATE',
        'persist/REGISTER',
        'persist/PURGE',
        'persist/FLUSH',
        'persist/PAUSE',
    ],

    // Ignore these paths in actions
    ignoredActionsPaths: [
        'meta.arg',
        'payload.timestamp',
        'error.stack',
    ],

    // Ignore these paths in state
    ignoredPaths: [
        // Temporarily ignore during migration
        'auth.syncStatus.lastSyncTime',
    ],

    // Custom serializable check
    isSerializable: (value: any): boolean => {
        // Allow undefined and null
        if (value === undefined || value === null) {
            return true;
        }

        // Reject Date objects
        if (value instanceof Date) {
            return false;
        }

        // Allow primitives
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return true;
        }

        // Allow plain objects and arrays (will be checked recursively)
        return true;
    },
};