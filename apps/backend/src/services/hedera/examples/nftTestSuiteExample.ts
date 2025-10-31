/**
 * Example usage of NFTTestSuite for testing Hedera NFT operations
 * 
 * This example demonstrates how to use the NFTTestSuite to test various
 * NFT operations in isolation, including token creation, minting, transfer,
 * and query operations.
 */

import { HederaService } from '../HederaService';
import { NFTTestSuite, NFTTestResult } from '../NFTTestSuite';
import { getHederaConfig } from '../config';
import { logger } from '../../../utils/logger';

/**
 * Example: Basic NFT Test Suite Usage
 */
async function basicNFTTestExample(): Promise<void> {
  console.log('\n=== Basic NFT Test Suite Example ===');
  
  try {
    // Initialize Hedera service
    const config = getHederaConfig();
    const hederaService = new HederaService(config);
    await hederaService.initialize();
    
    // Create NFT test suite
    const nftTestSuite = new NFTTestSuite(hederaService);
    
    // Test 1: Create a test token
    console.log('\n1. Testing token creation...');
    const tokenResult = await nftTestSuite.testTokenCreation();
    
    if (tokenResult.success) {
      console.log('✅ Token created successfully:', {
        tokenId: tokenResult.details.tokenId,
        transactionId: tokenResult.transactionId,
        duration: `${tokenResult.duration}ms`,
      });
      
      // Test 2: Mint an NFT
      console.log('\n2. Testing NFT minting...');
      const mintResult = await nftTestSuite.testNFTMinting(tokenResult.details.tokenId);
      
      if (mintResult.success) {
        console.log('✅ NFT minted successfully:', {
          serialNumber: mintResult.details.serialNumber,
          transactionId: mintResult.transactionId,
          duration: `${mintResult.duration}ms`,
        });
        
        // Test 3: Query the NFT
        console.log('\n3. Testing NFT query...');
        const queryResult = await nftTestSuite.testNFTQuery(
          tokenResult.details.tokenId,
          mintResult.details.serialNumber
        );
        
        if (queryResult.success) {
          console.log('✅ NFT queried successfully:', {
            nftId: queryResult.details.nftInfo.nftId,
            metadataValid: queryResult.details.nftInfo.metadataValid,
            duration: `${queryResult.duration}ms`,
          });
        } else {
          console.log('❌ NFT query failed:', queryResult.error?.errorMessage);
        }
        
        // Test 4: Transfer the NFT (same account for testing)
        console.log('\n4. Testing NFT transfer...');
        const transferResult = await nftTestSuite.testNFTTransfer(
          tokenResult.details.tokenId,
          mintResult.details.serialNumber
        );
        
        if (transferResult.success) {
          console.log('✅ NFT transfer test completed:', {
            transactionId: transferResult.transactionId,
            duration: `${transferResult.duration}ms`,
          });
        } else {
          console.log('❌ NFT transfer failed:', transferResult.error?.errorMessage);
        }
      } else {
        console.log('❌ NFT minting failed:', mintResult.error?.errorMessage);
      }
    } else {
      console.log('❌ Token creation failed:', tokenResult.error?.errorMessage);
    }
    
    // Clean up test assets
    console.log('\n5. Cleaning up test assets...');
    await nftTestSuite.cleanupTestAssets();
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

/**
 * Example: Full Test Suite Execution
 */
async function fullTestSuiteExample(): Promise<void> {
  console.log('\n=== Full Test Suite Example ===');
  
  try {
    // Initialize Hedera service
    const config = getHederaConfig();
    const hederaService = new HederaService(config);
    await hederaService.initialize();
    
    // Create NFT test suite
    const nftTestSuite = new NFTTestSuite(hederaService);
    
    // Run the complete test suite
    console.log('\nRunning full NFT test suite...');
    const results = await nftTestSuite.runFullTestSuite();
    
    // Analyze results
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    
    console.log('\n📊 Test Suite Results:');
    console.log(`Total tests: ${results.length}`);
    console.log(`Successful: ${successfulTests.length}`);
    console.log(`Failed: ${failedTests.length}`);
    console.log(`Success rate: ${((successfulTests.length / results.length) * 100).toFixed(1)}%`);
    
    // Display detailed results
    console.log('\n📋 Detailed Results:');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      
      console.log(`${index + 1}. ${status} ${result.testName} (${duration})`);
      
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error.errorMessage}`);
        console.log(`   Type: ${result.error.errorType}`);
        if (result.error.recommendation) {
          console.log(`   Recommendation: ${result.error.recommendation}`);
        }
      }
    });
    
    // Clean up
    console.log('\nCleaning up test assets...');
    await nftTestSuite.cleanupTestAssets();
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Full test suite example failed:', error);
  }
}

/**
 * Example: Testing Failure Scenarios
 */
async function failureScenarioExample(): Promise<void> {
  console.log('\n=== Failure Scenario Testing Example ===');
  
  try {
    // Initialize Hedera service
    const config = getHederaConfig();
    const hederaService = new HederaService(config);
    await hederaService.initialize();
    
    // Create NFT test suite
    const nftTestSuite = new NFTTestSuite(hederaService);
    
    // Test failure scenarios
    console.log('\nTesting failure scenarios...');
    const failureResults = await nftTestSuite.testFailureScenarios();
    
    console.log('\n🧪 Failure Scenario Results:');
    failureResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.testName}`);
      
      if (result.details.expectedError) {
        console.log(`   Expected error detected: ${result.details.errorType}`);
        console.log(`   Error message: ${result.details.errorMessage}`);
      }
    });
    
    // Clean up
    await nftTestSuite.cleanupTestAssets();
    
  } catch (error) {
    console.error('❌ Failure scenario example failed:', error);
  }
}

/**
 * Example: Individual Test Operations
 */
async function individualTestExample(): Promise<void> {
  console.log('\n=== Individual Test Operations Example ===');
  
  try {
    // Initialize Hedera service
    const config = getHederaConfig();
    const hederaService = new HederaService(config);
    await hederaService.initialize();
    
    // Create NFT test suite
    const nftTestSuite = new NFTTestSuite(hederaService);
    
    // Test individual operations
    console.log('\n1. Testing individual token creation...');
    const tokenResult = await nftTestSuite.testTokenCreation();
    logTestResult(tokenResult);
    
    if (tokenResult.success) {
      console.log('\n2. Testing individual NFT minting...');
      const mintResult = await nftTestSuite.testNFTMinting(tokenResult.details.tokenId);
      logTestResult(mintResult);
      
      if (mintResult.success) {
        console.log('\n3. Testing individual NFT query...');
        const queryResult = await nftTestSuite.testNFTQuery(
          tokenResult.details.tokenId,
          mintResult.details.serialNumber
        );
        logTestResult(queryResult);
        
        console.log('\n4. Testing individual NFT transfer...');
        const transferResult = await nftTestSuite.testNFTTransfer(
          tokenResult.details.tokenId,
          mintResult.details.serialNumber
        );
        logTestResult(transferResult);
      }
    }
    
    // Clean up
    await nftTestSuite.cleanupTestAssets();
    
  } catch (error) {
    console.error('❌ Individual test example failed:', error);
  }
}

/**
 * Helper function to log test results
 */
function logTestResult(result: NFTTestResult): void {
  const status = result.success ? '✅' : '❌';
  console.log(`${status} ${result.testName}`);
  console.log(`   Duration: ${result.duration}ms`);
  
  if (result.transactionId) {
    console.log(`   Transaction ID: ${result.transactionId}`);
  }
  
  if (result.success) {
    // Log key success details
    if (result.details.tokenId) {
      console.log(`   Token ID: ${result.details.tokenId}`);
    }
    if (result.details.serialNumber) {
      console.log(`   Serial Number: ${result.details.serialNumber}`);
    }
  } else if (result.error) {
    // Log error details
    console.log(`   Error: ${result.error.errorMessage}`);
    console.log(`   Error Type: ${result.error.errorType}`);
    console.log(`   Retryable: ${result.error.retryable}`);
    
    if (result.error.recommendation) {
      console.log(`   Recommendation: ${result.error.recommendation}`);
    }
  }
}

/**
 * Example: Performance Testing
 */
async function performanceTestExample(): Promise<void> {
  console.log('\n=== Performance Testing Example ===');
  
  try {
    // Initialize Hedera service
    const config = getHederaConfig();
    const hederaService = new HederaService(config);
    await hederaService.initialize();
    
    // Create NFT test suite
    const nftTestSuite = new NFTTestSuite(hederaService);
    
    // Run multiple token creation tests to measure performance
    const iterations = 3;
    const results: NFTTestResult[] = [];
    
    console.log(`\nRunning ${iterations} token creation tests for performance analysis...`);
    
    for (let i = 0; i < iterations; i++) {
      console.log(`Running iteration ${i + 1}/${iterations}...`);
      const result = await nftTestSuite.testTokenCreation();
      results.push(result);
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Analyze performance
    const successfulResults = results.filter(r => r.success);
    const durations = successfulResults.map(r => r.duration);
    
    if (durations.length > 0) {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      
      console.log('\n📈 Performance Analysis:');
      console.log(`Successful operations: ${successfulResults.length}/${iterations}`);
      console.log(`Average duration: ${avgDuration.toFixed(0)}ms`);
      console.log(`Min duration: ${minDuration}ms`);
      console.log(`Max duration: ${maxDuration}ms`);
    }
    
    // Clean up
    await nftTestSuite.cleanupTestAssets();
    
  } catch (error) {
    console.error('❌ Performance test example failed:', error);
  }
}

/**
 * Main function to run all examples
 */
async function runExamples(): Promise<void> {
  console.log('🚀 NFT Test Suite Examples');
  console.log('==========================');
  
  try {
    // Run examples (comment out any you don't want to run)
    await basicNFTTestExample();
    await individualTestExample();
    await failureScenarioExample();
    await fullTestSuiteExample();
    await performanceTestExample();
    
    console.log('\n🎉 All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Examples failed:', error);
    process.exit(1);
  }
}

// Export functions for individual use
export {
  basicNFTTestExample,
  fullTestSuiteExample,
  failureScenarioExample,
  individualTestExample,
  performanceTestExample,
  logTestResult,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}