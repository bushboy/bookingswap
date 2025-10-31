#!/usr/bin/env tsx

import { config } from 'dotenv';
import { HederaService } from '../../hedera/HederaService';
import { ContractService } from '../../hedera/ContractService';
import { BlockchainVerificationService } from '../../hedera/BlockchainVerificationService';
import { AtomicSwapService, SwapExecutionRequest } from '../AtomicSwapService';
import { logger } from '../../../utils/logger';

// Load environment variables
config();

/**
 * Example demonstrating complete atomic swap execution
 */
async function atomicSwapExample() {
  try {
    console.log('🚀 Starting Atomic Swap Example\n');

    // Initialize services
    const hederaService = new HederaService(
      'testnet',
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!,
      process.env.HEDERA_TOPIC_ID
    );

    const contractService = new ContractService(hederaService);
    const verificationService = new BlockchainVerificationService(hederaService);
    const atomicSwapService = new AtomicSwapService(hederaService, contractService);

    // Set contract ID if already deployed
    if (process.env.ESCROW_CONTRACT_ID) {
      contractService.setContractId(process.env.ESCROW_CONTRACT_ID);
      console.log(`📋 Using existing contract: ${process.env.ESCROW_CONTRACT_ID}`);
    } else {
      console.log('🔧 Deploying new escrow contract...');
      const contractId = await contractService.deployEscrowContract();
      console.log(`✅ Contract deployed: ${contractId}\n`);
    }

    // Step 1: Register bookings
    console.log('📝 Step 1: Registering bookings...');
    
    const timestamp = Date.now();
    const sourceBookingId = `hotel_booking_${timestamp}`;
    const targetBookingId = `event_booking_${timestamp}`;

    const sourceBooking = {
      bookingId: sourceBookingId,
      value: 5000000, // 5 HBAR
      metadata: 'QmSourceHotelBookingMetadata123',
    };

    const targetBooking = {
      bookingId: targetBookingId,
      value: 6000000, // 6 HBAR
      metadata: 'QmTargetEventBookingMetadata456',
    };

    console.log(`  • Registering source booking: ${sourceBookingId}`);
    const sourceResult = await contractService.registerBooking(sourceBooking, sourceBooking.value);
    console.log(`    ✅ Transaction: ${sourceResult.transactionId}`);

    console.log(`  • Registering target booking: ${targetBookingId}`);
    const targetResult = await contractService.registerBooking(targetBooking, targetBooking.value);
    console.log(`    ✅ Transaction: ${targetResult.transactionId}\n`);

    // Step 2: Verify bookings are registered
    console.log('🔍 Step 2: Verifying booking registration...');
    
    const sourceBookingDetails = await contractService.getBooking(sourceBookingId);
    const targetBookingDetails = await contractService.getBooking(targetBookingId);
    
    console.log(`  • Source booking owner: ${sourceBookingDetails.owner}`);
    console.log(`  • Target booking owner: ${targetBookingDetails.owner}`);
    console.log(`  • Both bookings unlocked: ${!sourceBookingDetails.isLocked && !targetBookingDetails.isLocked}\n`);

    // Step 3: Create atomic swap request
    console.log('⚡ Step 3: Preparing atomic swap...');
    
    const swapRequest: SwapExecutionRequest = {
      swapId: `atomic_swap_${timestamp}`,
      sourceBookingId,
      targetBookingId,
      proposerAccountId: process.env.HEDERA_ACCOUNT_ID!,
      acceptorAccountId: process.env.HEDERA_ACCOUNT_ID!, // Same account for demo
      additionalPayment: 1000000, // 1 HBAR difference
      expirationTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    console.log(`  • Swap ID: ${swapRequest.swapId}`);
    console.log(`  • Additional payment: ${swapRequest.additionalPayment / 100000000} HBAR`);
    console.log(`  • Expires in: 1 hour\n`);

    // Step 4: Execute atomic swap
    console.log('🔄 Step 4: Executing atomic swap...');
    console.log('  This may take a few minutes as it involves multiple blockchain transactions...\n');

    const swapResult = await atomicSwapService.executeAtomicSwap(swapRequest);

    if (swapResult.success) {
      console.log('✅ Atomic swap completed successfully!');
      console.log(`  • Swap ID: ${swapResult.swapId}`);
      console.log(`  • Final transaction: ${swapResult.transactionId}`);
      console.log(`  • Consensus timestamp: ${swapResult.consensusTimestamp}\n`);

      // Step 5: Verify swap completion
      console.log('🔍 Step 5: Verifying swap completion...');
      
      const finalSwapDetails = await contractService.getSwap(swapRequest.swapId);
      console.log(`  • Final swap status: ${finalSwapDetails.status} (2 = COMPLETED)`);
      
      const finalSourceBooking = await contractService.getBooking(sourceBookingId);
      const finalTargetBooking = await contractService.getBooking(targetBookingId);
      
      console.log(`  • Source booking new owner: ${finalSourceBooking.owner}`);
      console.log(`  • Target booking new owner: ${finalTargetBooking.owner}`);
      console.log(`  • Bookings unlocked: ${!finalSourceBooking.isLocked && !finalTargetBooking.isLocked}`);

      // Step 6: Verify transactions on blockchain
      console.log('\n🔐 Step 6: Blockchain verification...');
      
      if (swapResult.transactionId && swapResult.transactionId !== 'already_executed') {
        const verification = await verificationService.verifyTransaction(swapResult.transactionId);
        console.log(`  • Transaction verified: ${verification.isValid}`);
        console.log(`  • Status: ${verification.status}`);
      }

      console.log('\n🎉 Atomic swap example completed successfully!');
      
    } else {
      console.log('❌ Atomic swap failed:');
      console.log(`  • Error: ${swapResult.error}`);
      
      if (swapResult.rollbackTransactionId) {
        console.log(`  • Rollback transaction: ${swapResult.rollbackTransactionId}`);
        
        // Verify rollback
        const rollbackVerification = await verificationService.verifyTransaction(swapResult.rollbackTransactionId);
        console.log(`  • Rollback verified: ${rollbackVerification.isValid}`);
      }
    }

    // Cleanup
    hederaService.close();

  } catch (error) {
    console.error('❌ Example failed:', error.message);
    logger.error('Atomic swap example failed', { error });
    process.exit(1);
  }
}

/**
 * Example demonstrating swap validation and error handling
 */
async function swapValidationExample() {
  try {
    console.log('\n🔍 Swap Validation Example\n');

    const hederaService = new HederaService(
      'testnet',
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!
    );

    const contractService = new ContractService(hederaService);
    const atomicSwapService = new AtomicSwapService(hederaService, contractService);

    if (process.env.ESCROW_CONTRACT_ID) {
      contractService.setContractId(process.env.ESCROW_CONTRACT_ID);
    }

    // Test with invalid swap request
    const invalidSwapRequest: SwapExecutionRequest = {
      swapId: `invalid_swap_${Date.now()}`,
      sourceBookingId: 'non_existent_booking',
      targetBookingId: 'another_non_existent_booking',
      proposerAccountId: process.env.HEDERA_ACCOUNT_ID!,
      acceptorAccountId: process.env.HEDERA_ACCOUNT_ID!,
      expirationTime: Math.floor(Date.now() / 1000) + 3600,
    };

    console.log('Testing swap with non-existent bookings...');
    const result = await atomicSwapService.executeAtomicSwap(invalidSwapRequest);

    console.log(`Result: ${result.success ? 'Success' : 'Failed'}`);
    if (!result.success) {
      console.log(`Error: ${result.error}`);
    }

    hederaService.close();

  } catch (error) {
    console.error('Validation example failed:', error.message);
  }
}

/**
 * Example demonstrating swap execution monitoring
 */
async function swapMonitoringExample() {
  try {
    console.log('\n📊 Swap Monitoring Example\n');

    const hederaService = new HederaService(
      'testnet',
      process.env.HEDERA_ACCOUNT_ID!,
      process.env.HEDERA_PRIVATE_KEY!
    );

    const contractService = new ContractService(hederaService);
    const atomicSwapService = new AtomicSwapService(hederaService, contractService);

    // Check active swaps
    const activeSwaps = atomicSwapService.getActiveSwaps();
    console.log(`Active swaps: ${activeSwaps.length}`);

    // Cleanup expired executions
    const cleanedCount = atomicSwapService.cleanupExpiredExecutions(60000); // 1 minute
    console.log(`Cleaned up expired executions: ${cleanedCount}`);

    hederaService.close();

  } catch (error) {
    console.error('Monitoring example failed:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 Atomic Swap Service Examples

Usage: tsx examples/atomic-swap-example.ts [options]

Options:
  --validation    Run validation example only
  --monitoring    Run monitoring example only
  --help, -h      Show this help

Environment Variables Required:
  HEDERA_ACCOUNT_ID       Your Hedera account ID
  HEDERA_PRIVATE_KEY      Your Hedera private key
  ESCROW_CONTRACT_ID      Deployed escrow contract ID (optional)

Examples:
  # Run complete atomic swap example
  tsx examples/atomic-swap-example.ts

  # Run validation example only
  tsx examples/atomic-swap-example.ts --validation

  # Run monitoring example only
  tsx examples/atomic-swap-example.ts --monitoring
`);
    return;
  }

  if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
    console.error('❌ Missing required environment variables: HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY');
    process.exit(1);
  }

  if (args.includes('--validation')) {
    await swapValidationExample();
  } else if (args.includes('--monitoring')) {
    await swapMonitoringExample();
  } else {
    await atomicSwapExample();
    await swapValidationExample();
    await swapMonitoringExample();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { atomicSwapExample, swapValidationExample, swapMonitoringExample };