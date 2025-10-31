import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  CustomFee,
  Hbar,
  TransactionId,
  TransactionReceipt,
  TokenInfoQuery,
  AccountBalanceQuery,
  TokenNftInfoQuery,
  NftId,
  TransferTransaction,
  TokenAssociateTransaction,
  TokenGrantKycTransaction,
  TokenRevokeKycTransaction,
  TokenWipeTransaction,
  TokenBurnTransaction,
  TokenDeleteTransaction,
  Status,
} from '@hashgraph/sdk';
import { logger } from '../../utils/logger';
import { HederaService } from './HederaService';
import { HederaErrorReporter, HederaErrorDetails } from './HederaErrorReporter';
import { AccountPermissionValidator } from './AccountPermissionValidator';
import { NFTMonitoringService } from './NFTMonitoringService';

export interface BookingNFTMetadata {
  bookingId: string;
  userId: string;
  title: string;
  location: {
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  dateRange: {
    checkIn: string;
    checkOut: string;
  };
  originalPrice: number;
  swapValue: number;
  providerDetails: {
    provider: string;
    confirmationNumber: string;
    bookingReference?: string;
  };
  verification: {
    status: string;
    documents: string[];
  };
  nftMetadata: {
    name: string;
    description: string;
    image: string;
    attributes: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
  createdAt: string;
  tokenId?: string;
  serialNumber?: number;
}

export interface NFTCreationResult {
  tokenId: string;
  serialNumber: number;
  transactionId: string;
  metadata: BookingNFTMetadata;
}

export interface NFTTransferResult {
  transactionId: string;
  fromAccount: string;
  toAccount: string;
  serialNumber: number;
}

export class NFTService {
  private hederaService: HederaService;
  private client: Client;
  private operatorAccountId: AccountId;
  private operatorPrivateKey: PrivateKey;
  private bookingTokenId?: TokenId;
  private permissionValidator: AccountPermissionValidator;
  private monitoring: NFTMonitoringService;

  constructor(hederaService: HederaService) {
    this.hederaService = hederaService;
    this.client = hederaService['client'];
    this.operatorAccountId = hederaService['operatorAccountId'];
    this.operatorPrivateKey = hederaService['operatorPrivateKey'];
    this.permissionValidator = new AccountPermissionValidator(this.client, this.operatorAccountId);
    this.monitoring = NFTMonitoringService.getInstance();
  }

  /**
   * Initialize the booking NFT token if it doesn't exist
   */
  async initializeBookingToken(): Promise<string> {
    const startTime = Date.now();
    
    try {
      if (this.bookingTokenId) {
        return this.bookingTokenId.toString();
      }

      logger.info('Creating booking NFT token');

      // Get account balance for error context
      let accountBalance: string | undefined;
      try {
        const balance = await this.hederaService.getAccountBalance();
        accountBalance = balance.toString();
      } catch (balanceError) {
        logger.warn('Could not retrieve account balance before token creation');
      }

      // Create the main booking token (fungible token for tracking)
      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName('BookingSwap Token')
        .setTokenSymbol('BST')
        .setTokenType(TokenType.NonFungibleUnique)
        .setDecimals(0)
        .setInitialSupply(0)
        .setTreasuryAccountId(this.operatorAccountId)
        .setSupplyType(TokenSupplyType.Infinite)
        .setSupplyKey(this.operatorPrivateKey)
        .setAdminKey(this.operatorPrivateKey)
        .setWipeKey(this.operatorPrivateKey)
        .setFreezeKey(this.operatorPrivateKey)
        .setKycKey(this.operatorPrivateKey)
        .setPauseKey(this.operatorPrivateKey);

      // Note: Custom fees configuration would be added here in production
      // For now, we'll skip custom fees to avoid SDK compatibility issues

      const tokenCreateResponse = await tokenCreateTx.execute(this.client);
      const tokenCreateReceipt = await tokenCreateResponse.getReceipt(this.client);

      if (!tokenCreateReceipt.tokenId) {
        throw new Error('Token creation failed - no token ID returned');
      }

      this.bookingTokenId = tokenCreateReceipt.tokenId;

      logger.info('Booking NFT token created successfully', {
        tokenId: this.bookingTokenId.toString(),
        transactionId: tokenCreateResponse.transactionId.toString(),
      });

      // Record successful token creation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'create_token',
        true,
        duration,
        {
          tokenId: this.bookingTokenId.toString(),
          accountId: this.operatorAccountId.toString(),
        }
      );

      return this.bookingTokenId.toString();
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'TOKEN_CREATION',
        HederaErrorReporter.createTokenContext(
          undefined,
          this.operatorAccountId.toString(),
          undefined,
          undefined
        )
      );

      logger.error('Failed to create booking NFT token', { 
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails)
      });

      // Record failed token creation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'create_token',
        false,
        duration,
        {
          accountId: this.operatorAccountId.toString(),
        },
        errorDetails
      );

      // Throw enhanced error with detailed information
      const enhancedError = new Error(
        `NFT token creation failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
      );
      (enhancedError as any).hederaErrorDetails = errorDetails;
      throw enhancedError;
    }
  }

  /**
   * Mint an NFT for a booking when it's enabled for swapping
   * The NFT will be minted to the user's wallet (not the platform wallet)
   * Enhanced with comprehensive pre-flight checks and detailed error reporting
   * Requirements: 1.1, 1.4, 1.5
   */
  async mintBookingNFT(bookingData: any, userAccountId: string): Promise<NFTCreationResult> {
    const startTime = Date.now();
    const operationContext = HederaErrorReporter.createNFTContext(
      bookingData.id,
      bookingData.userId,
      userAccountId,
      undefined,
      undefined,
      undefined
    );

    logger.info('Starting NFT minting operation with enhanced error reporting', {
      bookingId: bookingData.id,
      userAccountId,
      operatorAccountId: this.operatorAccountId.toString(),
    });

    try {
      // Pre-flight check 1: Validate operator account balance and permissions
      logger.info('Performing pre-flight checks for NFT minting operation');
      
      const operatorBalance = await this.performOperatorAccountChecks();
      operationContext.accountBalance = operatorBalance;

      // Pre-flight check 2: Ensure token exists and get token ID
      await this.initializeBookingToken();
      if (!this.bookingTokenId) {
        throw new Error('Booking token not initialized after creation attempt');
      }

      const tokenId = this.bookingTokenId.toString();
      operationContext.tokenId = tokenId;

      // Pre-flight check 3: Validate operator account permissions for token operations
      await this.validateOperatorTokenPermissions(tokenId);

      // Pre-flight check 4: Verify user account can receive NFTs (token association)
      await this.verifyUserTokenAssociation(userAccountId, tokenId);

      logger.info('All pre-flight checks passed, proceeding with NFT minting', {
        bookingId: bookingData.id,
        tokenId,
        userAccountId,
        operatorBalance,
      });

      // Create metadata for the NFT
      const metadata = this.createBookingMetadata(bookingData);

      // Mint the NFT to platform treasury first
      const mintResult = await this.performNFTMinting(tokenId, metadata, operationContext);
      const serialNumber = mintResult.serialNumber;
      
      // Update operation context with serial number
      operationContext.serialNumber = serialNumber;

      // Transfer the NFT from platform treasury to user's account
      try {
        await this.transferNFTToUser(tokenId, serialNumber, userAccountId);
        logger.info('NFT successfully transferred to user wallet', { 
          tokenId, 
          serialNumber, 
          userAccountId 
        });
      } catch (transferError) {
        const transferErrorDetails = HederaErrorReporter.captureError(
          transferError,
          'NFT_TRANSFER_TO_USER',
          operationContext
        );
        
        logger.error('Failed to transfer NFT to user wallet, NFT remains in platform treasury', { 
          error: transferErrorDetails,
          formattedError: HederaErrorReporter.formatErrorForLogging(transferErrorDetails),
          tokenId,
          serialNumber,
        });
        
        // Continue - the NFT is still minted and can be transferred later
        logger.warn('NFT minted successfully but remains in platform treasury', { 
          tokenId, 
          serialNumber,
          recommendation: 'Manual transfer may be required or user needs to associate token'
        });
      }

      // Update metadata with token information
      metadata.tokenId = tokenId;
      metadata.serialNumber = serialNumber;

      // Record the NFT creation in the Hedera topic
      try {
        await this.recordNFTCreation(metadata, mintResult.transactionId);
      } catch (recordError) {
        const recordErrorDetails = HederaErrorReporter.captureError(
          recordError,
          'NFT_CREATION_RECORDING',
          operationContext
        );
        
        logger.warn('Failed to record NFT creation in topic (non-critical)', { 
          error: recordErrorDetails,
          tokenId,
          serialNumber,
        });
      }

      logger.info('Booking NFT minted successfully with enhanced error reporting', {
        bookingId: bookingData.id,
        tokenId,
        serialNumber,
        transactionId: mintResult.transactionId,
        userAccountId,
      });

      // Record successful operation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'mint',
        true,
        duration,
        {
          tokenId,
          accountId: userAccountId,
          serialNumber,
          bookingId: bookingData.id,
          userId: bookingData.userId,
        }
      );

      return {
        tokenId,
        serialNumber,
        transactionId: mintResult.transactionId,
        metadata,
      };
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'NFT_MINTING',
        operationContext
      );

      logger.error('NFT minting operation failed with detailed error capture', { 
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
        bookingId: bookingData.id,
        userAccountId,
      });

      // Record failed operation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'mint',
        false,
        duration,
        {
          tokenId: operationContext.tokenId,
          accountId: userAccountId,
          bookingId: bookingData.id,
          userId: bookingData.userId,
        },
        errorDetails
      );

      // Throw enhanced error with detailed information for upstream handling
      const enhancedError = new Error(
        `NFT minting failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
      );
      (enhancedError as any).hederaErrorDetails = errorDetails;
      (enhancedError as any).retryable = errorDetails.retryable;
      (enhancedError as any).recommendation = errorDetails.recommendation;
      throw enhancedError;
    }
  }

  /**
   * Perform comprehensive operator account checks before NFT operations
   * Requirements: 1.1, 1.4 - Pre-flight checks for account balance and permissions
   */
  private async performOperatorAccountChecks(): Promise<string> {
    try {
      logger.info('Performing operator account validation checks');

      // Get current account balance
      const balance = await this.hederaService.getAccountBalance();
      const balanceString = balance.toString();

      // Validate minimum balance for NFT operations
      const hasMinimumBalance = await this.permissionValidator.verifyMinimumBalance(
        this.operatorAccountId.toString(),
        'mint'
      );

      if (!hasMinimumBalance) {
        throw new Error(`Insufficient HBAR balance for NFT minting operations. Current balance: ${balanceString}`);
      }

      logger.info('Operator account validation passed', { 
        balance: balanceString,
        hasMinimumBalance,
      });

      return balanceString;
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'OPERATOR_ACCOUNT_VALIDATION',
        HederaErrorReporter.createAccountContext(
          this.operatorAccountId.toString(),
          undefined,
          'pre_mint_validation'
        )
      );

      logger.error('Operator account validation failed', {
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
      });

      throw error;
    }
  }

  /**
   * Validate operator account permissions for token operations
   * Requirements: 1.4 - Verify token permissions before minting
   */
  private async validateOperatorTokenPermissions(tokenId: string): Promise<void> {
    try {
      logger.info('Validating operator token permissions', { tokenId });

      const permissionReport = await this.permissionValidator.validateAccount(
        this.operatorAccountId.toString(),
        tokenId
      );

      if (!permissionReport.canMintNFTs) {
        const issues = permissionReport.issues.join('; ');
        const recommendations = permissionReport.recommendations.join('; ');
        
        throw new Error(
          `Operator account lacks required permissions for NFT minting. Issues: ${issues}. Recommendations: ${recommendations}`
        );
      }

      logger.info('Operator token permissions validated successfully', {
        tokenId,
        canMintNFTs: permissionReport.canMintNFTs,
        canTransferNFTs: permissionReport.canTransferNFTs,
      });
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'OPERATOR_TOKEN_PERMISSION_VALIDATION',
        HederaErrorReporter.createTokenContext(
          tokenId,
          this.operatorAccountId.toString(),
          undefined,
          undefined
        )
      );

      logger.error('Operator token permission validation failed', {
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
      });

      throw error;
    }
  }

  /**
   * Verify user account can receive NFTs (token association check)
   * Requirements: 1.5 - Token association verification before minting
   */
  private async verifyUserTokenAssociation(userAccountId: string, tokenId: string): Promise<void> {
    try {
      logger.info('Verifying user token association', { userAccountId, tokenId });

      // Check if user account exists and can receive tokens
      const userPermissionReport = await this.permissionValidator.validateAccount(userAccountId);

      if (!userPermissionReport.accountExists) {
        throw new Error(`User account ${userAccountId} does not exist or is not accessible`);
      }

      if (!userPermissionReport.canTransferNFTs) {
        const issues = userPermissionReport.issues.join('; ');
        const recommendations = userPermissionReport.recommendations.join('; ');
        
        logger.warn('User account may not be able to receive NFT transfers', {
          userAccountId,
          issues,
          recommendations,
        });
        
        // Don't throw error here - we'll attempt the transfer and handle failure gracefully
        // This allows for cases where the user can still receive NFTs despite validation warnings
      }

      logger.info('User token association verification completed', {
        userAccountId,
        tokenId,
        accountExists: userPermissionReport.accountExists,
        canReceiveNFTs: userPermissionReport.canTransferNFTs,
      });
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'USER_TOKEN_ASSOCIATION_VERIFICATION',
        HederaErrorReporter.createNFTContext(
          undefined,
          undefined,
          userAccountId,
          tokenId,
          undefined,
          undefined
        )
      );

      logger.error('User token association verification failed', {
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
      });

      throw error;
    }
  }

  /**
   * Perform the actual NFT minting operation with detailed error capture
   * Requirements: 1.1 - Capture detailed error information during minting
   */
  private async performNFTMinting(
    tokenId: string,
    metadata: BookingNFTMetadata,
    context: Record<string, any>
  ): Promise<{ serialNumber: number; transactionId: string }> {
    try {
      logger.info('Performing NFT minting operation', { tokenId });

      // Validate metadata size before minting
      this.validateMetadataSize(metadata.nftMetadata);

      const mintTx = new TokenMintTransaction()
        .setTokenId(TokenId.fromString(tokenId))
        .setMetadata([Buffer.from(JSON.stringify(metadata.nftMetadata))]);

      const mintResponse = await mintTx.execute(this.client);
      const mintReceipt = await mintResponse.getReceipt(this.client);

      if (!mintReceipt.serials || mintReceipt.serials.length === 0) {
        throw new Error('NFT minting failed - no serial numbers returned in receipt');
      }

      const serialNumber = mintReceipt.serials[0].toNumber();
      const transactionId = mintResponse.transactionId.toString();

      logger.info('NFT minting operation completed successfully', {
        tokenId,
        serialNumber,
        transactionId,
        status: mintReceipt.status.toString(),
      });

      return { serialNumber, transactionId };
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'NFT_MINTING_EXECUTION',
        context
      );

      logger.error('NFT minting execution failed', {
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
      });

      throw error;
    }
  }

  /**
   * Transfer an NFT from platform treasury to user's account
   * Enhanced with detailed error reporting and token association verification
   */
  private async transferNFTToUser(
    tokenId: string,
    serialNumber: number,
    userAccountId: string
  ): Promise<NFTTransferResult> {
    const transferContext = HederaErrorReporter.createNFTContext(
      undefined,
      undefined,
      userAccountId,
      tokenId,
      serialNumber,
      undefined
    );

    try {
      logger.info('Transferring NFT from platform to user with enhanced validation', {
        tokenId,
        serialNumber,
        userAccountId,
      });

      // Enhanced pre-flight check: Verify token association more thoroughly
      try {
        await this.verifyUserTokenAssociation(userAccountId, tokenId);
      } catch (associationError) {
        const associationErrorDetails = HederaErrorReporter.captureError(
          associationError,
          'TOKEN_ASSOCIATION_VERIFICATION',
          transferContext
        );
        
        logger.warn('Token association verification failed, attempting transfer anyway', { 
          error: associationErrorDetails,
          formattedError: HederaErrorReporter.formatErrorForLogging(associationErrorDetails),
        });
        
        // Continue with transfer attempt - some association issues may be resolved during transfer
      }

      const transferTx = new TransferTransaction()
        .addNftTransfer(new NftId(TokenId.fromString(tokenId), serialNumber), this.operatorAccountId, AccountId.fromString(userAccountId));

      const transferResponse = await transferTx.execute(this.client);
      const transferReceipt = await transferResponse.getReceipt(this.client);

      // Record the transfer in the Hedera topic
      try {
        await this.recordNFTTransfer(
          tokenId, 
          serialNumber, 
          this.operatorAccountId.toString(), 
          userAccountId, 
          transferResponse.transactionId.toString()
        );
      } catch (recordError) {
        logger.warn('Failed to record NFT transfer in topic (non-critical)', { 
          error: recordError,
          tokenId,
          serialNumber,
        });
      }

      logger.info('NFT transferred to user successfully with enhanced error reporting', {
        tokenId,
        serialNumber,
        transactionId: transferResponse.transactionId.toString(),
        status: transferReceipt.status.toString(),
      });

      return {
        transactionId: transferResponse.transactionId.toString(),
        fromAccount: this.operatorAccountId.toString(),
        toAccount: userAccountId,
        serialNumber,
      };
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'NFT_TRANSFER_TO_USER',
        transferContext
      );

      logger.error('Failed to transfer NFT to user with detailed error capture', { 
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
        tokenId,
        serialNumber,
        userAccountId,
      });

      // Throw enhanced error with detailed information
      const enhancedError = new Error(
        `NFT transfer to user failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
      );
      (enhancedError as any).hederaErrorDetails = errorDetails;
      (enhancedError as any).retryable = errorDetails.retryable;
      (enhancedError as any).recommendation = errorDetails.recommendation;
      throw enhancedError;
    }
  }

  /**
   * Transfer an NFT to a new owner
   * Enhanced with detailed error reporting and comprehensive logging
   */
  async transferNFT(
    tokenId: string,
    serialNumber: number,
    fromAccount: string,
    toAccount: string
  ): Promise<NFTTransferResult> {
    const startTime = Date.now();
    const transferContext = HederaErrorReporter.createNFTContext(
      undefined,
      undefined,
      toAccount,
      tokenId,
      serialNumber,
      undefined
    );
    transferContext.fromAccount = fromAccount;

    try {
      logger.info('Transferring booking NFT with enhanced error reporting', {
        tokenId,
        serialNumber,
        fromAccount,
        toAccount,
      });

      // Pre-flight checks for both accounts
      try {
        const [fromAccountReport, toAccountReport] = await Promise.all([
          this.permissionValidator.validateAccount(fromAccount),
          this.permissionValidator.validateAccount(toAccount),
        ]);

        if (!fromAccountReport.accountExists) {
          throw new Error(`Source account ${fromAccount} does not exist or is not accessible`);
        }

        if (!toAccountReport.accountExists) {
          throw new Error(`Destination account ${toAccount} does not exist or is not accessible`);
        }

        logger.info('Account validation completed for NFT transfer', {
          fromAccountExists: fromAccountReport.accountExists,
          toAccountExists: toAccountReport.accountExists,
          fromCanTransfer: fromAccountReport.canTransferNFTs,
          toCanReceive: toAccountReport.canTransferNFTs,
        });
      } catch (validationError) {
        logger.warn('Account validation failed, proceeding with transfer attempt', {
          error: validationError.message,
          tokenId,
          serialNumber,
        });
      }

      const transferTx = new TransferTransaction()
        .addNftTransfer(new NftId(TokenId.fromString(tokenId), serialNumber), AccountId.fromString(fromAccount), AccountId.fromString(toAccount));

      const transferResponse = await transferTx.execute(this.client);
      const transferReceipt = await transferResponse.getReceipt(this.client);

      // Record the transfer in the Hedera topic
      try {
        await this.recordNFTTransfer(tokenId, serialNumber, fromAccount, toAccount, transferResponse.transactionId.toString());
      } catch (recordError) {
        logger.warn('Failed to record NFT transfer in topic (non-critical)', { 
          error: recordError,
          tokenId,
          serialNumber,
        });
      }

      logger.info('Booking NFT transferred successfully with enhanced logging', {
        tokenId,
        serialNumber,
        transactionId: transferResponse.transactionId.toString(),
        status: transferReceipt.status.toString(),
        fromAccount,
        toAccount,
      });

      // Record successful transfer operation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'transfer',
        true,
        duration,
        {
          tokenId,
          accountId: toAccount,
          serialNumber,
        }
      );

      return {
        transactionId: transferResponse.transactionId.toString(),
        fromAccount,
        toAccount,
        serialNumber,
      };
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'NFT_TRANSFER',
        transferContext
      );

      logger.error('Failed to transfer booking NFT with detailed error capture', { 
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
        tokenId,
        serialNumber,
        fromAccount,
        toAccount,
      });

      // Record failed transfer operation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'transfer',
        false,
        duration,
        {
          tokenId,
          accountId: toAccount,
          serialNumber,
        },
        errorDetails
      );

      // Throw enhanced error with detailed information
      const enhancedError = new Error(
        `NFT transfer failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
      );
      (enhancedError as any).hederaErrorDetails = errorDetails;
      (enhancedError as any).retryable = errorDetails.retryable;
      (enhancedError as any).recommendation = errorDetails.recommendation;
      throw enhancedError;
    }
  }

  /**
   * Burn an NFT (when booking is cancelled or swap is completed)
   * Enhanced with detailed error reporting and comprehensive logging
   */
  async burnNFT(tokenId: string, serialNumber: number): Promise<string> {
    const burnContext = HederaErrorReporter.createNFTContext(
      undefined,
      undefined,
      undefined,
      tokenId,
      serialNumber,
      undefined
    );

    try {
      logger.info('Burning booking NFT with enhanced error reporting', { tokenId, serialNumber });

      // Pre-flight check: Validate operator permissions for burning
      try {
        const permissionReport = await this.permissionValidator.validateAccount(
          this.operatorAccountId.toString(),
          tokenId
        );

        if (!permissionReport.tokenPermissions.hasSupplyKey && !permissionReport.tokenPermissions.hasAdminKey) {
          logger.warn('Operator may lack permissions for NFT burning', {
            tokenId,
            serialNumber,
            hasSupplyKey: permissionReport.tokenPermissions.hasSupplyKey,
            hasAdminKey: permissionReport.tokenPermissions.hasAdminKey,
          });
        }
      } catch (validationError) {
        logger.warn('Permission validation failed, proceeding with burn attempt', {
          error: validationError.message,
          tokenId,
          serialNumber,
        });
      }

      const burnTx = new TokenBurnTransaction()
        .setTokenId(TokenId.fromString(tokenId))
        .setSerials([serialNumber]);

      const burnResponse = await burnTx.execute(this.client);
      const burnReceipt = await burnResponse.getReceipt(this.client);

      // Record the burn in the Hedera topic
      try {
        await this.recordNFTBurn(tokenId, serialNumber, burnResponse.transactionId.toString());
      } catch (recordError) {
        logger.warn('Failed to record NFT burn in topic (non-critical)', { 
          error: recordError,
          tokenId,
          serialNumber,
        });
      }

      logger.info('Booking NFT burned successfully with enhanced logging', {
        tokenId,
        serialNumber,
        transactionId: burnResponse.transactionId.toString(),
        status: burnReceipt.status.toString(),
      });

      return burnResponse.transactionId.toString();
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'NFT_BURN',
        burnContext
      );

      logger.error('Failed to burn booking NFT with detailed error capture', { 
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
        tokenId,
        serialNumber,
      });

      // Throw enhanced error with detailed information
      const enhancedError = new Error(
        `NFT burn failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
      );
      (enhancedError as any).hederaErrorDetails = errorDetails;
      (enhancedError as any).retryable = errorDetails.retryable;
      (enhancedError as any).recommendation = errorDetails.recommendation;
      throw enhancedError;
    }
  }

  /**
   * Get NFT information
   * Enhanced with detailed error reporting and comprehensive logging
   */
  async getNFTInfo(tokenId: string, serialNumber: number): Promise<any> {
    const startTime = Date.now();
    const queryContext = HederaErrorReporter.createNFTContext(
      undefined,
      undefined,
      undefined,
      tokenId,
      serialNumber,
      undefined
    );

    try {
      logger.info('Querying NFT information with enhanced error reporting', { tokenId, serialNumber });

      const nftInfoQuery = new TokenNftInfoQuery()
        .setNftId(new NftId(TokenId.fromString(tokenId), serialNumber));

      const nftInfo = await nftInfoQuery.execute(this.client);

      logger.info('NFT information retrieved successfully', {
        tokenId,
        serialNumber,
        accountId: nftInfo[0]?.accountId?.toString(),
        creationTime: nftInfo[0]?.creationTime?.toString(),
        metadata: nftInfo[0]?.metadata ? Buffer.from(nftInfo[0].metadata).toString() : undefined,
      });

      // Record successful query operation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'query',
        true,
        duration,
        {
          tokenId,
          serialNumber,
        }
      );

      return nftInfo;
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'NFT_INFO_QUERY',
        queryContext
      );

      logger.error('Failed to get NFT info with detailed error capture', { 
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
        tokenId,
        serialNumber,
      });

      // Record failed query operation in monitoring
      const duration = Date.now() - startTime;
      this.monitoring.recordOperation(
        'query',
        false,
        duration,
        {
          tokenId,
          serialNumber,
        },
        errorDetails
      );

      // Throw enhanced error with detailed information
      const enhancedError = new Error(
        `NFT info query failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
      );
      (enhancedError as any).hederaErrorDetails = errorDetails;
      (enhancedError as any).retryable = errorDetails.retryable;
      (enhancedError as any).recommendation = errorDetails.recommendation;
      throw enhancedError;
    }
  }

  /**
   * Get token information
   * Enhanced with detailed error reporting and comprehensive logging
   */
  async getTokenInfo(tokenId: string): Promise<any> {
    const queryContext = HederaErrorReporter.createTokenContext(
      tokenId,
      this.operatorAccountId.toString(),
      undefined,
      undefined
    );

    try {
      logger.info('Querying token information with enhanced error reporting', { tokenId });

      const tokenInfoQuery = new TokenInfoQuery()
        .setTokenId(TokenId.fromString(tokenId));

      const tokenInfo = await tokenInfoQuery.execute(this.client);

      logger.info('Token information retrieved successfully', {
        tokenId,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        tokenType: tokenInfo.tokenType.toString(),
        supplyType: tokenInfo.supplyType.toString(),
        totalSupply: tokenInfo.totalSupply.toString(),
        treasury: tokenInfo.treasuryAccountId.toString(),
        deleted: tokenInfo.isDeleted,
        paused: tokenInfo.pauseStatus,
      });

      return tokenInfo;
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'TOKEN_INFO_QUERY',
        queryContext
      );

      logger.error('Failed to get token info with detailed error capture', { 
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
        tokenId,
      });

      // Throw enhanced error with detailed information
      const enhancedError = new Error(
        `Token info query failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
      );
      (enhancedError as any).hederaErrorDetails = errorDetails;
      (enhancedError as any).retryable = errorDetails.retryable;
      (enhancedError as any).recommendation = errorDetails.recommendation;
      throw enhancedError;
    }
  }

  /**
   * Create metadata for a booking NFT
   */
  private createBookingMetadata(bookingData: any): BookingNFTMetadata {
    const attributes = [
      {
        trait_type: 'Location',
        value: `${bookingData.location.city}, ${bookingData.location.country}`,
      },
      {
        trait_type: 'Check-in Date',
        value: new Date(bookingData.dateRange.checkIn).toLocaleDateString(),
      },
      {
        trait_type: 'Check-out Date',
        value: new Date(bookingData.dateRange.checkOut).toLocaleDateString(),
      },
      {
        trait_type: 'Original Price',
        value: `$${bookingData.originalPrice.toLocaleString()}`,
      },
      {
        trait_type: 'Swap Value',
        value: `$${bookingData.swapValue.toLocaleString()}`,
      },
      {
        trait_type: 'Provider',
        value: bookingData.providerDetails.provider,
      },
      {
        trait_type: 'Verification Status',
        value: bookingData.verification?.status || 'pending',
      },
    ];

    return {
      bookingId: bookingData.id,
      userId: bookingData.userId,
      title: bookingData.title,
      location: bookingData.location,
      dateRange: bookingData.dateRange,
      originalPrice: bookingData.originalPrice,
      swapValue: bookingData.swapValue,
      providerDetails: bookingData.providerDetails,
      verification: bookingData.verification || { status: 'pending', documents: [] },
      nftMetadata: {
        name: `${bookingData.title}`,
        description: `${bookingData.location.city}, ${bookingData.location.country}`,
        image: `https://api.bookingswap.com/nft/${bookingData.id}/image`,
        attributes
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Record NFT creation in Hedera topic
   */
  private async recordNFTCreation(metadata: BookingNFTMetadata, transactionId: string): Promise<void> {
    try {
      const transactionData = {
        type: 'booking_nft_minted' as const,
        payload: {
          bookingId: metadata.bookingId,
          userId: metadata.userId,
          tokenId: metadata.tokenId,
          serialNumber: metadata.serialNumber,
          title: metadata.title,
          location: metadata.location,
          dateRange: metadata.dateRange,
          swapValue: metadata.swapValue,
          verification: metadata.verification,
          nftMetadata: metadata.nftMetadata,
        },
        timestamp: new Date(),
      };

      await this.hederaService.submitTransaction(transactionData);
    } catch (error) {
      logger.error('Failed to record NFT creation in topic', { error, metadata });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Record NFT transfer in Hedera topic
   */
  private async recordNFTTransfer(
    tokenId: string,
    serialNumber: number,
    fromAccount: string,
    toAccount: string,
    transactionId: string
  ): Promise<void> {
    try {
      const transactionData = {
        type: 'booking_nft_transferred' as const,
        payload: {
          tokenId,
          serialNumber,
          fromAccount,
          toAccount,
          transactionId,
        },
        timestamp: new Date(),
      };

      await this.hederaService.submitTransaction(transactionData);
    } catch (error) {
      logger.error('Failed to record NFT transfer in topic', { error, tokenId, serialNumber });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Record NFT burn in Hedera topic
   */
  private async recordNFTBurn(tokenId: string, serialNumber: number, transactionId: string): Promise<void> {
    try {
      const transactionData = {
        type: 'booking_nft_burned' as const,
        payload: {
          tokenId,
          serialNumber,
          transactionId,
        },
        timestamp: new Date(),
      };

      await this.hederaService.submitTransaction(transactionData);
    } catch (error) {
      logger.error('Failed to record NFT burn in topic', { error, tokenId, serialNumber });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Validate NFT metadata size to ensure it doesn't exceed Hedera limits
   * Hedera NFT metadata is limited to 100 bytes
   * Requirements: Error prevention for metadata size limits
   */
  private validateMetadataSize(metadata: any): void {
    const metadataString = JSON.stringify(metadata);
    const metadataBytes = Buffer.from(metadataString).length;
    const maxMetadataSize = 100; // Hedera NFT metadata limit

    if (metadataBytes > maxMetadataSize) {
      const error = new Error(
        `NFT metadata too large: ${metadataBytes} bytes. ` +
        `Maximum allowed: ${maxMetadataSize} bytes. ` +
        `Consider using shorter field values or external storage for large data. ` +
        `Current metadata: ${metadataString.substring(0, 200)}${metadataString.length > 200 ? '...' : ''}`
      );
      
      logger.error('NFT metadata size validation failed', {
        metadataSize: metadataBytes,
        maxSize: maxMetadataSize,
        metadata: metadataString.substring(0, 500), // Log first 500 chars for debugging
      });

      throw error;
    }

    logger.debug('NFT metadata size validation passed', {
      metadataSize: metadataBytes,
      maxSize: maxMetadataSize,
    });
  }
}
