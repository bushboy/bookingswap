# Mock Wallet Testnet Update Design

## Overview

This design outlines the approach to update all mock wallet configurations throughout the test suite to use the specific testnet wallet address `0.0.6199687` instead of the current placeholder addresses. The solution will centralize wallet configuration and ensure consistency across all test files.

## Architecture

### Current State Analysis

The codebase currently uses various placeholder wallet addresses:
- `0.0.123456` - Primary placeholder in most e2e tests
- `0.0.789012` - Secondary placeholder for multi-wallet scenarios  
- `0.0.345678` - Additional placeholder in load tests
- `0.0.999999` - Used in security/tampering tests

### Proposed Architecture

```
tests/
├── fixtures/
│   ├── mock-services.ts (existing)
│   └── wallet-config.ts (new - centralized config)
├── e2e/
│   ├── wallet-*.spec.ts (update imports)
│   └── fixtures/mock-services.ts (update)
└── integration/
    └── *.test.ts (update mocks)
```

## Components and Interfaces

### 1. Centralized Wallet Configuration

**File:** `tests/fixtures/wallet-config.ts`

```typescript
export const WALLET_CONFIG = {
  PRIMARY_TESTNET_ACCOUNT: '0.0.6199687',
  PRIMARY_TESTNET_PRIVATE_KEY: '302e020100300506032b6570042204200d011c720c7f83813569957825c8da8ce95bc4e8f17fc4a44d4614d7b7e60c70',
  SECONDARY_TESTNET_ACCOUNT: '0.0.6199688', // For multi-wallet scenarios
  NETWORK: 'testnet',
  DEFAULT_BALANCE: 100.5,
  TRANSACTION_ID_PREFIX: '0.0.6199687@'
} as const;

export const createMockWalletResponse = (accountId: string = WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT) => ({
  accountIds: [accountId],
  network: WALLET_CONFIG.NETWORK,
});

export const createMockAccountInfo = (accountId: string = WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT) => ({
  accountId,
  balance: { hbars: WALLET_CONFIG.DEFAULT_BALANCE },
});

export const createMockWalletWithPrivateKey = () => ({
  accountId: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
  privateKey: WALLET_CONFIG.PRIMARY_TESTNET_PRIVATE_KEY,
  network: WALLET_CONFIG.NETWORK,
});
```

### 2. Updated Mock Services

**File:** `tests/e2e/fixtures/mock-services.ts`

Update the existing `mockWalletConnection()` method to use centralized config:

```typescript
import { WALLET_CONFIG, createMockWalletResponse, createMockAccountInfo } from '../fixtures/wallet-config';

async mockWalletConnection() {
  await this.page.addInitScript(() => {
    // Use centralized config instead of hardcoded values
    window.hashpack = {
      isAvailable: true,
      connect: async () => createMockWalletResponse(),
      getAccountInfo: async () => createMockAccountInfo(),
      // ... other methods
    };
  });
}
```

### 3. Database Test Data Updates

Update blockchain-related fields in test data:
- `blockchain_topic_id` fields
- `blockchain_proposal_transaction_id` fields  
- User wallet addresses in test data

## Data Models

### Wallet Configuration Schema

```typescript
interface WalletConfig {
  PRIMARY_TESTNET_ACCOUNT: string;
  PRIMARY_TESTNET_PRIVATE_KEY: string;
  SECONDARY_TESTNET_ACCOUNT: string;
  NETWORK: 'testnet' | 'mainnet';
  DEFAULT_BALANCE: number;
  TRANSACTION_ID_PREFIX: string;
}

interface MockWalletResponse {
  accountIds: string[];
  network: string;
}

interface MockAccountInfo {
  accountId: string;
  balance: { hbars: number };
}
```

### Database Field Mapping

| Field Name | Current Value | New Value |
|------------|---------------|-----------|
| `blockchain_topic_id` | `0.0.123456` | `0.0.6199687` |
| `blockchain_proposal_transaction_id` | `0.0.123456@...` | `0.0.6199687@...` |
| User `walletAddress` | `0.0.123456` | `0.0.6199687` |

## Error Handling

### Configuration Validation

```typescript
// Validate wallet address format
const WALLET_ADDRESS_REGEX = /^0\.0\.\d+$/;

export function validateWalletAddress(address: string): boolean {
  return WALLET_ADDRESS_REGEX.test(address);
}

// Runtime validation
if (!validateWalletAddress(WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT)) {
  throw new Error(`Invalid wallet address format: ${WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT}`);
}
```

### Backward Compatibility

- Maintain existing test assertions that check for wallet connectivity
- Preserve test behavior while updating underlying data
- Add migration helpers for gradual rollout if needed

## Testing Strategy

### Validation Approach

1. **Configuration Tests**: Verify centralized config exports correct values
2. **Integration Tests**: Ensure mock services use new wallet address
3. **E2E Tests**: Validate wallet connection flows work with new address
4. **Regression Tests**: Confirm existing test assertions still pass

### Test Categories to Update

1. **E2E Wallet Tests**:
   - `wallet-integration.spec.ts`
   - `wallet-session-management.spec.ts`
   - `wallet-provider-switching.spec.ts`
   - `wallet-error-scenarios.spec.ts`

2. **Integration Tests**:
   - `auth-integration.test.ts`
   - `server-startup.integration.test.ts`
   - `swap-proposal-endpoint.integration.test.ts`

3. **Load Tests**:
   - `load-test.js`

4. **Database Test Scripts**:
   - `test-accepted-target-filter.js`
   - Other test scripts with hardcoded wallet addresses

### Verification Steps

1. Run existing test suite to establish baseline
2. Update centralized configuration
3. Update mock services to use centralized config
4. Update individual test files systematically
5. Run test suite after each major update
6. Verify no test regressions

## Implementation Phases

### Phase 1: Foundation
- Create centralized wallet configuration
- Update mock services infrastructure

### Phase 2: E2E Tests
- Update all e2e test files to use centralized config
- Verify wallet connection flows

### Phase 3: Integration & Unit Tests
- Update backend integration tests
- Update unit test mocks

### Phase 4: Database & Scripts
- Update standalone test scripts
- Update database seeding with new wallet address

### Phase 5: Validation
- Run comprehensive test suite
- Document any breaking changes
- Update test documentation