import React from 'react';
import { render, screen } from '@testing-library/react';
import { PaymentStatusDisplay } from '../PaymentStatusDisplay';
import { PaymentTransaction } from '@booking-swap/shared';

describe('PaymentStatusDisplay', () => {
    const mockPaymentTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-1',
        recipientId: 'user-2',
        amount: 100,
        currency: 'USD',
        status: 'completed',
        gatewayTransactionId: 'gateway-123',
        platformFee: 5,
        netAmount: 95,
        completedAt: new Date('2023-01-01T12:00:00Z'),
        blockchain: {
            transactionId: 'blockchain-123'
        },
        offerMode: 'auction',
        validationMetadata: {
            scenario: 'auction',
            validationPassed: true,
            rollbackAvailable: false,
            validatedAt: new Date(),
            validationType: 'standard',
            rollbackSteps: [],
            constraintViolations: [],
            foreignKeyValidation: {
                swapExists: true,
                proposalExists: true,
                usersExist: true
            }
        },
        createdVia: 'auction_proposal',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    it('renders payment completed status correctly', () => {
        render(
            <PaymentStatusDisplay
                paymentTransaction={mockPaymentTransaction}
                status="completed"
                amount={100}
                currency="USD"
            />
        );

        expect(screen.getByText('Payment Completed')).toBeInTheDocument();
        expect(screen.getByText('$100.00')).toBeInTheDocument();
        expect(screen.getByText('Payment has been successfully processed')).toBeInTheDocument();
    });

    it('renders payment processing status with progress indicator', () => {
        render(
            <PaymentStatusDisplay
                status="processing"
                amount={100}
                currency="USD"
                isProcessing={true}
            />
        );

        expect(screen.getByText('Processing Payment')).toBeInTheDocument();
        expect(screen.getByText('Processing payment...')).toBeInTheDocument();
    });

    it('renders payment failed status with error message', () => {
        const errorMessage = 'Payment processing failed due to insufficient funds';

        render(
            <PaymentStatusDisplay
                status="failed"
                amount={100}
                currency="USD"
                error={errorMessage}
            />
        );

        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
        expect(screen.getByText('Payment Error')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('renders compact mode correctly', () => {
        render(
            <PaymentStatusDisplay
                status="completed"
                amount={100}
                currency="USD"
                compact={true}
            />
        );

        expect(screen.getByText('$100.00')).toBeInTheDocument();
        // Should not show detailed description in compact mode
        expect(screen.queryByText('Payment has been successfully processed')).not.toBeInTheDocument();
    });

    it('shows transaction details when enabled', () => {
        render(
            <PaymentStatusDisplay
                paymentTransaction={mockPaymentTransaction}
                showDetails={true}
            />
        );

        expect(screen.getByText('Transaction Details')).toBeInTheDocument();
        expect(screen.getByText('payment-123')).toBeInTheDocument();
        expect(screen.getByText('gateway-123')).toBeInTheDocument();
    });
});