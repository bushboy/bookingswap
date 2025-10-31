import { PaymentSecurityService } from '../PaymentSecurityService';
import { PaymentRepository } from '../../../database/repositories/PaymentRepository';
import { FraudDetectionService } from '../FraudDetectionService';
import { HederaService } from '../../hedera/HederaService';
import { PaymentMethod, PaymentSecurityContext } from '@booking-swap/shared';

describe('PaymentSecurityService - Enhanced Security Features', () => {
  let paymentSecurityService: PaymentSecurityService;
  let mockPaymentRepository: jest.Mocked<PaymentRepository>;
  let mockFraudDetectionService: jest.Mocked<FraudDetectionService>;
  let mockHederaService: jest.Mocked<HederaService>;

  const mockEncryptionKey = 'test-encryption-key-32-characters';

  beforeEach(() => {
    mockPaymentRepository = {
      findById: jest.fn(),
      updatePaymentMethodVerification: jest.fn(),
    } as any;

    mockFraudDetectionService = {
      detectFraud: jest.fn(),
    } as any;

    mockHederaService = {} as any;

    paymentSecurityService = new PaymentSecurityService(
      mockPaymentRepository,
      mockFraudDetectionService,
      mockHederaService,
      mockEncryptionKey
    );
  });

  describe('Enhanced Payment Method Validation', () => {
    const mockPaymentMethod: PaymentMethod = {
      id: 'pm-123',
      userId: 'user-123',
      type: 'credit_card',
      displayName: 'Visa ****1234',
      isVerified: true,
      metadata: {
        cardType: 'credit',
        expiryDate: '12/25'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContext: PaymentSecurityContext = {
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      deviceFingerprint: 'device-123',
      previousTransactions: 5,
      accountAge: 30
    };

    it('should validate credit card with enhanced security checks', async () => {
      const verificationData = {
        cardNumber: '4532015112830366', // Valid test card number
        expiryDate: '12/25',
        cvv: '123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.securityScore).toBeGreaterThan(70);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid credit card number using Luhn algorithm', async () => {
      const verificationData = {
        cardNumber: '4532015112830367', // Invalid card number (fails Luhn check)
        expiryDate: '12/25',
        cvv: '123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid credit card number (failed Luhn check)');
      expect(result.securityScore).toBeLessThan(70);
    });

    it('should validate expired credit card', async () => {
      const verificationData = {
        cardNumber: '4532015112830366',
        expiryDate: '01/20', // Expired date
        cvv: '123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Credit card has expired');
    });

    it('should validate CVV format', async () => {
      const verificationData = {
        cardNumber: '4532015112830366',
        expiryDate: '12/25',
        cvv: '12' // Invalid CVV (too short)
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CVV must be 3 or 4 digits');
    });

    it('should flag prepaid cards as higher risk', async () => {
      const prepaidPaymentMethod = {
        ...mockPaymentMethod,
        metadata: {
          ...mockPaymentMethod.metadata,
          cardType: 'prepaid'
        }
      };

      const verificationData = {
        cardNumber: '4532015112830366',
        expiryDate: '12/25',
        cvv: '123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        prepaidPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.warnings).toContain('Card type has higher risk profile');
      expect(result.securityScore).toBeLessThan(100);
    });
  });

  describe('Bank Transfer Validation', () => {
    const mockBankPaymentMethod: PaymentMethod = {
      id: 'pm-456',
      userId: 'user-123',
      type: 'bank_transfer',
      displayName: 'Bank Account ****1234',
      isVerified: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContext: PaymentSecurityContext = {
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      deviceFingerprint: 'device-123',
      previousTransactions: 5,
      accountAge: 30
    };

    it('should validate micro-deposits correctly', async () => {
      const verificationData = {
        microDepositAmounts: '0.12, 0.34',
        accountNumber: '123456789',
        routingNumber: '021000021' // Valid routing number
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockBankPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid micro-deposit amounts', async () => {
      const verificationData = {
        microDepositAmounts: '1.50, 2.00', // Amounts too large
        accountNumber: '123456789',
        routingNumber: '021000021'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockBankPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid micro-deposit amount 1: must be between $0.01 and $1.00');
      expect(result.errors).toContain('Invalid micro-deposit amount 2: must be between $0.01 and $1.00');
    });

    it('should validate routing number checksum', async () => {
      const verificationData = {
        microDepositAmounts: '0.12, 0.34',
        accountNumber: '123456789',
        routingNumber: '021000022' // Invalid routing number (fails checksum)
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockBankPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid routing number (failed checksum validation)');
    });

    it('should validate account number length', async () => {
      const verificationData = {
        microDepositAmounts: '0.12, 0.34',
        accountNumber: '123', // Too short
        routingNumber: '021000021'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockBankPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.warnings).toContain('Bank account number must be between 8 and 17 digits');
    });
  });

  describe('Digital Wallet Validation', () => {
    const mockWalletPaymentMethod: PaymentMethod = {
      id: 'pm-789',
      userId: 'user-123',
      type: 'digital_wallet',
      displayName: 'PayPal user@example.com',
      isVerified: false,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContext: PaymentSecurityContext = {
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      deviceFingerprint: 'device-123',
      previousTransactions: 5,
      accountAge: 30
    };

    it('should validate trusted wallet providers', async () => {
      const verificationData = {
        provider: 'paypal',
        walletId: 'user@example.com'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockWalletPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should flag untrusted wallet providers', async () => {
      const verificationData = {
        provider: 'unknown_wallet',
        walletId: 'user123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockWalletPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.warnings).toContain('Untrusted wallet provider');
      expect(result.securityScore).toBeLessThan(100);
    });

    it('should validate PayPal email format', async () => {
      const verificationData = {
        provider: 'paypal',
        walletId: 'invalid-email' // Invalid email format
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockWalletPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PayPal wallet ID must be a valid email address');
    });

    it('should validate Venmo username format', async () => {
      const verificationData = {
        provider: 'venmo',
        walletId: '@validusername'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockWalletPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('PCI Compliance Validation', () => {
    const mockPaymentMethod: PaymentMethod = {
      id: 'pm-123',
      userId: 'user-123',
      type: 'credit_card',
      displayName: 'Visa ****1234',
      isVerified: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockContext: PaymentSecurityContext = {
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      deviceFingerprint: 'device-123',
      previousTransactions: 5,
      accountAge: 30
    };

    it('should detect PCI compliance violations', async () => {
      const verificationData = {
        fullCardNumber: '4532015112830366', // Full card number should not be transmitted
        cvv: '123',
        storeData: true // CVV should never be stored
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Full card number should not be transmitted for verification');
      expect(result.errors).toContain('CVV should never be stored');
    });

    it('should require encryption for sensitive data', async () => {
      const verificationData = {
        cardNumber: '4532015112830366',
        encrypted: false // Data should be encrypted
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sensitive data should be encrypted in transit');
    });
  });

  describe('Security Context Validation', () => {
    const mockPaymentMethod: PaymentMethod = {
      id: 'pm-123',
      userId: 'user-123',
      type: 'credit_card',
      displayName: 'Visa ****1234',
      isVerified: true,
      metadata: {
        lastDeviceFingerprint: 'device-456' // Different from current
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should flag new device usage', async () => {
      const context: PaymentSecurityContext = {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceFingerprint: 'device-123', // Different from stored fingerprint
        previousTransactions: 5,
        accountAge: 30
      };

      const verificationData = {
        cardNumber: '4532015112830366',
        expiryDate: '12/25',
        cvv: '123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        context
      );

      expect(result.warnings).toContain('Payment method accessed from new device');
      expect(result.securityScore).toBeLessThan(100);
    });

    it('should flag very new accounts', async () => {
      const context: PaymentSecurityContext = {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        deviceFingerprint: 'device-123',
        previousTransactions: 0,
        accountAge: 3 // Very new account
      };

      const verificationData = {
        cardNumber: '4532015112830366',
        expiryDate: '12/25',
        cvv: '123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        context
      );

      expect(result.warnings).toContain('Account is very new (less than 7 days)');
      expect(result.securityScore).toBeLessThan(100);
    });

    it('should reject private IP addresses', async () => {
      const context: PaymentSecurityContext = {
        userId: 'user-123',
        ipAddress: '10.0.0.1', // Private IP address
        deviceFingerprint: 'device-123',
        previousTransactions: 5,
        accountAge: 30
      };

      const verificationData = {
        cardNumber: '4532015112830366',
        expiryDate: '12/25',
        cvv: '123'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        context
      );

      expect(result.warnings).toContain('Verification cannot be performed from private IP address');
    });
  });

  describe('Tokenization', () => {
    it('should tokenize sensitive payment method data', async () => {
      const sensitiveData = {
        cardNumber: '4532015112830366',
        cvv: '123',
        expiryDate: '12/25'
      };

      const result = await paymentSecurityService.tokenizePaymentMethod(
        'user-123',
        'credit_card',
        sensitiveData
      );

      expect(result.token).toMatch(/^pm_[a-f0-9]{32}$/);
      expect(result.maskedData).toBe('****-****-****-0366');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should create different tokens for different data', async () => {
      const sensitiveData1 = { cardNumber: '4532015112830366' };
      const sensitiveData2 = { cardNumber: '4532015112830367' };

      const result1 = await paymentSecurityService.tokenizePaymentMethod(
        'user-123',
        'credit_card',
        sensitiveData1
      );

      const result2 = await paymentSecurityService.tokenizePaymentMethod(
        'user-123',
        'credit_card',
        sensitiveData2
      );

      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockContext: PaymentSecurityContext = {
        userId: 'user-123',
        ipAddress: 'invalid-ip',
        deviceFingerprint: 'device-123',
        previousTransactions: 5,
        accountAge: 30
      };

      const verificationData = {
        cardNumber: 'invalid-card-number',
        expiryDate: 'invalid-date',
        cvv: 'invalid-cvv'
      };

      const result = await paymentSecurityService.validatePaymentMethodWithEnhancedSecurity(
        mockPaymentMethod,
        verificationData,
        mockContext
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.securityScore).toBe(0);
    });
  });
});