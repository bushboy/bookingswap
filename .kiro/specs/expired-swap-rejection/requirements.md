# Requirements Document

## Introduction

This feature enables users to manually reject expired swaps and proposals while working alongside the existing automatic expiration system. The system currently auto-cancels expired swaps every 5 minutes, but users should also be able to manually reject expired swaps for immediate cleanup and closure. This addresses authorization errors that prevent users from rejecting their own expired swaps.

## Glossary

- **Expired Swap**: A swap that has passed its expiration date (expiresAt) and is no longer available for new proposals
- **Automatic Expiration**: The existing system that runs every 5 minutes to cancel expired swaps automatically
- **Manual Rejection**: User-initiated rejection of expired swaps for immediate cleanup
- **Swap Owner**: The user who created the original swap listing (derived from sourceBooking.userId)
- **Proposal Creator**: The user who submitted a proposal to a swap
- **ProposalAcceptanceService**: Backend service that handles proposal acceptance and rejection logic
- **SwapExpirationService**: Existing service that automatically cancels expired swaps

## Requirements

### Requirement 1

**User Story:** As a swap owner, I want to be able to manually reject my expired swaps so that I can immediately clean up my listings without waiting for the automatic expiration service.

#### Acceptance Criteria

1. WHEN a swap has expired, THE ProposalAcceptanceService SHALL allow the swap owner to manually reject the swap
2. THE ProposalAcceptanceService SHALL validate that the user is the swap owner by checking sourceBooking.userId
3. THE ProposalAcceptanceService SHALL update the swap status to 'rejected' with reason 'manually_rejected_expired'
4. THE ProposalAcceptanceService SHALL work alongside the existing automatic expiration system without conflicts
5. WHERE a swap is already cancelled by automatic expiration, THE ProposalAcceptanceService SHALL allow status change from 'cancelled' to 'rejected'

### Requirement 2

**User Story:** As a user, I want to be able to reject individual proposals on expired swaps so that I can provide specific closure to proposers.

#### Acceptance Criteria

1. WHEN a swap has expired, THE ProposalAcceptanceService SHALL allow rejection of individual proposals on that swap
2. THE ProposalAcceptanceService SHALL validate authorization by checking if user is swap owner or proposal creator
3. THE ProposalAcceptanceService SHALL update individual proposal status to 'rejected' with reason 'expired_swap_rejected'
4. THE ProposalAcceptanceService SHALL allow proposal creators to withdraw their own proposals from expired swaps
5. THE ProposalAcceptanceService SHALL send appropriate notifications based on who initiated the rejection

### Requirement 3

**User Story:** As a user, I want clear feedback about expired swap operations so that I understand what actions are allowed and why.

#### Acceptance Criteria

1. THE ProposalAcceptanceService SHALL provide specific error messages distinguishing between authorization and expiration issues
2. WHEN a user tries to accept an expired swap, THE ProposalAcceptanceService SHALL return error "Cannot accept expired swap" with expiration date
3. WHEN a user successfully rejects an expired swap, THE ProposalAcceptanceService SHALL return success message with expiration context
4. THE ProposalAcceptanceService SHALL include both current time and expiration time in error/success responses
5. WHERE automatic expiration has already processed a swap, THE ProposalAcceptanceService SHALL indicate this in response messages

### Requirement 4

**User Story:** As a system administrator, I want manual expiration handling to work seamlessly with automatic expiration so that the system maintains consistency.

#### Acceptance Criteria

1. THE ProposalAcceptanceService SHALL coordinate with the existing SwapExpirationService without conflicts
2. THE ProposalAcceptanceService SHALL prevent acceptance operations on expired swaps while allowing rejection operations
3. THE ProposalAcceptanceService SHALL handle race conditions between manual rejection and automatic cancellation
4. THE ProposalAcceptanceService SHALL log all manual expiration operations with timestamps for audit purposes
5. WHERE automatic expiration has processed a swap, THE ProposalAcceptanceService SHALL still allow manual status updates for user closure

### Requirement 5

**User Story:** As a frontend application, I want appropriate status codes and error information so that I can display helpful messages about expired swap operations.

#### Acceptance Criteria

1. THE ProposalAcceptanceService SHALL return 422 status code for expired swap acceptance attempts with clear error message
2. THE ProposalAcceptanceService SHALL return 200 status code for successful expired swap rejections
3. THE ProposalAcceptanceService SHALL return 409 status code when trying to reject already processed expired swaps
4. THE ProposalAcceptanceService SHALL include expiration timestamp and current timestamp in all responses
5. WHERE authorization fails on expired swaps, THE ProposalAcceptanceService SHALL return 403 with specific expired swap context