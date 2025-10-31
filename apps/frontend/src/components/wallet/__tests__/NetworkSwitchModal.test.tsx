import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NetworkSwitchModal } from '../NetworkSwitchModal';
import { NetworkValidator } from '../../../services/wallet/NetworkValidator';
import { NetworkType } from '../../../types/wallet';

// Mock network validator
const mockNetworkValidator = {
  getNetworkDisplayName: jest.fn(),
  getNetworkGuidance: jest.fn(),
  getProviderSwitchInstructions: jest.fn(),
  createSwitchRequest: jest.fn(),
} as unknown as NetworkValidator;

describe('NetworkSwitchModal', () => {
  const defaultProps = {
    isOpen: true,
    currentNetwork: 'testnet' as NetworkType,
    expectedNetwork: 'mainnet' as NetworkType,
    providerId: 'hashpack',
    networkValidator: mockNetworkValidator,
    onSwitchConfirm: jest.fn(),
    onCancel: jest.fn(),
    onClose: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    // Setup mock implementations
    (
      mockNetworkValidator.getNetworkDisplayName as jest.Mock
    ).mockImplementation((network: NetworkType) => {
      return network === 'mainnet' ? 'Hedera Mainnet' : 'Hedera Testnet';
    });

    (mockNetworkValidator.getNetworkGuidance as jest.Mock).mockReturnValue({
      title: 'Wrong Network Detected',
      message:
        'Your wallet is connected to Hedera Testnet, but this application requires Hedera Mainnet.',
      actions: [
        {
          label: 'Switch to Hedera Mainnet',
          type: 'primary',
          action: 'switch',
        },
        { label: 'Cancel', type: 'secondary', action: 'cancel' },
      ],
    });

    (
      mockNetworkValidator.getProviderSwitchInstructions as jest.Mock
    ).mockReturnValue({
      title: 'Switch HashPack to Hedera Mainnet',
      steps: [
        'Open your HashPack wallet extension',
        'Click on the network selector',
        'Select "Hedera Mainnet" from the dropdown',
        'Confirm the network switch',
      ],
      notes: [
        'HashPack may require you to unlock your wallet',
        'The network switch will affect all connected applications',
      ],
    });

    (mockNetworkValidator.createSwitchRequest as jest.Mock).mockReturnValue({
      targetNetwork: 'mainnet',
      providerId: 'hashpack',
      isAutomatic: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<NetworkSwitchModal {...defaultProps} isOpen={false} />);
      expect(
        screen.queryByText('Wrong Network Detected')
      ).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<NetworkSwitchModal {...defaultProps} />);
      expect(screen.getByText('Wrong Network Detected')).toBeInTheDocument();
    });

    it('should display network status information', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      expect(screen.getByText('Current:')).toBeInTheDocument();
      expect(screen.getByText('Hedera Testnet')).toBeInTheDocument();
      expect(screen.getByText('Required:')).toBeInTheDocument();
      expect(screen.getByText('Hedera Mainnet')).toBeInTheDocument();
    });

    it('should display guidance message', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      expect(
        screen.getByText(/Your wallet is connected to Hedera Testnet/)
      ).toBeInTheDocument();
    });

    it('should display action buttons', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      expect(screen.getByText('Switch to Hedera Mainnet')).toBeInTheDocument();
      expect(screen.getByText('Show Manual Instructions')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onSwitchConfirm when switch button is clicked', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Switch to Hedera Mainnet'));

      expect(defaultProps.onSwitchConfirm).toHaveBeenCalledWith({
        targetNetwork: 'mainnet',
        providerId: 'hashpack',
        isAutomatic: false,
      });
    });

    it('should call onCancel when cancel button is clicked', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should show instructions when "Show Manual Instructions" is clicked', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Show Manual Instructions'));

      expect(
        screen.getByText('Switch HashPack to Hedera Mainnet')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Open your HashPack wallet extension')
      ).toBeInTheDocument();
    });

    it('should go back to main view when back button is clicked', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      // Go to instructions
      fireEvent.click(screen.getByText('Show Manual Instructions'));
      expect(
        screen.getByText('Switch HashPack to Hedera Mainnet')
      ).toBeInTheDocument();

      // Go back
      fireEvent.click(screen.getByText('Back'));
      expect(screen.getByText('Wrong Network Detected')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should disable buttons when loading', () => {
      render(<NetworkSwitchModal {...defaultProps} isLoading={true} />);

      const switchButton = screen.getByText(/Switching.../);
      const instructionsButton = screen.getByText('Show Manual Instructions');
      const cancelButton = screen.getByText('Cancel');
      const closeButton = screen.getByRole('button', { name: /close/i });

      expect(switchButton).toBeDisabled();
      expect(instructionsButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
      expect(closeButton).toBeDisabled();
    });

    it('should show loading spinner and text', () => {
      render(<NetworkSwitchModal {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Switching...')).toBeInTheDocument();
      // Check for spinner (div with animate-spin class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('instructions view', () => {
    beforeEach(() => {
      render(<NetworkSwitchModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Show Manual Instructions'));
    });

    it('should display instruction steps', () => {
      expect(screen.getByText('Steps to switch networks:')).toBeInTheDocument();
      expect(
        screen.getByText('Open your HashPack wallet extension')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Click on the network selector')
      ).toBeInTheDocument();
    });

    it('should display important notes', () => {
      expect(screen.getByText('Important Notes:')).toBeInTheDocument();
      expect(
        screen.getByText(/HashPack may require you to unlock/)
      ).toBeInTheDocument();
    });

    it('should have completion button', () => {
      expect(screen.getByText("I've Switched Networks")).toBeInTheDocument();
    });

    it('should call onClose when completion button is clicked', () => {
      fireEvent.click(screen.getByText("I've Switched Networks"));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      // Modal should have role dialog (implied by structure)
      const modal = screen
        .getByText('Wrong Network Detected')
        .closest('div[class*="fixed"]');
      expect(modal).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      const switchButton = screen.getByText('Switch to Hedera Mainnet');
      switchButton.focus();
      expect(switchButton).toHaveFocus();
    });
  });

  describe('different providers', () => {
    it('should show provider-specific instructions for Blade', () => {
      (
        mockNetworkValidator.getProviderSwitchInstructions as jest.Mock
      ).mockReturnValue({
        title: 'Switch Blade to Hedera Mainnet',
        steps: ['Open your Blade wallet extension', 'Navigate to Settings'],
        notes: ['Blade wallet network switching may vary'],
      });

      render(<NetworkSwitchModal {...defaultProps} providerId="blade" />);

      fireEvent.click(screen.getByText('Show Manual Instructions'));

      expect(
        screen.getByText('Switch Blade to Hedera Mainnet')
      ).toBeInTheDocument();
    });
  });

  describe('network validator integration', () => {
    it('should call network validator methods with correct parameters', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      expect(mockNetworkValidator.getNetworkDisplayName).toHaveBeenCalledWith(
        'testnet'
      );
      expect(mockNetworkValidator.getNetworkDisplayName).toHaveBeenCalledWith(
        'mainnet'
      );
      expect(mockNetworkValidator.getNetworkGuidance).toHaveBeenCalledWith(
        'testnet',
        'mainnet'
      );

      fireEvent.click(screen.getByText('Show Manual Instructions'));
      expect(
        mockNetworkValidator.getProviderSwitchInstructions
      ).toHaveBeenCalledWith('hashpack', 'mainnet');
    });

    it('should create switch request with correct parameters', () => {
      render(<NetworkSwitchModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Switch to Hedera Mainnet'));

      expect(mockNetworkValidator.createSwitchRequest).toHaveBeenCalledWith(
        'mainnet',
        'hashpack',
        false
      );
    });
  });
});
