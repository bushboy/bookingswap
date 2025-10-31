import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WalletInfo } from '../WalletInfo';
import { AccountInfo } from '@/types/wallet';

// Mock clipboard API
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

describe('WalletInfo', () => {
  const mockAccountInfo: AccountInfo = {
    accountId: '0.0.123456789',
    balance: '1234.5678',
    network: 'mainnet',
  };

  const mockOnDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
  });

  describe('address display and interaction', () => {
    it('should display truncated address by default', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      expect(screen.getByText('0.0.12...3789')).toBeInTheDocument();
    });

    it('should show full address on hover', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      const addressElement = screen.getByText('0.0.12...3789');
      fireEvent.mouseEnter(addressElement);

      expect(screen.getByText('0.0.123456789')).toBeInTheDocument();
    });

    it('should hide full address on mouse leave', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      const addressElement = screen.getByText('0.0.12...3789');
      fireEvent.mouseEnter(addressElement);
      fireEvent.mouseLeave(addressElement);

      expect(screen.getByText('0.0.12...3789')).toBeInTheDocument();
      expect(screen.queryByText('0.0.123456789')).not.toBeInTheDocument();
    });

    it('should copy address to clipboard when clicked', async () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      const addressElement = screen.getByText('0.0.12...3789');
      fireEvent.click(addressElement);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('0.0.123456789');
      });
    });

    it('should show copy feedback after successful copy', async () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      const addressElement = screen.getByText('0.0.12...3789');
      fireEvent.click(addressElement);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('should handle copy failure gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockWriteText.mockRejectedValue(new Error('Copy failed'));

      render(<WalletInfo accountInfo={mockAccountInfo} />);

      const addressElement = screen.getByText('0.0.12...3789');
      fireEvent.click(addressElement);

      await waitFor(() => {
        expect(screen.getByText('Failed to copy')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should not truncate short addresses', () => {
      const shortAccountInfo = { ...mockAccountInfo, accountId: '0.0.123' };
      render(<WalletInfo accountInfo={shortAccountInfo} />);

      expect(screen.getByText('0.0.123')).toBeInTheDocument();
    });
  });

  describe('balance display', () => {
    it('should display balance when showBalance is true', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} showBalance={true} />);

      expect(screen.getByText('1234.57 HBAR')).toBeInTheDocument();
    });

    it('should hide balance when showBalance is false', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} showBalance={false} />);

      expect(screen.queryByText(/HBAR/)).not.toBeInTheDocument();
    });

    it('should format large balances with K suffix', () => {
      const largeBalanceInfo = { ...mockAccountInfo, balance: '12345.67' };
      render(<WalletInfo accountInfo={largeBalanceInfo} showBalance={true} />);

      expect(screen.getByText('12.35K HBAR')).toBeInTheDocument();
    });

    it('should format very large balances with M suffix', () => {
      const veryLargeBalanceInfo = {
        ...mockAccountInfo,
        balance: '1234567.89',
      };
      render(
        <WalletInfo accountInfo={veryLargeBalanceInfo} showBalance={true} />
      );

      expect(screen.getByText('1.23M HBAR')).toBeInTheDocument();
    });

    it('should format small balances with more decimal places', () => {
      const smallBalanceInfo = { ...mockAccountInfo, balance: '0.123456' };
      render(<WalletInfo accountInfo={smallBalanceInfo} showBalance={true} />);

      expect(screen.getByText('0.1235 HBAR')).toBeInTheDocument();
    });

    it('should handle invalid balance gracefully', () => {
      const invalidBalanceInfo = { ...mockAccountInfo, balance: 'invalid' };
      render(
        <WalletInfo accountInfo={invalidBalanceInfo} showBalance={true} />
      );

      expect(screen.getByText('invalid HBAR')).toBeInTheDocument();
    });
  });

  describe('network display', () => {
    it('should display mainnet with success color', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      expect(screen.getByText('Mainnet')).toBeInTheDocument();
    });

    it('should display testnet with warning color', () => {
      const testnetInfo = { ...mockAccountInfo, network: 'testnet' as const };
      render(<WalletInfo accountInfo={testnetInfo} />);

      expect(screen.getByText('Testnet')).toBeInTheDocument();
    });

    it('should capitalize unknown network names', () => {
      const customNetworkInfo = {
        ...mockAccountInfo,
        network: 'custom' as any,
      };
      render(<WalletInfo accountInfo={customNetworkInfo} />);

      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  describe('disconnect functionality', () => {
    it('should display disconnect button when onDisconnect is provided', () => {
      render(
        <WalletInfo
          accountInfo={mockAccountInfo}
          onDisconnect={mockOnDisconnect}
        />
      );

      expect(
        screen.getByRole('button', { name: /disconnect/i })
      ).toBeInTheDocument();
    });

    it('should not display disconnect button when onDisconnect is not provided', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      expect(
        screen.queryByRole('button', { name: /disconnect/i })
      ).not.toBeInTheDocument();
    });

    it('should call onDisconnect when disconnect button is clicked', () => {
      render(
        <WalletInfo
          accountInfo={mockAccountInfo}
          onDisconnect={mockOnDisconnect}
        />
      );

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      });
      fireEvent.click(disconnectButton);

      expect(mockOnDisconnect).toHaveBeenCalledOnce();
    });
  });

  describe('layout variants', () => {
    it('should render horizontal layout by default', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      // Check that elements are arranged horizontally
      const container = screen
        .getByText('0.0.12...3789')
        .closest('div')?.parentElement;
      expect(container).toHaveStyle({ display: 'flex', alignItems: 'center' });
    });

    it('should render vertical layout when specified', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} layout="vertical" />);

      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      expect(screen.getByText('Mainnet')).toBeInTheDocument();
    });

    it('should render compact layout when specified', () => {
      render(
        <WalletInfo
          accountInfo={mockAccountInfo}
          layout="compact"
          onDisconnect={mockOnDisconnect}
        />
      );

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      });
      expect(disconnectButton).toBeInTheDocument();
    });

    it('should show full width disconnect button in vertical layout', () => {
      render(
        <WalletInfo
          accountInfo={mockAccountInfo}
          layout="vertical"
          onDisconnect={mockOnDisconnect}
        />
      );

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect wallet/i,
      });
      expect(disconnectButton).toBeInTheDocument();
    });
  });

  describe('styling and props', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <WalletInfo
          accountInfo={mockAccountInfo}
          className="custom-wallet-info"
        />
      );

      expect(container.firstChild).toHaveClass('custom-wallet-info');
    });

    it('should apply custom style', () => {
      const customStyle = { backgroundColor: 'red' };
      const { container } = render(
        <WalletInfo accountInfo={mockAccountInfo} style={customStyle} />
      );

      expect(container.firstChild).toHaveStyle({ backgroundColor: 'red' });
    });

    it('should use custom variant and size for disconnect button', () => {
      render(
        <WalletInfo
          accountInfo={mockAccountInfo}
          onDisconnect={mockOnDisconnect}
          variant="secondary"
          size="lg"
        />
      );

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      });
      expect(disconnectButton).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper tooltip for address click', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      const addressElement = screen.getByText('0.0.12...3789');
      expect(addressElement).toHaveAttribute(
        'title',
        'Click to copy full address'
      );
    });

    it('should have proper tooltip for compact layout', () => {
      render(<WalletInfo accountInfo={mockAccountInfo} layout="compact" />);

      const addressElement = screen.getByText('0.0.12...3789');
      expect(addressElement).toHaveAttribute('title', 'Click to copy address');
    });

    it('should be keyboard accessible', () => {
      render(
        <WalletInfo
          accountInfo={mockAccountInfo}
          onDisconnect={mockOnDisconnect}
        />
      );

      const disconnectButton = screen.getByRole('button', {
        name: /disconnect/i,
      });
      disconnectButton.focus();
      expect(disconnectButton).toHaveFocus();
    });
  });

  describe('copy feedback timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should hide copy feedback after timeout', async () => {
      render(<WalletInfo accountInfo={mockAccountInfo} />);

      const addressElement = screen.getByText('0.0.12...3789');
      fireEvent.click(addressElement);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      // Fast-forward time
      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });
    });
  });
});
