# Requirements Document

## Introduction

This feature focuses on debugging and resolving Hedera NFT minting errors in the booking swap system. The system currently attempts to mint NFTs when users enable swapping for their bookings, but errors are occurring that prevent successful minting. We need to identify the root cause, provide detailed error reporting, and ensure the test account has proper permissions for NFT operations.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to see the full error details when NFT minting fails, so that I can diagnose and fix the underlying issues.

#### Acceptance Criteria

1. WHEN an NFT minting operation fails THEN the system SHALL log the complete error object including error code, message, and stack trace
2. WHEN an NFT minting operation fails THEN the system SHALL return the specific Hedera error status code to the caller
3. WHEN an NFT minting operation fails THEN the system SHALL include the transaction ID (if available) in the error response
4. WHEN debugging NFT issues THEN the system SHALL log the account balance before attempting minting operations
5. WHEN debugging NFT issues THEN the system SHALL log the token association status for the target account

### Requirement 2

**User Story:** As a developer, I want to verify that the Hedera test account has the necessary permissions and setup for NFT minting, so that I can ensure the account configuration is correct.

#### Acceptance Criteria

1. WHEN checking account permissions THEN the system SHALL verify the account has sufficient HBAR balance for NFT operations
2. WHEN checking account permissions THEN the system SHALL verify the account has the required keys (supply key, admin key, etc.) for the NFT token
3. WHEN checking account permissions THEN the system SHALL verify the NFT token exists and is properly configured
4. WHEN checking account permissions THEN the system SHALL verify the target user account can receive NFTs (token association)
5. WHEN checking account permissions THEN the system SHALL provide a diagnostic report of all permission checks

### Requirement 3

**User Story:** As a developer, I want to test NFT minting operations in isolation, so that I can verify the Hedera integration works correctly without other system dependencies.

#### Acceptance Criteria

1. WHEN running NFT minting tests THEN the system SHALL provide a standalone test function that attempts to mint an NFT
2. WHEN running NFT minting tests THEN the system SHALL test both successful and failure scenarios
3. WHEN running NFT minting tests THEN the system SHALL verify the minted NFT can be queried and has correct metadata
4. WHEN running NFT minting tests THEN the system SHALL test NFT transfer operations to user accounts
5. WHEN running NFT minting tests THEN the system SHALL clean up test NFTs after testing

### Requirement 4

**User Story:** As a system administrator, I want to understand what specific Hedera account capabilities are required for NFT operations, so that I can ensure the production account is properly configured.

#### Acceptance Criteria

1. WHEN documenting account requirements THEN the system SHALL specify the minimum HBAR balance needed for NFT operations
2. WHEN documenting account requirements THEN the system SHALL list all required keys (supply, admin, wipe, freeze, KYC, pause)
3. WHEN documenting account requirements THEN the system SHALL explain the token creation and management permissions needed
4. WHEN documenting account requirements THEN the system SHALL provide steps to verify account setup
5. WHEN documenting account requirements THEN the system SHALL include troubleshooting steps for common permission issues