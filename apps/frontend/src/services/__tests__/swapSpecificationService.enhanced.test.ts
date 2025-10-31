import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { swapSpecificationService } from '../swapSpecificationService';
import { ValidationError } from '@booking-swap/shared';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('SwapSpecificationService - Enhanced Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock axios.create
    const mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateSwapSpecificationWithRecovery', () => {
    it('should return success when normal update succeeds', async () => {
      const mockSwapData = {
        id: 'swap-123',
        bookingId: 'booking-123',
        paymentTypes: ['booking', 'cash'],
        minCashAmount: 100,
        maxCashAmount: 500,
        acceptanceStrategy: 'first_come_first_served',
        swapConditions: ['No pets', 'Non-smoking'],
        swapEnabled: true,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            swapSpecification: mockSwapData,
            validationWarnings: ['Minor warning about cash amounts'],
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put).mockResolvedValue(mockResponse);

      const updateData = {
        paymentTypes: ['booking', 'cash'] as const,
        minCashAmount: 100,
        maxCashAmount: 500,
      };

      const result = await swapSpecificationService.updateSwapSpecificationWithRecovery('swap-123', updateData);

      expect(result.success).toBe(true);
      expect(result.swapSpecification).toBeDefined();
      expect(result.swapSpecification?.paymentTypes).toEqual(['booking', 'cash']);
      expect(result.validationWarnings).toEqual(['Minor warning about cash amounts']);
      expect(result.partialFailures).toBeUndefined();
    });

    it('should attempt partial recovery when validation fails', async () => {
      const validationError = new ValidationError('Validation failed', {
        errors: [
          { field: 'paymentTypes', message: 'Invalid payment types' },
          { field: 'minCashAmount', message: 'Amount too low' },
        ],
      });

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put)
        .mockRejectedValueOnce(validationError)
        // Mock individual field updates
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              swapSpecification: {
                id: 'swap-123',
                paymentTypes: ['booking', 'cash'],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        })
        .mockRejectedValueOnce(new Error('Cash amount validation failed'));

      const updateData = {
        paymentTypes: ['booking', 'cash'] as const,
        minCashAmount: 5, // Too low, will fail
      };

      const result = await swapSpecificationService.updateSwapSpecificationWithRecovery('swap-123', updateData);

      expect(result.success).toBe(false);
      expect(result.swapSpecification).toBeDefined(); // Should have the successful paymentTypes update
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].field).toBe('minCashAmount');
      expect(result.partialFailures?.[0].error).toBe('Cash amount validation failed');
    });

    it('should handle blockchain-related failures', async () => {
      const blockchainError = new Error('NFT minting failed');
      
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put).mockRejectedValue(blockchainError);

      const updateData = {
        swapEnabled: true,
      };

      await expect(
        swapSpecificationService.updateSwapSpecificationWithRecovery('swap-123', updateData)
      ).rejects.toThrow('NFT minting failed');
    });

    it('should handle partial success with multiple swap fields', async () => {
      const validationError = new ValidationError('Multiple field validation failed', {
        errors: [
          { field: 'paymentTypes', message: 'Payment types invalid' },
          { field: 'acceptanceStrategy', message: 'Strategy invalid' },
          { field: 'swapConditions', message: 'Conditions invalid' },
        ],
      });

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put)
        .mockRejectedValueOnce(validationError)
        // Mock individual field updates - some succeed, some fail
        .mockResolvedValueOnce({ // paymentTypes succeeds
          data: {
            success: true,
            data: {
              swapSpecification: {
                id: 'swap-123',
                paymentTypes: ['booking'],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        })
        .mockRejectedValueOnce(new Error('Strategy still invalid')) // acceptanceStrategy fails
        .mockResolvedValueOnce({ // swapConditions succeeds
          data: {
            success: true,
            data: {
              swapSpecification: {
                id: 'swap-123',
                paymentTypes: ['booking'],
                swapConditions: ['Updated conditions'],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        });

      const updateData = {
        paymentTypes: ['booking'] as const,
        acceptanceStrategy: 'invalid_strategy' as any,
        swapConditions: ['Updated conditions'],
      };

      const result = await swapSpecificationService.updateSwapSpecificationWithRecovery('swap-123', updateData);

      expect(result.success).toBe(false);
      expect(result.swapSpecification).toBeDefined();
      expect(result.swapSpecification?.paymentTypes).toEqual(['booking']);
      expect(result.swapSpecification?.swapConditions).toEqual(['Updated conditions']);
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].field).toBe('acceptanceStrategy');
    });
  });

  describe('canModifySwapSpecification', () => {
    it('should return true when swap can be modified', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            canModify: true,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await swapSpecificationService.canModifySwapSpecification('swap-123');

      expect(result.canModify).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false with reason when swap cannot be modified', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            canModify: false,
            reason: 'Swap has active proposals',
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await swapSpecificationService.canModifySwapSpecification('swap-123');

      expect(result.canModify).toBe(false);
      expect(result.reason).toBe('Swap has active proposals');
    });

    it('should handle API errors gracefully', async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockRejectedValue(new Error('API Error'));

      const result = await swapSpecificationService.canModifySwapSpecification('swap-123');

      expect(result.canModify).toBe(false);
      expect(result.reason).toBe('Unable to verify modification permissions');
    });
  });

  describe('getSwapSpecificationHistory', () => {
    it('should return modification history with parsed dates', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          changes: {
            paymentTypes: { from: ['booking'], to: ['booking', 'cash'] },
            minCashAmount: { from: 50, to: 100 },
          },
          modifiedAt: '2024-01-01T12:00:00.000Z',
          modifiedBy: 'user-123',
        },
        {
          id: 'history-2',
          changes: {
            acceptanceStrategy: { from: 'first_come_first_served', to: 'auction' },
            auctionEndDate: { from: null, to: '2024-06-01T12:00:00.000Z' },
          },
          modifiedAt: '2024-01-02T12:00:00.000Z',
          modifiedBy: 'user-123',
        },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            history: mockHistory,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await swapSpecificationService.getSwapSpecificationHistory('swap-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('history-1');
      expect(result[0].modifiedAt).toBeInstanceOf(Date);
      expect(result[0].changes.paymentTypes).toEqual({ from: ['booking'], to: ['booking', 'cash'] });
      expect(result[1].changes.acceptanceStrategy).toEqual({ from: 'first_come_first_served', to: 'auction' });
    });

    it('should handle empty history', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            history: [],
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await swapSpecificationService.getSwapSpecificationHistory('swap-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAuctionInfo', () => {
    it('should return active auction information', async () => {
      const mockAuction = {
        auctionId: 'auction-123',
        endDate: '2024-06-01T12:00:00.000Z',
        currentHighestBid: 450,
        bidCount: 5,
        timeRemaining: 3600000, // 1 hour in milliseconds
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            auction: mockAuction,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await swapSpecificationService.getAuctionInfo('swap-123');

      expect(result).toBeDefined();
      expect(result?.auctionId).toBe('auction-123');
      expect(result?.endDate).toBeInstanceOf(Date);
      expect(result?.currentHighestBid).toBe(450);
      expect(result?.bidCount).toBe(5);
      expect(result?.timeRemaining).toBe(3600000);
    });

    it('should return null when no active auction', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            auction: null,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await swapSpecificationService.getAuctionInfo('swap-123');

      expect(result).toBeNull();
    });

    it('should handle 404 errors gracefully', async () => {
      const mockAxiosInstance = mockedAxios.create();
      const error = new Error('Not found');
      (error as any).response = { status: 404 };
      vi.mocked(mockAxiosInstance.get).mockRejectedValue(error);

      const result = await swapSpecificationService.getAuctionInfo('swap-123');

      expect(result).toBeNull();
    });
  });

  describe('enableSwapping', () => {
    it('should enable swapping with NFT minting', async () => {
      const swapData = {
        bookingId: 'booking-123',
        paymentTypes: ['booking', 'cash'] as const,
        minCashAmount: 100,
        maxCashAmount: 500,
        acceptanceStrategy: 'first_come_first_served' as const,
        swapConditions: ['No pets'],
        swapEnabled: true,
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            swapSpecification: {
              id: 'swap-123',
              ...swapData,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            nftInfo: {
              tokenId: 'token-123',
              serialNumber: 1,
              transactionId: 'tx-123',
            },
            validationWarnings: ['Wallet connection recommended'],
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.post).mockResolvedValue(mockResponse);

      const result = await swapSpecificationService.enableSwapping(
        'booking-123',
        swapData,
        'wallet-address-123'
      );

      expect(result.swapSpecification).toBeDefined();
      expect(result.nftInfo).toBeDefined();
      expect(result.nftInfo?.tokenId).toBe('token-123');
      expect(result.validationWarnings).toEqual(['Wallet connection recommended']);
    });

    it('should handle wallet validation errors', async () => {
      const swapData = {
        bookingId: 'booking-123',
        paymentTypes: ['booking'] as const,
        acceptanceStrategy: 'first_come_first_served' as const,
        swapConditions: ['No pets'],
        swapEnabled: true,
      };

      // Mock validation to fail due to missing wallet
      const validationError = new ValidationError('Wallet validation failed', {
        errors: [{ field: 'walletConnection', message: 'Wallet connection required' }],
      });

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.post).mockRejectedValue(validationError);

      await expect(
        swapSpecificationService.enableSwapping('booking-123', swapData)
      ).rejects.toThrow('Wallet validation failed');
    });
  });

  describe('disableSwapping', () => {
    it('should disable swapping and burn NFT', async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.post).mockResolvedValue({
        data: { success: true },
      });

      await expect(
        swapSpecificationService.disableSwapping('booking-123')
      ).resolves.not.toThrow();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/bookings/booking-123/disable-swapping');
    });

    it('should handle NFT burning failures', async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.post).mockRejectedValue(new Error('NFT burning failed'));

      await expect(
        swapSpecificationService.disableSwapping('booking-123')
      ).rejects.toThrow('NFT burning failed');
    });
  });

  describe('validation methods', () => {
    it('should validate swap specification data without API calls', () => {
      const validSwapData = {
        bookingId: 'booking-123',
        paymentTypes: ['booking', 'cash'] as const,
        minCashAmount: 100,
        maxCashAmount: 500,
        acceptanceStrategy: 'first_come_first_served' as const,
        swapConditions: ['No pets', 'Non-smoking'],
        swapEnabled: true,
      };

      const errors = swapSpecificationService.validateSwapSpecificationData(validSwapData);

      // Should return empty errors object for valid data
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should validate swap specification update data without API calls', () => {
      const validUpdateData = {
        paymentTypes: ['booking'] as const,
        acceptanceStrategy: 'auction' as const,
        auctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      const errors = swapSpecificationService.validateSwapSpecificationUpdateData(validUpdateData);

      // Should return empty errors object for valid data
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});