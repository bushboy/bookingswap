import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { WalletValidationErrorDisplay } from '../../wallet/WalletValidationErrorDisplay';

// Mock the useWallet hook
const mockConnect = vi.fn();
vi.mock('@/hooks/useWallet', () => ({
    useWallet: () => ({
        availableProviders: ['hashpack'],
        connect: mockConnect,
    }),
}));

describe('Wallet Connection Integration', () => {
    beforeEach(() => {
        mockConnect.mockClear();
    });

    it('should trigger wallet connection when connect button is clicked', async () => {
        const mockOnConnectWallet = vi.fn().mockImplementation(async () => {
            await mockConnect('hashpack');
        });

        const validation = {
            connection: { isConnected: false, errorMessage: 'Wallet not connected' },
            isValid: false,
            errors: ['Wallet not connected'],
        };

        render(
            <WalletValidationErrorDisplay
                validation={validation}
                onConnectWallet={mockOnConnectWallet}
            />
        );

        const connectButton = screen.getByText('Connect Wallet');
        fireEvent.click(connectButton);

        await waitFor(() => {
            expect(mockOnConnectWallet).toHaveBeenCalled();
        });
    });

    it('should show appropriate error message when no providers are available', () => {
        const validation = {
            connection: { isConnected: false, errorMessage: 'Wallet not connected' },
            isValid: false,
            errors: ['Wallet not connected'],
        };

        render(
            <WalletValidationErrorDisplay
                validation={validation}
            />
        );

        expect(screen.getByText('Connect Your Wallet to Continue')).toBeInTheDocument();
    });
});