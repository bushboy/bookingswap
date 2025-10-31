#!/usr/bin/env tsx

import { config } from 'dotenv';
import { HederaService } from '../src/services/hedera/HederaService';
import { ContractService } from '../src/services/hedera/ContractService';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

interface DeploymentConfig {
  network: 'testnet' | 'mainnet';
  accountId: string;
  privateKey: string;
  topicId?: string;
}

async function deployContract() {
  try {
    // Validate environment variables
    const deployConfig: DeploymentConfig = {
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
      accountId: process.env.HEDERA_ACCOUNT_ID!,
      privateKey: process.env.HEDERA_PRIVATE_KEY!,
      topicId: process.env.HEDERA_TOPIC_ID,
    };

    if (!deployConfig.accountId || !deployConfig.privateKey) {
      throw new Error('Missing required environment variables: HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY');
    }

    logger.info('Starting contract deployment', {
      network: deployConfig.network,
      accountId: deployConfig.accountId,
    });

    // Initialize services
    const hederaService = new HederaService(
      deployConfig.network,
      deployConfig.accountId,
      deployConfig.privateKey,
      deployConfig.topicId
    );

    const contractService = new ContractService(hederaService);

    // Check account balance
    const balance = await hederaService.getAccountBalance();
    logger.info('Account balance', { balance: balance.toString() });

    if (balance.toTinybars().toNumber() < 10000000000) { // Less than 100 HBAR
      logger.warn('Low account balance - deployment may fail');
    }

    // Deploy the contract
    logger.info('Deploying BookingEscrow contract...');
    const contractId = await contractService.deployEscrowContract(1000000); // 1M gas

    logger.info('Contract deployed successfully!', {
      contractId,
      network: deployConfig.network,
    });

    // Test basic contract functionality
    logger.info('Testing contract functionality...');
    
    // Test contract info retrieval
    const testBalance = await contractService.getUserBalance(deployConfig.accountId);
    logger.info('Contract test successful', { userBalance: testBalance });

    // Save contract ID to environment file
    const envContent = `
# Contract deployment info
ESCROW_CONTRACT_ID=${contractId}
ESCROW_CONTRACT_NETWORK=${deployConfig.network}
ESCROW_CONTRACT_DEPLOYED_AT=${new Date().toISOString()}
`;

    const fs = await import('fs');
    const path = await import('path');
    
    const envPath = path.join(__dirname, '../.env.contract');
    fs.writeFileSync(envPath, envContent);
    
    logger.info('Contract deployment info saved', { envPath });

    // Close connection
    hederaService.close();

    console.log('\n✅ Contract deployment completed successfully!');
    console.log(`📋 Contract ID: ${contractId}`);
    console.log(`🌐 Network: ${deployConfig.network}`);
    console.log(`💾 Environment file: ${envPath}`);
    console.log('\nNext steps:');
    console.log('1. Add ESCROW_CONTRACT_ID to your .env file');
    console.log('2. Update your application configuration');
    console.log('3. Run integration tests to verify functionality');

  } catch (error) {
    logger.error('Contract deployment failed', { error });
    console.error('\n❌ Contract deployment failed:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log(`
📋 Contract Deployment Script

Usage: tsx scripts/deploy-contract.ts [options]

Options:
  --help, -h     Show this help message

Environment Variables Required:
  HEDERA_ACCOUNT_ID    Your Hedera account ID (e.g., 0.0.123456)
  HEDERA_PRIVATE_KEY   Your Hedera private key
  HEDERA_NETWORK       Network to deploy to (testnet|mainnet, default: testnet)
  HEDERA_TOPIC_ID      Optional: Existing topic ID for consensus service

Example:
  HEDERA_ACCOUNT_ID=0.0.123456 \\
  HEDERA_PRIVATE_KEY=302e020100... \\
  HEDERA_NETWORK=testnet \\
  tsx scripts/deploy-contract.ts
`);
  process.exit(0);
}

// Run deployment
if (require.main === module) {
  deployContract().catch((error) => {
    console.error('Deployment script error:', error);
    process.exit(1);
  });
}

export { deployContract };