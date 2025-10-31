# Hedera NFT Requirements Summary

## Overview

This document provides a concise summary of all requirements for successful Hedera NFT operations in the booking swap system. Use this as a quick reference checklist for account setup and troubleshooting.

## Minimum HBAR Balance Requirements

### Operation-Specific Requirements

| Operation | HBAR Required | Purpose | Command to Test |
|-----------|---------------|---------|-----------------|
| **Token Creation** | 20 HBAR | One-time token creation fee | `npm run hedera:diagnose -- --check-balance --operation create_token` |
| **NFT Minting** | 0.05 HBAR | Per NFT transaction fee | `npm run hedera:diagnose -- --check-balance --operation mint` |
| **NFT Transfer** | 0.001 HBAR | Per transfer transaction fee | `npm run hedera:diagnose -- --check-balance --operation transfer` |
| **Token Association** | 0.05 HBAR | Associate token with account | `npm run hedera:diagnose -- --check-balance --operation associate` |

### Recommended Account Balances

| Environment | Minimum Balance | Recommended Balance | Purpose |
|-------------|----------------|-------------------|---------|
| **Development** | 25 HBAR | 50 HBAR | Testing and development |
| **Staging** | 50 HBAR | 100 HBAR | Pre-production testing |
| **Production** | 100 HBAR | 200+ HBAR | High-volume operations |

### Balance Verification Commands
```bash
# Check current balance
npm run hedera:check-balance

# Check balance for specific operation
npm run hedera:diagnose -- --check-balance --operation mint

# Monitor balance continuously
npm run hedera:diagnose -- --monitor --metrics balance
```

## Required Account Keys and Permissions

### Essential Keys (Required)

#### 1. Admin Key ✅ **REQUIRED**
- **Purpose**: Manage token properties and configuration
- **Permissions**: Update token metadata, delete token, modify settings
- **Environment Variable**: `HEDERA_ADMIN_KEY`
- **Verification**: `npm run hedera:check-permissions`

#### 2. Supply Key ✅ **REQUIRED**
- **Purpose**: Mint and burn NFTs
- **Permissions**: Create new NFT instances, destroy existing NFTs
- **Environment Variable**: `HEDERA_SUPPLY_KEY`
- **Critical For**: All NFT minting operations

### Optional Keys (Recommended for Production)

#### 3. Wipe Key ⚪ **OPTIONAL**
- **Purpose**: Remove NFTs from any account
- **Use Case**: Emergency NFT removal, compliance requirements
- **Environment Variable**: `HEDERA_WIPE_KEY`

#### 4. Freeze Key ⚪ **OPTIONAL**
- **Purpose**: Freeze/unfreeze accounts for token operations
- **Use Case**: Temporary account restrictions
- **Environment Variable**: `HEDERA_FREEZE_KEY`

#### 5. KYC Key ⚪ **OPTIONAL**
- **Purpose**: Grant/revoke KYC status
- **Use Case**: Compliance and regulatory requirements
- **Environment Variable**: `HEDERA_KYC_KEY`

#### 6. Pause Key ⚪ **OPTIONAL**
- **Purpose**: Pause all token operations globally
- **Use Case**: Emergency system-wide halt
- **Environment Variable**: `HEDERA_PAUSE_KEY`

### Key Verification Commands
```bash
# Check all key permissions
npm run hedera:check-permissions

# Verify specific key configuration
npm run hedera:diagnose -- --check-keys --key-type supply

# Test key functionality
npm run hedera:test-suite -- --operation mint
```

## Environment Configuration Requirements

### Required Environment Variables

```bash
# Core Configuration (REQUIRED)
HEDERA_NETWORK=testnet              # or mainnet
HEDERA_ACCOUNT_ID=0.0.123456        # Your Hedera account ID
HEDERA_PRIVATE_KEY=302e020100...    # Account private key
HEDERA_TOKEN_ID=0.0.789012          # NFT token ID

# Key Configuration (REQUIRED for operations)
HEDERA_ADMIN_KEY=302e020100...      # Admin key for token management
HEDERA_SUPPLY_KEY=302e020100...     # Supply key for minting/burning
```

### Optional Environment Variables

```bash
# Additional Keys (OPTIONAL)
HEDERA_WIPE_KEY=302e020100...       # Wipe key for NFT removal
HEDERA_FREEZE_KEY=302e020100...     # Freeze key for account control
HEDERA_KYC_KEY=302e020100...        # KYC key for compliance
HEDERA_PAUSE_KEY=302e020100...      # Pause key for emergency stop

# Diagnostic Configuration (OPTIONAL)
HEDERA_DEBUG=true                   # Enable debug logging
HEDERA_LOG_LEVEL=debug              # Set logging level
HEDERA_TIMEOUT=30000                # Operation timeout (ms)
HEDERA_RETRY_COUNT=3                # Max retry attempts
```

### Environment Verification
```bash
# Check environment configuration
npm run hedera:diagnose -- --check-env

# Validate all required variables
npm run hedera:diagnose -- --validate-config

# Test environment connectivity
npm run hedera:health
```

## Account Setup Checklist

### Pre-Setup Requirements
- [ ] Hedera account created with sufficient initial balance
- [ ] Private keys generated and securely stored
- [ ] Network endpoint configured (testnet vs mainnet)
- [ ] Environment variables properly set

### Account Configuration Steps
1. **Create Account**
   ```bash
   # Verify account exists and is accessible
   npm run hedera:diagnose -- --verify-account
   ```

2. **Fund Account**
   ```bash
   # Check current balance
   npm run hedera:check-balance
   
   # Ensure minimum 50 HBAR for production
   ```

3. **Configure Keys**
   ```bash
   # Verify all required keys are configured
   npm run hedera:check-permissions
   ```

4. **Create/Configure Token**
   ```bash
   # Test token creation (if needed)
   npm run hedera:test-suite -- --operation token-creation
   
   # Verify existing token configuration
   npm run hedera:diagnose -- --token-check
   ```

5. **Test Operations**
   ```bash
   # Run complete test suite
   npm run hedera:test-suite
   
   # Test specific operations
   npm run hedera:test-suite -- --operation mint
   npm run hedera:test-suite -- --operation transfer
   ```

### Post-Setup Verification
- [ ] All diagnostic tests pass
- [ ] NFT minting works successfully
- [ ] NFT transfers complete without errors
- [ ] Account balance monitoring is configured
- [ ] Error handling and logging are working

## Production Deployment Requirements

### Security Requirements
- [ ] Private keys stored in secure key management system
- [ ] Environment variables not committed to version control
- [ ] Multi-signature enabled for high-value operations
- [ ] Regular key rotation schedule established
- [ ] Backup and recovery procedures documented

### Monitoring Requirements
- [ ] Account balance monitoring with alerts
- [ ] Transaction success rate monitoring
- [ ] Error rate tracking and alerting
- [ ] Performance metrics collection
- [ ] Regular diagnostic report generation

### Operational Requirements
- [ ] Minimum 100 HBAR balance maintained
- [ ] Automated balance top-up procedures
- [ ] Emergency contact procedures established
- [ ] Disaster recovery plan tested
- [ ] Documentation kept current

## NFT Metadata Size Requirements

### Hedera NFT Metadata Limits
- **Maximum Size**: 100 bytes (total JSON string)
- **Encoding**: UTF-8
- **Format**: JSON object converted to string

### Metadata Size Validation
```bash
# Check metadata size before minting
npm run hedera:check-metadata -- --metadata '{"name":"Hotel Booking","description":"Confirmed reservation","image":"https://example.com/img.png"}'

# Example output:
# 📊 Metadata Size Analysis:
#    Size: 95 bytes
#    Limit: 100 bytes  
#    Status: ✅ Valid
```

### Metadata Optimization Examples

#### ❌ Too Large (125 bytes)
```json
{
  "name": "Luxury Hotel Booking Confirmation NFT",
  "description": "This NFT represents a confirmed booking at a luxury hotel with premium amenities",
  "image": "https://example.com/images/hotel-booking-nft-image.png",
  "attributes": [
    {"trait_type": "Hotel Category", "value": "5-Star Luxury"},
    {"trait_type": "Check-in Date", "value": "2024-03-15"}
  ]
}
```

#### ✅ Optimized (78 bytes)
```json
{
  "name": "Hotel NFT",
  "desc": "Booking confirmed",
  "image": "https://api.hotel.com/img/123",
  "attrs": [{"type": "5-Star", "date": "2024-03-15"}]
}
```

#### ✅ Minimal (45 bytes)
```json
{
  "name": "Booking NFT",
  "url": "https://api.hotel.com/nft/123"
}
```

## Quick Verification Commands

### Complete System Check
```bash
# Run comprehensive diagnostic
npm run hedera:diagnose

# Generate detailed report
npm run hedera:diagnose -- --format json --output system-check.json
```

### Metadata Validation
```bash
# Validate metadata size
npm run hedera:check-metadata -- --metadata '{"name":"Test"}'

# Check metadata from file
npm run hedera:check-metadata -- --metadata "$(cat nft-metadata.json)"
```

### Account Verification
```bash
# Quick account check
npm run hedera:diagnose -- --account-check

# Detailed account analysis
npm run hedera:verify
```

### Operation Testing
```bash
# Test all NFT operations
npm run hedera:test-suite

# Test specific operation
npm run hedera:test-suite -- --operation mint
```

### Continuous Monitoring
```bash
# Start monitoring mode
npm run hedera:diagnose -- --monitor --interval 300

# Generate periodic reports
npm run hedera:report -- --format json
```

## Troubleshooting Quick Reference

### Common Issues and Solutions

| Issue | Symptoms | Quick Fix | Verification |
|-------|----------|-----------|--------------|
| **Low Balance** | Transaction failures | Add HBAR to account | `npm run hedera:check-balance` |
| **Missing Keys** | Permission errors | Configure required keys | `npm run hedera:check-permissions` |
| **Token Issues** | Association errors | Check token configuration | `npm run hedera:diagnose -- --token-check` |
| **Network Issues** | Connection timeouts | Check network configuration | `npm run hedera:health` |

### Emergency Procedures
1. **Service Degradation**: Switch to backup account, reduce operation frequency
2. **Complete Failure**: Check network status, verify account access, contact support
3. **Security Incident**: Rotate keys, audit transactions, implement additional monitoring

## Support and Documentation

### Internal Resources
- **[Complete Setup Guide](./hedera-nft-setup.md)**: Detailed account setup instructions
- **[Troubleshooting Guide](./hedera-nft-troubleshooting.md)**: Comprehensive error resolution
- **[Diagnostic Tool Guide](./hedera-diagnostic-tool-usage.md)**: CLI tool documentation
- **[Documentation Index](./README.md)**: Complete documentation overview

### External Resources
- **Hedera Docs**: https://docs.hedera.com/
- **SDK Reference**: https://github.com/hashgraph/hedera-sdk-js
- **Network Status**: https://status.hedera.com/
- **Support Portal**: https://help.hedera.com/

---

**Quick Start**: Run `npm run hedera:diagnose` to verify your setup meets all requirements.

**Emergency Contact**: Check network status at https://status.hedera.com/ for service issues.