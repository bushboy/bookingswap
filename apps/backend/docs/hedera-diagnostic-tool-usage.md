# Hedera Diagnostic Tool Usage Guide

## Overview

The Hedera diagnostic tool provides comprehensive testing and analysis capabilities for NFT operations. This guide covers all available commands, options, and usage patterns for effective debugging and monitoring.

## Installation and Setup

### Prerequisites
- Node.js 16+ installed
- Hedera account with sufficient HBAR balance
- Properly configured environment variables

### Environment Configuration
```bash
# Required environment variables
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_TOKEN_ID=0.0.789012

# Optional diagnostic settings
HEDERA_DEBUG=true
HEDERA_LOG_LEVEL=debug
HEDERA_TIMEOUT=30000
```

## Command Line Interface

### Basic Usage
```bash
# Run comprehensive diagnostics
npm run hedera:diagnose

# Run specific diagnostic component
npm run hedera:diagnose -- --component <component-name>

# Get help and available options
npm run hedera:diagnose -- --help
```

### Available Commands

#### System Health Check
```bash
# Complete system analysis
npm run hedera:diagnose

# Quick health check (essential components only)
npm run hedera:diagnose -- --quick

# Verbose output with detailed logging
npm run hedera:diagnose -- --verbose
```

#### Account Diagnostics
```bash
# Full account analysis
npm run hedera:diagnose -- --account-check

# Check account balance only
npm run hedera:diagnose -- --check-balance

# Verify account permissions
npm run hedera:diagnose -- --check-permissions

# Check specific account
npm run hedera:diagnose -- --account-id 0.0.123456
```

#### Token Diagnostics
```bash
# Analyze token configuration
npm run hedera:diagnose -- --token-check

# Check specific token
npm run hedera:diagnose -- --token-id 0.0.789012

# Verify token associations
npm run hedera:diagnose -- --check-associations

# List all token permissions
npm run hedera:diagnose -- --token-permissions
```

#### NFT Operation Testing
```bash
# Run complete NFT test suite
npm run hedera:test-suite

# Test specific operation
npm run hedera:test-suite -- --operation mint
npm run hedera:test-suite -- --operation transfer
npm run hedera:test-suite -- --operation query

# Test with custom parameters
npm run hedera:test-suite -- --count 5 --metadata '{"name":"Test NFT"}'
```

#### Metadata Validation
```bash
# Check metadata size against Hedera limits
npm run hedera:check-metadata -- --metadata '{"name":"Test NFT","description":"Test"}'

# Validate complex metadata
npm run hedera:check-metadata -- --metadata '{"name":"Booking NFT","description":"Hotel booking confirmation","image":"https://example.com/image.png","attributes":[{"trait_type":"Type","value":"Hotel"}]}'

# Check metadata from file
npm run hedera:check-metadata -- --metadata "$(cat metadata.json)"
```

#### Network and Connectivity
```bash
# Test network connectivity
npm run hedera:diagnose -- --network-check

# Check mirror node connectivity
npm run hedera:diagnose -- --mirror-check

# Test transaction submission
npm run hedera:diagnose -- --transaction-test
```

## Diagnostic Components

### 1. Account Permission Validator

**Purpose**: Verify account setup and permissions

**Usage**:
```bash
# Basic permission check
npm run hedera:diagnose -- --component account-validator

# Check specific permissions
npm run hedera:diagnose -- --component account-validator --check-keys
npm run hedera:diagnose -- --component account-validator --check-balance
npm run hedera:diagnose -- --component account-validator --check-associations
```

**Output Example**:
```json
{
  "accountId": "0.0.123456",
  "balance": {
    "hbar": "25.50000000",
    "sufficient": true,
    "minimumRequired": "5.00000000"
  },
  "tokenPermissions": {
    "hasSupplyKey": true,
    "hasAdminKey": true,
    "hasWipeKey": false
  },
  "canMintNFTs": true,
  "issues": []
}
```

### 2. NFT Test Suite

**Purpose**: Test NFT operations in isolation

**Usage**:
```bash
# Run all tests
npm run hedera:diagnose -- --component nft-test-suite

# Run specific test
npm run hedera:diagnose -- --component nft-test-suite --test mint
npm run hedera:diagnose -- --component nft-test-suite --test transfer
npm run hedera:diagnose -- --component nft-test-suite --test query

# Custom test parameters
npm run hedera:diagnose -- --component nft-test-suite --test mint --metadata '{"name":"Test","description":"Test NFT"}'
```

**Test Results**:
```json
{
  "testName": "NFT Minting Test",
  "success": true,
  "transactionId": "0.0.123456@1640995200.123456789",
  "duration": 2340,
  "details": {
    "tokenId": "0.0.789012",
    "serialNumber": 1,
    "metadata": "Test NFT metadata"
  }
}
```

### 3. Error Reporter

**Purpose**: Analyze and categorize errors

**Usage**:
```bash
# Analyze recent errors
npm run hedera:diagnose -- --component error-reporter

# Check specific time period
npm run hedera:diagnose -- --component error-reporter --hours 24
npm run hedera:diagnose -- --component error-reporter --days 7

# Filter by error type
npm run hedera:diagnose -- --component error-reporter --error-type INSUFFICIENT_BALANCE
```

### 4. Diagnostic Reporter

**Purpose**: Generate comprehensive reports

**Usage**:
```bash
# Generate full diagnostic report
npm run hedera:diagnose -- --component diagnostic-reporter

# Export report in different formats
npm run hedera:diagnose -- --component diagnostic-reporter --format json
npm run hedera:diagnose -- --component diagnostic-reporter --format markdown
npm run hedera:diagnose -- --component diagnostic-reporter --format html

# Save report to file
npm run hedera:diagnose -- --component diagnostic-reporter --output ./reports/diagnostic-$(date +%Y%m%d).json
```

## Advanced Usage

### Batch Operations
```bash
# Test multiple accounts
npm run hedera:diagnose -- --accounts 0.0.123456,0.0.123457,0.0.123458

# Test multiple tokens
npm run hedera:diagnose -- --tokens 0.0.789012,0.0.789013,0.0.789014

# Batch NFT operations
npm run hedera:test-suite -- --batch --count 10
```

### Monitoring Mode
```bash
# Continuous monitoring (runs every 5 minutes)
npm run hedera:diagnose -- --monitor --interval 300

# Monitor specific metrics
npm run hedera:diagnose -- --monitor --metrics balance,errors,performance

# Monitor with alerts
npm run hedera:diagnose -- --monitor --alert-threshold 0.8 --alert-webhook https://hooks.slack.com/...
```

### Performance Testing
```bash
# Load testing
npm run hedera:test-suite -- --load-test --concurrent 5 --duration 300

# Performance benchmarking
npm run hedera:diagnose -- --benchmark --operations mint,transfer,query

# Stress testing
npm run hedera:test-suite -- --stress-test --max-operations 100
```

## Configuration Options

### Command Line Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `--component` | Run specific diagnostic component | `--component account-validator` |
| `--account-id` | Target account ID | `--account-id 0.0.123456` |
| `--token-id` | Target token ID | `--token-id 0.0.789012` |
| `--operation` | Specific operation to test | `--operation mint` |
| `--metadata` | JSON metadata to validate | `--metadata '{"name":"NFT"}'` |
| `--format` | Output format | `--format json` |
| `--output` | Output file path | `--output ./report.json` |
| `--verbose` | Enable verbose logging | `--verbose` |
| `--quick` | Run quick checks only | `--quick` |
| `--monitor` | Enable monitoring mode | `--monitor` |
| `--interval` | Monitoring interval (seconds) | `--interval 300` |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HEDERA_DEBUG` | Enable debug mode | `false` |
| `HEDERA_LOG_LEVEL` | Logging level | `info` |
| `HEDERA_TIMEOUT` | Operation timeout (ms) | `30000` |
| `HEDERA_RETRY_COUNT` | Max retry attempts | `3` |
| `HEDERA_RETRY_DELAY` | Retry delay (ms) | `1000` |

## Output Formats

### JSON Format
```bash
npm run hedera:diagnose -- --format json
```
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": {
    "network": "testnet",
    "accountId": "0.0.123456"
  },
  "results": {
    "accountStatus": { "passed": true },
    "tokenStatus": { "passed": true },
    "nftOperations": { "passed": true }
  },
  "recommendations": [
    "Account balance is sufficient",
    "All required permissions are configured"
  ]
}
```

### Markdown Format
```bash
npm run hedera:diagnose -- --format markdown
```
```markdown
# Hedera NFT Diagnostic Report

**Generated**: 2024-01-15 10:30:00 UTC
**Network**: testnet
**Account**: 0.0.123456

## Summary
✅ Account Status: PASSED
✅ Token Status: PASSED  
✅ NFT Operations: PASSED

## Recommendations
- Account balance is sufficient
- All required permissions are configured
```

### HTML Format
```bash
npm run hedera:diagnose -- --format html --output report.html
```

## Integration with CI/CD

### GitHub Actions
```yaml
name: Hedera NFT Health Check
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run hedera:diagnose -- --format json --output health-report.json
        env:
          HEDERA_ACCOUNT_ID: ${{ secrets.HEDERA_ACCOUNT_ID }}
          HEDERA_PRIVATE_KEY: ${{ secrets.HEDERA_PRIVATE_KEY }}
      - uses: actions/upload-artifact@v2
        with:
          name: health-report
          path: health-report.json
```

### Docker Integration
```dockerfile
# Add to Dockerfile
RUN npm run hedera:diagnose -- --quick
HEALTHCHECK --interval=5m --timeout=30s --start-period=5s --retries=3 \
  CMD npm run hedera:diagnose -- --quick --format json || exit 1
```

## Troubleshooting the Diagnostic Tool

### Common Issues

#### Permission Denied
```bash
# Ensure proper file permissions
chmod +x ./scripts/hedera-diagnose.js

# Check environment variables
npm run hedera:diagnose -- --check-env
```

#### Network Connectivity
```bash
# Test basic connectivity
npm run hedera:diagnose -- --network-test

# Use alternative endpoints
HEDERA_NETWORK_ENDPOINT=testnet.hedera.com npm run hedera:diagnose
```

#### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run hedera:diagnose
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=hedera:* npm run hedera:diagnose

# Trace mode for detailed analysis
npm run hedera:diagnose -- --trace
```

## Best Practices

### Regular Health Checks
1. **Daily**: Run quick health checks
2. **Weekly**: Full diagnostic reports
3. **Monthly**: Performance benchmarking
4. **Before Deployments**: Complete test suite

### Monitoring Integration
```bash
# Set up automated monitoring
npm run hedera:diagnose -- --monitor --webhook https://monitoring.example.com/hedera

# Custom alert thresholds
npm run hedera:diagnose -- --monitor --balance-threshold 10 --error-threshold 5
```

### Report Management
```bash
# Automated report archival
npm run hedera:diagnose -- --format json --output "./reports/$(date +%Y%m%d-%H%M%S).json"

# Report cleanup (keep last 30 days)
find ./reports -name "*.json" -mtime +30 -delete
```

For troubleshooting specific errors, see the [Hedera NFT Troubleshooting Guide](./hedera-nft-troubleshooting.md).
For account setup requirements, see the [Hedera NFT Setup Guide](./hedera-nft-setup.md).