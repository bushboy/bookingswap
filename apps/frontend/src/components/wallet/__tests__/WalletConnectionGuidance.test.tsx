import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { WalletConnectionGuidance } from '../WalletConnectionGuidance';

// Mock the useWallet hook
vi.mock('@/hooks/useWallet', () => ({
    useWallet: () => ({
        availableProviders: ['hashpack', 'blade'],
        connect: vi.fn(),
    }),
}));

describe('WalletConnectionGuidance', () => {
    it('renders connection guidance with steps', () => {
        render(<WalletConnectionGuidance showSteps={true} />);

        expect(screen.getByText('Connect Your Wallet to Continue')).toBeInTheDocument();
        expect(screen.getByText('How to Connect:')).toBeInTheDocument();
        expect(screen.getByText('Click "Connect Wallet" below')).toBeInTheDocument();
    });

    it('shows connect wallet button when providers are available', () => {
        render(<WalletConnectionGuidance />);

        const connectButton = screen.getByText('Connect Wallet');
        expect(connectButton).toBeInTheDocument();
        expect(connectButton).not.toBeDisabled();
    });

    it('calls onConnectWallet when provided', () => {
        const mockOnConnect = vi.fn();
        render(<WalletConnectionGuidance onConnectWallet={mockOnConnect} />);

        const connectButton = screen.getByText('Connect Wallet');
        fireEvent.click(connectButton);

        expect(mockOnConnect).toHaveBeenCalled();
    });

    it('shows dismiss button when onDismiss is provided', () => {
        const mockOnDismiss = vi.fn();
        render(<WalletConnectionGuidance onDismiss={mockOnDismiss} />);

        const dismissButton = screen.getByLabelText('Dismiss guidance');
        expect(dismissButton).toBeInTheDocument();

        fireEvent.click(dismissButton);
        expect(mockOnDismiss).toHaveBeenCalled();
    });
});