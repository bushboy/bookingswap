# Hedera NFT Debugging Integration Tests

This directory contains comprehensive integration tests for the Hedera NFT debugging system. These tests validate the complete NFT lifecycle and error handling capabilities against the real Hedera testnet.

## Test Coverage

### Requirements Covered
- **Requirement 3.1**: NFT minting operations in isolation
- **Requirement 3.4**: NFT lifecycle operations (create, mint, transfer, query)

### Test Categories

#### 1. Test Environment Setup and Validation
- Validates Hedera testnet connectivity
- Confirms operator account has sufficient balance
- Verifies all debugging services initialize correctly

#### 2. Error Scenarios - Insufficient Balance
- Tests NFT operations with accounts that have insufficient HBAR
- Validates error reporting for balance-related failures
- Confirms appropriate recommendations are provided

#### 3. Error Scenarios - Invalid Accounts
- Tests operations with non-existent account IDs
- Validates error handling for invalid account operations
- Tests NFT transfers to invalid accounts

#### 4. NFT Lifecycle Operations - Complete Flow
- **Token Creation**: Creates NFT tokens on Hedera testnet
- **NFT Minting**: Mints NFTs with proper metadata
- **NFT Querying**: Retrieves and validates NFT information
- **NFT Transfer**: Transfers NFTs between accounts
- **Multiple Minting**: Tests minting multiple NFTs on same token

#### 5. Permission Validation - Different Account Configurations
- Validates operator account permissions comprehensively
- Tests balance requirements for different operations
- Validates token-specific permissions after creation

#### 6. Failure Scenarios - Comprehensive Testing
- Tests all failure scenarios systematically
- Simulates network timeout scenarios
- Validates error classification and reporting

#### 7. Diagnostic Reporting Integration
- Generates comprehensive diagnostic reports
- Tests report export in JSON and Markdown formats
- Validates report structure and content

#### 8. Full Integration Test Suite
- Runs complete test suite end-to-end
- Validates all components working together
- Measures test coverage and success rates

#### 9. Performance and Reliability
- Tests concurrent NFT operations
- Validates consistent error reporting across operations
- Measures performance under load

## Prerequisites

### Environment Setup
1. **Hedera Testnet Account**: You need a valid Hedera testnet account with sufficient HBAR balance (minimum 50 HBAR recommended)
2. **Environment Variables**: Configure the following in your `.env.test` file:
   ```
   HEDERA_NETWORK=testnet
   HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID
   HEDERA_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
   ```

### Account Requirements
- **Minimum Balance**: 50 HBAR (recommended 100+ HBAR for full test suite)
- **Account Type**: Standard Hedera account with admin privileges
- **Network**: Hedera testnet (tests will not run on mainnet)

## Running the Tests

### Run All Hedera Integration Tests
```bash
npm run test:hedera-integration
```

### Run Specific Test Files
```bash
# Run only the comprehensive integration tests
npx vitest run src/services/hedera/__tests__/hedera-nft-debugging.integration.test.ts

# Run with verbose output
npx vitest run --reporter=verbose src/services/hedera/__tests__/hedera-nft-debugging.integration.test.ts

# Run in watch mode for development
npx vitest src/services/hedera/__tests__/hedera-nft-debugging.integration.test.ts
```

### Run Individual Test Suites
```bash
# Test only error scenarios
npx vitest run -t "Error Scenarios"

# Test only NFT lifecycle
npx vitest run -t "NFT Lifecycle Operations"

# Test only permission validation
npx vitest run -t "Permission Validation"
```

## Test Configuration

### Timeouts
- **Individual Tests**: Up to 5 minutes for complex operations
- **Setup/Teardown**: Up to 1 minute for initialization
- **Full Suite**: Up to 10 minutes total

### Retry Logic
- Tests automatically retry once on failure (network issues)
- Test suite stops after 5 consecutive failures to avoid excessive API calls

### Isolation
- Tests run in separate processes to avoid interference
- Sequential execution to respect Hedera rate limits
- Automatic cleanup of test assets after completion

## Expected Test Results

### Successful Run
When all tests pass, you should see:
- ✅ All environment validation tests pass
- ✅ Token creation, minting, querying, and transfer operations succeed
- ✅ Error scenarios properly detected and reported
- ✅ Permission validation confirms account capabilities
- ✅ Diagnostic reports generated successfully

### Common Failure Scenarios
1. **Insufficient Balance**: Tests will fail if account has < 10 HBAR
2. **Network Issues**: Temporary failures may occur due to network latency
3. **Rate Limiting**: Too many concurrent operations may trigger rate limits
4. **Invalid Credentials**: Incorrect account ID or private key will cause failures

## Troubleshooting

### Test Failures
1. **Check Account Balance**: Ensure your testnet account has sufficient HBAR
2. **Verify Credentials**: Confirm account ID and private key are correct
3. **Network Connectivity**: Ensure you can reach Hedera testnet endpoints
4. **Rate Limits**: Wait a few minutes between test runs if hitting rate limits

### Environment Issues
1. **Missing Variables**: Ensure all required environment variables are set
2. **Invalid Format**: Account ID must match pattern `0.0.123456`
3. **Network Setting**: Must be set to `testnet` for integration tests

### Performance Issues
1. **Slow Tests**: Network latency can cause longer execution times
2. **Timeouts**: Increase timeout values in vitest config if needed
3. **Memory Usage**: Tests create and cleanup multiple Hedera resources

## Test Asset Management

### Automatic Cleanup
- All test tokens and NFTs are automatically cleaned up after tests
- Failed tests may leave some assets that will be cleaned up in subsequent runs
- No manual cleanup required under normal circumstances

### Manual Cleanup
If needed, you can manually clean up test assets:
```bash
npm run hedera-diagnostics cleanup-test-assets
```

## Integration with CI/CD

### GitHub Actions
These tests can be integrated into CI/CD pipelines with proper secret management:
```yaml
- name: Run Hedera Integration Tests
  env:
    HEDERA_NETWORK: testnet
    HEDERA_ACCOUNT_ID: ${{ secrets.HEDERA_TESTNET_ACCOUNT_ID }}
    HEDERA_PRIVATE_KEY: ${{ secrets.HEDERA_TESTNET_PRIVATE_KEY }}
  run: npm run test:hedera-integration
```

### Local Development
For local development, use the `.env.test` file and avoid committing credentials to version control.

## Monitoring and Metrics

### Test Metrics
- **Success Rate**: Percentage of tests passing
- **Execution Time**: Total time for test suite completion
- **Resource Usage**: Number of tokens/NFTs created and cleaned up
- **Error Distribution**: Types and frequency of errors encountered

### Performance Benchmarks
- **Token Creation**: ~10-15 seconds per token
- **NFT Minting**: ~8-12 seconds per NFT
- **NFT Transfer**: ~5-8 seconds per transfer
- **Full Suite**: ~5-10 minutes total execution time

## Contributing

When adding new integration tests:
1. Follow the existing test structure and naming conventions
2. Include proper error handling and cleanup
3. Add appropriate timeouts for network operations
4. Document any new environment requirements
5. Ensure tests are deterministic and don't depend on external state