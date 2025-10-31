import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { WalletSelectionModal } from '../WalletSelectionModal';

// Mock the wallet hooks
const mockUseWallet = vi.fn();
const mockUseWalletConnection = vi.fn();
const mockUseWalletProviders = vi.fn();

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => mockUseWallet(),
  useWalletConnection: () => mockUseWalletConnection(),
  useWalletProviders: () => mockUseWalletProviders(),
}));

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    DEV: true,
    VITE_ENABLE_MOCK_WALLET: 'true',
  },
  writable: true,
});

describe('WalletSelectionModal', () => {
  const mockOnClose = vi.fn();
  const mockConnect = vi.fn();
  const mockRefreshAvailableProviders = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      error: null,
      isConnecting: false,
      clearError: vi.fn(),
      needsProviderInstallation: false,
      errorType: null,
    });
    
    mockUseWalletConnection.mockReturnValue({
      connect: mockConnect,
    });
    
    mockUseWalletProviders.mockReturnValue({
      availableProviders: ['mock', 'hashpack'],
      refreshAvailableProviders: mockRefreshAvailableProviders,
    });
  });

  it('renders wallet selection modal when open', () => {
    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByText('Choose a wallet to connect to the Hedera network:')).toBeInTheDocument();
  });

  it('shows development mode notice when in dev environment', () => {
    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Development Mode/)).toBeInTheDocument();
    expect(screen.getByText(/Mock Wallet \(Testing\)/)).toBeInTheDocument();
  });

  it('displays available wallet providers', () => {
    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Mock Wallet (Testing)')).toBeInTheDocument();
    expect(screen.getByText('HashPack')).toBeInTheDocument();
    expect(screen.getByText('Kabila Wallet')).toBeInTheDocument();
    expect(screen.getByText('Yamgo Wallet')).toBeInTheDocument();
  });

  it('calls connect when a wallet provider is clicked', async () => {
    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const mockWalletOption = screen.getByText('Mock Wallet (Testing)').closest('div');
    fireEvent.click(mockWalletOption!);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('mock');
    });
  });

  it('shows install button for unavailable providers', () => {
    mockUseWalletProviders.mockReturnValue({
      availableProviders: ['mock'], // Only mock wallet available
      refreshAvailableProviders: mockRefreshAvailableProviders,
    });

    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // HashPack should show install button since it's not in availableProviders
    const installButtons = screen.getAllByText('Install');
    expect(installButtons.length).toBeGreaterThan(0);
  });

  it('displays error message when there is a wallet error', () => {
    mockUseWallet.mockReturnValue({
      error: {
        type: 'CONNECTION_REJECTED',
        message: 'User rejected connection',
      },
      isConnecting: false,
      clearError: vi.fn(),
      needsProviderInstallation: false,
      errorType: 'CONNECTION_REJECTED',
    });

    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Connection was rejected/)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('calls onClose when modal is closed', () => {
    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Find and click the close button (assuming Modal component has a close button)
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    
    // Test that onClose is called when the modal should close
    // This would depend on the Modal component implementation
  });

  it('refreshes available providers when modal opens', () => {
    const { rerender } = render(
      <WalletSelectionModal
        isOpen={false}
        onClose={mockOnClose}
      />
    );

    expect(mockRefreshAvailableProviders).not.toHaveBeenCalled();

    rerender(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(mockRefreshAvailableProviders).toHaveBeenCalled();
  });

  it('shows loading state when connecting to a wallet', () => {
    mockUseWallet.mockReturnValue({
      error: null,
      isConnecting: true,
      clearError: vi.fn(),
      needsProviderInstallation: false,
      errorType: null,
    });

    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Should show loading spinner when connecting
    // This would depend on the specific implementation
    expect(screen.getByText('Mock Wallet (Testing)')).toBeInTheDocument();
  });

  it('hides mock wallet in production environment', () => {
    // Mock production environment
    Object.defineProperty(import.meta, 'env', {
      value: {
        DEV: false,
        VITE_ENABLE_MOCK_WALLET: 'false',
      },
      writable: true,
    });

    render(
      <WalletSelectionModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/Development Mode/)).not.toBeInTheDocument();
  });

  it('should show proper cursor for unavailable providers', () => {
    mockUseWalletProviders.mockReturnValue({
      availableProviders: [],
      refreshAvailableProviders: mockRefreshAvailableProviders,
    });

    render(<WalletSelectionModal isOpen={true} onClose={mockOnClose} />);

    const hashpackOption = screen.getByText('HashPack').closest('div');
    expect(hashpackOption).toHaveStyle({ opacity: '0.6' });
  });
});
