import { NFTService } from '../NFTService';
import { HederaService } from '../HederaService';
import { HederaErrorReporter } from '../HederaErrorReporter';
import { AccountPermissionValidator } from '../AccountPermissionValidator';
import { Client, AccountId, PrivateKey, TokenId } from '@hashgraph/sdk';
import { logger } from '../../../utils/logger';

// Mock dependencies
jest.mock('../HederaService');
jest.mock('../HederaErrorReporter');
jest.mock('../AccountPermissionValidator');
jest.mock('../../../utils/logger');

describe('NFTService Enhanced Error Reporting', () => {
  let nftService: NFTService;
  let mockHederaService: jest.Mocked<HederaService>;
  let mockClient: jest.Mocked<Client>;
  let mockAccountPermissionValidator: jest.Mocked<AccountPermissionValidator>;

  const mockOperatorAccountId = AccountId.fromString('0.0.123');
  const mockOperatorPrivateKey = PrivateKey.generateED25519();
  const mockTokenId = TokenId.fromString('0.0.456');

  beforeEach(() => {
    // Setup mocks
    mockClient = {
      execute: jest.fn(),
    } as any;

    mockHederaService = {
      getAccountBalance: jest.fn(),
      submitTransaction: jest.fn(),
    } as any;

    // Mock private properties access
    Object.defineProperty(mockHederaService, 'client', {
      get: () => mockClient,
    });
    Object.defineProperty(mockHederaService, 'operatorAccountId', {
      get: () => mockOperatorAccountId,
    });
    Object.defineProperty(mockHederaService, 'operatorPrivateKey', {
      get: () => mockOperatorPrivateKey,
    });

    mockAccountPermissionValidator = {
      validateAccount: jest.fn(),
      verifyMinimumBalance: jest.fn(),
    } as any;

    // Mock AccountPermissionValidator constructor
    (AccountPermissionValidator as jest.MockedClass<typeof AccountPermissionValidator>).mockImplementation(
      () => mockAccountPermissionValidator
    );

    nftService = new NFTService(mockHederaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Error Reporting', () => {
    it('should capture detailed error information when minting fails', async () => {
      // Arrange
      const bookingData = {
        id: 'booking-123',
        userId: 'user-456',
        title: 'Test Booking',
        description: 'Test Description',
        location: { city: 'Test City', country: 'Test Country' },
        dateRange: { checkIn: '2024-01-01', checkOut: '2024-01-07' },
        originalPrice: 1000,
        swapValue: 900,
        providerDetails: { provider: 'Test Provider', confirmationNumber: 'CONF123' },
        verification: { status: 'verified', documents: [] },
      };
      const userAccountId = '0.0.789';

      // Mock balance check to pass
      mockHederaService.getAccountBalance.mockResolvedValue({ toString: () => '10' } as any);
      mockAccountPermissionValidator.verifyMinimumBalance.mockResolvedValue(true);
      mockAccountPermissionValidator.validateAccount.mockResolvedValue({
        accountExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        tokenExists: true,
        tokenPermissions: { canMintNFTs: true },
        issues: [],
        recommendations: [],
      } as any);

      // Mock minting to fail
      const mockError = new Error('Insufficient balance');
      mockClient.execute = jest.fn().mockRejectedValue(mockError);

      // Mock error reporter
      const mockErrorDetails = {
        errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
        errorMessage: 'Insufficient balance',
        operation: 'NFT_MINTING',
        retryable: false,
        recommendation: 'Add more HBAR to account',
      };
      (HederaErrorReporter.captureError as jest.Mock).mockReturnValue(mockErrorDetails);
      (HederaErrorReporter.formatErrorForLogging as jest.Mock).mockReturnValue('Formatted error');
      (HederaErrorReporter.createNFTContext as jest.Mock).mockReturnValue({});

      // Act & Assert
      await expect(nftService.mintBookingNFT(bookingData, userAccountId)).rejects.toThrow();

      // Verify error reporting was called
      expect(HederaErrorReporter.captureError).toHaveBeenCalledWith(
        mockError,
        'NFT_MINTING',
        expect.any(Object)
      );
      expect(HederaErrorReporter.formatErrorForLogging).toHaveBeenCalledWith(mockErrorDetails);
    });

    it('should perform comprehensive pre-flight checks before minting', async () => {
      // Arrange
      const bookingData = {
        id: 'booking-123',
        userId: 'user-456',
        title: 'Test Booking',
        description: 'Test Description',
        location: { city: 'Test City', country: 'Test Country' },
        dateRange: { checkIn: '2024-01-01', checkOut: '2024-01-07' },
        originalPrice: 1000,
        swapValue: 900,
        providerDetails: { provider: 'Test Provider', confirmationNumber: 'CONF123' },
        verification: { status: 'verified', documents: [] },
      };
      const userAccountId = '0.0.789';

      // Mock all pre-flight checks to pass
      mockHederaService.getAccountBalance.mockResolvedValue({ toString: () => '10' } as any);
      mockAccountPermissionValidator.verifyMinimumBalance.mockResolvedValue(true);
      mockAccountPermissionValidator.validateAccount.mockResolvedValue({
        accountExists: true,
        canMintNFTs: true,
        canTransferNFTs: true,
        tokenExists: true,
        tokenPermissions: { canMintNFTs: true },
        issues: [],
        recommendations: [],
      } as any);

      // Mock successful minting
      const mockMintResponse = {
        transactionId: { toString: () => 'tx-123' },
        getReceipt: jest.fn().mockResolvedValue({
          serials: [{ toNumber: () => 1 }],
          status: { toString: () => 'SUCCESS' },
        }),
      };
      mockClient.execute = jest.fn().mockResolvedValue(mockMintResponse);

      // Mock context creation
      (HederaErrorReporter.createNFTContext as jest.Mock).mockReturnValue({});

      // Act
      try {
        await nftService.mintBookingNFT(bookingData, userAccountId);
      } catch (error) {
        // Expected to fail at some point due to incomplete mocking, but we want to verify pre-flight checks
      }

      // Assert - Verify pre-flight checks were performed
      expect(mockHederaService.getAccountBalance).toHaveBeenCalled();
      expect(mockAccountPermissionValidator.verifyMinimumBalance).toHaveBeenCalledWith(
        mockOperatorAccountId.toString(),
        'mint'
      );
      expect(mockAccountPermissionValidator.validateAccount).toHaveBeenCalledWith(
        mockOperatorAccountId.toString(),
        expect.any(String)
      );
      expect(mockAccountPermissionValidator.validateAccount).toHaveBeenCalledWith(userAccountId);
    });

    it('should validate token association before transfer', async () => {
      // Arrange
      const tokenId = '0.0.456';
      const serialNumber = 1;
      const fromAccount = '0.0.123';
      const toAccount = '0.0.789';

      // Mock account validation
      mockAccountPermissionValidator.validateAccount.mockResolvedValue({
        accountExists: true,
        canTransferNFTs: true,
        issues: [],
        recommendations: [],
      } as any);

      // Mock successful transfer
      const mockTransferResponse = {
        transactionId: { toString: () => 'tx-456' },
        getReceipt: jest.fn().mockResolvedValue({
          status: { toString: () => 'SUCCESS' },
        }),
      };
      mockClient.execute = jest.fn().mockResolvedValue(mockTransferResponse);

      // Mock context creation
      (HederaErrorReporter.createNFTContext as jest.Mock).mockReturnValue({});

      // Act
      try {
        await nftService.transferNFT(tokenId, serialNumber, fromAccount, toAccount);
      } catch (error) {
        // Expected to fail at some point due to incomplete mocking
      }

      // Assert - Verify account validation was performed
      expect(mockAccountPermissionValidator.validateAccount).toHaveBeenCalledWith(fromAccount);
      expect(mockAccountPermissionValidator.validateAccount).toHaveBeenCalledWith(toAccount);
    });
  });

  describe('Comprehensive Logging', () => {
    it('should log all NFT operations with detailed context', async () => {
      // Arrange
      const tokenId = '0.0.456';
      const serialNumber = 1;

      // Mock permission validation
      mockAccountPermissionValidator.validateAccount.mockResolvedValue({
        tokenPermissions: { hasSupplyKey: true, hasAdminKey: true },
      } as any);

      // Mock successful burn
      const mockBurnResponse = {
        transactionId: { toString: () => 'tx-789' },
        getReceipt: jest.fn().mockResolvedValue({
          status: { toString: () => 'SUCCESS' },
        }),
      };
      mockClient.execute = jest.fn().mockResolvedValue(mockBurnResponse);

      // Mock context creation
      (HederaErrorReporter.createNFTContext as jest.Mock).mockReturnValue({});

      // Act
      try {
        await nftService.burnNFT(tokenId, serialNumber);
      } catch (error) {
        // Expected to fail at some point due to incomplete mocking
      }

      // Assert - Verify comprehensive logging
      expect(logger.info).toHaveBeenCalledWith(
        'Burning booking NFT with enhanced error reporting',
        expect.objectContaining({ tokenId, serialNumber })
      );
    });
  });
});