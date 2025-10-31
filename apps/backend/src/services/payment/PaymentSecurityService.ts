import {
  PaymentMethod,
  PaymentMethodType,
  PaymentSecurityContext,
  FraudDetectionResult,
} from '@booking-swap/shared';
import { PaymentRepository } from '../../database/repositories/PaymentRepository';
import { FraudDetectionService } from './FraudDetectionService';
import { HederaService } from '../hedera/HederaService';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export interface TokenizationResult {
  token: string;
  maskedData: string;
  expiresAt: Date;
}

export interface VerificationResult {
  isVerified: boolean;
  verificationId: string;
  errors: string[];
  requiresAdditionalVerification: boolean;
}

export interface PaymentMethodValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityScore: number; // 0-100
}

/**
 * Enhanced validation result interface for consolidated payment validation methods.
 * This interface provides a standardized structure for validation results that includes
 * detailed error information, warnings, and security score deductions.
 *
 * @interface PaymentValidationResult
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * const result: PaymentValidationResult = {
 *   errors: ['Invalid card number format'],
 *   warnings: ['Card expires soon'],
 *   securityDeduction: 15
 * };
 * ```
 */
export interface PaymentValidationResult {
  /**
   * Array of validation error messages.
   * Each error represents a critical validation failure that prevents
   * the payment method from being considered valid for processing.
   *
   * @type {string[]}
   * @example ['Invalid card number format', 'CVV is required']
   */
  errors: string[];

  /**
   * Array of validation warning messages.
   * Warnings indicate potential issues that don't prevent processing
   * but may require attention or additional verification.
   *
   * @type {string[]}
   * @example ['Card expires within 30 days', 'Unusual spending pattern detected']
   */
  warnings: string[];

  /**
   * Security score deduction amount (0-100).
   * Represents the amount to deduct from the base security score
   * based on validation findings. Higher values indicate more severe
   * security concerns or validation failures.
   *
   * @type {number}
   * @minimum 0
   * @maximum 100
   * @example 25 // Deduct 25 points from security score
   */
  securityDeduction: number;
}

export class PaymentSecurityService {
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly TOKEN_EXPIRY_HOURS = 24;
  private readonly VERIFICATION_TIMEOUT_MINUTES = 15;

  constructor(
    private paymentRepository: PaymentRepository,
    private fraudDetectionService: FraudDetectionService,
    private hederaService: HederaService,
    private encryptionKey: string
  ) {}

  /**
   * Tokenize sensitive payment method data
   */
  async tokenizePaymentMethod(
    userId: string,
    paymentMethodType: PaymentMethodType,
    sensitiveData: Record<string, any>
  ): Promise<TokenizationResult> {
    try {
      logger.info('Tokenizing payment method', { userId, paymentMethodType });

      // Generate unique token
      const token = `pm_${uuidv4().replace(/-/g, '')}`;

      // Encrypt sensitive data
      const encryptedData = this.encryptData(JSON.stringify(sensitiveData));

      // Create masked version for display
      const maskedData = this.maskSensitiveData(
        paymentMethodType,
        sensitiveData
      );

      // Store tokenized data (in a real implementation, this would go to a secure vault)
      const expiresAt = new Date(
        Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
      );

      // For now, store in metadata - in production, use a dedicated secure storage
      const tokenData = {
        token,
        encryptedData,
        userId,
        paymentMethodType,
        createdAt: new Date(),
        expiresAt,
      };

      logger.info('Payment method tokenized successfully', {
        userId,
        token: token.substring(0, 10) + '...',
        paymentMethodType,
      });

      return {
        token,
        maskedData,
        expiresAt,
      };
    } catch (error) {
      logger.error('Payment method tokenization failed', {
        error,
        userId,
        paymentMethodType,
      });
      throw error;
    }
  }

  /**
   * Verify payment method with additional security checks
   */
  async verifyPaymentMethod(
    userId: string,
    paymentMethodId: string,
    verificationData: Record<string, any>
  ): Promise<VerificationResult> {
    try {
      logger.info('Verifying payment method', { userId, paymentMethodId });

      const errors: string[] = [];
      let requiresAdditionalVerification = false;

      // Get payment method
      const paymentMethod =
        await this.paymentRepository.findById(paymentMethodId);
      if (!paymentMethod) {
        errors.push('Payment method not found');
        return {
          isVerified: false,
          verificationId: '',
          errors,
          requiresAdditionalVerification: false,
        };
      }

      if (paymentMethod.userId !== userId) {
        errors.push('Payment method does not belong to user');
        return {
          isVerified: false,
          verificationId: '',
          errors,
          requiresAdditionalVerification: false,
        };
      }

      // Perform type-specific verification
      const typeVerification = await this.verifyPaymentMethodType(
        paymentMethod,
        verificationData
      );

      if (!typeVerification.isValid) {
        errors.push(...typeVerification.errors);
      }

      // Check security score
      if (typeVerification.securityScore < 70) {
        requiresAdditionalVerification = true;
      }

      // Generate verification ID
      const verificationId = `ver_${uuidv4()}`;

      // Record verification attempt on blockchain
      if (errors.length === 0) {
        await this.recordVerificationAttempt(
          userId,
          paymentMethodId,
          verificationId,
          true
        );
      }

      const isVerified = errors.length === 0;

      // Update payment method verification status
      if (isVerified && !requiresAdditionalVerification) {
        await this.paymentRepository.updatePaymentMethodVerification(
          paymentMethodId,
          true
        );
      }

      logger.info('Payment method verification completed', {
        userId,
        paymentMethodId,
        isVerified,
        requiresAdditionalVerification,
        errorsCount: errors.length,
      });

      return {
        isVerified,
        verificationId,
        errors,
        requiresAdditionalVerification,
      };
    } catch (error) {
      logger.error('Payment method verification failed', {
        error,
        userId,
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * Validate payment method security
   */
  async validatePaymentMethodSecurity(
    paymentMethod: PaymentMethod,
    context: PaymentSecurityContext
  ): Promise<PaymentMethodValidationResult> {
    try {
      logger.info('Validating payment method security', {
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
      });

      const errors: string[] = [];
      const warnings: string[] = [];
      let securityScore = 100;

      // Check if payment method is verified
      if (!paymentMethod.isVerified) {
        errors.push('Payment method is not verified');
        securityScore -= 50;
      }

      // Check payment method age
      const methodAge = Date.now() - paymentMethod.createdAt.getTime();
      const methodAgeDays = methodAge / (1000 * 60 * 60 * 24);

      if (methodAgeDays < 1) {
        warnings.push('Payment method was added recently');
        securityScore -= 10;
      }

      // Type-specific security checks
      switch (paymentMethod.type) {
        case 'credit_card':
          securityScore -= (await this.validateCreditCardSecurity(
            paymentMethod,
            errors,
            warnings
          )) as number;
          break;
        case 'bank_transfer':
          securityScore -= await this.validateBankTransferSecurity(
            paymentMethod,
            errors,
            warnings
          );
          break;
        case 'digital_wallet':
          securityScore -= await this.validateDigitalWalletSecurity(
            paymentMethod,
            errors,
            warnings
          );
          break;
      }

      // Check for suspicious activity
      const fraudResult = await this.checkPaymentMethodFraud(
        paymentMethod,
        context
      );
      if (fraudResult.isSuspicious) {
        warnings.push('Payment method flagged for suspicious activity');
        securityScore -= fraudResult.riskScore / 2; // Reduce impact on security score
      }

      securityScore = Math.max(0, securityScore);

      const isValid = errors.length === 0 && securityScore >= 50;

      logger.info('Payment method security validation completed', {
        paymentMethodId: paymentMethod.id,
        isValid,
        securityScore,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      });

      return {
        isValid,
        errors,
        warnings,
        securityScore,
      };
    } catch (error) {
      logger.error('Payment method security validation failed', {
        error,
        paymentMethod,
      });
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   */
  private encryptData(data: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(
        this.ENCRYPTION_ALGORITHM,
        this.encryptionKey
      );

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Data encryption failed', { error });
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   */
  private decryptData(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      const decipher = crypto.createDecipher(
        this.ENCRYPTION_ALGORITHM,
        this.encryptionKey
      );

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Data decryption failed', { error });
      throw error;
    }
  }

  /**
   * Create masked version of sensitive data for display
   */
  private maskSensitiveData(
    type: PaymentMethodType,
    data: Record<string, any>
  ): string {
    switch (type) {
      case 'credit_card':
        const cardNumber = data.cardNumber || '';
        return `****-****-****-${cardNumber.slice(-4)}`;

      case 'bank_transfer':
        const accountNumber = data.accountNumber || '';
        return `****${accountNumber.slice(-4)}`;

      case 'digital_wallet':
        const walletId = data.walletId || '';
        return `${walletId.slice(0, 4)}****${walletId.slice(-4)}`;

      default:
        return '****';
    }
  }

  /**
   * Verify payment method based on type
   */
  private async verifyPaymentMethodType(
    paymentMethod: PaymentMethod,
    verificationData: Record<string, any>
  ): Promise<PaymentMethodValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityScore = 100;

    switch (paymentMethod.type) {
      case 'credit_card':
        // Verify CVV, expiry date, etc.
        if (!verificationData.cvv || verificationData.cvv.length < 3) {
          errors.push('Invalid CVV provided');
          securityScore -= 30;
        }

        if (!verificationData.expiryDate) {
          errors.push('Expiry date required for verification');
          securityScore -= 20;
        }
        break;

      case 'bank_transfer':
        // Verify micro-deposits or account ownership
        if (!verificationData.microDepositAmounts) {
          errors.push('Micro-deposit verification required');
          securityScore -= 40;
        }
        break;

      case 'digital_wallet':
        // Verify wallet ownership
        if (!verificationData.walletSignature) {
          errors.push('Digital signature required for wallet verification');
          securityScore -= 35;
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityScore: Math.max(0, securityScore),
    };
  }

  /**
   * Consolidated bank transfer security validation method.
   * Supports both legacy calling pattern (with errors/warnings arrays) and enhanced pattern (with verificationData).
   * Combines comprehensive validation logic including account verification, micro-deposit validation, account number format checks, and routing number validation.
   *
   * @param paymentMethod - The payment method to validate
   * @param errorsOrVerificationData - Either errors array (legacy) or verification data object (enhanced)
   * @param warnings - Warnings array (only used in legacy mode)
   * @returns Promise<number | PaymentValidationResult> - Security deduction (legacy) or full validation result (enhanced)
   */
  private async validateBankTransferSecurity(
    paymentMethod: PaymentMethod,
    errorsOrVerificationData?: string[] | Record<string, any>,
    warnings?: string[]
  ): Promise<number | PaymentValidationResult> {
    // Determine calling pattern based on parameters
    const isLegacyCall =
      Array.isArray(errorsOrVerificationData) && Array.isArray(warnings);

    const errors: string[] = isLegacyCall
      ? (errorsOrVerificationData as string[])
      : [];
    const warningsArray: string[] = isLegacyCall ? (warnings as string[]) : [];
    const verificationData: Record<string, any> = isLegacyCall
      ? {}
      : (errorsOrVerificationData as Record<string, any>) || {};

    let securityDeduction = 0;

    // Legacy validation: Check if account is verified from metadata
    if (!paymentMethod.metadata.accountVerified) {
      warningsArray.push('Bank account verification pending');
      securityDeduction += 20;
    }

    // Enhanced validation: Validate micro-deposits
    if (verificationData.microDepositAmounts) {
      const microDepositValidation = this.validateMicroDeposits(
        verificationData.microDepositAmounts
      );
      if (!microDepositValidation.isValid) {
        errors.push(...microDepositValidation.errors);
        securityDeduction += 30;
      }
    }

    // Enhanced validation: Validate account number format
    if (verificationData.accountNumber) {
      const accountValidation = this.validateBankAccountNumber(
        verificationData.accountNumber
      );
      if (!accountValidation.isValid) {
        warningsArray.push(...accountValidation.errors);
        securityDeduction += 10;
      }
    }

    // Enhanced validation: Validate routing number
    if (verificationData.routingNumber) {
      const routingValidation = this.validateRoutingNumber(
        verificationData.routingNumber
      );
      if (!routingValidation.isValid) {
        errors.push(...routingValidation.errors);
        securityDeduction += 25;
      }
    }

    // Enhanced validation: Check verification status from verification data
    if (verificationData.verificationStatus) {
      if (verificationData.verificationStatus !== 'verified') {
        if (verificationData.verificationStatus === 'pending') {
          warningsArray.push('Bank account verification is pending');
          securityDeduction += 15;
        } else if (verificationData.verificationStatus === 'failed') {
          errors.push('Bank account verification failed');
          securityDeduction += 40;
        }
      }
    }

    // Return appropriate format based on calling pattern
    if (isLegacyCall) {
      return securityDeduction;
    } else {
      return {
        errors,
        warnings: warningsArray,
        securityDeduction,
      } as PaymentValidationResult;
    }
  }

  /**
   * Consolidated digital wallet security validation method.
   * Supports both legacy calling pattern (with errors/warnings arrays) and enhanced pattern (with verificationData).
   * Combines comprehensive validation logic including provider validation, wallet ID format checks, and provider-specific requirements.
   *
   * @param paymentMethod - The payment method to validate
   * @param errorsOrVerificationData - Either errors array (legacy) or verification data object (enhanced)
   * @param warnings - Warnings array (only used in legacy mode)
   * @returns Promise<number | PaymentValidationResult> - Security deduction (legacy) or full validation result (enhanced)
   */
  private async validateDigitalWalletSecurity(
    paymentMethod: PaymentMethod,
    errorsOrVerificationData?: string[] | Record<string, any>,
    warnings?: string[]
  ): Promise<number | PaymentValidationResult> {
    // Determine calling pattern based on parameters
    const isLegacyCall =
      Array.isArray(errorsOrVerificationData) && Array.isArray(warnings);

    const errors: string[] = isLegacyCall
      ? (errorsOrVerificationData as string[])
      : [];
    const warningsArray: string[] = isLegacyCall ? (warnings as string[]) : [];
    const verificationData: Record<string, any> = isLegacyCall
      ? {}
      : (errorsOrVerificationData as Record<string, any>) || {};

    let securityDeduction = 0;

    // Legacy validation: Check wallet provider from metadata
    const provider = paymentMethod.metadata.provider;
    const trustedProviders = ['paypal', 'apple_pay', 'google_pay'];

    if (!trustedProviders.includes(provider?.toLowerCase())) {
      warningsArray.push('Unknown or untrusted wallet provider');
      securityDeduction += 25;
    }

    // Enhanced validation: Validate wallet provider from verification data
    if (verificationData.provider) {
      const providerValidation = this.validateWalletProvider(
        verificationData.provider
      );
      if (!providerValidation.isValid) {
        warningsArray.push(...providerValidation.errors);
        securityDeduction += 15;
      }

      // Additional provider-specific security checks
      const providerSecurityCheck = this.validateProviderSpecificRequirements(
        verificationData.provider,
        verificationData
      );
      if (!providerSecurityCheck.isValid) {
        warningsArray.push(...providerSecurityCheck.warnings);
        errors.push(...providerSecurityCheck.errors);
        securityDeduction += providerSecurityCheck.securityDeduction;
      }
    }

    // Enhanced validation: Validate wallet ID format
    if (verificationData.walletId) {
      const walletIdValidation = this.validateWalletId(
        verificationData.walletId,
        verificationData.provider
      );
      if (!walletIdValidation.isValid) {
        errors.push(...walletIdValidation.errors);
        securityDeduction += 20;
      }
    }

    // Enhanced validation: Validate wallet verification status
    if (verificationData.verificationStatus) {
      if (verificationData.verificationStatus !== 'verified') {
        if (verificationData.verificationStatus === 'pending') {
          warningsArray.push('Digital wallet verification is pending');
          securityDeduction += 10;
        } else if (verificationData.verificationStatus === 'failed') {
          errors.push('Digital wallet verification failed');
          securityDeduction += 30;
        } else if (verificationData.verificationStatus === 'limited') {
          warningsArray.push('Digital wallet has limited verification status');
          securityDeduction += 15;
        }
      }
    }

    // Enhanced validation: Check wallet balance and transaction limits
    if (verificationData.walletBalance !== undefined) {
      if (verificationData.walletBalance < 0) {
        errors.push('Digital wallet has negative balance');
        securityDeduction += 25;
      } else if (verificationData.walletBalance === 0) {
        warningsArray.push('Digital wallet has zero balance');
        securityDeduction += 5;
      }
    }

    // Enhanced validation: Check transaction limits
    if (verificationData.transactionLimits) {
      const limitsValidation = this.validateWalletTransactionLimits(
        verificationData.transactionLimits,
        verificationData.provider
      );
      if (!limitsValidation.isValid) {
        warningsArray.push(...limitsValidation.warnings);
        securityDeduction += limitsValidation.securityDeduction;
      }
    }

    // Enhanced validation: Validate wallet signature for ownership verification
    if (verificationData.walletSignature) {
      const signatureValidation = this.validateWalletSignature(
        verificationData.walletSignature,
        verificationData.walletId,
        verificationData.provider
      );
      if (!signatureValidation.isValid) {
        errors.push(...signatureValidation.errors);
        securityDeduction += 35;
      }
    } else if (!isLegacyCall) {
      // Only require signature for enhanced validation
      warningsArray.push(
        'Digital wallet signature not provided for verification'
      );
      securityDeduction += 10;
    }

    // Enhanced validation: Check for suspicious wallet activity patterns
    if (verificationData.recentTransactions) {
      const activityValidation = this.validateWalletActivityPattern(
        verificationData.recentTransactions,
        verificationData.provider
      );
      if (!activityValidation.isValid) {
        warningsArray.push(...activityValidation.warnings);
        securityDeduction += activityValidation.securityDeduction;
      }
    }

    // Return appropriate format based on calling pattern
    if (isLegacyCall) {
      return securityDeduction;
    } else {
      return {
        errors,
        warnings: warningsArray,
        securityDeduction,
      } as PaymentValidationResult;
    }
  }

  /**
   * Check for fraud patterns in payment method usage
   */
  private async checkPaymentMethodFraud(
    paymentMethod: PaymentMethod,
    context: PaymentSecurityContext
  ): Promise<FraudDetectionResult> {
    // Create a mock payment request for fraud detection
    const mockRequest = {
      amount: 100, // Use average amount for checking
      currency: 'USD',
      payerId: paymentMethod.userId,
      recipientId: 'mock',
      paymentMethodId: paymentMethod.id,
      swapId: 'mock',
      proposalId: 'mock',
      escrowRequired: false,
    };

    return await this.fraudDetectionService.detectFraud(context, mockRequest);
  }

  /**
   * Record verification attempt on blockchain
   */
  private async recordVerificationAttempt(
    userId: string,
    paymentMethodId: string,
    verificationId: string,
    success: boolean
  ): Promise<void> {
    try {
      // This would record the verification attempt on blockchain
      // For now, just log it
      logger.info('Verification attempt recorded', {
        userId,
        paymentMethodId,
        verificationId,
        success,
      });
    } catch (error) {
      logger.error('Failed to record verification attempt', { error });
      // Don't throw - verification can continue without blockchain recording
    }
  }

  /**
   * Enhanced payment method validation with comprehensive security checks
   */
  async validatePaymentMethodWithEnhancedSecurity(
    paymentMethod: PaymentMethod,
    verificationData: Record<string, any>,
    context: PaymentSecurityContext
  ): Promise<PaymentMethodValidationResult> {
    try {
      logger.info('Enhanced payment method validation started', {
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
      });

      const errors: string[] = [];
      const warnings: string[] = [];
      let securityScore = 100;

      // Basic verification checks
      const basicValidation = await this.verifyPaymentMethodType(
        paymentMethod,
        verificationData
      );
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);
      securityScore = Math.min(securityScore, basicValidation.securityScore);

      // Enhanced security validations
      switch (paymentMethod.type) {
        case 'credit_card':
          const ccValidation = (await this.validateCreditCardSecurity(
            paymentMethod,
            verificationData
          )) as PaymentValidationResult;
          errors.push(...ccValidation.errors);
          warnings.push(...ccValidation.warnings);
          securityScore -= ccValidation.securityDeduction;
          break;

        case 'bank_transfer':
          const bankValidation = (await this.validateBankTransferSecurity(
            paymentMethod,
            verificationData
          )) as PaymentValidationResult;
          errors.push(...bankValidation.errors);
          warnings.push(...bankValidation.warnings);
          securityScore -= bankValidation.securityDeduction;
          break;

        case 'digital_wallet':
          const walletValidation = (await this.validateDigitalWalletSecurity(
            paymentMethod,
            verificationData
          )) as PaymentValidationResult;
          errors.push(...walletValidation.errors);
          warnings.push(...walletValidation.warnings);
          securityScore -= walletValidation.securityDeduction;
          break;
      }

      // Context-based security checks
      const contextValidation = await this.validateSecurityContext(
        context,
        paymentMethod
      );
      warnings.push(...contextValidation.warnings);
      securityScore -= contextValidation.securityDeduction;

      // PCI compliance validation
      const pciValidation = this.validatePCICompliance(verificationData);
      if (!pciValidation.isCompliant) {
        errors.push(...pciValidation.violations);
        securityScore -= 20;
      }

      securityScore = Math.max(0, securityScore);

      logger.info('Enhanced payment method validation completed', {
        paymentMethodId: paymentMethod.id,
        securityScore,
        errorsCount: errors.length,
        warningsCount: warnings.length,
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        securityScore,
      };
    } catch (error) {
      logger.error('Enhanced payment method validation failed', {
        error,
        paymentMethod,
      });
      throw error;
    }
  }

  /**
   * Consolidated credit card security validation method.
   * Supports both legacy calling pattern (with errors/warnings arrays) and enhanced pattern (with verificationData).
   * Combines comprehensive validation logic including Luhn algorithm, expiry date checks, CVV validation, and card type restrictions.
   *
   * @param paymentMethod - The payment method to validate
   * @param errorsOrVerificationData - Either errors array (legacy) or verification data object (enhanced)
   * @param warnings - Warnings array (only used in legacy mode)
   * @returns Promise<number | PaymentValidationResult> - Security deduction (legacy) or full validation result (enhanced)
   */
  private async validateCreditCardSecurity(
    paymentMethod: PaymentMethod,
    errorsOrVerificationData?: string[] | Record<string, any>,
    warnings?: string[]
  ): Promise<number | PaymentValidationResult> {
    // Determine calling pattern based on parameters
    const isLegacyCall =
      Array.isArray(errorsOrVerificationData) && Array.isArray(warnings);

    const errors: string[] = isLegacyCall
      ? (errorsOrVerificationData as string[])
      : [];
    const warningsArray: string[] = isLegacyCall ? (warnings as string[]) : [];
    const verificationData: Record<string, any> = isLegacyCall
      ? {}
      : (errorsOrVerificationData as Record<string, any>) || {};

    let securityDeduction = 0;

    // Enhanced validation: Validate card number format using Luhn algorithm
    if (verificationData.cardNumber) {
      const cardValidation = this.validateCreditCardNumber(
        verificationData.cardNumber
      );
      if (!cardValidation.isValid) {
        errors.push(...cardValidation.errors);
        securityDeduction += 40;
      }
    }

    // Enhanced validation: Validate expiry date from verification data
    if (verificationData.expiryDate) {
      const expiryValidation = this.validateCreditCardExpiry(
        verificationData.expiryDate
      );
      if (!expiryValidation.isValid) {
        errors.push(...expiryValidation.errors);
        securityDeduction += 25;
      }
    }

    // Legacy validation: Check if card is expired from metadata
    if (paymentMethod.metadata.expiryDate && !verificationData.expiryDate) {
      const expiryDate = new Date(paymentMethod.metadata.expiryDate);
      if (expiryDate < new Date()) {
        errors.push('Credit card has expired');
        securityDeduction += 50;
      }
    }

    // Enhanced validation: Validate CVV format
    if (verificationData.cvv) {
      if (!/^\d{3,4}$/.test(verificationData.cvv)) {
        errors.push('CVV must be 3 or 4 digits');
        securityDeduction += 20;
      }
    }

    // Combined validation: Check card type restrictions (enhanced logic with legacy fallback)
    const cardType = paymentMethod.metadata.cardType;
    if (cardType) {
      const restrictedTypes = ['prepaid', 'gift', 'virtual'];
      if (restrictedTypes.includes(cardType.toLowerCase())) {
        if (isLegacyCall) {
          warningsArray.push('Prepaid/gift cards have higher risk');
        } else {
          warningsArray.push('Card type has higher risk profile');
        }
        securityDeduction += 15;
      }
    }

    // Return appropriate format based on calling pattern
    if (isLegacyCall) {
      return securityDeduction;
    } else {
      return {
        errors,
        warnings: warningsArray,
        securityDeduction,
      } as PaymentValidationResult;
    }
  }

  /**
   * Validate security context
   */
  private async validateSecurityContext(
    context: PaymentSecurityContext,
    paymentMethod: PaymentMethod
  ): Promise<{ warnings: string[]; securityDeduction: number }> {
    const warnings: string[] = [];
    let securityDeduction = 0;

    // Validate IP address
    if (context.ipAddress) {
      const ipValidation = await this.validateVerificationIP(context.ipAddress);
      if (!ipValidation.isValid) {
        warnings.push(...ipValidation.errors);
        securityDeduction += 10;
      }
    }

    // Check device fingerprint consistency
    if (
      context.deviceFingerprint &&
      paymentMethod.metadata.lastDeviceFingerprint
    ) {
      if (
        context.deviceFingerprint !==
        paymentMethod.metadata.lastDeviceFingerprint
      ) {
        warnings.push('Payment method accessed from new device');
        securityDeduction += 5;
      }
    }

    // Check account age
    if (context.accountAge < 7) {
      warnings.push('Account is very new (less than 7 days)');
      securityDeduction += 15;
    } else if (context.accountAge < 30) {
      warnings.push('Account is relatively new (less than 30 days)');
      securityDeduction += 5;
    }

    return { warnings, securityDeduction };
  }

  /**
   * Validate PCI compliance requirements
   */
  private validatePCICompliance(verificationData: Record<string, any>): {
    isCompliant: boolean;
    violations: string[];
    recommendations: string[];
  } {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check for sensitive data that shouldn't be transmitted
    if (
      verificationData.fullCardNumber &&
      verificationData.fullCardNumber.length > 6
    ) {
      violations.push(
        'Full card number should not be transmitted for verification'
      );
      recommendations.push('Use tokenized card data instead');
    }

    if (verificationData.cvv && verificationData.storeData) {
      violations.push('CVV should never be stored');
      recommendations.push('Remove CVV from stored data');
    }

    // Check for proper encryption indicators
    if (verificationData.cardNumber && !verificationData.encrypted) {
      violations.push('Sensitive data should be encrypted in transit');
      recommendations.push('Implement end-to-end encryption');
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      recommendations,
    };
  }

  /**
   * Validate credit card number using Luhn algorithm
   */
  private validateCreditCardNumber(cardNumber: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const cleaned = cardNumber.replace(/\D/g, '');

    if (cleaned.length < 13 || cleaned.length > 19) {
      errors.push('Credit card number must be between 13 and 19 digits');
      return { isValid: false, errors };
    }

    // Luhn algorithm validation
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    if (sum % 10 !== 0) {
      errors.push('Invalid credit card number (failed Luhn check)');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate credit card expiry date
   */
  private validateCreditCardExpiry(expiryDate: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!expiryDate.match(/^\d{2}\/\d{2}$/)) {
      errors.push('Expiry date must be in MM/YY format');
      return { isValid: false, errors };
    }

    const [month, year] = expiryDate.split('/').map(num => parseInt(num, 10));

    if (month < 1 || month > 12) {
      errors.push('Invalid expiry month');
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      errors.push('Credit card has expired');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate micro-deposit amounts
   */
  private validateMicroDeposits(microDepositAmounts: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      const amounts = microDepositAmounts
        .split(',')
        .map(amount => parseFloat(amount.trim()));

      if (amounts.length !== 2) {
        errors.push('Exactly two micro-deposit amounts are required');
      }

      amounts.forEach((amount, index) => {
        if (isNaN(amount) || amount <= 0 || amount > 1) {
          errors.push(
            `Invalid micro-deposit amount ${index + 1}: must be between $0.01 and $1.00`
          );
        }
      });
    } catch (error) {
      errors.push('Invalid micro-deposit format');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate bank account number format
   */
  private validateBankAccountNumber(accountNumber: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const cleaned = accountNumber.replace(/\D/g, '');

    if (cleaned.length < 8 || cleaned.length > 17) {
      errors.push('Bank account number must be between 8 and 17 digits');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate routing number
   */
  private validateRoutingNumber(routingNumber: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const cleaned = routingNumber.replace(/\D/g, '');

    if (cleaned.length !== 9) {
      errors.push('Routing number must be exactly 9 digits');
      return { isValid: false, errors };
    }

    // ABA routing number checksum validation
    const digits = cleaned.split('').map(d => parseInt(d, 10));
    const checksum =
      (3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        (digits[2] + digits[5] + digits[8])) %
      10;

    if (checksum !== 0) {
      errors.push('Invalid routing number (failed checksum validation)');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate wallet provider with comprehensive trust and security checks
   */
  private validateWalletProvider(provider: string): {
    isValid: boolean;
    errors: string[];
  } {
    const trustedProviders = [
      'paypal',
      'apple_pay',
      'google_pay',
      'venmo',
      'cashapp',
      'zelle',
      'samsung_pay',
      'amazon_pay',
    ];

    const highRiskProviders = ['unknown_wallet', 'test_wallet', 'demo_wallet'];

    const providerLower = provider.toLowerCase();

    if (highRiskProviders.includes(providerLower)) {
      return {
        isValid: false,
        errors: ['High-risk wallet provider detected'],
      };
    }

    const isValid = trustedProviders.includes(providerLower);

    return {
      isValid,
      errors: isValid ? [] : ['Untrusted wallet provider'],
    };
  }

  /**
   * Validate wallet ID format with provider-specific rules
   */
  private validateWalletId(
    walletId: string,
    provider: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!walletId || walletId.trim().length === 0) {
      errors.push('Wallet ID is required');
      return { isValid: false, errors };
    }

    const trimmedId = walletId.trim();

    switch (provider?.toLowerCase()) {
      case 'paypal':
        // PayPal uses email addresses
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedId)) {
          errors.push('PayPal wallet ID must be a valid email address');
        }
        break;

      case 'venmo':
        // Venmo uses usernames or phone numbers
        if (
          !/^@?[a-zA-Z0-9_-]+$/.test(trimmedId) &&
          !/^\+?1?[0-9]{10}$/.test(trimmedId)
        ) {
          errors.push(
            'Venmo wallet ID must be a valid username or phone number'
          );
        }
        break;

      case 'cashapp':
        // Cash App uses $cashtags or phone numbers
        if (
          !/^\$[a-zA-Z0-9_-]+$/.test(trimmedId) &&
          !/^\+?1?[0-9]{10}$/.test(trimmedId)
        ) {
          errors.push(
            'Cash App wallet ID must be a valid $cashtag or phone number'
          );
        }
        break;

      case 'zelle':
        // Zelle uses email addresses or phone numbers
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedId) &&
          !/^\+?1?[0-9]{10}$/.test(trimmedId)
        ) {
          errors.push(
            'Zelle wallet ID must be a valid email address or phone number'
          );
        }
        break;

      case 'apple_pay':
      case 'google_pay':
      case 'samsung_pay':
        // Digital wallet providers use device-specific identifiers
        if (!/^[a-zA-Z0-9_-]{8,64}$/.test(trimmedId)) {
          errors.push(
            'Digital wallet ID must be 8-64 characters of alphanumeric characters, underscores, or hyphens'
          );
        }
        break;

      case 'amazon_pay':
        // Amazon Pay uses email addresses
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedId)) {
          errors.push('Amazon Pay wallet ID must be a valid email address');
        }
        break;

      default:
        // Generic validation for other providers
        if (trimmedId.length < 3) {
          errors.push('Wallet ID is too short (minimum 3 characters)');
        }
        if (trimmedId.length > 100) {
          errors.push('Wallet ID is too long (maximum 100 characters)');
        }
        // Check for suspicious patterns
        if (/[<>"'&]/.test(trimmedId)) {
          errors.push('Wallet ID contains invalid characters');
        }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate verification IP address
   */
  private async validateVerificationIP(
    ipAddress: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for private IP ranges (shouldn't be used for verification)
    const privateRanges = [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^127\./,
    ];

    if (privateRanges.some(range => range.test(ipAddress))) {
      errors.push('Verification cannot be performed from private IP address');
    }

    // Basic IPv4 format validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ipAddress)) {
      errors.push('Invalid IP address format');
    } else {
      // Validate IP address ranges
      const octets = ipAddress.split('.').map(octet => parseInt(octet, 10));
      if (octets.some(octet => octet < 0 || octet > 255)) {
        errors.push('Invalid IP address range');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate provider-specific security requirements
   */
  private validateProviderSpecificRequirements(
    provider: string,
    verificationData: Record<string, any>
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    securityDeduction: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let securityDeduction = 0;

    switch (provider?.toLowerCase()) {
      case 'paypal':
        // PayPal requires account verification
        if (!verificationData.accountVerified) {
          warnings.push('PayPal account verification recommended');
          securityDeduction += 5;
        }
        // Check for business vs personal account
        if (
          verificationData.accountType === 'business' &&
          !verificationData.businessVerified
        ) {
          warnings.push('PayPal business account not verified');
          securityDeduction += 10;
        }
        break;

      case 'venmo':
        // Venmo has transaction limits for unverified accounts
        if (!verificationData.identityVerified) {
          warnings.push(
            'Venmo identity verification recommended for higher limits'
          );
          securityDeduction += 8;
        }
        break;

      case 'cashapp':
        // Cash App requires identity verification for higher limits
        if (!verificationData.identityVerified) {
          warnings.push(
            'Cash App identity verification required for full functionality'
          );
          securityDeduction += 12;
        }
        break;

      case 'apple_pay':
      case 'google_pay':
      case 'samsung_pay':
        // Device-based wallets require device authentication
        if (!verificationData.deviceAuthenticated) {
          errors.push('Device authentication required for digital wallet');
          securityDeduction += 20;
        }
        break;

      default:
        // Generic requirements for unknown providers
        if (!verificationData.basicVerification) {
          warnings.push('Basic wallet verification recommended');
          securityDeduction += 5;
        }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityDeduction,
    };
  }

  /**
   * Validate wallet transaction limits
   */
  private validateWalletTransactionLimits(
    limits: Record<string, any>,
    provider: string
  ): { isValid: boolean; warnings: string[]; securityDeduction: number } {
    const warnings: string[] = [];
    let securityDeduction = 0;

    // Check daily limits
    if (limits.dailyLimit !== undefined) {
      if (limits.dailyLimit < 100) {
        warnings.push(
          'Very low daily transaction limit may indicate restricted account'
        );
        securityDeduction += 5;
      } else if (limits.dailyLimit > 10000) {
        warnings.push(
          'Very high daily limit may require additional verification'
        );
        securityDeduction += 3;
      }
    }

    // Check monthly limits
    if (limits.monthlyLimit !== undefined) {
      if (limits.monthlyLimit < 500) {
        warnings.push('Low monthly transaction limit detected');
        securityDeduction += 3;
      }
    }

    // Provider-specific limit validation
    switch (provider?.toLowerCase()) {
      case 'venmo':
        if (limits.weeklyLimit && limits.weeklyLimit < 300) {
          warnings.push('Venmo weekly limit suggests unverified account');
          securityDeduction += 8;
        }
        break;

      case 'cashapp':
        if (limits.dailyLimit && limits.dailyLimit < 250) {
          warnings.push('Cash App daily limit suggests unverified account');
          securityDeduction += 10;
        }
        break;
    }

    return {
      isValid: true, // Limits don't invalidate, just add warnings
      warnings,
      securityDeduction,
    };
  }

  /**
   * Validate wallet signature for ownership verification
   */
  private validateWalletSignature(
    signature: string,
    walletId: string,
    provider: string
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!signature || signature.trim().length === 0) {
      errors.push('Wallet signature is required');
      return { isValid: false, errors };
    }

    // Basic signature format validation
    switch (provider?.toLowerCase()) {
      case 'paypal':
        // PayPal uses OAuth tokens or API signatures
        if (!/^[A-Za-z0-9+/=]{20,}$/.test(signature)) {
          errors.push('Invalid PayPal signature format');
        }
        break;

      case 'apple_pay':
      case 'google_pay':
      case 'samsung_pay':
        // Digital wallets use cryptographic signatures
        if (!/^[A-Fa-f0-9]{64,}$/.test(signature)) {
          errors.push('Invalid digital wallet signature format');
        }
        break;

      default:
        // Generic signature validation
        if (signature.length < 16) {
          errors.push('Wallet signature is too short');
        }
        if (!/^[A-Za-z0-9+/=_-]+$/.test(signature)) {
          errors.push('Wallet signature contains invalid characters');
        }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate wallet activity patterns for suspicious behavior
   */
  private validateWalletActivityPattern(
    recentTransactions: any[],
    _provider: string
  ): { isValid: boolean; warnings: string[]; securityDeduction: number } {
    const warnings: string[] = [];
    let securityDeduction = 0;

    if (!Array.isArray(recentTransactions)) {
      return { isValid: true, warnings: [], securityDeduction: 0 };
    }

    // Check transaction frequency
    const transactionCount = recentTransactions.length;
    if (transactionCount > 50) {
      warnings.push('High transaction frequency detected');
      securityDeduction += 5;
    }

    // Check for unusual patterns
    const amounts = recentTransactions
      .map(tx => tx.amount)
      .filter(amount => typeof amount === 'number');
    if (amounts.length > 0) {
      const maxAmount = Math.max(...amounts);

      // Check for round number patterns (potential money laundering)
      const roundAmounts = amounts.filter(amount => amount % 100 === 0);
      if (roundAmounts.length > amounts.length * 0.8) {
        warnings.push(
          'Unusual pattern: high frequency of round-number transactions'
        );
        securityDeduction += 8;
      }

      // Check for very high amounts
      if (maxAmount > 5000) {
        warnings.push('High-value transactions detected');
        securityDeduction += 3;
      }

      // Check for rapid succession transactions
      const timestamps = recentTransactions
        .map(tx => new Date(tx.timestamp))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (timestamps.length > 1) {
        const rapidTransactions = timestamps.filter((timestamp, index) => {
          if (index === 0) return false;
          const timeDiff =
            timestamp.getTime() - timestamps[index - 1].getTime();
          return timeDiff < 60000; // Less than 1 minute apart
        });

        if (rapidTransactions.length > 5) {
          warnings.push('Multiple rapid transactions detected');
          securityDeduction += 10;
        }
      }
    }

    return {
      isValid: true, // Activity patterns don't invalidate, just add warnings
      warnings,
      securityDeduction,
    };
  }
}
