import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WalletConnectButton } from '../WalletConnectButton';

// Mock the hooks
const mockUseWallet = vi.fn();
const mockUseWalletConnection = vi.fn();

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => mockUseWallet(),
  useWalletConnection: () => mockUseWalletConnection(),
}));

// Mock the child components
vi.mock('../WalletSelectionModal', () => ({
  WalletSelectionModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) => (
    <div data-testid="wallet-selection-modal">
      {isOpen && (
        <div>
          <span>Wallet Selection Modal</span>
          <button onClick={onClose}>Close Modal</button>
        </div>
      )}
    </div>
  ),
}));

vi.mock('../WalletInfo', () => ({
  WalletInfo: ({ accountInfo, onDisconnect }: any) => (
    <div data-testid="wallet-info">
      <span>Wallet Info: {accountInfo.accountId}</span>
      <button onClick={onDisconnect}>Disconnect</button>
    </div>
  ),
}));

describe('WalletConnectButton', () => {
  const mockDisconnect = vi.fn();

  const defaultWalletState = {
    isConnected: false,
    isConnecting: false,
    shouldShowConnectButton: true,
    shouldShowWalletInfo: false,
    accountInfo: null,
    truncatedAddress: null,
    balance: null,
    network: null,
  };

  const defaultConnectionState = {
    disconnect: mockDisconnect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue(defaultWalletState);
    mockUseWalletConnection.mockReturnValue(defaultConnectionState);
  });

  describe('when wallet is not connected', () => {
    it('should display "Connect Wallet" button', () => {
      render(<WalletConnectButton />);

      expect(
        screen.getByRole('button', { name: /connect wallet/i })
      ).toBeInTheDocument();
    });

    it('should show loading state when connecting', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletState,
        isConnecting: true,
      });

      render(<WalletConnectButton />);

      const button = screen.getByRole('button', { name: /connect wallet/i });
      expect(button).toBeDisabled();
    });

    it('should open wallet selection modal when clicked', () => {
      render(<WalletConnectButton />);

      const connectButton = screen.getByRole('button', {
        name: /connect wallet/i,
      });
      fireEvent.click(connectButton);

      expect(screen.getByText('Wallet Selection Modal')).toBeInTheDocument();
    });

    it('should close modal when close button is clicked', () => {
      render(<WalletConnectButton />);

      // Open modal
      const connectButton = screen.getByRole('button', {
        name: /connect wallet/i,
      });
      fireEvent.click(connectButton);

      // Close modal
      const closeButton = screen.getByText('Close Modal');
      fireEvent.click(closeButton);

      expect(
        screen.queryByText('Wallet Selection Modal')
      ).not.toBeInTheDocument();
    });

    it('should apply custom variant and size props', () => {
      render(<WalletConnectButton variant="secondary" size="lg" />);

      const button = screen.getByRole('button', { name: /connect wallet/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('when wallet is connected', () => {
    const mockAccountInfo = {
      accountId: '0.0.123456',
      balance: '1000.50',
      network: 'mainnet' as const,
    };

    beforeEach(() => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletState,
        isConnected: true,
        shouldShowConnectButton: false,
        shouldShowWalletInfo: true,
        accountInfo: mockAccountInfo,
        truncatedAddress: '0.0.12...3456',
        balance: '1000.50',
        network: 'mainnet',
      });
    });

    it('should display wallet info when showFullInfo is true', () => {
      render(<WalletConnectButton showFullInfo={true} />);

      expect(screen.getByTestId('wallet-info')).toBeInTheDocument();
      expect(screen.getByText('Wallet Info: 0.0.123456')).toBeInTheDocument();
    });

    it('should display compact wallet info with disconnect button when showFullInfo is false', () => {
      render(<WalletConnectButton showBalance={true} />);

      expect(screen.getByText('1000.50 HBAR')).toBeInTheDocument();
      expect(screen.getByText('0.0.12...3456')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /disconnect/i })
      ).toBeInTheDocument();
    });

    it('should hide balance when showBalance is false', () => {
      render(<WalletConnectButton showBalance={false} />);

      expect(screen.queryByText('1000.50 HBAR')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /disconnect/i })
      ).toBeInTheDocument();
    });

    it('should call disconnect when disconnect button is clicked', async () => {
      render(<WalletConnectButton />);

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledOnce();
      });
    });

    it('should handle disconnect error gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockDisconnect.mockRejectedValue(new Error('Disconnect failed'));

      render(<WalletConnectButton />);

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      });
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledOnce();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to disconnect wallet:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should show loading state during disconnect', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletState,
        isConnected: true,
        shouldShowConnectButton: false,
        shouldShowWalletInfo: true,
        accountInfo: mockAccountInfo,
        truncatedAddress: '0.0.12...3456',
        balance: '1000.50',
        network: 'mainnet',
        isConnecting: true, // Simulating loading state
      });

      render(<WalletConnectButton />);

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      });
      expect(disconnectButton).toBeDisabled();
    });
  });

  describe('edge cases', () => {
    it('should return null when neither connect nor wallet info should be shown', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletState,
        shouldShowConnectButton: false,
        shouldShowWalletInfo: false,
      });

      const { container } = render(<WalletConnectButton />);
      expect(container.firstChild).toBeNull();
    });

    it('should handle missing account info gracefully', () => {
      mockUseWallet.mockReturnValue({
        ...defaultWalletState,
        isConnected: true,
        shouldShowConnectButton: false,
        shouldShowWalletInfo: true,
        accountInfo: null,
      });

      const { container } = render(<WalletConnectButton />);
      expect(container.firstChild).toBeNull();
    });

    it('should apply custom className and style props', () => {
      const customStyle = { backgroundColor: 'red' };
      const customClassName = 'custom-wallet-button';

      render(
        <WalletConnectButton style={customStyle} className={customClassName} />
      );

      const button = screen.getByRole('button', { name: /connect wallet/i });
      expect(button).toHaveClass(customClassName);
    });
  });

  describe('accessibility', () => {
    it('should have proper button role and accessible name', () => {
      render(<WalletConnectButton />);

      const button = screen.getByRole('button', { name: /connect wallet/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should be keyboard accessible', () => {
      render(<WalletConnectButton />);

      const button = screen.getByRole('button', { name: /connect wallet/i });
      button.focus();
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: 'Enter' });
      expect(screen.getByText('Wallet Selection Modal')).toBeInTheDocument();
    });
  });
});
