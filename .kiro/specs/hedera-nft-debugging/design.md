# Design Document

## Overview

This design outlines a comprehensive debugging and diagnostic system for Hedera NFT minting operations. The system will provide detailed error reporting, account permission verification, isolated testing capabilities, and documentation for proper account setup. The design focuses on identifying and resolving the root causes of NFT minting failures in the booking swap system.

## Architecture

The debugging system will be implemented as a set of diagnostic tools and enhanced error handling within the existing Hedera service architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    NFT Debugging System                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Error Reporter  │  │ Permission      │  │ Test Suite  │ │
│  │                 │  │ Validator       │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Account         │  │ Token           │  │ Diagnostic  │ │
│  │ Diagnostics     │  │ Diagnostics     │  │ Reporter    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│              Enhanced NFT Service                           │
│              (with detailed error handling)                │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Enhanced Error Reporter

**Purpose**: Capture and format detailed error information from Hedera operations.

**Interface**:
```typescript
interface HederaErrorDetails {
  errorCode: string;
  errorMessage: string;
  transactionId?: string;
  status?: Status;
  receipt?: TransactionReceipt;
  accountBalance?: string;
  timestamp: Date;
  operation: string;
  context: Record<string, any>;
}

class HederaErrorReporter {
  static captureError(error: any, operation: string, context: Record<string, any>): HederaErrorDetails;
  static formatErrorForLogging(errorDetails: HederaErrorDetails): string;
  static isRetryableError(errorDetails: HederaErrorDetails): boolean;
}
```

### 2. Account Permission Validator

**Purpose**: Verify that the Hedera account has all necessary permissions and setup for NFT operations.

**Interface**:
```typescript
interface AccountPermissionReport {
  accountId: string;
  balance: {
    hbar: string;
    sufficient: boolean;
    minimumRequired: string;
  };
  tokenPermissions: {
    hasSupplyKey: boolean;
    hasAdminKey: boolean;
    hasWipeKey: boolean;
    hasFreezeKey: boolean;
    hasKycKey: boolean;
    hasPauseKey: boolean;
  };
  tokenExists: boolean;
  tokenInfo?: any;
  canMintNFTs: boolean;
  issues: string[];
}

class AccountPermissionValidator {
  async validateAccount(accountId: string): Promise<AccountPermissionReport>;
  async checkTokenPermissions(tokenId: string, accountId: string): Promise<boolean>;
  async verifyMinimumBalance(accountId: string): Promise<boolean>;
}
```

### 3. NFT Test Suite

**Purpose**: Provide isolated testing of NFT operations without system dependencies.

**Interface**:
```typescript
interface NFTTestResult {
  testName: string;
  success: boolean;
  error?: HederaErrorDetails;
  transactionId?: string;
  duration: number;
  details: Record<string, any>;
}

class NFTTestSuite {
  async testTokenCreation(): Promise<NFTTestResult>;
  async testNFTMinting(tokenId: string): Promise<NFTTestResult>;
  async testNFTTransfer(tokenId: string, serialNumber: number, toAccount: string): Promise<NFTTestResult>;
  async testNFTQuery(tokenId: string, serialNumber: number): Promise<NFTTestResult>;
  async runFullTestSuite(): Promise<NFTTestResult[]>;
  async cleanupTestAssets(): Promise<void>;
}
```

### 4. Diagnostic Reporter

**Purpose**: Generate comprehensive diagnostic reports for troubleshooting.

**Interface**:
```typescript
interface DiagnosticReport {
  timestamp: Date;
  environment: {
    network: string;
    accountId: string;
    topicId?: string;
  };
  accountStatus: AccountPermissionReport;
  recentErrors: HederaErrorDetails[];
  testResults: NFTTestResult[];
  recommendations: string[];
}

class DiagnosticReporter {
  async generateReport(): Promise<DiagnosticReport>;
  async exportReport(format: 'json' | 'markdown'): Promise<string>;
}
```

## Data Models

### Enhanced Error Context
```typescript
interface NFTMintingContext {
  bookingId: string;
  userId: string;
  userAccountId: string;
  tokenId?: string;
  metadata: any;
  operatorAccountId: string;
  networkType: 'testnet' | 'mainnet';
}
```

### Permission Check Results
```typescript
interface PermissionCheckResult {
  check: string;
  passed: boolean;
  details: string;
  recommendation?: string;
}
```

## Error Handling

### 1. Comprehensive Error Capture
- Capture full error objects from Hedera SDK
- Extract status codes, transaction IDs, and receipts
- Include operation context and account state
- Log errors with structured format for analysis

### 2. Error Classification
```typescript
enum HederaErrorType {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_ACCOUNT_BALANCE',
  INVALID_ACCOUNT = 'INVALID_ACCOUNT_ID',
  TOKEN_NOT_ASSOCIATED = 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT',
  ACCOUNT_FROZEN = 'ACCOUNT_FROZEN_FOR_TOKEN',
  INSUFFICIENT_TOKEN_BALANCE = 'INSUFFICIENT_TOKEN_BALANCE',
  INVALID_TOKEN_ID = 'INVALID_TOKEN_ID',
  TOKEN_WAS_DELETED = 'TOKEN_WAS_DELETED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}
```

### 3. Retry Logic Enhancement
- Implement smart retry based on error type
- Exponential backoff for network errors
- No retry for permission/configuration errors
- Maximum retry limits with circuit breaker

## Testing Strategy

### 1. Unit Tests
- Test error capture and formatting
- Test permission validation logic
- Test diagnostic report generation
- Mock Hedera SDK responses for various error scenarios

### 2. Integration Tests
- Test against Hedera testnet with real accounts
- Test various error conditions (insufficient balance, invalid accounts, etc.)
- Test NFT lifecycle (create, mint, transfer, query, burn)
- Test permission validation with different account configurations

### 3. End-to-End Tests
- Test complete NFT minting flow with debugging enabled
- Test error reporting in production-like scenarios
- Test diagnostic report generation and export
- Verify recommendations are actionable

### 4. Performance Tests
- Measure impact of enhanced error handling on performance
- Test diagnostic operations under load
- Verify error capture doesn't introduce memory leaks

## Implementation Details

### 1. Enhanced NFT Service
- Wrap all Hedera operations with detailed error capture
- Add pre-flight checks before expensive operations
- Include account balance checks before minting
- Add token association verification

### 2. Diagnostic CLI Tool
- Create command-line tool for running diagnostics
- Support for generating reports in multiple formats
- Integration with existing deployment scripts
- Automated health checks for production environments

### 3. Monitoring Integration
- Export error metrics to monitoring systems
- Create alerts for specific error patterns
- Dashboard for NFT operation health
- Historical error trend analysis

### 4. Documentation Generation
- Auto-generate troubleshooting guides from error patterns
- Create setup verification scripts
- Provide account configuration templates
- Include common error resolution steps