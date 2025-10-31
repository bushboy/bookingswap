# BookingEscrow Smart Contract Service

This service provides integration with the BookingEscrow smart contract deployed on Hedera Hashgraph. The contract enables secure, atomic swaps of booking reservations with built-in escrow functionality.

## Overview

The BookingEscrow contract implements a trustless system for exchanging bookings between users. Key features include:

- **Booking Registration**: Users can register their bookings with value and metadata
- **Swap Proposals**: Users can propose swaps with other registered bookings
- **Atomic Execution**: Swaps are executed atomically to prevent partial failures
- **Escrow Protection**: Funds are held in escrow until swap completion
- **Automatic Expiration**: Proposals automatically expire to prevent stale swaps

## Contract Architecture

### Smart Contract (Solidity)

The `BookingEscrow.sol` contract includes:

- **Booking Management**: Registration, validation, and locking mechanisms
- **Swap Lifecycle**: Proposal, acceptance, execution, and cancellation
- **Escrow System**: Secure fund holding and automatic fee deduction
- **Access Control**: Owner-only functions and participant restrictions

### Service Layer (TypeScript)

The `ContractService.ts` provides:

- **Contract Deployment**: Automated deployment to Hedera testnet/mainnet
- **Transaction Management**: Wrapper methods for all contract functions
- **Error Handling**: Comprehensive error handling and logging
- **Type Safety**: Full TypeScript interfaces for all operations

## Usage

### 1. Initialize the Service

```typescript
import { HederaService, ContractService } from '../services/hedera';

// Initialize Hedera service
const hederaService = new HederaService(
  'testnet',
  process.env.HEDERA_ACCOUNT_ID!,
  process.env.HEDERA_PRIVATE_KEY!
);

// Initialize contract service
const contractService = new ContractService(hederaService);
```

### 2. Deploy Contract (One-time)

```typescript
// Deploy the escrow contract
const contractId = await contractService.deployEscrowContract();
console.log('Contract deployed:', contractId);

// Or use existing contract
contractService.setContractId('0.0.123456');
```

### 3. Register Bookings

```typescript
const bookingData = {
  bookingId: 'booking_123',
  value: 1000000, // 1 HBAR in tinybars
  metadata: 'QmIPFSHashOfBookingDetails'
};

const result = await contractService.registerBooking(
  bookingData, 
  bookingData.value // Payment amount
);
```

### 4. Propose Swaps

```typescript
const swapProposal = {
  swapId: 'swap_456',
  sourceBookingId: 'booking_123',
  targetBookingId: 'booking_789',
  additionalPayment: 200000, // 0.2 HBAR difference
  expirationTime: Math.floor(Date.now() / 1000) + 3600 // 1 hour
};

await contractService.proposeSwap(swapProposal, swapProposal.additionalPayment);
```

### 5. Execute Swaps

```typescript
// Accept the swap proposal
await contractService.acceptSwap('swap_456');

// Execute the atomic swap
await contractService.executeSwap('swap_456');
```

## API Reference

### BookingData Interface

```typescript
interface BookingData {
  bookingId: string;      // Unique booking identifier
  value: number;          // Booking value in tinybars
  metadata: string;       // IPFS hash of booking details
}
```

### SwapProposal Interface

```typescript
interface SwapProposal {
  swapId: string;           // Unique swap identifier
  sourceBookingId: string;  // Proposer's booking ID
  targetBookingId: string;  // Target booking ID
  additionalPayment: number; // Additional payment in tinybars
  expirationTime: number;   // Unix timestamp for expiration
}
```

### Contract Methods

#### Booking Operations

- `registerBooking(booking, payment)` - Register a new booking
- `getBooking(bookingId)` - Retrieve booking details

#### Swap Operations

- `proposeSwap(proposal, payment)` - Propose a new swap
- `acceptSwap(swapId)` - Accept a swap proposal
- `executeSwap(swapId)` - Execute an accepted swap
- `cancelSwap(swapId)` - Cancel a pending swap
- `getSwap(swapId)` - Retrieve swap details

#### Balance Operations

- `getUserBalance(address)` - Get user's contract balance
- `withdrawFunds(amount)` - Withdraw funds from contract

## Deployment

### Using the Deployment Script

```bash
# Set environment variables
export HEDERA_ACCOUNT_ID="0.0.123456"
export HEDERA_PRIVATE_KEY="302e020100..."
export HEDERA_NETWORK="testnet"

# Run deployment script
tsx scripts/deploy-contract.ts
```

### Manual Deployment

```typescript
const contractService = new ContractService(hederaService);
const contractId = await contractService.deployEscrowContract(1000000);
```

## Testing

### Integration Tests

Run integration tests with Hedera testnet:

```bash
# Set test credentials
export HEDERA_ACCOUNT_ID="0.0.123456"
export HEDERA_PRIVATE_KEY="302e020100..."

# Run integration tests
npm run test:integration -- ContractService
```

### Unit Tests

Run unit tests with mocked services:

```bash
npm run test -- ContractService
```

## Error Handling

The service includes comprehensive error handling for:

- **Contract Not Deployed**: Ensures contract is deployed before operations
- **Invalid Parameters**: Validates all input parameters
- **Transaction Failures**: Handles Hedera transaction errors
- **Network Issues**: Manages network connectivity problems
- **Insufficient Funds**: Checks account balances before operations

## Security Considerations

### Smart Contract Security

- **Access Control**: Functions restricted to appropriate participants
- **Reentrancy Protection**: Guards against reentrancy attacks
- **Integer Overflow**: Uses SafeMath-equivalent operations
- **Emergency Controls**: Owner-only emergency functions

### Service Security

- **Input Validation**: All parameters validated before submission
- **Private Key Management**: Secure handling of Hedera credentials
- **Transaction Verification**: All transactions verified on-chain
- **Error Logging**: Comprehensive logging without exposing secrets

## Gas Optimization

Default gas limits for operations:

- Contract Deployment: 1,000,000 gas
- Booking Registration: 300,000 gas
- Swap Proposal: 400,000 gas
- Swap Execution: 500,000 gas
- Balance Queries: 50,000 gas

## Environment Variables

Required environment variables:

```bash
HEDERA_ACCOUNT_ID=0.0.123456          # Your Hedera account ID
HEDERA_PRIVATE_KEY=302e020100...      # Your Hedera private key
HEDERA_NETWORK=testnet                # Network (testnet|mainnet)
ESCROW_CONTRACT_ID=0.0.789012         # Deployed contract ID
```

## Monitoring and Logging

The service provides detailed logging for:

- Contract deployment events
- Transaction submissions and receipts
- Error conditions and recovery
- Performance metrics

Logs are structured for easy parsing and monitoring integration.

## Future Enhancements

Planned improvements:

- **Multi-signature Support**: Support for multi-sig wallets
- **Batch Operations**: Batch multiple operations for efficiency
- **Event Subscriptions**: Real-time event monitoring
- **Upgrade Mechanisms**: Contract upgrade patterns
- **Advanced Escrow**: More complex escrow conditions