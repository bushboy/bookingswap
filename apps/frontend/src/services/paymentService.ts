import axios, { AxiosResponse } from 'axios';
import {
  PaymentRequest,
  PaymentValidation,
  PaymentMethod,
  PaymentTransaction,
  PaymentProcessingResult,
  EscrowAccount,
  EscrowRequest,
  EscrowReleaseRequest,
  EscrowCreationResult,
  PaymentReceipt,
  PaymentFees,
  RiskAssessment,
  PaymentSecurityContext,
  FraudDetectionResult,
  PaymentErrorDetails,
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Additional interfaces for enhanced functionality
export interface AddPaymentMethodRequest {
  type: 'credit_card' | 'bank_transfer' | 'digital_wallet' | 'cryptocurrency';
  displayName: string;
  metadata: Record<string, any>;
}

export interface PaymentMethodVerificationData {
  verificationCode?: string;
  microDepositAmounts?: number[];
  documentUpload?: File;
  additionalInfo?: Record<string, any>;
}

export interface DisputeRequest {
  transactionId: string;
  reason: string;
  description: string;
  evidence?: File[];
}

export interface RefundRequest {
  transactionId: string;
  reason: string;
  amount?: number; // For partial refunds
  refundToOriginalMethod?: boolean;
}

class PaymentService {
  private baseURL: string;
  private axiosInstance;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // Longer timeout for payment operations
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      config => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): SwapPlatformError {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          return new ValidationError(
            data.error?.message || 'Invalid payment request',
            data.error?.details
          );
        case 401:
          return new SwapPlatformError(
            ERROR_CODES.INVALID_TOKEN,
            'Payment authentication required',
            'authentication'
          );
        case 402:
          return new BusinessLogicError(
            'INSUFFICIENT_FUNDS',
            'Insufficient funds for payment'
          );
        case 403:
          return new SwapPlatformError(
            ERROR_CODES.ACCESS_DENIED,
            'Payment access denied',
            'authorization'
          );
        case 404:
          return new BusinessLogicError(
            'PAYMENT_NOT_FOUND',
            'Payment or payment method not found'
          );
        case 409:
          return new BusinessLogicError(
            'PAYMENT_CONFLICT',
            'Payment already processed or in progress'
          );
        case 422:
          return new ValidationError(
            'Payment validation failed',
            data.error?.details
          );
        case 429:
          return new SwapPlatformError(
            ERROR_CODES.RATE_LIMIT_EXCEEDED,
            'Too many payment requests',
            'rate_limiting',
            true
          );
        default:
          return new SwapPlatformError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            'Payment processing error',
            'server_error',
            true
          );
      }
    } else if (error.request) {
      return new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Payment network error - please check your connection',
        'integration',
        true
      );
    } else {
      return new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'Payment processing failed',
        'server_error'
      );
    }
  }
  // =============================================================================
  // PAYMENT PROCESSING
  // =============================================================================

  /**
   * Validate a payment request with comprehensive security checks
   */
  async validatePayment(paymentRequest: PaymentRequest): Promise<PaymentValidation> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { validation: PaymentValidation };
      }> = await this.axiosInstance.post('/payments/validate', paymentRequest);

      return response.data.data.validation;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process a payment with fraud detection and security validation
   */
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentProcessingResult> {
    try {
      // Validate payment before processing
      const validation = await this.validatePayment(paymentRequest);
      if (!validation.isValid) {
        throw new ValidationError('Payment validation failed', {
          errors: validation.errors,
        });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: { result: PaymentProcessingResult };
      }> = await this.axiosInstance.post('/payments/process', paymentRequest);

      return response.data.data.result;
    } catch (error) {
      throw error;
    }
  }

  // =============================================================================
  // PAYMENT METHOD MANAGEMENT
  // =============================================================================

  /**
   * Get payment methods for a user with security validation
   */
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { paymentMethods: PaymentMethod[] };
      }> = await this.axiosInstance.get(`/payments/methods/${userId}`);
      return response.data.data.paymentMethods;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add a new payment method with tokenization and verification
   */
  async addPaymentMethod(methodData: AddPaymentMethodRequest): Promise<PaymentMethod> {
    try {
      // Validate payment method data
      const validation = this.validatePaymentMethodData(methodData);
      if (!validation.isValid) {
        throw new ValidationError('Invalid payment method data', {
          errors: validation.errors,
        });
      }

      // Tokenize sensitive data before sending
      const tokenizedData = await this.tokenizeSensitiveData(methodData);

      const response: AxiosResponse<{
        success: boolean;
        data: { paymentMethod: PaymentMethod };
      }> = await this.axiosInstance.post('/payments/methods', tokenizedData);

      return response.data.data.paymentMethod;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify a payment method with additional security checks
   */
  async verifyPaymentMethod(
    paymentMethodId: string,
    verificationData: PaymentMethodVerificationData
  ): Promise<PaymentMethod> {
    try {
      let formData: FormData | PaymentMethodVerificationData = verificationData;

      // Handle file uploads for document verification
      if (verificationData.documentUpload) {
        formData = new FormData();
        Object.entries(verificationData).forEach(([key, value]) => {
          if (key !== 'documentUpload') {
            (formData as FormData).append(
              key,
              typeof value === 'object' ? JSON.stringify(value) : value
            );
          }
        });
        (formData as FormData).append('document', verificationData.documentUpload);
      }

      const response: AxiosResponse<{
        success: boolean;
        data: { paymentMethod: PaymentMethod };
      }> = await this.axiosInstance.post(
        `/payments/methods/${paymentMethodId}/verify`,
        formData,
        {
          headers: formData instanceof FormData
            ? { 'Content-Type': 'multipart/form-data' }
            : undefined,
        }
      );

      return response.data.data.paymentMethod;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/payments/methods/${paymentMethodId}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment transaction details
   */
  async getTransactionStatus(transactionId: string): Promise<PaymentTransaction> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { transaction: PaymentTransaction };
      }> = await this.axiosInstance.get(`/payments/transactions/${transactionId}`);

      return response.data.data.transaction;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all transactions for a user
   */
  async getUserTransactions(
    userId: string,
    filters?: {
      status?: string[];
      dateRange?: { start: Date; end: Date };
      limit?: number;
      offset?: number;
    }
  ): Promise<{ transactions: PaymentTransaction[]; total: number }> {
    try {
      const params: Record<string, any> = {};

      if (filters?.status) {
        params.status = filters.status.join(',');
      }
      if (filters?.dateRange) {
        params.startDate = filters.dateRange.start.toISOString();
        params.endDate = filters.dateRange.end.toISOString();
      }
      if (filters?.limit) {
        params.limit = filters.limit;
      }
      if (filters?.offset) {
        params.offset = filters.offset;
      }

      const response: AxiosResponse<{
        success: boolean;
        data: { transactions: PaymentTransaction[]; total: number };
      }> = await this.axiosInstance.get(`/payments/transactions/user/${userId}`, { params });

      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel a payment transaction
   */
  async cancelPayment(transactionId: string, reason: string): Promise<PaymentTransaction> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { transaction: PaymentTransaction };
      }> = await this.axiosInstance.post(
        `/payments/transactions/${transactionId}/cancel`,
        { reason }
      );

      return response.data.data.transaction;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Request a refund for a payment
   */
  async refundPayment(
    transactionId: string,
    refundRequest: RefundRequest
  ): Promise<PaymentTransaction> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { transaction: PaymentTransaction };
      }> = await this.axiosInstance.post(
        `/payments/transactions/${transactionId}/refund`,
        refundRequest
      );

      return response.data.data.transaction;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment fees for a given amount and payment method
   */
  async calculateFees(
    amount: number,
    currency: string,
    paymentMethodType: string,
    escrowRequired: boolean = false
  ): Promise<PaymentFees> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { fees: PaymentFees };
      }> = await this.axiosInstance.post('/payments/calculate-fees', {
        amount,
        currency,
        paymentMethodType,
        escrowRequired,
      });

      return response.data.data.fees;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate payment receipt
   */
  async generateReceipt(transactionId: string): Promise<PaymentReceipt> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { receipt: PaymentReceipt };
      }> = await this.axiosInstance.get(`/payments/transactions/${transactionId}/receipt`);

      return response.data.data.receipt;
    } catch (error) {
      throw error;
    }
  }

  // =============================================================================
  // ESCROW ACCOUNT MANAGEMENT
  // =============================================================================

  /**
   * Create an escrow account for a transaction
   */
  async createEscrow(escrowRequest: EscrowRequest): Promise<EscrowCreationResult> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { escrow: EscrowCreationResult };
      }> = await this.axiosInstance.post('/payments/escrow/create', escrowRequest);

      return response.data.data.escrow;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get escrow account details
   */
  async getEscrowAccount(escrowId: string): Promise<EscrowAccount> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { escrow: EscrowAccount };
      }> = await this.axiosInstance.get(`/payments/escrow/${escrowId}`);

      return response.data.data.escrow;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Release funds from escrow to recipient
   */
  async releaseEscrow(releaseRequest: EscrowReleaseRequest): Promise<EscrowAccount> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { escrow: EscrowAccount };
      }> = await this.axiosInstance.post(
        `/payments/escrow/${releaseRequest.escrowId}/release`,
        releaseRequest
      );

      return response.data.data.escrow;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refund escrow funds to payer
   */
  async refundEscrow(escrowId: string, reason: string): Promise<EscrowAccount> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { escrow: EscrowAccount };
      }> = await this.axiosInstance.post(`/payments/escrow/${escrowId}/refund`, {
        reason,
      });

      return response.data.data.escrow;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all escrow accounts for a user
   */
  async getUserEscrowAccounts(
    userId: string,
    filters?: {
      status?: string[];
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<EscrowAccount[]> {
    try {
      const params: Record<string, any> = {};

      if (filters?.status) {
        params.status = filters.status.join(',');
      }
      if (filters?.dateRange) {
        params.startDate = filters.dateRange.start.toISOString();
        params.endDate = filters.dateRange.end.toISOString();
      }

      const response: AxiosResponse<{
        success: boolean;
        data: { escrowAccounts: EscrowAccount[] };
      }> = await this.axiosInstance.get(`/payments/escrow/user/${userId}`, { params });

      return response.data.data.escrowAccounts;
    } catch (error) {
      throw error;
    }
  }

  // =============================================================================
  // SECURITY AND FRAUD DETECTION
  // =============================================================================

  /**
   * Perform risk assessment for a payment
   */
  async assessPaymentRisk(
    paymentRequest: PaymentRequest,
    securityContext: PaymentSecurityContext
  ): Promise<RiskAssessment> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { riskAssessment: RiskAssessment };
      }> = await this.axiosInstance.post('/payments/risk-assessment', {
        paymentRequest,
        securityContext,
      });

      return response.data.data.riskAssessment;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Run fraud detection on a payment
   */
  async detectFraud(
    paymentRequest: PaymentRequest,
    securityContext: PaymentSecurityContext
  ): Promise<FraudDetectionResult> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { fraudDetection: FraudDetectionResult };
      }> = await this.axiosInstance.post('/payments/fraud-detection', {
        paymentRequest,
        securityContext,
      });

      return response.data.data.fraudDetection;
    } catch (error) {
      throw error;
    }
  }

  // =============================================================================
  // DISPUTE MANAGEMENT
  // =============================================================================

  /**
   * Create a payment dispute
   */
  async createDispute(disputeRequest: DisputeRequest): Promise<{ disputeId: string }> {
    try {
      let formData: FormData | DisputeRequest = disputeRequest;

      // Handle file uploads for evidence
      if (disputeRequest.evidence && disputeRequest.evidence.length > 0) {
        formData = new FormData();
        Object.entries(disputeRequest).forEach(([key, value]) => {
          if (key !== 'evidence') {
            (formData as FormData).append(
              key,
              typeof value === 'object' ? JSON.stringify(value) : value
            );
          }
        });

        disputeRequest.evidence.forEach((file, index) => {
          (formData as FormData).append(`evidence[${index}]`, file);
        });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: { disputeId: string };
      }> = await this.axiosInstance.post('/payments/disputes', formData, {
        headers: formData instanceof FormData
          ? { 'Content-Type': 'multipart/form-data' }
          : undefined,
      });

      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  // =============================================================================
  // VALIDATION AND SECURITY HELPERS
  // =============================================================================

  /**
   * Validate payment method data before submission
   */
  private validatePaymentMethodData(methodData: AddPaymentMethodRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate type
    if (!methodData.type || !['credit_card', 'bank_transfer', 'digital_wallet', 'cryptocurrency'].includes(methodData.type)) {
      errors.push('Valid payment method type is required');
    }

    // Validate display name
    if (!methodData.displayName || methodData.displayName.trim().length === 0) {
      errors.push('Display name is required');
    } else if (methodData.displayName.length > 100) {
      errors.push('Display name must be less than 100 characters');
    }

    // Type-specific validations
    if (methodData.type === 'credit_card' && methodData.metadata) {
      if (methodData.metadata.cardNumber && !this.validateCreditCardNumber(methodData.metadata.cardNumber)) {
        errors.push('Invalid credit card number');
      }
      if (methodData.metadata.expiryDate && !this.validateExpiryDate(methodData.metadata.expiryDate)) {
        errors.push('Invalid or expired card');
      }
      if (methodData.metadata.cvv && !this.validateCVV(methodData.metadata.cvv)) {
        errors.push('Invalid CVV');
      }
    }

    if (methodData.type === 'bank_transfer' && methodData.metadata) {
      if (methodData.metadata.accountNumber && methodData.metadata.accountNumber.length < 8) {
        errors.push('Invalid account number');
      }
      if (methodData.metadata.routingNumber && methodData.metadata.routingNumber.length !== 9) {
        errors.push('Invalid routing number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Tokenize sensitive payment data on the client side
   */
  private async tokenizeSensitiveData(methodData: AddPaymentMethodRequest): Promise<any> {
    // In a real implementation, this would use a client-side tokenization library
    // For now, we'll just mask sensitive fields and let the server handle tokenization

    const tokenizedData = { ...methodData };

    // Remove or mask sensitive fields that shouldn't be sent to server
    if (tokenizedData.metadata) {
      // Mask credit card numbers
      if (tokenizedData.metadata.cardNumber) {
        tokenizedData.metadata.maskedCardNumber = `****-****-****-${tokenizedData.metadata.cardNumber.slice(-4)}`;
        delete tokenizedData.metadata.cardNumber;
      }

      // Mask CVV
      if (tokenizedData.metadata.cvv) {
        delete tokenizedData.metadata.cvv; // Never send CVV to server
      }

      // Mask account numbers
      if (tokenizedData.metadata.accountNumber) {
        tokenizedData.metadata.maskedAccountNumber = `****${tokenizedData.metadata.accountNumber.slice(-4)}`;
        delete tokenizedData.metadata.accountNumber;
      }

      // Mask cryptocurrency private keys
      if (tokenizedData.metadata.privateKey) {
        delete tokenizedData.metadata.privateKey; // Never send private keys
      }
    }

    return tokenizedData;
  }

  /**
   * Validate payment form data on client side
   */
  validatePaymentFormData(formData: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate amount
    if (!formData.amount || formData.amount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    if (formData.amount > 100000) { // Increased limit for high-value bookings
      errors.push('Payment amount exceeds maximum limit of $100,000');
    }

    // Validate currency
    if (
      !formData.currency ||
      !['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(formData.currency)
    ) {
      errors.push('Invalid currency selected');
    }

    // Validate payment method
    if (!formData.paymentMethodId) {
      errors.push('Payment method is required');
    }

    // Validate payer and recipient
    if (!formData.payerId) {
      errors.push('Payer ID is required');
    }

    if (!formData.recipientId) {
      errors.push('Recipient ID is required');
    }

    if (formData.payerId === formData.recipientId) {
      errors.push('Payer and recipient cannot be the same');
    }

    // Validate swap and proposal IDs
    if (!formData.swapId) {
      errors.push('Swap ID is required');
    }

    if (!formData.proposalId) {
      errors.push('Proposal ID is required');
    }

    // Type-specific validations
    if (formData.paymentMethodType === 'credit_card') {
      if (
        formData.cardNumber &&
        !this.validateCreditCardNumber(formData.cardNumber)
      ) {
        errors.push('Invalid credit card number');
      }

      if (
        formData.expiryDate &&
        !this.validateExpiryDate(formData.expiryDate)
      ) {
        errors.push('Invalid or expired card');
      }

      if (formData.cvv && !this.validateCVV(formData.cvv)) {
        errors.push('Invalid CVV');
      }
    }

    if (formData.paymentMethodType === 'bank_transfer') {
      if (formData.accountNumber && formData.accountNumber.length < 8) {
        errors.push('Invalid account number');
      }

      if (formData.routingNumber && formData.routingNumber.length !== 9) {
        errors.push('Invalid routing number');
      }
    }

    if (formData.paymentMethodType === 'cryptocurrency') {
      if (!formData.walletAddress) {
        errors.push('Wallet address is required for cryptocurrency payments');
      }

      if (!formData.cryptoCurrency || !['BTC', 'ETH', 'HBAR'].includes(formData.cryptoCurrency)) {
        errors.push('Valid cryptocurrency type is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate escrow request data
   */
  validateEscrowRequest(escrowRequest: EscrowRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!escrowRequest.amount || escrowRequest.amount <= 0) {
      errors.push('Escrow amount must be greater than 0');
    }

    if (!escrowRequest.currency || !['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(escrowRequest.currency)) {
      errors.push('Valid currency is required');
    }

    if (!escrowRequest.payerId) {
      errors.push('Payer ID is required');
    }

    if (!escrowRequest.recipientId) {
      errors.push('Recipient ID is required');
    }

    if (escrowRequest.payerId === escrowRequest.recipientId) {
      errors.push('Payer and recipient cannot be the same');
    }

    if (!escrowRequest.swapId) {
      errors.push('Swap ID is required');
    }

    // Proposal ID is optional for escrow creation before proposal exists
    // if (!escrowRequest.proposalId) {
    //   errors.push('Proposal ID is required');
    // }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate credit card number using Luhn algorithm
   */
  private validateCreditCardNumber(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/\D/g, '');

    if (cleaned.length < 13 || cleaned.length > 19) {
      return false;
    }

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

    return sum % 10 === 0;
  }

  /**
   * Validate credit card expiry date
   */
  private validateExpiryDate(expiryDate: string): boolean {
    const [month, year] = expiryDate.split('/').map(num => parseInt(num, 10));

    if (!month || !year || month < 1 || month > 12) {
      return false;
    }

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return false;
    }

    return true;
  }

  /**
   * Validate CVV
   */
  private validateCVV(cvv: string): boolean {
    const cleaned = cvv.replace(/\D/g, '');
    return cleaned.length >= 3 && cleaned.length <= 4;
  }
}

export const paymentService = new PaymentService();
