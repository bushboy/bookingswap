# Requirements Document

## Introduction

This feature addresses critical blockchain integration failures in the auction creation process for swap proposals. The system currently fails when attempting to create auctions due to two main issues: 1) date handling errors where `endDate` is not properly converted to a Date object before calling `toISOString()`, and 2) null constraint violations where `swap_id` is null in the `swap_auctions` table. The latest error shows "null value in column 'swap_id' of relation 'swap_auctions' violates not-null constraint", indicating that the swap ID is not being properly passed to the auction creation process. This prevents users from creating enhanced swap proposals with auction functionality.

## Glossary

- **Auction_System**: The blockchain-based auction mechanism for swap proposals
- **Swap_Proposal_Service**: The backend service responsible for creating and managing swap proposals
- **Blockchain_Integration**: The component that interfaces with the Hedera blockchain for recording auction data
- **Enhanced_Swap**: A swap proposal that includes auction functionality with time-based bidding

## Requirements

### Requirement 1

**User Story:** As a user, I want to create enhanced swap proposals with auction functionality, so that I can receive competitive offers through a time-limited bidding process.

#### Acceptance Criteria

1. WHEN a user creates an enhanced swap proposal with auction settings THEN the Auction_System SHALL successfully record the auction on the blockchain
2. WHEN auction settings contain an endDate THEN the Swap_Proposal_Service SHALL ensure the endDate is a valid Date object before blockchain operations
3. WHEN the blockchain auction creation succeeds THEN the Enhanced_Swap SHALL be created with the returned auction ID
4. WHEN auction creation fails THEN the Swap_Proposal_Service SHALL provide detailed error information to help diagnose the issue
5. WHEN auction settings are validated THEN the Auction_System SHALL verify all required fields are present and properly formatted

### Requirement 2

**User Story:** As a developer, I want proper date handling in auction creation, so that blockchain operations don't fail due to type conversion errors.

#### Acceptance Criteria

1. WHEN processing auction settings THEN the Blockchain_Integration SHALL convert string dates to Date objects before calling toISOString()
2. WHEN validating auction endDate THEN the Auction_System SHALL ensure the date is in the future
3. WHEN serializing auction data for blockchain THEN the Blockchain_Integration SHALL use consistent ISO string format for all dates
4. WHEN receiving auction settings from the frontend THEN the Swap_Proposal_Service SHALL validate and normalize date formats
5. WHEN date conversion fails THEN the Auction_System SHALL return a specific error indicating the date format issue

### Requirement 3

**User Story:** As a system administrator, I want comprehensive error logging for auction creation failures, so that I can quickly identify and resolve blockchain integration issues.

#### Acceptance Criteria

1. WHEN auction creation fails THEN the Auction_System SHALL log the complete error object with stack trace
2. WHEN blockchain operations fail THEN the Blockchain_Integration SHALL log the specific request data that caused the failure
3. WHEN date conversion errors occur THEN the Auction_System SHALL log the original date value and expected format
4. WHEN auction creation succeeds THEN the Auction_System SHALL log the auction ID and transaction details
5. WHEN debugging auction issues THEN the Blockchain_Integration SHALL provide structured logs that can be easily filtered and analyzed

### Requirement 4

**User Story:** As a user, I want reliable auction functionality that handles edge cases gracefully, so that my swap proposals are created successfully regardless of input variations.

#### Acceptance Criteria

1. WHEN auction endDate is provided as a string THEN the Auction_System SHALL convert it to a Date object automatically
2. WHEN auction endDate is already a Date object THEN the Auction_System SHALL use it directly without conversion
3. WHEN auction settings contain invalid dates THEN the Swap_Proposal_Service SHALL return a validation error before attempting blockchain operations
4. WHEN timezone information is missing THEN the Auction_System SHALL assume UTC timezone for consistency
5. WHEN auction creation partially fails THEN the Swap_Proposal_Service SHALL implement proper rollback to maintain data consistency

### Requirement 5

**User Story:** As a developer, I want robust validation of auction settings, so that only properly formatted data reaches the blockchain integration layer.

#### Acceptance Criteria

1. WHEN validating auction settings THEN the Auction_System SHALL check that endDate is a valid future date
2. WHEN validating auction settings THEN the Auction_System SHALL ensure autoSelectAfterHours is a positive number
3. WHEN validating auction settings THEN the Auction_System SHALL verify that allowBookingProposals or allowCashProposals is true
4. WHEN auction settings validation fails THEN the Swap_Proposal_Service SHALL return specific field-level error messages
5. WHEN all auction settings are valid THEN the Auction_System SHALL proceed with blockchain recording

### Requirement 6

**User Story:** As a developer, I want proper swap ID validation and propagation, so that auction creation doesn't fail due to null constraint violations.

#### Acceptance Criteria

1. WHEN creating an enhanced swap THEN the Swap_Proposal_Service SHALL ensure the swap is successfully created with a valid ID before proceeding to auction creation
2. WHEN passing swap ID to auction creation THEN the Auction_System SHALL validate that the swap ID is not null or undefined
3. WHEN swap creation fails THEN the Swap_Proposal_Service SHALL not attempt auction creation
4. WHEN auction creation receives a null swap ID THEN the Auction_System SHALL return a specific error indicating the swap ID validation failure
5. WHEN swap ID validation passes THEN the Auction_System SHALL proceed with auction creation using the validated swap ID