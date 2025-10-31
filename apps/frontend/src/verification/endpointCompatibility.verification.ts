/**
 * Manual verification script for frontend compatibility with the new endpoint
 * This script verifies that the frontend components work correctly with the new API endpoint
 */

import { swapApiService } from '../services/swapApiService';
import { CreateProposalRequest, ProposalResponse } from '../types/api';

interface VerificationResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class EndpointCompatibilityVerifier {
  private results: VerificationResult[] = [];

  /**
   * Verify that the swapApiService calls the correct endpoint
   */
  async verifyApiServiceEndpoint(): Promise<VerificationResult> {
    const test = 'API Service Endpoint Verification';
    
    try {
      // Mock the axios instance to capture the endpoint being called
      const originalPost = (swapApiService as any).axiosInstance.post;
      let capturedEndpoint = '';
      
      (swapApiService as any).axiosInstance.post = async (endpoint: string, data: any) => {
        capturedEndpoint = endpoint;
        // Return a mock response
        return {
          data: {
            proposalId: 'test-proposal-123',
            status: 'pending',
            estimatedResponseTime: '2-3 business days',
          },
        };
      };

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-123',
        message: 'Test proposal',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      await swapApiService.createProposal('target-123', proposalData);

      // Restore original method
      (swapApiService as any).axiosInstance.post = originalPost;

      const expectedEndpoint = '/swaps/target-123/proposals';
      const passed = capturedEndpoint === expectedEndpoint;

      return {
        test,
        passed,
        details: {
          expectedEndpoint,
          actualEndpoint: capturedEndpoint,
        },
        ...(passed ? {} : { error: `Expected endpoint ${expectedEndpoint}, got ${capturedEndpoint}` }),
      };
    } catch (error) {
      return {
        test,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify that the request format is correct
   */
  async verifyRequestFormat(): Promise<VerificationResult> {
    const test = 'Request Format Verification';
    
    try {
      // Mock the axios instance to capture the request data
      const originalPost = (swapApiService as any).axiosInstance.post;
      let capturedData: any = null;
      
      (swapApiService as any).axiosInstance.post = async (endpoint: string, data: any) => {
        capturedData = data;
        return {
          data: {
            proposalId: 'test-proposal-123',
            status: 'pending',
            estimatedResponseTime: '2-3 business days',
          },
        };
      };

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-123',
        message: 'Test proposal message',
        conditions: ['Standard swap exchange'],
        agreedToTerms: true,
      };

      await swapApiService.createProposal('target-123', proposalData);

      // Restore original method
      (swapApiService as any).axiosInstance.post = originalPost;

      // Verify the request data matches expected format
      const hasRequiredFields = 
        capturedData &&
        capturedData.sourceSwapId === 'source-123' &&
        capturedData.message === 'Test proposal message' &&
        Array.isArray(capturedData.conditions) &&
        capturedData.conditions.includes('Standard swap exchange') &&
        capturedData.agreedToTerms === true;

      return {
        test,
        passed: hasRequiredFields,
        details: {
          expectedData: proposalData,
          actualData: capturedData,
        },
        ...(hasRequiredFields ? {} : { error: 'Request data format does not match expected format' }),
      };
    } catch (error) {
      return {
        test,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify that cash proposals work correctly
   */
  async verifyCashProposalFormat(): Promise<VerificationResult> {
    const test = 'Cash Proposal Format Verification';
    
    try {
      // Mock the axios instance to capture the request data
      const originalPost = (swapApiService as any).axiosInstance.post;
      let capturedData: any = null;
      
      (swapApiService as any).axiosInstance.post = async (endpoint: string, data: any) => {
        capturedData = data;
        return {
          data: {
            proposalId: 'cash-proposal-123',
            status: 'pending',
            estimatedResponseTime: '1-2 business days',
          },
        };
      };

      const cashProposalData: CreateProposalRequest = {
        sourceSwapId: 'CASH_OFFER',
        message: 'Cash offer message',
        conditions: ['Cash payment offer'],
        agreedToTerms: true,
        cashOffer: {
          amount: 1500,
          currency: 'USD',
        },
      };

      await swapApiService.createProposal('target-123', cashProposalData);

      // Restore original method
      (swapApiService as any).axiosInstance.post = originalPost;

      // Verify the cash proposal data is correct
      const hasCashOfferFields = 
        capturedData &&
        capturedData.sourceSwapId === 'CASH_OFFER' &&
        capturedData.cashOffer &&
        capturedData.cashOffer.amount === 1500 &&
        capturedData.cashOffer.currency === 'USD';

      return {
        test,
        passed: hasCashOfferFields,
        details: {
          expectedData: cashProposalData,
          actualData: capturedData,
        },
        ...(hasCashOfferFields ? {} : { error: 'Cash proposal data format is incorrect' }),
      };
    } catch (error) {
      return {
        test,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify that error handling works correctly
   */
  async verifyErrorHandling(): Promise<VerificationResult> {
    const test = 'Error Handling Verification';
    
    try {
      // Mock the axios instance to simulate an error response
      const originalPost = (swapApiService as any).axiosInstance.post;
      
      (swapApiService as any).axiosInstance.post = async () => {
        const error = new Error('Mock API Error');
        (error as any).response = {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid proposal data',
              category: 'validation',
            },
          },
        };
        throw error;
      };

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'invalid-source',
        message: '',
        conditions: [],
        agreedToTerms: false,
      };

      let errorCaught = false;
      let errorMessage = '';

      try {
        await swapApiService.createProposal('target-123', proposalData);
      } catch (error) {
        errorCaught = true;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      // Restore original method
      (swapApiService as any).axiosInstance.post = originalPost;

      return {
        test,
        passed: errorCaught,
        details: {
          errorCaught,
          errorMessage,
        },
        ...(errorCaught ? {} : { error: 'Expected error was not caught' }),
      };
    } catch (error) {
      return {
        test,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify that response format is handled correctly
   */
  async verifyResponseFormat(): Promise<VerificationResult> {
    const test = 'Response Format Verification';
    
    try {
      // Mock the axios instance to return a specific response format
      const originalPost = (swapApiService as any).axiosInstance.post;
      
      const mockResponse = {
        proposalId: 'response-test-123',
        status: 'pending' as const,
        estimatedResponseTime: '3-5 business days',
      };

      (swapApiService as any).axiosInstance.post = async () => ({
        data: mockResponse,
      });

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-123',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      const result = await swapApiService.createProposal('target-123', proposalData);

      // Restore original method
      (swapApiService as any).axiosInstance.post = originalPost;

      // Verify the response format
      const hasCorrectFormat = 
        result &&
        result.proposalId === 'response-test-123' &&
        result.status === 'pending' &&
        result.estimatedResponseTime === '3-5 business days';

      return {
        test,
        passed: hasCorrectFormat,
        details: {
          expectedResponse: mockResponse,
          actualResponse: result,
        },
        ...(hasCorrectFormat ? {} : { error: 'Response format does not match expected format' }),
      };
    } catch (error) {
      return {
        test,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run all verification tests
   */
  async runAllVerifications(): Promise<VerificationResult[]> {
    console.log('🔍 Starting Frontend Endpoint Compatibility Verification...\n');

    const tests = [
      this.verifyApiServiceEndpoint(),
      this.verifyRequestFormat(),
      this.verifyCashProposalFormat(),
      this.verifyErrorHandling(),
      this.verifyResponseFormat(),
    ];

    this.results = await Promise.all(tests);

    // Print results
    console.log('📊 Verification Results:');
    console.log('========================\n');

    let passedCount = 0;
    let failedCount = 0;

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.test}: ${status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.details) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
      
      console.log('');

      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    });

    console.log(`📈 Summary: ${passedCount} passed, ${failedCount} failed`);
    
    if (failedCount === 0) {
      console.log('🎉 All frontend compatibility tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Please review the issues above.');
    }

    return this.results;
  }

  /**
   * Get verification summary
   */
  getSummary(): { passed: number; failed: number; total: number } {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    return { passed, failed, total };
  }
}

// Export for use in other files
export { EndpointCompatibilityVerifier };

// If running directly, execute the verification
if (typeof window === 'undefined') {
  const verifier = new EndpointCompatibilityVerifier();
  verifier.runAllVerifications().then(() => {
    const summary = verifier.getSummary();
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}