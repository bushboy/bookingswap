# Hedera NFT Account Setup Requirements

## Overview

This document outlines the complete setup requirements for Hedera accounts to successfully perform NFT operations in the booking swap system. Proper account configuration is critical for NFT minting, transferring, and management operations.

## Minimum HBAR Balance Requirements

### Account Balance Requirements

| Operation | Minimum HBAR Required | Purpose |
|-----------|----------------------|---------|
| Token Creation | 20 HBAR | Initial token creation fee |
| NFT Minting | 0.05 HBAR per NFT | Transaction fee for minting |
| NFT Transfer | 0.001 HBAR | Transaction fee for transfer |
| Token Association | 0.05 HBAR | Associate token with account |
| Account Maintenance | 5 HBAR | Recommended buffer for operations |

### Recommended Account Balance
- **Minimum**: 25 HBAR for basic operations
- **Recommended**: 50 HBAR for production environments
- **High Volume**: 100+ HBAR for frequent NFT operations

## Required Account Keys

### Essential Keys for NFT Operations

#### 1. Admin Key
- **Purpose**: Manage token properties and metadata
- **Required**: Yes
- **Permissions**: Update token properties, delete token

#### 2. Supply Key  
- **Purpose**: Mint and burn NFTs
- **Required**: Yes for minting
- **Permissions**: Create new NFT instances, destroy existing NFTs

#### 3. Wipe Key
- **Purpose**: Remove NFTs from accounts
- **Required**: Optional
- **Permissions**: Forcibly remove NFTs from any account

#### 4. Freeze Key
- **Purpose**: Freeze/unfreeze token operations for specific accounts
- **Required**: Optional
- **Permissions**: Prevent token transfers for specific accounts

#### 5. KYC Key
- **Purpose**: Grant/revoke KYC status for accounts
- **Required**: Optional
- **Permissions**: Control which accounts can hold the token

#### 6. Pause Key
- **Purpose**: Pause all token operations globally
- **Required**: Optional
- **Permissions**: Temporarily halt all token operations

## Account Setup Steps

### Step 1: Create Hedera Account
```bash
# Using Hedera CLI (if available)
hedera account create --initial-balance 50

# Or use the Hedera Portal
# Visit: https://portal.hedera.com/
```

### Step 2: Fund Account with HBAR
```bash
# Transfer HBAR to your account
hedera crypto transfer --from <source-account> --to <your-account> --amount 50
```

### Step 3: Generate Required Keys
```javascript
// Example key generation
const { PrivateKey } = require("@hashgraph/sdk");

const adminKey = PrivateKey.generateED25519();
const supplyKey = PrivateKey.generateED25519();
const wipeKey = PrivateKey.generateED25519();

console.log("Admin Key:", adminKey.toString());
console.log("Supply Key:", supplyKey.toString());
console.log("Wipe Key:", wipeKey.toString());
```

### Step 4: Create NFT Token
```javascript
const tokenCreateTx = new TokenCreateTransaction()
    .setTokenName("Booking NFT")
    .setTokenSymbol("BNFT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryAccountId)
    .setAdminKey(adminKey)
    .setSupplyKey(supplyKey)
    .setWipeKey(wipeKey)
    .setMaxTransactionFee(new Hbar(20));
```

## Environment Configuration

### Environment Variables
```bash
# Required environment variables
HEDERA_NETWORK=testnet  # or mainnet
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=302e020100300506032b657004220420...
HEDERA_TOKEN_ID=0.0.789012

# Optional but recommended
HEDERA_ADMIN_KEY=302e020100300506032b657004220420...
HEDERA_SUPPLY_KEY=302e020100300506032b657004220420...
HEDERA_WIPE_KEY=302e020100300506032b657004220420...
```

### Network Endpoints
```javascript
// Testnet configuration
const client = Client.forTestnet();
client.setOperator(accountId, privateKey);

// Mainnet configuration  
const client = Client.forMainnet();
client.setOperator(accountId, privateKey);
```

## Account Verification Steps

### 1. Check Account Balance
```bash
# Using diagnostic CLI
npm run hedera:diagnose -- --check-balance

# Manual verification
hedera account info --account-id 0.0.123456
```

### 2. Verify Token Permissions
```bash
# Check token information
npm run hedera:diagnose -- --check-token --token-id 0.0.789012

# Verify account has required keys
npm run hedera:diagnose -- --check-permissions
```

### 3. Test NFT Operations
```bash
# Run comprehensive test suite
npm run hedera:test-suite

# Test specific operations
npm run hedera:test -- --operation mint
npm run hedera:test -- --operation transfer
```

## Security Best Practices

### Key Management
1. **Never commit private keys to version control**
2. **Use environment variables for sensitive data**
3. **Rotate keys regularly in production**
4. **Use hardware security modules (HSM) for production keys**
5. **Implement key backup and recovery procedures**

### Account Security
1. **Enable multi-signature for high-value accounts**
2. **Monitor account balance and transactions**
3. **Set up alerts for unusual activity**
4. **Use separate accounts for different environments**
5. **Implement proper access controls**

## Production Checklist

### Pre-Deployment Verification
- [ ] Account has sufficient HBAR balance (50+ HBAR recommended)
- [ ] All required keys are properly configured
- [ ] Token is created with correct properties
- [ ] NFT minting tests pass successfully
- [ ] Transfer operations work correctly
- [ ] Error handling is properly implemented
- [ ] Monitoring and alerting are configured
- [ ] Backup procedures are in place
- [ ] Security audit completed

### Ongoing Maintenance
- [ ] Monitor account balance weekly
- [ ] Review transaction logs monthly
- [ ] Update keys quarterly (if required)
- [ ] Test disaster recovery procedures
- [ ] Review and update documentation

## Common Account Issues

### Insufficient Balance
**Symptoms**: Transaction failures with "INSUFFICIENT_ACCOUNT_BALANCE"
**Solution**: Add more HBAR to the account

### Missing Keys
**Symptoms**: "INVALID_SIGNATURE" or permission denied errors
**Solution**: Verify all required keys are configured correctly

### Token Association Issues
**Symptoms**: "TOKEN_NOT_ASSOCIATED_TO_ACCOUNT" errors
**Solution**: Associate token with target accounts before operations

### Network Configuration
**Symptoms**: Connection timeouts or network errors
**Solution**: Verify network endpoints and account configuration

For detailed troubleshooting, see the [Hedera NFT Troubleshooting Guide](./hedera-nft-troubleshooting.md).