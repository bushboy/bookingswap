import { describe, it, expect } from 'vitest';
import { HederaErrorReporter, HederaErrorType } from '../HederaErrorReporter';

describe('HederaErrorReporter Integration', () => {
    it('should capture and format real error scenarios', () => {
        // Test insufficient balance error
        const insufficientBalanceError = {
            status: { toString: () => 'INSUFFICIENT_ACCOUNT_BALANCE' },
            message: 'Account 0.0.12345 has insufficient balance',
            transactionId: { toString: () => '0.0.12345@1234567890.123456789' },
        };

        const errorDetails = HederaErrorReporter.captureError(
            insufficientBalanceError,
            'NFT_MINTING',
            HederaErrorReporter.createNFTContext(
                'booking-123',
                'user-456',
                '0.0.12345',
                '0.0.67890',
                1,
                '5 HBAR'
            )
        );

        expect(errorDetails.errorType).toBe(HederaErrorType.INSUFFICIENT_BALANCE);
        expect(errorDetails.retryable).toBe(false);
        expect(errorDetails.recommendation).toContain('sufficient HBAR balance');
        expect(errorDetails.context.bookingId).toBe('booking-123');
        expect(errorDetails.transactionId).toBe('0.0.12345@1234567890.123456789');

        const formatted = HederaErrorReporter.formatErrorForLogging(errorDetails);
        expect(formatted).toContain('NFT_MINTING failed');
        expect(formatted).toContain('INSUFFICIENT_ACCOUNT_BALANCE');
        expect(formatted).toContain('Account: 0.0.12345');
        expect(formatted).toContain('Account Balance: 5 HBAR');
    });

    it('should handle network errors correctly', () => {
        const networkError = new Error('ECONNREFUSED: Connection refused');
        (networkError as any).code = 'ECONNREFUSED';

        const errorDetails = HederaErrorReporter.captureError(
            networkError,
            'ACCOUNT_BALANCE_QUERY',
            { accountId: '0.0.12345' }
        );

        expect(errorDetails.errorType).toBe(HederaErrorType.NETWORK_ERROR);
        expect(errorDetails.retryable).toBe(true);
        expect(errorDetails.recommendation).toContain('network connectivity');
    });

    it('should classify token association errors', () => {
        const tokenError = {
            status: { toString: () => 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT' },
            message: 'Token 0.0.67890 is not associated to account 0.0.12345',
        };

        const errorDetails = HederaErrorReporter.captureError(
            tokenError,
            'NFT_TRANSFER',
            HederaErrorReporter.createTokenContext('0.0.67890', '0.0.12345')
        );

        expect(errorDetails.errorType).toBe(HederaErrorType.TOKEN_NOT_ASSOCIATED);
        expect(errorDetails.retryable).toBe(false);
        expect(errorDetails.recommendation).toContain('Associate the token');
    });

    it('should handle unknown errors gracefully', () => {
        const unknownError = {
            message: 'Some unexpected error occurred',
            someProperty: 'value',
        };

        const errorDetails = HederaErrorReporter.captureError(
            unknownError,
            'UNKNOWN_OPERATION',
            {}
        );

        expect(errorDetails.errorType).toBe(HederaErrorType.UNKNOWN);
        expect(errorDetails.retryable).toBe(false);
        expect(errorDetails.errorMessage).toBe('Some unexpected error occurred');
    });
});