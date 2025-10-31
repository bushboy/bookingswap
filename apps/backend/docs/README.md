# Hedera NFT Documentation

## Overview

This documentation provides comprehensive guidance for setting up, troubleshooting, and using the Hedera NFT system in the booking swap application. The documentation is organized into focused guides that address specific aspects of NFT operations.

## Documentation Structure

### 📋 Setup and Configuration
- **[Hedera Requirements Summary](./hedera-requirements-summary.md)** ⭐ **START HERE**
  - Quick reference checklist
  - Minimum balance requirements
  - Required keys and permissions
  - Verification commands
  - Production deployment requirements

- **[Hedera NFT Account Setup Requirements](./hedera-nft-setup.md)**
  - Complete account setup requirements
  - Detailed configuration steps
  - Environment setup
  - Security best practices
  - Production checklist

### 🔧 Troubleshooting and Diagnostics
- **[Hedera NFT Troubleshooting Guide](./hedera-nft-troubleshooting.md)**
  - Common error codes and solutions
  - Network and connectivity issues
  - Error prevention best practices
  - Emergency procedures
  - Support resources

- **[Hedera Diagnostic Tool Usage Guide](./hedera-diagnostic-tool-usage.md)**
  - Complete CLI tool documentation
  - Command reference and examples
  - Configuration options
  - Output formats and integration
  - Advanced usage patterns

### 🛠️ Technical Implementation
- **[CLI Tool README](../src/cli/README.md)**
  - Technical implementation details
  - Command-line interface reference
  - Integration examples
  - Development guidelines

## Quick Start Guide

### 1. Initial Setup
Before using the Hedera NFT system, ensure your account is properly configured:

```bash
# 1. Check account setup requirements
cat docs/hedera-nft-setup.md

# 2. Verify environment configuration
npm run hedera:diagnose -- --check-env

# 3. Run initial health check
npm run hedera:diagnose -- --quick
```

### 2. Account Verification
Verify your Hedera account has the necessary permissions and balance:

```bash
# Check account balance and permissions
npm run hedera:diagnose -- --account-check

# Verify token configuration
npm run hedera:diagnose -- --token-check

# Generate comprehensive report
npm run hedera:diagnose -- --format json --output setup-verification.json
```

### 3. Test NFT Operations
Test that NFT operations work correctly:

```bash
# Run complete test suite
npm run hedera:test-suite

# Test specific operations
npm run hedera:test-suite -- --operation mint
npm run hedera:test-suite -- --operation transfer
```

## Common Use Cases

### 🚨 Troubleshooting NFT Minting Failures

1. **Check Error Details**: Review the [troubleshooting guide](./hedera-nft-troubleshooting.md) for your specific error code
2. **Run Diagnostics**: Use `npm run hedera:diagnose` to identify issues
3. **Verify Account Setup**: Ensure account meets [setup requirements](./hedera-nft-setup.md)
4. **Test Operations**: Use the [diagnostic tool](./hedera-diagnostic-tool-usage.md) to test individual operations

### 🔍 Account Setup Verification

1. **Review Requirements**: Check [account setup requirements](./hedera-nft-setup.md)
2. **Run Account Check**: Use `npm run hedera:diagnose -- --account-check`
3. **Verify Balance**: Ensure sufficient HBAR using `npm run hedera:diagnose -- --check-balance`
4. **Test Permissions**: Run `npm run hedera:diagnose -- --check-permissions`

### 📊 System Health Monitoring

1. **Regular Health Checks**: Use `npm run hedera:diagnose -- --monitor`
2. **Generate Reports**: Create periodic reports with `npm run hedera:diagnose -- --format json`
3. **Set Up Alerts**: Configure monitoring based on diagnostic output
4. **Review Metrics**: Analyze performance and error trends

### 🧪 Development and Testing

1. **Isolated Testing**: Use the [diagnostic tool](./hedera-diagnostic-tool-usage.md) for component testing
2. **Integration Testing**: Run full test suites before deployment
3. **Performance Testing**: Use load testing features for capacity planning
4. **Error Simulation**: Test error handling with failure scenarios

## Error Code Quick Reference

| Error Code | Common Cause | Quick Fix | Documentation |
|------------|--------------|-----------|---------------|
| `INSUFFICIENT_ACCOUNT_BALANCE` | Low HBAR balance | Add HBAR to account | [Troubleshooting Guide](./hedera-nft-troubleshooting.md#insufficient_account_balance) |
| `INVALID_ACCOUNT_ID` | Wrong account format | Verify account ID | [Troubleshooting Guide](./hedera-nft-troubleshooting.md#invalid_account_id) |
| `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT` | Missing token association | Associate token | [Troubleshooting Guide](./hedera-nft-troubleshooting.md#token_not_associated_to_account) |
| `INVALID_SIGNATURE` | Wrong private key | Check key configuration | [Troubleshooting Guide](./hedera-nft-troubleshooting.md#invalid_signature) |
| `ACCOUNT_FROZEN_FOR_TOKEN` | Account frozen | Unfreeze account | [Troubleshooting Guide](./hedera-nft-troubleshooting.md#account_frozen_for_token) |
| `METADATA_TOO_LONG` | NFT metadata > 100 bytes | Reduce metadata size | [Troubleshooting Guide](./hedera-nft-troubleshooting.md#metadata_too_long) |

## Minimum Requirements Summary

### HBAR Balance Requirements
- **Token Creation**: 20 HBAR
- **NFT Minting**: 0.05 HBAR per NFT
- **NFT Transfer**: 0.001 HBAR
- **Recommended Buffer**: 5+ HBAR
- **Production Minimum**: 50 HBAR

### Required Account Keys
- ✅ **Admin Key**: Token management (Required)
- ✅ **Supply Key**: NFT minting/burning (Required)
- ⚪ **Wipe Key**: Force NFT removal (Optional)
- ⚪ **Freeze Key**: Account freezing (Optional)
- ⚪ **KYC Key**: KYC management (Optional)
- ⚪ **Pause Key**: Global token pause (Optional)

### Environment Variables
```bash
# Required
HEDERA_NETWORK=testnet|mainnet
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_TOKEN_ID=0.0.789012

# Optional
HEDERA_ADMIN_KEY=...
HEDERA_SUPPLY_KEY=...
HEDERA_DEBUG=true
```

## Command Quick Reference

### Diagnostic Commands
```bash
# Complete system check
npm run hedera:diagnose

# Account verification
npm run hedera:diagnose -- --account-check

# Token verification  
npm run hedera:diagnose -- --token-check

# Balance check
npm run hedera:diagnose -- --check-balance

# Metadata size validation
npm run hedera:check-metadata -- --metadata '{"name":"Test NFT"}'

# Generate report
npm run hedera:diagnose -- --format json --output report.json
```

### Testing Commands
```bash
# Full test suite
npm run hedera:test-suite

# Specific operation test
npm run hedera:test-suite -- --operation mint

# Load testing
npm run hedera:test-suite -- --load-test --concurrent 5

# Integration tests
npm run test:hedera-integration
```

### Monitoring Commands
```bash
# Continuous monitoring
npm run hedera:diagnose -- --monitor --interval 300

# Performance metrics
npm run hedera:diagnose -- --benchmark

# Error analysis
npm run hedera:diagnose -- --analyze-failures --hours 24
```

## Support and Resources

### Internal Documentation
- [Requirements Summary](./hedera-requirements-summary.md) - Quick reference checklist ⭐
- [Setup Requirements](./hedera-nft-setup.md) - Complete account setup guide
- [Troubleshooting Guide](./hedera-nft-troubleshooting.md) - Error resolution
- [Diagnostic Tool Usage](./hedera-diagnostic-tool-usage.md) - CLI tool reference
- [CLI Implementation](../src/cli/README.md) - Technical details

### External Resources
- **Hedera Documentation**: https://docs.hedera.com/
- **JavaScript SDK**: https://github.com/hashgraph/hedera-sdk-js
- **Community Discord**: https://discord.com/invite/hedera
- **Stack Overflow**: Tag questions with `hedera-hashgraph`

### Emergency Contacts
- **Network Status**: https://status.hedera.com/
- **Support Portal**: https://help.hedera.com/
- **Developer Chat**: https://discord.com/channels/hedera-developers

## Contributing to Documentation

### Documentation Standards
1. **Keep it actionable**: Focus on specific steps and commands
2. **Include examples**: Provide real command examples and output
3. **Cross-reference**: Link related documentation sections
4. **Update regularly**: Keep information current with system changes
5. **Test instructions**: Verify all commands and procedures work

### Documentation Updates
When updating documentation:
1. Test all commands and procedures
2. Update version numbers and dates
3. Check cross-references and links
4. Review for clarity and completeness
5. Update the quick reference sections

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Backend Development Team