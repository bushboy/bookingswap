import { describe, it, expect } from 'vitest';
import { paymentService } from '../paymentService';
import { PaymentRequest, EscrowRequest } from '@booking-swap/shared';

describe('PaymentService - Validation Methods', () => {
  describe('validatePaymentFormData', () => {
    it('should validate valid payment form data', () => {
      const validFormData = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-2',
        paymentMethodId: 'pm-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
      };

      const result = paymentService.validatePaymentFormData(validFormData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid payment form data', () => {
      const invalidFormData = {
        amount: -100,
        currency: 'INVALID',
        payerId: '',
        recipientId: '',
        paymentMethodId: '',
        swapId: '',
        proposalId: '',
      };

      const result = paymentService.validatePaymentFormData(invalidFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Payment amount must be greater than 0');
      expect(result.errors).toContain('Invalid currency selected');
      expect(result.errors).toContain('Payer ID is required');
      expect(result.errors).toContain('Recipient ID is required');
      expect(result.errors).toContain('Payment method is required');
      expect(result.errors).toContain('Swap ID is required');
      expect(result.errors).toContain('Proposal ID is required');
    });

    it('should prevent same payer and recipient', () => {
      const formData = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-1',
        paymentMethodId: 'pm-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
      };

      const result = paymentService.validatePaymentFormData(formData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payer and recipient cannot be the same');
    });

    it('should validate amount limits', () => {
      const highAmountFormData = {
        amount: 150000,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-2',
        paymentMethodId: 'pm-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
      };

      const result = paymentService.validatePaymentFormData(highAmountFormData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payment amount exceeds maximum limit of $100,000');
    });

    it('should validate supported currencies', () => {
      const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
      
      supportedCurrencies.forEach(currency => {
        const formData = {
          amount: 100,
          currency,
          payerId: 'user-1',
          recipientId: 'user-2',
          paymentMethodId: 'pm-1',
          swapId: 'swap-1',
          proposalId: 'proposal-1',
        };

        const result = paymentService.validatePaymentFormData(formData);
        expect(result.isValid).toBe(true);
      });
    });

    it('should validate cryptocurrency payments', () => {
      const cryptoFormData = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-2',
        paymentMethodId: 'pm-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
        paymentMethodType: 'cryptocurrency',
        walletAddress: '0x1234567890abcdef',
        cryptoCurrency: 'HBAR',
      };

      const result = paymentService.validatePaymentFormData(cryptoFormData);
      expect(result.isValid).toBe(true);

      // Test missing wallet address
      const invalidCryptoFormData = {
        ...cryptoFormData,
        walletAddress: '',
      };

      const invalidResult = paymentService.validatePaymentFormData(invalidCryptoFormData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Wallet address is required for cryptocurrency payments');
    });
  });

  describe('validateEscrowRequest', () => {
    it('should validate valid escrow request', () => {
      const validEscrowRequest: EscrowRequest = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-2',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
      };

      const result = paymentService.validateEscrowRequest(validEscrowRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate invalid escrow request', () => {
      const invalidEscrowRequest = {
        amount: -100,
        currency: 'INVALID',
        payerId: '',
        recipientId: '',
        swapId: '',
        proposalId: '',
      } as EscrowRequest;

      const result = paymentService.validateEscrowRequest(invalidEscrowRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Escrow amount must be greater than 0');
      expect(result.errors).toContain('Valid currency is required');
      expect(result.errors).toContain('Payer ID is required');
      expect(result.errors).toContain('Recipient ID is required');
      expect(result.errors).toContain('Swap ID is required');
      expect(result.errors).toContain('Proposal ID is required');
    });

    it('should prevent same payer and recipient in escrow', () => {
      const escrowRequest: EscrowRequest = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
      };

      const result = paymentService.validateEscrowRequest(escrowRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payer and recipient cannot be the same');
    });
  });

  describe('Credit Card Validation', () => {
    it('should validate valid credit card numbers using Luhn algorithm', () => {
      const validCards = [
        '4111111111111111', // Visa
        '5555555555554444', // Mastercard
        '378282246310005',  // American Express
        '6011111111111117', // Discover
      ];

      validCards.forEach(cardNumber => {
        const formData = {
          amount: 100,
          currency: 'USD',
          payerId: 'user-1',
          recipientId: 'user-2',
          paymentMethodId: 'pm-1',
          swapId: 'swap-1',
          proposalId: 'proposal-1',
          paymentMethodType: 'credit_card',
          cardNumber,
        };

        const result = paymentService.validatePaymentFormData(formData);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid credit card numbers', () => {
      const invalidCards = [
        '1234567890123456', // Invalid Luhn
        '123',              // Too short
        '12345678901234567890', // Too long
        '4111111111111112', // Invalid Luhn for Visa
      ];

      invalidCards.forEach(cardNumber => {
        const formData = {
          amount: 100,
          currency: 'USD',
          payerId: 'user-1',
          recipientId: 'user-2',
          paymentMethodId: 'pm-1',
          swapId: 'swap-1',
          proposalId: 'proposal-1',
          paymentMethodType: 'credit_card',
          cardNumber,
        };

        const result = paymentService.validatePaymentFormData(formData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid credit card number');
      });
    });

    it('should validate expiry dates', () => {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear() % 100;
      const currentMonth = currentDate.getMonth() + 1;

      // Valid future date
      const futureMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const futureYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const validExpiry = `${futureMonth.toString().padStart(2, '0')}/${futureYear.toString().padStart(2, '0')}`;

      const formData = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-2',
        paymentMethodId: 'pm-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
        paymentMethodType: 'credit_card',
        cardNumber: '4111111111111111',
        expiryDate: validExpiry,
      };

      const result = paymentService.validatePaymentFormData(formData);
      expect(result.isValid).toBe(true);

      // Invalid past date
      const pastFormData = {
        ...formData,
        expiryDate: '01/20', // Expired
      };

      const pastResult = paymentService.validatePaymentFormData(pastFormData);
      expect(pastResult.isValid).toBe(false);
      expect(pastResult.errors).toContain('Invalid or expired card');
    });

    it('should validate CVV codes', () => {
      const validCVVs = ['123', '1234'];
      const invalidCVVs = ['12', '12345', 'abc'];

      validCVVs.forEach(cvv => {
        const formData = {
          amount: 100,
          currency: 'USD',
          payerId: 'user-1',
          recipientId: 'user-2',
          paymentMethodId: 'pm-1',
          swapId: 'swap-1',
          proposalId: 'proposal-1',
          paymentMethodType: 'credit_card',
          cardNumber: '4111111111111111',
          cvv,
        };

        const result = paymentService.validatePaymentFormData(formData);
        expect(result.isValid).toBe(true);
      });

      invalidCVVs.forEach(cvv => {
        const formData = {
          amount: 100,
          currency: 'USD',
          payerId: 'user-1',
          recipientId: 'user-2',
          paymentMethodId: 'pm-1',
          swapId: 'swap-1',
          proposalId: 'proposal-1',
          paymentMethodType: 'credit_card',
          cardNumber: '4111111111111111',
          cvv,
        };

        const result = paymentService.validatePaymentFormData(formData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid CVV');
      });

      // Test that empty CVV is allowed (optional field)
      const formDataWithoutCVV = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-2',
        paymentMethodId: 'pm-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
        paymentMethodType: 'credit_card',
        cardNumber: '4111111111111111',
      };

      const resultWithoutCVV = paymentService.validatePaymentFormData(formDataWithoutCVV);
      expect(resultWithoutCVV.isValid).toBe(true);
    });
  });

  describe('Bank Transfer Validation', () => {
    it('should validate bank transfer details', () => {
      const validBankData = {
        amount: 100,
        currency: 'USD',
        payerId: 'user-1',
        recipientId: 'user-2',
        paymentMethodId: 'pm-1',
        swapId: 'swap-1',
        proposalId: 'proposal-1',
        paymentMethodType: 'bank_transfer',
        accountNumber: '12345678901',
        routingNumber: '123456789',
      };

      const result = paymentService.validatePaymentFormData(validBankData);
      expect(result.isValid).toBe(true);

      // Test invalid account number
      const invalidAccountData = {
        ...validBankData,
        accountNumber: '1234567', // Too short
      };

      const invalidAccountResult = paymentService.validatePaymentFormData(invalidAccountData);
      expect(invalidAccountResult.isValid).toBe(false);
      expect(invalidAccountResult.errors).toContain('Invalid account number');

      // Test invalid routing number
      const invalidRoutingData = {
        ...validBankData,
        routingNumber: '12345678', // Wrong length
      };

      const invalidRoutingResult = paymentService.validatePaymentFormData(invalidRoutingData);
      expect(invalidRoutingResult.isValid).toBe(false);
      expect(invalidRoutingResult.errors).toContain('Invalid routing number');
    });
  });
});