import { Client, AccountId } from '@hashgraph/sdk';
import { AccountPermissionValidator } from '../AccountPermissionValidator';
import { getHederaConfig } from '../config';
import { logger } from '../../../utils/logger';

/**
 * Example demonstrating the AccountPermissionValidator functionality
 * This example shows how to validate account permissions for NFT operations
 */
async function demonstrateAccountPermissionValidation() {
  try {
    logger.info('Starting Account Permission Validation Example');

    // Get Hedera configuration
    const config = getHederaConfig();
    
    // Initialize Hedera client
    const client = config.network === 'testnet' 
      ? Client.forTestnet() 
      : Client.forMainnet();
    
    const operatorAccountId = AccountId.fromString(config.accountId);
    client.setOperator(operatorAccountId, config.privateKey);

    // Create AccountPermissionValidator instance
    const validator = new AccountPermissionValidator(client, operatorAccountId);

    // Example 1: Validate account balance only
    logger.info('=== Example 1: Account Balance Validation ===');
    const balanceResult = await validator.validateAccountBalance(config.accountId);
    
    if (balanceResult.passed) {
      const balanceData = JSON.parse(balanceResult.details);
      logger.info('Account balance validation passed', {
        balance: balanceData.hbar,
        sufficient: balanceData.sufficient,
        minimumRequired: balanceData.minimumRequired,
      });
    } else {
      logger.warn('Account balance validation failed', {
        details: balanceResult.details,
        recommendation: balanceResult.recommendation,
      });
    }

    // Example 2: Verify minimum balance for different operations
    logger.info('=== Example 2: Minimum Balance Verification ===');
    
    const operations = ['mint', 'transfer', 'create_token'] as const;
    for (const operation of operations) {
      const hasMinimum = await validator.verifyMinimumBalance(config.accountId, operation);
      logger.info(`Minimum balance check for ${operation}`, {
        operation,
        sufficient: hasMinimum,
      });
    }

    // Example 3: Comprehensive account validation (without token)
    logger.info('=== Example 3: Comprehensive Account Validation (No Token) ===');
    const accountReport = await validator.validateAccount(config.accountId);
    
    logger.info('Account validation report', {
      accountExists: accountReport.accountExists,
      balanceSufficient: accountReport.balance.sufficient,
      canMintNFTs: accountReport.canMintNFTs,
      canTransferNFTs: accountReport.canTransferNFTs,
      issuesCount: accountReport.issues.length,
      recommendationsCount: accountReport.recommendations.length,
    });

    if (accountReport.issues.length > 0) {
      logger.warn('Account validation issues found', {
        issues: accountReport.issues,
      });
    }

    if (accountReport.recommendations.length > 0) {
      logger.info('Account validation recommendations', {
        recommendations: accountReport.recommendations,
      });
    }

    // Example 4: Token permission validation (if token ID is available)
    if (process.env.HEDERA_TEST_TOKEN_ID) {
      logger.info('=== Example 4: Token Permission Validation ===');
      const tokenResult = await validator.validateTokenPermissions(
        process.env.HEDERA_TEST_TOKEN_ID,
        config.accountId
      );

      if (tokenResult.passed) {
        const tokenData = JSON.parse(tokenResult.details);
        logger.info('Token permission validation passed', {
          tokenName: tokenData.tokenInfo.name,
          hasSupplyKey: tokenData.permissions.hasSupplyKey,
          hasAdminKey: tokenData.permissions.hasAdminKey,
          canMintNFTs: tokenData.permissions.canMintNFTs,
        });

        // Example 5: Comprehensive validation with token
        logger.info('=== Example 5: Comprehensive Validation with Token ===');
        const fullReport = await validator.validateAccount(
          config.accountId,
          process.env.HEDERA_TEST_TOKEN_ID
        );

        logger.info('Full validation report with token', {
          accountExists: fullReport.accountExists,
          tokenExists: fullReport.tokenExists,
          canMintNFTs: fullReport.canMintNFTs,
          canTransferNFTs: fullReport.canTransferNFTs,
          overallStatus: fullReport.canMintNFTs && fullReport.canTransferNFTs ? 'READY' : 'NEEDS_ATTENTION',
        });
      } else {
        logger.warn('Token permission validation failed', {
          details: tokenResult.details,
          recommendation: tokenResult.recommendation,
        });
      }
    } else {
      logger.info('Skipping token validation - HEDERA_TEST_TOKEN_ID not set');
    }

    // Example 6: Configuration management
    logger.info('=== Example 6: Configuration Management ===');
    const currentRequirements = validator.getBalanceRequirements();
    logger.info('Current balance requirements', currentRequirements);

    // Update requirements for demonstration
    validator.setBalanceRequirements({
      minimumHbarForNFTOperations: 10,
      recommendedHbarBuffer: 25,
    });

    const updatedRequirements = validator.getBalanceRequirements();
    logger.info('Updated balance requirements', updatedRequirements);

    // Example 7: Error handling demonstration
    logger.info('=== Example 7: Error Handling ===');
    try {
      // Try to validate an invalid account ID
      const invalidResult = await validator.validateAccountBalance('0.0.invalid');
      logger.info('Invalid account validation result', {
        passed: invalidResult.passed,
        details: invalidResult.details,
      });
    } catch (error) {
      logger.error('Error handling demonstration', { error: error.message });
    }

    // Close the client
    client.close();
    logger.info('Account Permission Validation Example completed successfully');

  } catch (error) {
    logger.error('Account Permission Validation Example failed', { 
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Run the example if this file is executed directly
 */
if (require.main === module) {
  demonstrateAccountPermissionValidation()
    .then(() => {
      logger.info('Example completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Example failed', { error });
      process.exit(1);
    });
}

export { demonstrateAccountPermissionValidation };