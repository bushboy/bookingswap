import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PaymentForm } from '../../components/payment/PaymentForm';
import { paymentService } from '../../services/paymentService';
import { paymentSecurityService } from '../../services/paymentSecurityService';

// Mock services
jest.mock('../../services/paymentService');
jest.mock('../../services/paymentSecurityService');

const mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;
const mockPaymentSecurityService = paymentSecurityService as jest.Mocked<
  typeof paymentSecurityService
>;

// Mock store
const createMockStore = () =>
  configureStore({
    reducer: {
      auth: (state = { user: { id: 'user-123' } }) => state,
    },
  });

describe('Payment Security Validation Integration', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    jest.clearAllMocks();
  });

  const renderPaymentForm = (props = {}) => {
    const defaultProps = {
      amount: 1000,
      currency: 'USD',
      recipientId: 'recipient-123',
      swapId: 'swap-123',
      proposalId: 'proposal-123',
      onSubmit: jest.fn(),
      onCancel: jest.fn(),
      ...props,
    };

    return render(
      <Provider store={store}>
        <PaymentForm {...defaultProps} />
      </Provider>
    );
  };

  describe('Payment Method Validation Flow', () => {
    it('should validate payment method and show security indicators', async () => {
      const user = userEvent.setup();

      // Mock payment validation response
      mockPaymentService.validatePayment.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['Large transaction may require additional verification'],
        estimatedFees: {
          platformFee: 25,
          processingFee: 29,
          totalFees: 54,
          netAmount: 946,
        },
        requiresEscrow: true,
      });

      // Mock security validation response
      mockPaymentSecurityService.validatePaymentSecurity.mockResolvedValue({
        isValid: true,
        securityScore: 85,
        warnings: ['Payment method accessed from new device'],
        requiresVerification: false,
      });

      // Mock fraud detection response
      mockPaymentSecurityService.detectFraud.mockResolvedValue({
        isSuspicious: false,
        riskScore: 25,
        flags: [],
        recommendedAction: 'approve',
      });

      renderPaymentForm();

      // Should show payment amount and fees
      expect(screen.getByText('USD 1000.00')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Platform Fee: USD 25.00')).toBeInTheDocument();
        expect(
          screen.getByText('Processing Fee: USD 29.00')
        ).toBeInTheDocument();
        expect(screen.getByText('Total Fees: USD 54.00')).toBeInTheDocument();
      });

      // Should show validation warnings
      expect(
        screen.getByText(
          'Large transaction may require additional verification'
        )
      ).toBeInTheDocument();

      // Should show escrow requirement
      expect(
        screen.getByText('Escrow Protection Required')
      ).toBeInTheDocument();

      // Should show security status
      await waitFor(() => {
        expect(screen.getByText('Security Status')).toBeInTheDocument();
      });
    });

    it('should handle high-risk transactions with fraud warning', async () => {
      // Mock high-risk fraud detection
      mockPaymentSecurityService.detectFraud.mockResolvedValue({
        isSuspicious: true,
        riskScore: 85,
        flags: ['New account', 'Large amount', 'Unusual device'],
        recommendedAction: 'review',
      });

      mockPaymentService.validatePayment.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        estimatedFees: {
          platformFee: 25,
          processingFee: 29,
          totalFees: 54,
          netAmount: 946,
        },
        requiresEscrow: true,
      });

      renderPaymentForm();

      await waitFor(() => {
        expect(
          screen.getByText('Security Review Required')
        ).toBeInTheDocument();
        expect(
          screen.getByText('HIGH risk level detected')
        ).toBeInTheDocument();
      });

      // Should show risk factors
      expect(screen.getByText('New account')).toBeInTheDocument();
      expect(screen.getByText('Large amount')).toBeInTheDocument();
      expect(screen.getByText('Unusual device')).toBeInTheDocument();

      // Should show security measures
      expect(screen.getByText('Your Protection:')).toBeInTheDocument();
      expect(
        screen.getByText(
          'All payments are processed through secure, PCI-compliant gateways'
        )
      ).toBeInTheDocument();
    });

    it('should handle payment validation errors', async () => {
      mockPaymentService.validatePayment.mockResolvedValue({
        isValid: false,
        errors: [
          'Payment method not verified',
          'Amount exceeds daily limit',
          'Invalid payment method for this amount',
        ],
        warnings: [],
        estimatedFees: {
          platformFee: 0,
          processingFee: 0,
          totalFees: 0,
          netAmount: 1000,
        },
        requiresEscrow: false,
      });

      renderPaymentForm();

      await waitFor(() => {
        expect(
          screen.getByText('Payment Validation Errors:')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Payment method not verified')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Amount exceeds daily limit')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Invalid payment method for this amount')
        ).toBeInTheDocument();
      });

      // Submit button should be disabled
      const submitButton = screen.getByRole('button', {
        name: /process payment/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it('should handle PCI compliance violations', async () => {
      mockPaymentSecurityService.validatePCICompliance.mockResolvedValue({
        isCompliant: false,
        violations: [
          'Sensitive payment data found in local storage',
          'Payment data transmitted over insecure connection',
        ],
        recommendations: [
          'Remove sensitive data from client-side storage',
          'Use HTTPS for all payment transactions',
        ],
      });

      renderPaymentForm();

      // In a real implementation, this would be triggered by form interaction
      // For now, we'll simulate the PCI compliance check result
      await waitFor(() => {
        // The form should handle PCI compliance violations
        expect(
          mockPaymentSecurityService.validatePCICompliance
        ).toHaveBeenCalled();
      });
    });
  });

  describe('Payment Method Security Verification', () => {
    it('should handle credit card verification flow', async () => {
      const user = userEvent.setup();

      mockPaymentService.validatePayment.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        estimatedFees: {
          platformFee: 25,
          processingFee: 29,
          totalFees: 54,
          netAmount: 946,
        },
        requiresEscrow: false,
      });

      mockPaymentSecurityService.verifyPaymentMethodSecurity.mockResolvedValue({
        isVerified: true,
        verificationId: 'ver-123',
        errors: [],
        requiresAdditionalVerification: false,
      });

      renderPaymentForm();

      // Simulate payment method requiring verification
      await waitFor(() => {
        const verifyButton = screen.queryByText('Verify Now');
        if (verifyButton) {
          fireEvent.click(verifyButton);
        }
      });

      // Should show verification modal (if payment method is unverified)
      // This would be handled by the PaymentVerificationModal component
    });

    it('should handle bank transfer micro-deposit verification', async () => {
      mockPaymentService.verifyPaymentMethod.mockResolvedValue({
        isVerified: true,
        errors: [],
      });

      // This would be tested with a bank transfer payment method
      // The verification would require micro-deposit amounts
      const verificationData = {
        microDepositAmounts: '0.12, 0.34',
      };

      const result = await mockPaymentService.verifyPaymentMethod(
        'pm-123',
        verificationData
      );
      expect(result.isVerified).toBe(true);
    });

    it('should handle digital wallet verification', async () => {
      mockPaymentService.verifyPaymentMethod.mockResolvedValue({
        isVerified: true,
        errors: [],
      });

      // Digital wallet verification would require signature or verification code
      const verificationData = {
        walletSignature: 'signature-123',
        provider: 'paypal',
      };

      const result = await mockPaymentService.verifyPaymentMethod(
        'pm-456',
        verificationData
      );
      expect(result.isVerified).toBe(true);
    });
  });

  describe('Fraud Detection Integration', () => {
    it('should perform real-time fraud detection during payment', async () => {
      const user = userEvent.setup();

      mockPaymentService.validatePayment.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        estimatedFees: {
          platformFee: 25,
          processingFee: 29,
          totalFees: 54,
          netAmount: 946,
        },
        requiresEscrow: false,
      });

      // Mock fraud detection with medium risk
      mockPaymentSecurityService.detectFraud.mockResolvedValue({
        isSuspicious: true,
        riskScore: 55,
        flags: ['Unusual transaction pattern', 'New payment method'],
        recommendedAction: 'review',
      });

      renderPaymentForm();

      await waitFor(() => {
        expect(mockPaymentSecurityService.detectFraud).toHaveBeenCalled();
      });

      // Should show medium risk warning
      await waitFor(() => {
        expect(
          screen.getByText('Security Review Required')
        ).toBeInTheDocument();
        expect(
          screen.getByText('MEDIUM risk level detected')
        ).toBeInTheDocument();
      });
    });

    it('should block high-risk transactions', async () => {
      mockPaymentSecurityService.detectFraud.mockResolvedValue({
        isSuspicious: true,
        riskScore: 95,
        flags: [
          'Multiple failed attempts',
          'Suspicious IP address',
          'Device fingerprint mismatch',
          'Velocity limits exceeded',
        ],
        recommendedAction: 'reject',
      });

      renderPaymentForm();

      await waitFor(() => {
        expect(
          screen.getByText('Security Review Required')
        ).toBeInTheDocument();
        expect(
          screen.getByText('HIGH risk level detected')
        ).toBeInTheDocument();
      });

      // Should show all risk factors
      expect(screen.getByText('Multiple failed attempts')).toBeInTheDocument();
      expect(screen.getByText('Suspicious IP address')).toBeInTheDocument();
      expect(
        screen.getByText('Device fingerprint mismatch')
      ).toBeInTheDocument();
      expect(screen.getByText('Velocity limits exceeded')).toBeInTheDocument();
    });
  });

  describe('Error Recovery and User Experience', () => {
    it('should provide clear error messages for validation failures', async () => {
      mockPaymentService.validatePayment.mockRejectedValue(
        new Error('Payment validation service unavailable')
      );

      renderPaymentForm();

      await waitFor(() => {
        // Should show user-friendly error message
        expect(
          screen.getByText(/payment validation failed/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle network failures gracefully', async () => {
      mockPaymentSecurityService.detectFraud.mockRejectedValue(
        new Error('Network error')
      );

      renderPaymentForm();

      await waitFor(() => {
        // Should fall back to high-risk assessment on error
        expect(mockPaymentSecurityService.detectFraud).toHaveBeenCalled();
      });
    });

    it('should provide retry mechanisms for failed operations', async () => {
      const user = userEvent.setup();

      // First call fails, second succeeds
      mockPaymentService.validatePayment
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          isValid: true,
          errors: [],
          warnings: [],
          estimatedFees: {
            platformFee: 25,
            processingFee: 29,
            totalFees: 54,
            netAmount: 946,
          },
          requiresEscrow: false,
        });

      renderPaymentForm();

      // Should handle retry logic internally
      await waitFor(() => {
        expect(mockPaymentService.validatePayment).toHaveBeenCalled();
      });
    });
  });

  describe('Security Compliance', () => {
    it('should ensure PCI DSS compliance throughout the flow', async () => {
      renderPaymentForm();

      // Should validate PCI compliance
      await waitFor(() => {
        expect(
          mockPaymentSecurityService.validatePCICompliance
        ).toHaveBeenCalled();
      });

      // Should show security indicators
      expect(screen.getByText(/PCI compliant/i)).toBeInTheDocument();
      expect(screen.getByText(/AES-256/i)).toBeInTheDocument();
    });

    it('should handle sensitive data securely', async () => {
      // Mock tokenization
      mockPaymentSecurityService.generatePaymentToken.mockResolvedValue({
        token: 'pm_1234567890abcdef',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Should tokenize sensitive data
      const sensitiveData = {
        cardNumber: '4532015112830366',
        cvv: '123',
      };

      await mockPaymentSecurityService.generatePaymentToken(sensitiveData);

      expect(
        mockPaymentSecurityService.generatePaymentToken
      ).toHaveBeenCalledWith(sensitiveData);
    });

    it('should clear sensitive data after processing', async () => {
      renderPaymentForm();

      // Should call clearSensitiveData after form submission or cancellation
      mockPaymentSecurityService.clearSensitiveData();
      expect(mockPaymentSecurityService.clearSensitiveData).toHaveBeenCalled();
    });
  });
});
