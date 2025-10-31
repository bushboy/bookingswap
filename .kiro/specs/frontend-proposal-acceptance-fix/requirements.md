# Requirements Document

## Introduction

The frontend proposal acceptance system currently has inconsistent implementation where some components use the correct proposal acceptance flow (with swapTargetId) while others use an outdated flow that doesn't pass the swapTargetId. This causes the backend to log "usingSwapTargetId": false when it should be using the swap_target_id for proper proposal processing.

## Glossary

- **ProposalAcceptanceAPI**: The correct API service that handles proposal acceptance with swapTargetId support
- **SwapService**: The legacy service that handles proposal acceptance without swapTargetId (incorrect)
- **ProposalAcceptanceThunks**: Redux thunks that use the correct ProposalAcceptanceAPI
- **SwapThunks**: Legacy Redux thunks that use the incorrect SwapService
- **SwapTargetId**: The target swap identifier that should be passed to the backend for proper proposal processing
- **ProposalResponseModal**: The main component that currently uses the incorrect flow

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want all proposal acceptance flows to use the correct API endpoint with swapTargetId, so that the backend can properly process proposals with the target swap information.

#### Acceptance Criteria

1. WHEN a user accepts a proposal through any frontend component, THE Frontend_System SHALL pass the swapTargetId to the backend API
2. WHEN ProposalResponseModal processes proposal acceptance, THE Frontend_System SHALL use the ProposalAcceptanceThunks instead of SwapThunks
3. WHEN any component calls proposal acceptance, THE Frontend_System SHALL ensure the request includes the swapTargetId parameter
4. THE Frontend_System SHALL maintain consistent proposal acceptance behavior across all components
5. THE Frontend_System SHALL log "usingSwapTargetId": true in backend processing after the fix

### Requirement 2

**User Story:** As a developer, I want to consolidate proposal acceptance logic to use a single, correct implementation, so that there's no confusion about which service to use.

#### Acceptance Criteria

1. THE Frontend_System SHALL use only ProposalAcceptanceAPI for all proposal acceptance operations
2. THE Frontend_System SHALL deprecate the acceptProposal method in SwapService
3. THE Frontend_System SHALL update all components to use ProposalAcceptanceThunks
4. THE Frontend_System SHALL ensure backward compatibility during the transition
5. THE Frontend_System SHALL maintain the same user interface behavior after the changes

### Requirement 3

**User Story:** As a user accepting proposals, I want the system to work consistently regardless of which component I use, so that my proposal acceptances are processed correctly.

#### Acceptance Criteria

1. WHEN a user accepts a proposal from ProposalResponseModal, THE Frontend_System SHALL process it with the same logic as other components
2. WHEN a user accepts a proposal from any component, THE Frontend_System SHALL provide consistent error handling and notifications
3. THE Frontend_System SHALL maintain the same loading states and user feedback across all components
4. THE Frontend_System SHALL ensure proposal acceptance works correctly with the target swap information
5. THE Frontend_System SHALL provide the same retry and error recovery mechanisms across all components