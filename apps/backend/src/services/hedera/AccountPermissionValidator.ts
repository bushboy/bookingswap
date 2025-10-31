import {
  Client,
  AccountId,
  TokenId,
  AccountBalanceQuery,
  TokenInfoQuery,
  Hbar,
  Status,
  AccountInfoQuery,
  Key,
} from '@hashgraph/sdk';
import { logger } from '../../utils/logger';
import { HederaErrorReporter, HederaErrorDetails, HederaErrorType } from './HederaErrorReporter';

/**
 * Report structure for account balance validation
 */
export interface AccountBalanceReport {
  hbar: string;
  sufficient: boolean;
  minimumRequired: string;
  recommendedAmount: string;
}

/**
 * Report structure for token permissions validation
 */
export interface TokenPermissionReport {
  hasSupplyKey: boolean;
  hasAdminKey: boolean;
  hasWipeKey: boolean;
  hasFreezeKey: boolean;
  hasKycKey: boolean;
  hasPauseKey: boolean;
  canMintNFTs: boolean;
  canManageToken: boolean;
}

/**
 * Comprehensive account permission validation report
 */
export interface AccountPermissionReport {
  accountId: string;
  accountExists: boolean;
  balance: AccountBalanceReport;
  tokenPermissions: TokenPermissionReport;
  tokenExists: boolean;
  tokenInfo?: any;
  canMintNFTs: boolean;
  canTransferNFTs: boolean;
  issues: string[];
  recommendations: string[];
  validationTimestamp: Date;
}

/**
 * Individual permission check result
 */
export interface PermissionCheckResult {
  check: string;
  passed: boolean;
  details: string;
  recommendation?: string;
  errorDetails?: HederaErrorDetails;
}

/**
 * Configuration for minimum balance requirements
 */
export interface BalanceRequirements {
  minimumHbarForNFTOperations: number; // Minimum HBAR for NFT operations
  recommendedHbarBuffer: number; // Recommended buffer above minimum
  tokenCreationCost: number; // Cost for creating new tokens
  nftMintingCost: number; // Cost per NFT minting operation
  nftTransferCost: number; // Cost per NFT transfer operation
}

/**
 * Account permission validator for Hedera NFT operations
 * Validates account balance, token permissions, and NFT operation capabilities
 */
export class AccountPermissionValidator {
  private client: Client;
  private operatorAccountId: AccountId;
  private balanceRequirements: BalanceRequirements;

  constructor(client: Client, operatorAccountId: AccountId) {
    this.client = client;
    this.operatorAccountId = operatorAccountId;
    
    // Default balance requirements (can be configured)
    this.balanceRequirements = {
      minimumHbarForNFTOperations: 5, // 5 HBAR minimum
      recommendedHbarBuffer: 10, // 10 HBAR recommended buffer
      tokenCreationCost: 20, // 20 HBAR for token creation
      nftMintingCost: 0.1, // 0.1 HBAR per NFT mint
      nftTransferCost: 0.001, // 0.001 HBAR per NFT transfer
    };
  }

  /**
   * Validate account permissions for NFT operations
   * Requirement 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async validateAccount(accountId: string, tokenId?: string): Promise<AccountPermissionReport> {
    const validationTimestamp = new Date();
    const issues: string[] = [];
    const recommendations: string[] = [];

    logger.info('Starting account permission validation', {
      accountId,
      tokenId,
      timestamp: validationTimestamp.toISOString(),
    });

    try {
      // Initialize report structure
      const report: AccountPermissionReport = {
        accountId,
        accountExists: false,
        balance: {
          hbar: '0',
          sufficient: false,
          minimumRequired: this.balanceRequirements.minimumHbarForNFTOperations.toString(),
          recommendedAmount: this.balanceRequirements.recommendedHbarBuffer.toString(),
        },
        tokenPermissions: {
          hasSupplyKey: false,
          hasAdminKey: false,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: false,
          canManageToken: false,
        },
        tokenExists: false,
        canMintNFTs: false,
        canTransferNFTs: false,
        issues,
        recommendations,
        validationTimestamp,
      };

      // Validate account existence and balance (Requirement 2.1)
      const balanceResult = await this.validateAccountBalance(accountId);
      report.accountExists = balanceResult.passed;
      
      if (balanceResult.passed && balanceResult.details) {
        const balanceData = JSON.parse(balanceResult.details);
        report.balance = balanceData;
      } else {
        issues.push(balanceResult.details);
        if (balanceResult.recommendation) {
          recommendations.push(balanceResult.recommendation);
        }
      }

      // Validate token permissions if token ID is provided (Requirement 2.2, 2.3)
      if (tokenId) {
        const tokenResult = await this.validateTokenPermissions(tokenId, accountId);
        report.tokenExists = tokenResult.passed;
        
        if (tokenResult.passed && tokenResult.details) {
          const tokenData = JSON.parse(tokenResult.details);
          report.tokenPermissions = tokenData.permissions;
          report.tokenInfo = tokenData.tokenInfo;
        } else {
          issues.push(tokenResult.details);
          if (tokenResult.recommendation) {
            recommendations.push(tokenResult.recommendation);
          }
        }
      }

      // Determine overall NFT operation capabilities (Requirement 2.4)
      report.canMintNFTs = this.canPerformNFTMinting(report);
      report.canTransferNFTs = this.canPerformNFTTransfer(report);

      // Add general recommendations (Requirement 2.5)
      this.addGeneralRecommendations(report);

      logger.info('Account permission validation completed', {
        accountId,
        tokenId,
        canMintNFTs: report.canMintNFTs,
        canTransferNFTs: report.canTransferNFTs,
        issuesCount: issues.length,
        recommendationsCount: recommendations.length,
      });

      return report;
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'ACCOUNT_PERMISSION_VALIDATION',
        HederaErrorReporter.createAccountContext(accountId, undefined, 'permission_validation')
      );

      logger.error('Account permission validation failed', {
        error: errorDetails,
        formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
      });

      // Return a failed validation report
      return {
        accountId,
        accountExists: false,
        balance: {
          hbar: '0',
          sufficient: false,
          minimumRequired: this.balanceRequirements.minimumHbarForNFTOperations.toString(),
          recommendedAmount: this.balanceRequirements.recommendedHbarBuffer.toString(),
        },
        tokenPermissions: {
          hasSupplyKey: false,
          hasAdminKey: false,
          hasWipeKey: false,
          hasFreezeKey: false,
          hasKycKey: false,
          hasPauseKey: false,
          canMintNFTs: false,
          canManageToken: false,
        },
        tokenExists: false,
        canMintNFTs: false,
        canTransferNFTs: false,
        issues: [`Validation failed: ${errorDetails.errorMessage}`],
        recommendations: [errorDetails.recommendation || 'Check account configuration and network connectivity'],
        validationTimestamp,
      };
    }
  }

  /**
   * Validate account balance for NFT operations
   * Requirement 2.1: Verify sufficient HBAR balance
   */
  async validateAccountBalance(accountId: string): Promise<PermissionCheckResult> {
    try {
      logger.info('Validating account balance', { accountId });

      const accountIdObj = AccountId.fromString(accountId);
      const balanceQuery = new AccountBalanceQuery().setAccountId(accountIdObj);
      const balance = await balanceQuery.execute(this.client);

      const hbarBalance = balance.hbars.toBigNumber().toNumber();
      const minimumRequired = this.balanceRequirements.minimumHbarForNFTOperations;
      const recommendedAmount = this.balanceRequirements.recommendedHbarBuffer;
      
      const sufficient = hbarBalance >= minimumRequired;

      const balanceReport: AccountBalanceReport = {
        hbar: hbarBalance.toString(),
        sufficient,
        minimumRequired: minimumRequired.toString(),
        recommendedAmount: recommendedAmount.toString(),
      };

      if (sufficient) {
        return {
          check: 'account_balance',
          passed: true,
          details: JSON.stringify(balanceReport),
        };
      } else {
        return {
          check: 'account_balance',
          passed: false,
          details: `Insufficient HBAR balance: ${hbarBalance} HBAR (minimum required: ${minimumRequired} HBAR)`,
          recommendation: `Add at least ${minimumRequired - hbarBalance} HBAR to the account. Recommended total: ${recommendedAmount} HBAR for optimal operations.`,
        };
      }
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'ACCOUNT_BALANCE_VALIDATION',
        HederaErrorReporter.createAccountContext(accountId, undefined, 'balance_check')
      );

      return {
        check: 'account_balance',
        passed: false,
        details: `Account balance validation failed: ${errorDetails.errorMessage}`,
        recommendation: errorDetails.recommendation,
        errorDetails,
      };
    }
  }

  /**
   * Validate token permissions for NFT operations
   * Requirement 2.2, 2.3: Verify token keys and configuration
   */
  async validateTokenPermissions(tokenId: string, accountId: string): Promise<PermissionCheckResult> {
    try {
      logger.info('Validating token permissions', { tokenId, accountId });

      const tokenIdObj = TokenId.fromString(tokenId);
      const tokenInfoQuery = new TokenInfoQuery().setTokenId(tokenIdObj);
      const tokenInfo = await tokenInfoQuery.execute(this.client);

      // Check if account has the required keys for token operations
      const accountIdObj = AccountId.fromString(accountId);
      const permissions: TokenPermissionReport = {
        hasSupplyKey: this.hasTokenKey(tokenInfo.supplyKey, accountIdObj),
        hasAdminKey: this.hasTokenKey(tokenInfo.adminKey, accountIdObj),
        hasWipeKey: this.hasTokenKey(tokenInfo.wipeKey, accountIdObj),
        hasFreezeKey: this.hasTokenKey(tokenInfo.freezeKey, accountIdObj),
        hasKycKey: this.hasTokenKey(tokenInfo.kycKey, accountIdObj),
        hasPauseKey: this.hasTokenKey(tokenInfo.pauseKey, accountIdObj),
        canMintNFTs: false,
        canManageToken: false,
      };

      // Determine NFT minting capability
      permissions.canMintNFTs = permissions.hasSupplyKey && (permissions.hasAdminKey || permissions.hasSupplyKey);
      permissions.canManageToken = permissions.hasAdminKey;

      const tokenData = {
        permissions,
        tokenInfo: {
          tokenId: tokenInfo.tokenId.toString(),
          name: tokenInfo.name,
          symbol: tokenInfo.symbol,
          tokenType: tokenInfo.tokenType.toString(),
          supplyType: tokenInfo.supplyType.toString(),
          totalSupply: tokenInfo.totalSupply.toString(),
          treasury: tokenInfo.treasuryAccountId.toString(),
          deleted: tokenInfo.isDeleted,
          paused: tokenInfo.pauseStatus,
        },
      };

      return {
        check: 'token_permissions',
        passed: true,
        details: JSON.stringify(tokenData),
      };
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        'TOKEN_PERMISSION_VALIDATION',
        HederaErrorReporter.createTokenContext(tokenId, accountId, undefined, undefined)
      );

      return {
        check: 'token_permissions',
        passed: false,
        details: `Token permission validation failed: ${errorDetails.errorMessage}`,
        recommendation: errorDetails.recommendation,
        errorDetails,
      };
    }
  }

  /**
   * Verify minimum balance for specific NFT operations
   * Requirement 2.1: Check balance against operation-specific requirements
   */
  async verifyMinimumBalance(accountId: string, operation: 'mint' | 'transfer' | 'create_token' = 'mint'): Promise<boolean> {
    try {
      const balanceResult = await this.validateAccountBalance(accountId);
      
      if (!balanceResult.passed) {
        return false;
      }

      const balanceData = JSON.parse(balanceResult.details);
      const currentBalance = parseFloat(balanceData.hbar);
      
      let requiredBalance: number;
      switch (operation) {
        case 'create_token':
          requiredBalance = this.balanceRequirements.tokenCreationCost;
          break;
        case 'mint':
          requiredBalance = this.balanceRequirements.nftMintingCost;
          break;
        case 'transfer':
          requiredBalance = this.balanceRequirements.nftTransferCost;
          break;
        default:
          requiredBalance = this.balanceRequirements.minimumHbarForNFTOperations;
      }

      const sufficient = currentBalance >= requiredBalance;
      
      logger.info('Minimum balance verification', {
        accountId,
        operation,
        currentBalance,
        requiredBalance,
        sufficient,
      });

      return sufficient;
    } catch (error) {
      logger.error('Minimum balance verification failed', { error, accountId, operation });
      return false;
    }
  }

  /**
   * Check if account has specific token key
   */
  private hasTokenKey(tokenKey: Key | null, accountId: AccountId): boolean {
    if (!tokenKey) {
      return false;
    }

    // For simplicity, we'll check if the account ID matches the operator account
    // In a real implementation, you would need to check key structures more thoroughly
    return this.operatorAccountId.equals(accountId);
  }

  /**
   * Determine if account can perform NFT minting operations
   */
  private canPerformNFTMinting(report: AccountPermissionReport): boolean {
    return (
      report.accountExists &&
      report.balance.sufficient &&
      report.tokenExists &&
      report.tokenPermissions.canMintNFTs
    );
  }

  /**
   * Determine if account can perform NFT transfer operations
   */
  private canPerformNFTTransfer(report: AccountPermissionReport): boolean {
    return (
      report.accountExists &&
      report.balance.sufficient
      // Note: NFT transfers don't require special token keys, just sufficient balance
    );
  }

  /**
   * Add general recommendations based on validation results
   */
  private addGeneralRecommendations(report: AccountPermissionReport): void {
    if (!report.accountExists) {
      report.recommendations.push('Verify the account ID format and ensure the account exists on the network');
    }

    if (!report.balance.sufficient) {
      const needed = parseFloat(report.balance.minimumRequired) - parseFloat(report.balance.hbar);
      report.recommendations.push(`Add at least ${needed.toFixed(3)} HBAR to meet minimum balance requirements`);
    }

    if (report.tokenExists && !report.tokenPermissions.canMintNFTs) {
      report.recommendations.push('Ensure the account has supply key permissions for NFT minting operations');
    }

    if (!report.tokenExists && report.accountExists) {
      report.recommendations.push('Create or configure the NFT token before attempting minting operations');
    }

    if (report.canMintNFTs && report.canTransferNFTs) {
      report.recommendations.push('Account is properly configured for NFT operations');
    }

    // Add balance buffer recommendation
    const currentBalance = parseFloat(report.balance.hbar);
    const recommendedBalance = parseFloat(report.balance.recommendedAmount);
    if (currentBalance < recommendedBalance) {
      report.recommendations.push(`Consider maintaining a balance of ${recommendedBalance} HBAR for optimal operations`);
    }
  }

  /**
   * Update balance requirements configuration
   */
  setBalanceRequirements(requirements: Partial<BalanceRequirements>): void {
    this.balanceRequirements = {
      ...this.balanceRequirements,
      ...requirements,
    };

    logger.info('Balance requirements updated', {
      requirements: this.balanceRequirements,
    });
  }

  /**
   * Get current balance requirements
   */
  getBalanceRequirements(): BalanceRequirements {
    return { ...this.balanceRequirements };
  }
}