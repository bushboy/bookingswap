import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentForm } from '../PaymentForm';
import { usePaymentValidation } from '../../../hooks/usePaymentValidation';
import { usePaymentSecurity } from '../../../hooks/usePaymentSecurity';

// Mock hooks
vi.mock('../../../hooks/usePaymentValidation');
vi.mock('../../../hooks/usePaymentSecurity');

const mockUsePaymentValidation = usePaymentValidation as any;
const mockUsePaymentSecurity = usePaymentSecurity as any;

describe('PaymentForm', () => {
  const defaultProps = {
    amount: 100,
    currency: 'USD',
    recipientId: 'recipient-123',
    swapId: 'swap-123',
    proposalId: 'proposal-123',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  const mockValidation = {
    isValid: true,
    errors: [],
    warnings: [],
    estimatedFees: {
      platformFee: 2.5,
      processingFee: 2.9,
      totalFees: 5.4,
      netAmount: 94.6,
    },
    requiresEscrow: false,
  };

  const mockSecurityCheck = {
    isValid: true,
    securityScore: 85,
    warnings: [],
    requiresVerification: false,
  };

  const mockRiskAssessment = {
    riskLevel: 'low' as const,
    factors: [],
    requiresManualReview: false,
    additionalVerificationRequired: false,
  };

  beforeEach(() => {
    mockUsePaymentValidation.mockReturnValue({
      validation: mockValidation,
      validatePayment: vi.fn(),
      isValidating: false,
      error: null,
      clearValidation: vi.fn(),
    });

    mockUsePaymentSecurity.mockReturnValue({
      securityCheck: mockSecurityCheck,
      performSecurityCheck: vi.fn(),
      riskAssessment: mockRiskAssessment,
      isCheckingFraud: false,
      error: null,
      clearSecurityCheck: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders payment form with amount and currency', () => {
    render(<PaymentForm {...defaultProps} />);

    expect(screen.getByText('Payment Details')).toBeInTheDocument();
    expect(screen.getByText('USD 100.00')).toBeInTheDocument();
  });

  it('displays estimated fees when validation is available', () => {
    render(<PaymentForm {...defaultProps} />);

    expect(screen.getByText('Platform Fee: USD 2.50')).toBeInTheDocument();
    expect(screen.getByText('Processing Fee: USD 2.90')).toBeInTheDocument();
    expect(screen.getByText('Total Fees: USD 5.40')).toBeInTheDocument();
  });

  it('shows validation errors when present', () => {
    const validationWithErrors = {
      ...mockValidation,
      isValid: false,
      errors: ['Payment method not verified', 'Amount exceeds limit'],
    };

    mockUsePaymentValidation.mockReturnValue({
      validation: validationWithErrors,
      validatePayment: vi.fn(),
      isValidating: false,
      error: null,
      clearValidation: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    expect(screen.getByText('Payment Validation Errors:')).toBeInTheDocument();
    expect(screen.getByText('Payment method not verified')).toBeInTheDocument();
    expect(screen.getByText('Amount exceeds limit')).toBeInTheDocument();
  });

  it('shows validation warnings when present', () => {
    const validationWithWarnings = {
      ...mockValidation,
      warnings: ['Large transaction may require additional verification'],
    };

    mockUsePaymentValidation.mockReturnValue({
      validation: validationWithWarnings,
      validatePayment: vi.fn(),
      isValidating: false,
      error: null,
      clearValidation: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    expect(screen.getByText('Important Information:')).toBeInTheDocument();
    expect(
      screen.getByText('Large transaction may require additional verification')
    ).toBeInTheDocument();
  });

  it('shows escrow agreement when required', () => {
    const validationWithEscrow = {
      ...mockValidation,
      requiresEscrow: true,
    };

    mockUsePaymentValidation.mockReturnValue({
      validation: validationWithEscrow,
      validatePayment: vi.fn(),
      isValidating: false,
      error: null,
      clearValidation: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    expect(screen.getByText('Escrow Protection Required')).toBeInTheDocument();
    expect(
      screen.getByText('I agree to the escrow terms and conditions')
    ).toBeInTheDocument();
  });

  it('disables submit button when validation fails', () => {
    const invalidValidation = {
      ...mockValidation,
      isValid: false,
      errors: ['Invalid payment method'],
    };

    mockUsePaymentValidation.mockReturnValue({
      validation: invalidValidation,
      validatePayment: vi.fn(),
      isValidating: false,
      error: null,
      clearValidation: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', {
      name: /process payment/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('shows fraud warning modal for high risk transactions', async () => {
    const highRiskAssessment = {
      riskLevel: 'high' as const,
      factors: ['New account', 'Large amount'],
      requiresManualReview: true,
      additionalVerificationRequired: true,
    };

    mockUsePaymentSecurity.mockReturnValue({
      securityCheck: mockSecurityCheck,
      performSecurityCheck: vi.fn(),
      riskAssessment: highRiskAssessment,
      isCheckingFraud: false,
      error: null,
      clearSecurityCheck: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Security Review Required')).toBeInTheDocument();
    });
  });

  it('calls onSubmit with correct payment request data', async () => {
    const user = userEvent.setup();
    const mockPaymentMethod = {
      id: 'pm-123',
      userId: 'user-123',
      type: 'credit_card' as const,
      displayName: 'Visa ****1234',
      isVerified: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock PaymentMethodSelector to automatically select a method
    vi.doMock('../PaymentMethodSelector', () => ({
      PaymentMethodSelector: ({ onSelect }: any) => {
        React.useEffect(() => {
          onSelect(mockPaymentMethod);
        }, [onSelect]);
        return <div>Payment Method Selector</div>;
      },
    }));

    render(<PaymentForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', {
      name: /process payment/i,
    });
    await user.click(submitButton);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      amount: 100,
      currency: 'USD',
      payerId: 'user-123',
      recipientId: 'recipient-123',
      paymentMethodId: 'pm-123',
      swapId: 'swap-123',
      proposalId: 'proposal-123',
      escrowRequired: false,
    });
  });

  it('requires escrow agreement when escrow is required', async () => {
    const user = userEvent.setup();
    const validationWithEscrow = {
      ...mockValidation,
      requiresEscrow: true,
    };

    mockUsePaymentValidation.mockReturnValue({
      validation: validationWithEscrow,
      validatePayment: vi.fn(),
      isValidating: false,
      error: null,
      clearValidation: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', {
      name: /process payment/i,
    });
    expect(submitButton).toBeDisabled();

    const escrowCheckbox = screen.getByRole('checkbox', {
      name: /i agree to the escrow terms/i,
    });
    await user.click(escrowCheckbox);

    expect(submitButton).not.toBeDisabled();
  });

  it('shows loading state during form submission', () => {
    render(<PaymentForm {...defaultProps} isLoading={true} />);

    const submitButton = screen.getByRole('button', { name: /processing/i });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveStyle({ opacity: '0.7' });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<PaymentForm {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('validates payment when payment method changes', () => {
    const mockValidatePayment = vi.fn();
    mockUsePaymentValidation.mockReturnValue({
      validation: mockValidation,
      validatePayment: mockValidatePayment,
      isValidating: false,
      error: null,
      clearValidation: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    // This would be triggered by PaymentMethodSelector
    // In a real test, we'd simulate the payment method selection
    expect(mockValidatePayment).toHaveBeenCalled();
  });

  it('performs security check after validation completes', () => {
    const mockPerformSecurityCheck = vi.fn();
    mockUsePaymentSecurity.mockReturnValue({
      securityCheck: null,
      performSecurityCheck: mockPerformSecurityCheck,
      riskAssessment: null,
      isCheckingFraud: false,
      error: null,
      clearSecurityCheck: vi.fn(),
    });

    render(<PaymentForm {...defaultProps} />);

    // Security check should be performed when validation is complete
    expect(mockPerformSecurityCheck).toHaveBeenCalled();
  });
});