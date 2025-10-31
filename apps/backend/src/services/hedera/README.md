# Hedera Blockchain Integration

This module provides comprehensive integration with the Hedera Hashgraph network for the Booking Swap Platform. It includes services for blockchain transactions, wallet authentication, and smart contract interactions.

## Features

- **Hedera Consensus Service (HCS)** integration for immutable transaction records
- **Wallet authentication** using Hedera wallet signatures
- **Smart contract** creation and execution
- **Account balance** queries and management
- **Topic management** for organizing different types of transactions
- **Comprehensive error handling** and logging
- **Full test coverage** with unit tests

## Components

### HederaService

The main service class for interacting with the Hedera network.

```typescript
import { getHederaService, TransactionData } from './services/hedera';

// Get singleton instance
const hederaService = getHederaService();

// Submit transaction to HCS
const transactionData: TransactionData = {
  type: 'booking_listing',
  payload: { bookingId: 'booking-123' },
  timestamp: new Date(),
};

const result = await hederaService.submitTransaction(transactionData);
console.log('Transaction ID:', result.transactionId);
```

### WalletService

Utilities for wallet authentication and signature verification.

```typescript
import { WalletService } from './services/hedera';

// Verify wallet signature
const verification = WalletService.verifySignature(
  message,
  signature,
  publicKey
);

if (verification.isValid) {
  console.log('User authenticated:', verification.accountId);
}

// Generate authentication challenge
const challenge = WalletService.generateAuthChallenge(accountId);
```

## Configuration

Set up environment variables in your `.env` file:

```bash
# Hedera Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=your_private_key_here
HEDERA_TOPIC_ID=0.0.789012

# Optional: Logging
LOG_LEVEL=info
```

### Environment Variables

- `HEDERA_NETWORK`: Network to connect to (`testnet` or `mainnet`)
- `HEDERA_ACCOUNT_ID`: Your Hedera account ID (format: `0.0.123456`)
- `HEDERA_PRIVATE_KEY`: Private key for your Hedera account
- `HEDERA_TOPIC_ID`: (Optional) Topic ID for consensus service messages
- `LOG_LEVEL`: (Optional) Logging level (`debug`, `info`, `warn`, `error`)

## Usage Examples

### Basic Transaction Submission

```typescript
import { submitBookingListing } from './services/hedera/examples/basic-usage';

const bookingData = {
  id: 'booking-123',
  userId: 'user-456',
  title: 'Hotel Booking in Paris',
  location: { city: 'Paris', country: 'France' },
  dateRange: { checkIn: new Date(), checkOut: new Date() },
  swapValue: 500,
};

const transactionId = await submitBookingListing(bookingData);
console.log('Booking recorded on blockchain:', transactionId);
```

### Wallet Authentication

```typescript
import { authenticateUser, generateWalletChallenge } from './services/hedera/examples/basic-usage';

// Generate challenge for user to sign
const challenge = generateWalletChallenge('0.0.123456');

// Verify signed challenge
const auth = authenticateUser(challenge, signature, publicKey);
if (auth.isAuthenticated) {
  console.log('User authenticated:', auth.accountId);
}
```

### Smart Contract Operations

```typescript
import { getHederaService } from './services/hedera';

const hederaService = getHederaService();

// Create smart contract
const contract = await hederaService.createSmartContract(bytecode);
console.log('Contract created:', contract.contractId);

// Execute contract function
const result = await hederaService.executeContract(
  contract.contractId,
  'transfer',
  [recipientAddress, amount]
);
console.log('Contract executed:', result.transactionId);
```

## Testing

The module includes comprehensive unit tests for all components:

```bash
# Run all Hedera tests
npm run test:unit -- src/services/hedera

# Run specific test file
npm run test:unit -- src/services/hedera/__tests__/HederaService.test.ts

# Run tests in watch mode
npm run test:watch -- src/services/hedera
```

### Test Coverage

- **HederaService**: Transaction submission, smart contracts, account queries
- **WalletService**: Signature verification, authentication challenges
- **Configuration**: Environment variable validation and parsing
- **Factory Functions**: Service creation and singleton management

## Error Handling

The module provides comprehensive error handling with detailed logging:

```typescript
try {
  const result = await hederaService.submitTransaction(data);
} catch (error) {
  if (error.message.includes('Topic ID not configured')) {
    // Handle missing topic configuration
  } else if (error.message.includes('Network error')) {
    // Handle network connectivity issues
  } else {
    // Handle other errors
  }
}
```

## Network Support

### Testnet (Development)

- **Network**: `testnet`
- **Mirror Node**: `https://testnet.mirrornode.hedera.com`
- **Use for**: Development, testing, staging environments

### Mainnet (Production)

- **Network**: `mainnet`
- **Mirror Node**: `https://mainnet-public.mirrornode.hedera.com`
- **Use for**: Production deployments

## Security Considerations

1. **Private Key Management**: Never commit private keys to version control
2. **Environment Variables**: Use secure environment variable management
3. **Network Validation**: Always validate network configuration
4. **Signature Verification**: Implement proper signature validation for authentication
5. **Error Handling**: Don't expose sensitive information in error messages

## Performance Considerations

1. **Singleton Pattern**: Use `getHederaService()` for efficient resource usage
2. **Connection Pooling**: The service manages client connections efficiently
3. **Caching**: Consider caching frequently accessed data
4. **Batch Operations**: Group related transactions when possible

## Monitoring and Logging

The module provides detailed logging for:

- Transaction submissions and results
- Authentication attempts
- Error conditions and recovery
- Performance metrics
- Network connectivity status

Logs are structured for easy parsing and monitoring in production environments.

## Contributing

When contributing to the Hedera integration:

1. **Add Tests**: All new functionality must include unit tests
2. **Update Documentation**: Keep this README and code comments current
3. **Follow Patterns**: Use existing patterns for error handling and logging
4. **Security Review**: Have security-sensitive changes reviewed
5. **Performance Testing**: Test performance impact of changes

## Troubleshooting

### Common Issues

1. **"Topic ID not configured"**: Set `HEDERA_TOPIC_ID` environment variable
2. **"Invalid account ID format"**: Ensure account ID follows `0.0.123456` format
3. **"Network error"**: Check network connectivity and Hedera service status
4. **"Insufficient balance"**: Ensure account has sufficient HBAR for transactions

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug npm run dev
```

This will provide detailed information about:
- Network requests and responses
- Transaction details
- Authentication flows
- Error stack traces