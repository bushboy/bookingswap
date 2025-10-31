# Hedera NFT Troubleshooting Guide

## Overview

This guide provides solutions for common NFT minting errors and issues encountered in the Hedera booking swap system. Use this guide to quickly diagnose and resolve NFT operation failures.

## Common Error Codes and Solutions

### INSUFFICIENT_ACCOUNT_BALANCE

**Error Message**: "Insufficient account balance for transaction"
**Error Code**: `INSUFFICIENT_ACCOUNT_BALANCE`

**Symptoms**:
- NFT minting operations fail
- Transaction submission rejected
- Account balance warnings in logs

**Diagnosis**:
```bash
# Check current account balance
npm run hedera:diagnose -- --check-balance

# View recent transactions
npm run hedera:diagnose -- --transaction-history
```

**Solutions**:
1. **Add HBAR to Account**:
   ```bash
   # Transfer HBAR from another account
   hedera crypto transfer --from <source> --to <target> --amount 10
   ```

2. **Verify Minimum Balance Requirements**:
   - NFT minting: 0.05 HBAR per transaction
   - Token association: 0.05 HBAR
   - Recommended buffer: 5+ HBAR

3. **Check for Pending Transactions**:
   ```bash
   # View pending transactions that may be holding balance
   npm run hedera:diagnose -- --pending-transactions
   ```

### INVALID_ACCOUNT_ID

**Error Message**: "Invalid account ID format or account does not exist"
**Error Code**: `INVALID_ACCOUNT_ID`

**Symptoms**:
- Account lookup failures
- Transaction routing errors
- Authentication failures

**Diagnosis**:
```bash
# Verify account exists
npm run hedera:diagnose -- --verify-account --account-id 0.0.123456

# Check account format
npm run hedera:diagnose -- --validate-format --account-id 0.0.123456
```

**Solutions**:
1. **Verify Account ID Format**:
   - Correct format: `0.0.123456`
   - Check for typos or extra characters

2. **Confirm Account Exists**:
   ```bash
   # Query account information
   hedera account info --account-id 0.0.123456
   ```

3. **Check Network Configuration**:
   - Ensure using correct network (testnet vs mainnet)
   - Verify account exists on the target network

### TOKEN_NOT_ASSOCIATED_TO_ACCOUNT

**Error Message**: "Token is not associated with the account"
**Error Code**: `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`

**Symptoms**:
- NFT transfer failures
- Token balance queries fail
- Minting to user accounts fails

**Diagnosis**:
```bash
# Check token associations
npm run hedera:diagnose -- --check-associations --account-id 0.0.123456

# Verify token exists
npm run hedera:diagnose -- --check-token --token-id 0.0.789012
```

**Solutions**:
1. **Associate Token with Account**:
   ```javascript
   const associateTx = new TokenAssociateTransaction()
       .setAccountId(userAccountId)
       .setTokenIds([tokenId])
       .freezeWith(client);
   
   const signedTx = await associateTx.sign(userPrivateKey);
   const response = await signedTx.execute(client);
   ```

2. **Auto-Associate During Minting**:
   ```javascript
   // Enable auto-association in token creation
   const tokenCreateTx = new TokenCreateTransaction()
       .setAutoRenewAccountId(treasuryAccountId)
       .setMaxAutomaticTokenAssociations(100);
   ```

3. **Batch Associate Multiple Tokens**:
   ```bash
   # Associate multiple tokens at once
   npm run hedera:associate -- --account-id 0.0.123456 --tokens 0.0.789012,0.0.789013
   ```

### INVALID_SIGNATURE

**Error Message**: "Transaction signature is invalid"
**Error Code**: `INVALID_SIGNATURE`

**Symptoms**:
- Transaction submission failures
- Authentication errors
- Key validation failures

**Diagnosis**:
```bash
# Verify key configuration
npm run hedera:diagnose -- --check-keys

# Test signature generation
npm run hedera:diagnose -- --test-signature
```

**Solutions**:
1. **Verify Private Key Format**:
   ```javascript
   // Ensure key is properly formatted
   const privateKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
   console.log("Public Key:", privateKey.publicKey.toString());
   ```

2. **Check Required Keys**:
   - Admin key for token management
   - Supply key for NFT minting
   - Treasury key for account operations

3. **Validate Key Permissions**:
   ```bash
   # Check which keys are required for operation
   npm run hedera:diagnose -- --check-permissions --operation mint
   ```

### ACCOUNT_FROZEN_FOR_TOKEN

**Error Message**: "Account is frozen for this token"
**Error Code**: `ACCOUNT_FROZEN_FOR_TOKEN`

**Symptoms**:
- Token operations blocked
- Transfer failures
- Minting restrictions

**Diagnosis**:
```bash
# Check freeze status
npm run hedera:diagnose -- --check-freeze --account-id 0.0.123456 --token-id 0.0.789012
```

**Solutions**:
1. **Unfreeze Account**:
   ```javascript
   const unfreezeTransaction = new TokenUnfreezeTransaction()
       .setAccountId(targetAccountId)
       .setTokenId(tokenId)
       .freezeWith(client);
   
   const signedTx = await unfreezeTransaction.sign(freezeKey);
   await signedTx.execute(client);
   ```

2. **Check Freeze Key Configuration**:
   - Verify freeze key is available
   - Ensure proper permissions

### METADATA_TOO_LONG

**Error Message**: "Metadata exceeds maximum allowed size"
**Error Code**: `METADATA_TOO_LONG` or `TRANSACTION_OVERSIZE`

**Symptoms**:
- NFT minting operations fail with metadata size errors
- Transaction rejected before submission
- Large JSON metadata objects cause failures

**Diagnosis**:
```bash
# Check metadata size in your NFT creation
npm run hedera:diagnose -- --check-metadata-size --metadata '{"your":"metadata"}'

# Test with sample metadata
npm run hedera:test-suite -- --operation mint --metadata '{"name":"test"}'
```

**Solutions**:
1. **Reduce Metadata Size**:
   ```javascript
   // Hedera NFT metadata limit is 100 bytes
   const metadata = {
     name: "Booking NFT",           // Keep names short
     description: "Hotel booking", // Limit description length
     image: "https://short.url",   // Use short URLs
     attributes: [                 // Minimize attributes
       { trait_type: "Type", value: "Hotel" },
       { trait_type: "Date", value: "2024-01" }
     ]
   };
   
   // Check size before minting
   const metadataString = JSON.stringify(metadata);
   const metadataSize = Buffer.from(metadataString).length;
   
   if (metadataSize > 100) {
     throw new Error(`Metadata too large: ${metadataSize} bytes (max: 100 bytes)`);
   }
   ```

2. **Use External Storage for Large Data**:
   ```javascript
   // Store large data externally and reference it
   const metadata = {
     name: "Booking NFT",
     description: "Hotel booking",
     image: "https://api.example.com/nft/image/123",
     external_url: "https://api.example.com/nft/details/123"
   };
   ```

3. **Implement Metadata Validation**:
   ```javascript
   function validateMetadataSize(metadata) {
     const metadataString = JSON.stringify(metadata);
     const metadataBytes = Buffer.from(metadataString).length;
     
     if (metadataBytes > 100) {
       throw new Error(
         `NFT metadata too large: ${metadataBytes} bytes. ` +
         `Maximum allowed: 100 bytes. ` +
         `Consider using shorter field values or external storage.`
       );
     }
     
     return metadataBytes;
   }
   ```

4. **Optimize Metadata Structure**:
   ```javascript
   // Instead of verbose metadata
   const verboseMetadata = {
     "name": "Luxury Hotel Booking NFT",
     "description": "This NFT represents a confirmed booking at a luxury hotel",
     "booking_details": {
       "hotel_name": "Grand Palace Hotel",
       "check_in_date": "2024-03-15",
       "check_out_date": "2024-03-18"
     }
   };
   
   // Use compact metadata
   const compactMetadata = {
     "name": "Hotel NFT",
     "desc": "Booking confirmed",
     "url": "https://api.hotel.com/b/123"
   };
   ```

### TOKEN_WAS_DELETED

**Error Message**: "Token has been deleted"
**Error Code**: `TOKEN_WAS_DELETED`

**Symptoms**:
- All token operations fail
- Token queries return deleted status
- Historical data may be inaccessible

**Diagnosis**:
```bash
# Check token status
npm run hedera:diagnose -- --check-token --token-id 0.0.789012
```

**Solutions**:
1. **Create New Token**:
   ```bash
   # Create replacement token
   npm run hedera:create-token -- --name "Booking NFT v2" --symbol "BNFT2"
   ```

2. **Update Configuration**:
   - Update environment variables with new token ID
   - Migrate existing data if necessary

## Network and Connection Issues

### Connection Timeouts

**Symptoms**:
- Slow transaction responses
- Network timeout errors
- Intermittent failures

**Solutions**:
1. **Check Network Status**:
   ```bash
   # Verify Hedera network status
   curl -s https://mainnet-public.mirrornode.hedera.com/api/v1/network/nodes
   ```

2. **Adjust Timeout Settings**:
   ```javascript
   client.setRequestTimeout(Duration.ofSeconds(30));
   client.setMaxAttempts(3);
   ```

3. **Use Alternative Endpoints**:
   ```javascript
   // Configure backup endpoints
   const client = Client.forTestnet();
   client.setMirrorNetwork(["testnet.mirrornode.hedera.com:443"]);
   ```

### Rate Limiting

**Symptoms**:
- "BUSY" status responses
- Transaction throttling
- Delayed processing

**Solutions**:
1. **Implement Retry Logic**:
   ```javascript
   const retryTransaction = async (transaction, maxRetries = 3) => {
       for (let i = 0; i < maxRetries; i++) {
           try {
               return await transaction.execute(client);
           } catch (error) {
               if (error.status === Status.Busy && i < maxRetries - 1) {
                   await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                   continue;
               }
               throw error;
           }
       }
   };
   ```

2. **Batch Operations**:
   ```javascript
   // Group multiple operations together
   const batchMint = async (metadataList) => {
       const promises = metadataList.map(async (metadata, index) => {
           await new Promise(resolve => setTimeout(resolve, index * 100));
           return mintNFT(metadata);
       });
       return Promise.all(promises);
   };
   ```

## Diagnostic Commands

### Quick Health Check
```bash
# Run comprehensive system check
npm run hedera:diagnose

# Check specific component
npm run hedera:diagnose -- --component nft-service
```

### Account Diagnostics
```bash
# Full account analysis
npm run hedera:diagnose -- --account-full-check

# Balance and permissions only
npm run hedera:diagnose -- --account-quick-check
```

### Token Diagnostics
```bash
# Token information and permissions
npm run hedera:diagnose -- --token-info --token-id 0.0.789012

# Token association status
npm run hedera:diagnose -- --token-associations
```

### Transaction Analysis
```bash
# Analyze recent failures
npm run hedera:diagnose -- --analyze-failures --hours 24

# Transaction performance metrics
npm run hedera:diagnose -- --performance-metrics
```

## Error Prevention Best Practices

### Pre-Flight Checks
1. **Always verify account balance before operations**
2. **Check token associations before transfers**
3. **Validate account IDs and formats**
4. **Confirm network connectivity**

### Monitoring and Alerting
1. **Set up balance monitoring**:
   ```javascript
   // Monitor account balance
   setInterval(async () => {
       const balance = await getAccountBalance(accountId);
       if (balance.hbars.toBigNumber().lt(5)) {
           console.warn("Low HBAR balance:", balance.toString());
       }
   }, 300000); // Check every 5 minutes
   ```

2. **Error rate monitoring**:
   ```javascript
   // Track error rates
   const errorMetrics = {
       total: 0,
       errors: 0,
       lastHour: []
   };
   ```

### Graceful Error Handling
```javascript
const handleNFTOperation = async (operation) => {
    try {
        return await operation();
    } catch (error) {
        const errorDetails = HederaErrorReporter.captureError(error, 'nft-operation', {});
        
        if (HederaErrorReporter.isRetryableError(errorDetails)) {
            // Implement retry logic
            return retryOperation(operation, 3);
        }
        
        // Log non-retryable errors
        console.error('NFT operation failed:', errorDetails);
        throw error;
    }
};
```

## Getting Help

### Log Analysis
1. **Enable debug logging**:
   ```bash
   DEBUG=hedera:* npm start
   ```

2. **Generate diagnostic report**:
   ```bash
   npm run hedera:diagnose -- --export-report --format json
   ```

### Support Resources
- **Hedera Documentation**: https://docs.hedera.com/
- **SDK Documentation**: https://github.com/hashgraph/hedera-sdk-js
- **Community Discord**: https://discord.com/invite/hedera
- **Stack Overflow**: Tag questions with `hedera-hashgraph`

### Emergency Procedures
1. **Service Degradation**:
   - Switch to backup accounts
   - Reduce operation frequency
   - Enable maintenance mode

2. **Complete Service Failure**:
   - Check Hedera network status
   - Verify account access
   - Contact Hedera support if needed

For account setup requirements, see the [Hedera NFT Setup Guide](./hedera-nft-setup.md).