import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockchainStatusDisplay } from '../BlockchainStatusDisplay';

describe('BlockchainStatusDisplay', () => {
    const mockBlockchainTransaction = {
        transactionId: '0.0.123456@1640995200.123456789',
        consensusTimestamp: '2023-01-01T12:00:00.123456789Z',
        status: 'confirmed' as const,
        networkFee: 0.001,
        explorerUrl: 'https://hashscan.io/mainnet/transaction/0.0.123456@1640995200.123456789'
    };

    it('renders blockchain confirmed status correctly', () => {
        render(
            <BlockchainStatusDisplay
                blockchainTransaction={mockBlockchainTransaction}
                actionType="accept"
            />
        );

        expect(screen.getByText('Blockchain Confirmed')).toBeInTheDocument();
        expect(screen.getByText('Transaction has been confirmed on the blockchain')).toBeInTheDocument();
        expect(screen.getByText('Immutable Record')).toBeInTheDocument();
    });

    it('renders blockchain pending status with progress indicator', () => {
        render(
            <BlockchainStatusDisplay
                transactionId="pending-tx-123"
                status="pending"
                isProcessing={true}
                actionType="accept"
            />
        );

        expect(screen.getByText('Recording on Blockchain')).toBeInTheDocument();
        expect(screen.getByText('Recording accept action on blockchain...')).toBeInTheDocument();
    });

    it('renders blockchain failed status with error message', () => {
        const errorMessage = 'Failed to record transaction on blockchain';

        render(
            <BlockchainStatusDisplay
                transactionId="failed-tx-123"
                status="failed"
                error={errorMessage}
                actionType="reject"
            />
        );

        expect(screen.getByText('Blockchain Failed')).toBeInTheDocument();
        expect(screen.getByText('Blockchain Error')).toBeInTheDocument();
        expect(screen.getAllByText(errorMessage)).toHaveLength(2); // One in description, one in error section
    });

    it('renders compact mode correctly', () => {
        render(
            <BlockchainStatusDisplay
                transactionId="tx-123"
                status="confirmed"
                compact={true}
            />
        );

        expect(screen.getByText('Blockchain')).toBeInTheDocument();
        // Should not show detailed description in compact mode
        expect(screen.queryByText('Transaction has been confirmed on the blockchain')).not.toBeInTheDocument();
    });

    it('shows transaction ID with expand/collapse functionality', () => {
        render(
            <BlockchainStatusDisplay
                transactionId="0.0.123456@1640995200.123456789"
                status="confirmed"
            />
        );

        // Initially shows collapsed transaction ID (first 8 + ... + last 8)
        expect(screen.getByText('0.0.1234...23456789')).toBeInTheDocument();

        // Click expand button
        fireEvent.click(screen.getByText('Expand'));

        // Should show full transaction ID
        expect(screen.getByText('0.0.123456@1640995200.123456789')).toBeInTheDocument();
    });

    it('shows consensus timestamp for confirmed transactions', () => {
        render(
            <BlockchainStatusDisplay
                blockchainTransaction={mockBlockchainTransaction}
            />
        );

        expect(screen.getByText('Confirmed at:')).toBeInTheDocument();
        expect(screen.getByText('Jan 1, 02:00:00 PM')).toBeInTheDocument();
    });

    it('shows detailed blockchain information when enabled', () => {
        render(
            <BlockchainStatusDisplay
                blockchainTransaction={mockBlockchainTransaction}
                showDetails={true}
                actionType="accept"
            />
        );

        expect(screen.getByText('Blockchain Details')).toBeInTheDocument();
        expect(screen.getByText('Hedera Hashgraph')).toBeInTheDocument();
        expect(screen.getByText('Proposal accept')).toBeInTheDocument();
        expect(screen.getByText('0.001 HBAR')).toBeInTheDocument();
        expect(screen.getByText('View on Explorer ↗')).toBeInTheDocument();
    });
});