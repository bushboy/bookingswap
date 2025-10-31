import {
  PaymentSecurityContext,
  FraudDetectionResult,
  PaymentRequest,
} from '@booking-swap/shared';
import axios from 'axios';

class PaymentSecurityService {
  private baseURL: string;
  private axiosInstance: any;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  /**
   * Validate payment method security
   */
  async validatePaymentSecurity(
    paymentMethodId: string,
    context: PaymentSecurityContext
  ): Promise<{
    isValid: boolean;
    securityScore: number;
    warnings: string[];
    requiresVerification: boolean;
  }> {
    try {
      const response = await this.axiosInstance.post('/payments/security/validate', {
        paymentMethodId,
        context,
      });
      return response.data;
    } catch (error) {
      console.error('Payment security validation failed:', error);
      throw new Error('Failed to validate payment security');
    }
  }

  /**
   * Perform fraud detection on payment request
   */
  async detectFraud(
    context: PaymentSecurityContext,
    paymentRequest: PaymentRequest
  ): Promise<FraudDetectionResult> {
    try {
      const response = await this.axiosInstance.post(
        '/payments/security/fraud-detection',
        {
          context,
          paymentRequest,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Fraud detection failed:', error);

      // Return high-risk result on error
      return {
        isSuspicious: true,
        riskScore: 100,
        flags: ['fraud_detection_error'],
        recommendedAction: 'reject',
      };
    }
  }

  /**
   * Verify payment method with additional security checks
   */
  async verifyPaymentMethodSecurity(
    paymentMethodId: string,
    verificationData: Record<string, any>
  ): Promise<{
    isVerified: boolean;
    verificationId: string;
    errors: string[];
    requiresAdditionalVerification: boolean;
  }> {
    try {
      const response = await this.axiosInstance.post(
        `/payments/security/verify/${paymentMethodId}`,
        verificationData
      );
      return response.data;
    } catch (error) {
      console.error('Payment method security verification failed:', error);
      throw new Error('Failed to verify payment method security');
    }
  }

  /**
   * Get security recommendations for a payment
   */
  async getSecurityRecommendations(
    paymentRequest: PaymentRequest,
    context: PaymentSecurityContext
  ): Promise<{
    recommendations: string[];
    requiredActions: string[];
    escrowRecommended: boolean;
    additionalVerificationRequired: boolean;
  }> {
    try {
      const response = await this.axiosInstance.post(
        '/payments/security/recommendations',
        {
          paymentRequest,
          context,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get security recommendations:', error);

      // Return safe defaults
      return {
        recommendations: ['Use escrow protection', 'Verify payment method'],
        requiredActions: ['Additional verification required'],
        escrowRecommended: true,
        additionalVerificationRequired: true,
      };
    }
  }

  /**
   * Report suspicious activity
   */
  async reportSuspiciousActivity(
    paymentMethodId: string,
    activityType: string,
    description: string,
    evidence?: Record<string, any>
  ): Promise<{ reportId: string; status: string }> {
    try {
      const response = await this.axiosInstance.post('/payments/security/report', {
        paymentMethodId,
        activityType,
        description,
        evidence,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to report suspicious activity:', error);
      throw new Error('Failed to report suspicious activity');
    }
  }

  /**
   * Get payment security metrics for user
   */
  async getSecurityMetrics(userId: string): Promise<{
    trustScore: number;
    verifiedMethods: number;
    totalTransactions: number;
    successfulTransactions: number;
    flaggedTransactions: number;
    lastSecurityCheck: Date;
  }> {
    try {
      const response = await this.axiosInstance.get(
        `/payments/security/metrics/${userId}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get security metrics:', error);
      throw new Error('Failed to get security metrics');
    }
  }

  /**
   * Validate PCI compliance requirements
   */
  async validatePCICompliance(paymentData: Record<string, any>): Promise<{
    isCompliant: boolean;
    violations: string[];
    recommendations: string[];
  }> {
    // Client-side PCI compliance checks
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check for sensitive data in client-side storage
    if (this.checkLocalStorageForSensitiveData()) {
      violations.push('Sensitive payment data found in local storage');
      recommendations.push('Remove sensitive data from client-side storage');
    }

    // Check for unencrypted transmission
    if (window.location.protocol !== 'https:') {
      violations.push('Payment data transmitted over insecure connection');
      recommendations.push('Use HTTPS for all payment transactions');
    }

    // Check for proper form field security
    if (this.checkFormFieldSecurity()) {
      violations.push('Payment form fields not properly secured');
      recommendations.push(
        'Implement proper form field masking and validation'
      );
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      recommendations,
    };
  }

  /**
   * Encrypt sensitive data for transmission
   */
  async encryptSensitiveData(data: Record<string, any>): Promise<string> {
    try {
      // In a real implementation, this would use Web Crypto API
      // For now, we'll use a simple base64 encoding as placeholder
      const jsonString = JSON.stringify(data);
      return btoa(jsonString);
    } catch (error) {
      console.error('Failed to encrypt sensitive data:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Generate secure payment token
   */
  async generatePaymentToken(
    paymentMethodData: Record<string, any>
  ): Promise<{ token: string; expiresAt: Date }> {
    try {
      const response = await this.axiosInstance.post('/payments/security/tokenize', {
        paymentMethodData,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to generate payment token:', error);
      throw new Error('Failed to generate payment token');
    }
  }

  /**
   * Check local storage for sensitive payment data
   */
  private checkLocalStorageForSensitiveData(): boolean {
    const sensitiveKeys = [
      'cardNumber',
      'cvv',
      'accountNumber',
      'routingNumber',
      'pin',
      'password',
      'ssn',
      'bankAccount',
    ];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            const lowerKey = key.toLowerCase();
            const lowerValue = value.toLowerCase();

            if (
              sensitiveKeys.some(
                sensitiveKey =>
                  lowerKey.includes(sensitiveKey) ||
                  lowerValue.includes(sensitiveKey)
              )
            ) {
              return true;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not check local storage:', error);
    }

    return false;
  }

  /**
   * Check form field security implementation
   */
  private checkFormFieldSecurity(): boolean {
    const paymentInputs = document.querySelectorAll(
      'input[type="text"][name*="card"], input[type="text"][name*="cvv"], ' +
        'input[type="text"][name*="account"], input[type="password"]'
    );

    for (const input of paymentInputs) {
      const element = input as HTMLInputElement;

      // Check if autocomplete is properly disabled for sensitive fields
      if (!element.autocomplete || element.autocomplete !== 'off') {
        return true;
      }

      // Check if input has proper security attributes
      if (
        !element.hasAttribute('data-encrypted') &&
        !element.hasAttribute('data-tokenized')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clear sensitive data from memory and DOM
   */
  clearSensitiveData(): void {
    // Clear form fields
    const sensitiveInputs = document.querySelectorAll(
      'input[type="text"][name*="card"], input[type="text"][name*="cvv"], ' +
        'input[type="text"][name*="account"], input[type="password"]'
    );

    sensitiveInputs.forEach(input => {
      (input as HTMLInputElement).value = '';
    });

    // Clear any temporary variables (this would be more comprehensive in a real implementation)
    if ((window as any).paymentData) {
      delete (window as any).paymentData;
    }
  }
}

export const paymentSecurityService = new PaymentSecurityService();
