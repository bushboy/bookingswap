import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  WalletErrorDisplay,
  WalletErrorInline,
  WalletErrorToast,
} from '../WalletErrorDisplay';
import { createWalletError } from '../../../utils/walletErrorHandling';
import { WalletErrorType } from '../../../types/wallet';

describe('WalletErrorDisplay', () => {
  const mockError = createWalletError(
    WalletErrorType.PROVIDER_NOT_FOUND,
    'HashPack wallet extension is not installed.'
  );

  const mockGenericError = new Error('User rejected the connection');

  describe('WalletErrorDisplay', () => {
    it('should render nothing when no error is provided', () => {
      const { container } = render(<WalletErrorDisplay error={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render error message and title', () => {
      render(<WalletErrorDisplay error={mockError} />);

      expect(screen.getByText('Wallet Not Found')).toBeInTheDocument();
      expect(
        screen.getByText(
          'The selected wallet extension is not installed or not available.'
        )
      ).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      render(<WalletErrorDisplay error={mockError} />);

      expect(
        screen.getByRole('button', { name: 'Install Wallet' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Refresh Page' })
      ).toBeInTheDocument();
    });

    it('should call onRetry when retry action is clicked', () => {
      const onRetry = vi.fn();
      render(<WalletErrorDisplay error={mockError} onRetry={onRetry} />);

      // The retry action for PROVIDER_NOT_FOUND is not "retry_connection",
      // but let's test with a retryable error
      const retryableError = createWalletError(
        WalletErrorType.NETWORK_ERROR,
        'Network error'
      );
      render(<WalletErrorDisplay error={retryableError} onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      render(<WalletErrorDisplay error={mockError} onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', {
        name: 'Dismiss error',
      });
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should call onAction for custom actions', () => {
      const onAction = vi.fn();
      render(<WalletErrorDisplay error={mockError} onAction={onAction} />);

      const installButton = screen.getByRole('button', {
        name: 'Install Wallet',
      });
      fireEvent.click(installButton);

      expect(onAction).toHaveBeenCalledWith('install_wallet');
    });

    it('should handle refresh page action', () => {
      // Mock window.location.reload
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(<WalletErrorDisplay error={mockError} />);

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh Page',
      });
      fireEvent.click(refreshButton);

      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('should show explanation in details', () => {
      render(<WalletErrorDisplay error={mockError} />);

      const detailsElement = screen.getByText('Why did this happen?');
      expect(detailsElement).toBeInTheDocument();

      fireEvent.click(detailsElement);
      expect(
        screen.getByText(/Wallet extensions must be installed/)
      ).toBeInTheDocument();
    });

    it('should apply correct severity styles', () => {
      const { container } = render(<WalletErrorDisplay error={mockError} />);

      const errorContainer = container.firstChild as HTMLElement;
      expect(errorContainer).toHaveClass(
        'border-red-200',
        'bg-red-50',
        'text-red-800'
      );
    });

    it('should handle generic errors by inferring type', () => {
      render(<WalletErrorDisplay error={mockGenericError} />);

      expect(screen.getByText('Connection Declined')).toBeInTheDocument();
      expect(
        screen.getByText('You declined the wallet connection request.')
      ).toBeInTheDocument();
    });
  });

  describe('WalletErrorInline', () => {
    it('should render compact error display', () => {
      render(<WalletErrorInline error={mockError} />);

      expect(screen.getByText(/Wallet Not Found:/)).toBeInTheDocument();
      expect(
        screen.getByText(/The selected wallet extension is not installed/)
      ).toBeInTheDocument();
    });

    it('should show limited action buttons', () => {
      const retryableError = createWalletError(
        WalletErrorType.NETWORK_ERROR,
        'Network error'
      );
      render(<WalletErrorInline error={retryableError} />);

      // Should show only first 2 actions
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeLessThanOrEqual(3); // 2 actions + dismiss
    });

    it('should call onRetry for retry action', () => {
      const onRetry = vi.fn();
      const retryableError = createWalletError(
        WalletErrorType.NETWORK_ERROR,
        'Network error'
      );
      render(<WalletErrorInline error={retryableError} onRetry={onRetry} />);

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should show dismiss button when onDismiss is provided', () => {
      const onDismiss = vi.fn();
      render(<WalletErrorInline error={mockError} onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
      fireEvent.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('WalletErrorToast', () => {
    it('should render nothing when not visible', () => {
      const { container } = render(
        <WalletErrorToast
          error={mockError}
          isVisible={false}
          onClose={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render when visible', () => {
      render(
        <WalletErrorToast
          error={mockError}
          isVisible={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Wallet Not Found')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <WalletErrorToast
          error={mockError}
          isVisible={true}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should show limited actions in toast format', () => {
      render(
        <WalletErrorToast
          error={mockError}
          isVisible={true}
          onClose={vi.fn()}
        />
      );

      // Should show only first 2 actions
      const actionButtons = screen
        .getAllByRole('button')
        .filter(
          button => !button.getAttribute('aria-label')?.includes('Close')
        );
      expect(actionButtons.length).toBeLessThanOrEqual(2);
    });

    it('should call onRetry for retry actions', () => {
      const onRetry = vi.fn();
      const retryableError = createWalletError(
        WalletErrorType.NETWORK_ERROR,
        'Network error'
      );

      render(
        <WalletErrorToast
          error={retryableError}
          isVisible={true}
          onClose={vi.fn()}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should apply correct positioning classes', () => {
      const { container } = render(
        <WalletErrorToast
          error={mockError}
          isVisible={true}
          onClose={vi.fn()}
        />
      );

      const toastElement = container.firstChild as HTMLElement;
      expect(toastElement).toHaveClass('fixed', 'top-4', 'right-4', 'z-50');
    });

    it('should handle visibility transitions', () => {
      const { container, rerender } = render(
        <WalletErrorToast
          error={mockError}
          isVisible={false}
          onClose={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();

      rerender(
        <WalletErrorToast
          error={mockError}
          isVisible={true}
          onClose={vi.fn()}
        />
      );

      const toastElement = container.firstChild as HTMLElement;
      expect(toastElement).toHaveClass('translate-x-0');
    });
  });

  describe('Error Severity Styling', () => {
    it('should apply error styles for error severity', () => {
      const errorSeverityError = createWalletError(
        WalletErrorType.NETWORK_ERROR,
        'Network error'
      );
      const { container } = render(
        <WalletErrorDisplay error={errorSeverityError} />
      );

      const errorContainer = container.firstChild as HTMLElement;
      expect(errorContainer).toHaveClass(
        'border-red-200',
        'bg-red-50',
        'text-red-800'
      );
    });

    it('should apply warning styles for warning severity', () => {
      const warningSeverityError = createWalletError(
        WalletErrorType.CONNECTION_REJECTED,
        'User rejected'
      );
      const { container } = render(
        <WalletErrorDisplay error={warningSeverityError} />
      );

      const errorContainer = container.firstChild as HTMLElement;
      expect(errorContainer).toHaveClass(
        'border-yellow-200',
        'bg-yellow-50',
        'text-yellow-800'
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const onDismiss = vi.fn();
      render(<WalletErrorDisplay error={mockError} onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', {
        name: 'Dismiss error',
      });
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error');
    });

    it('should have proper focus management', () => {
      render(<WalletErrorDisplay error={mockError} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('focus:outline-none');
      });
    });

    it('should have screen reader friendly content', () => {
      render(
        <WalletErrorToast
          error={mockError}
          isVisible={true}
          onClose={vi.fn()}
        />
      );

      const closeButton = screen.getByRole('button', { name: 'Close' });
      const srText = closeButton.querySelector('.sr-only');
      expect(srText).toHaveTextContent('Close');
    });
  });
});
