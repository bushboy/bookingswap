# Hedera NFT Diagnostic CLI Tool

A comprehensive command-line interface for debugging and testing Hedera NFT operations in the booking swap system.

## Overview

The Hedera NFT Diagnostic CLI Tool provides developers with the ability to:

- Generate comprehensive diagnostic reports
- Test individual NFT operations (creation, minting, transfer, query)
- Verify account permissions and configuration
- Check account balances and minimum requirements
- Export diagnostic data in multiple formats
- Perform health checks on Hedera connectivity

## Installation

The CLI tool is included with the backend package. To use it:

```bash
# Install dependencies
npm install

# Run the CLI tool
npm run hedera-diagnostics -- --help
```

## Configuration

The CLI tool can be configured using command-line options or environment variables:

### Environment Variables

```bash
# Required
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_NETWORK=testnet

# Optional
HEDERA_TOKEN_ID=0.0.789012
```

### Command-Line Options

```bash
-n, --network <network>      Hedera network (testnet|mainnet) [default: testnet]
-a, --account-id <accountId> Hedera account ID
-k, --private-key <key>      Hedera private key
-t, --token-id <tokenId>     NFT token ID for testing
-o, --output-dir <dir>       Output directory for reports [default: ./diagnostic-reports]
-v, --verbose                Enable verbose logging
```

## Commands

### Generate Diagnostic Report

Generate a comprehensive diagnostic report including account validation, test results, and recommendations:

```bash
# Basic report
npm run hedera-diagnostics report

# JSON format report
npm run hedera-diagnostics report --format json

# Full test suite with failure scenarios
npm run hedera-diagnostics report --full-test-suite --include-failures

# With specific token ID
npm run hedera-diagnostics report --token-id 0.0.789012
```

**Options:**
- `-f, --format <format>`: Report format (json|markdown) [default: markdown]
- `--full-test-suite`: Include full test suite in report
- `--include-failures`: Include failure scenario tests

### Verify Account

Verify account permissions and configuration for NFT operations:

```bash
# Verify configured account
npm run hedera-diagnostics verify-account

# Verify specific account
npm run hedera-diagnostics verify-account 0.0.123456

# Verify with specific token
npm run hedera-diagnostics verify-account --token-id 0.0.789012
```

### Individual Tests

Run specific NFT operation tests:

#### Token Creation Test
```bash
npm run hedera-diagnostics test token-creation
```

#### NFT Minting Test
```bash
# Create new token and mint NFT
npm run hedera-diagnostics test nft-minting

# Mint NFT for existing token
npm run hedera-diagnostics test nft-minting --token-id 0.0.789012
```

#### NFT Transfer Test
```bash
npm run hedera-diagnostics test nft-transfer --token-id 0.0.789012 --serial 1 --to-account 0.0.654321
```

#### NFT Query Test
```bash
npm run hedera-diagnostics test nft-query --token-id 0.0.789012 --serial 1
```

#### Full Test Suite
```bash
# Run all tests
npm run hedera-diagnostics test full-suite

# Run tests without cleanup
npm run hedera-diagnostics test full-suite --no-cleanup
```

### Balance Check

Check account balance and minimum requirements:

```bash
# Check configured account
npm run hedera-diagnostics check-balance

# Check specific account
npm run hedera-diagnostics check-balance 0.0.123456

# Check for specific operation
npm run hedera-diagnostics check-balance --operation mint
npm run hedera-diagnostics check-balance --operation transfer
npm run hedera-diagnostics check-balance --operation create_token
```

### Health Check

Perform a quick health check of Hedera connectivity:

```bash
npm run hedera-diagnostics health-check
```

### Export Reports

Export existing diagnostic reports in different formats:

```bash
# Export to markdown
npm run hedera-diagnostics export ./diagnostic-reports/report.json --format markdown

# Export to CSV
npm run hedera-diagnostics export ./diagnostic-reports/report.json --format csv --output ./exported-report.csv
```

## Usage Examples

### Basic Diagnostic Workflow

1. **Health Check**: Verify basic connectivity
   ```bash
   npm run hedera-diagnostics health-check
   ```

2. **Account Verification**: Check account permissions
   ```bash
   npm run hedera-diagnostics verify-account --token-id 0.0.789012
   ```

3. **Generate Report**: Create comprehensive diagnostic report
   ```bash
   npm run hedera-diagnostics report --full-test-suite
   ```

### Troubleshooting NFT Minting Issues

1. **Check Balance**: Ensure sufficient HBAR
   ```bash
   npm run hedera-diagnostics check-balance --operation mint
   ```

2. **Test Token Creation**: Verify token creation works
   ```bash
   npm run hedera-diagnostics test token-creation
   ```

3. **Test NFT Minting**: Test minting operation
   ```bash
   npm run hedera-diagnostics test nft-minting --token-id 0.0.789012
   ```

4. **Generate Detailed Report**: Get comprehensive analysis
   ```bash
   npm run hedera-diagnostics report --format json --include-failures
   ```

### Testing New Account Setup

1. **Verify Account**: Check account configuration
   ```bash
   npm run hedera-diagnostics verify-account 0.0.NEW_ACCOUNT
   ```

2. **Run Full Test Suite**: Test all operations
   ```bash
   npm run hedera-diagnostics test full-suite --account-id 0.0.NEW_ACCOUNT
   ```

## Output Files

The CLI tool generates various output files in the specified output directory:

### Diagnostic Reports
- `diagnostic-report-TIMESTAMP.md`: Markdown format report
- `diagnostic-report-TIMESTAMP.json`: JSON format report

### Report Structure

#### Markdown Report Sections:
1. **Environment**: Network, account, and configuration details
2. **Summary**: Overall health and key metrics
3. **Account Status**: Balance and permission information
4. **Test Results**: Individual test outcomes
5. **Recent Errors**: Error history and patterns
6. **Recommendations**: Actionable improvement suggestions

#### JSON Report Structure:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "reportId": "diag-1234567890-abc123",
  "environment": {
    "network": "testnet",
    "accountId": "0.0.123456",
    "tokenId": "0.0.789012"
  },
  "summary": {
    "overallHealth": "healthy|warning|critical",
    "criticalIssues": 0,
    "warningIssues": 0,
    "passedTests": 5,
    "failedTests": 0,
    "totalTests": 5
  },
  "accountStatus": {
    "accountId": "0.0.123456",
    "balance": {
      "hbar": "10.5",
      "sufficient": true,
      "minimumRequired": "5",
      "recommendedAmount": "10"
    },
    "canMintNFTs": true,
    "issues": [],
    "recommendations": []
  },
  "testResults": [...],
  "recentErrors": [...],
  "recommendations": [...]
}
```

## Error Handling

The CLI tool provides comprehensive error handling and reporting:

### Common Error Scenarios

1. **Insufficient Balance**
   - Error: Account balance too low for operations
   - Solution: Fund account with sufficient HBAR

2. **Invalid Account ID**
   - Error: Account does not exist or invalid format
   - Solution: Verify account ID and network

3. **Missing Token Permissions**
   - Error: Account lacks required keys for token operations
   - Solution: Configure account with proper token keys

4. **Network Connectivity Issues**
   - Error: Cannot connect to Hedera network
   - Solution: Check network configuration and connectivity

### Error Output Format

```
❌ NFT minting test failed
   Duration: 1234ms
   Error: INSUFFICIENT_ACCOUNT_BALANCE
   Error Code: INSUFFICIENT_ACCOUNT_BALANCE
   💡 Ensure the account has sufficient HBAR for transaction fees.
```

## Integration with Monitoring

The CLI tool can be integrated with monitoring and alerting systems:

### Automated Health Checks
```bash
# Add to cron job or scheduled task
npm run hedera-diagnostics health-check
```

### CI/CD Integration
```bash
# Add to deployment pipeline
npm run hedera-diagnostics verify-account
npm run hedera-diagnostics test full-suite --no-cleanup
```

### Monitoring Scripts
```bash
# Generate daily reports
npm run hedera-diagnostics report --format json --output ./monitoring/daily-report.json
```

## Troubleshooting

### Common Issues

1. **Command Not Found**
   ```bash
   # Ensure you're in the backend directory
   cd apps/backend
   npm run hedera-diagnostics -- --help
   ```

2. **Permission Denied**
   ```bash
   # Check environment variables
   echo $HEDERA_ACCOUNT_ID
   echo $HEDERA_PRIVATE_KEY
   ```

3. **Network Errors**
   ```bash
   # Test with verbose logging
   npm run hedera-diagnostics health-check --verbose
   ```

4. **Missing Dependencies**
   ```bash
   # Reinstall dependencies
   npm install
   ```

### Debug Mode

Enable verbose logging for detailed debugging:

```bash
npm run hedera-diagnostics report --verbose
```

This will provide detailed logs of all operations and API calls.

## Requirements Mapping

This CLI tool addresses the following requirements:

- **Requirement 3.1**: Standalone test functions for NFT operations
- **Requirement 4.4**: Diagnostic reporting and account setup documentation

## Support

For issues or questions about the CLI tool:

1. Check the troubleshooting section above
2. Review the diagnostic report recommendations
3. Examine verbose logs for detailed error information
4. Consult the Hedera SDK documentation for network-specific issues