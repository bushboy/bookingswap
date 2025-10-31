# Requirements Document

## Introduction

This feature temporarily removes auction and cash swap options from the user interface while maintaining the underlying functionality in the system. The goal is to simplify the user experience by hiding these advanced features without breaking existing functionality or requiring database changes.

## Glossary

- **Swap Creation Modal**: The modal component that allows users to create new swap proposals
- **Proposal Modal**: The modal component that allows users to make proposals on existing swaps
- **Auction Mode**: A swap acceptance strategy where multiple proposals are collected and the best one is selected
- **Cash Swap**: A swap type that accepts cash offers instead of booking exchanges
- **UI Hiding**: Making interface elements invisible to users while keeping the underlying functionality intact
- **Feature Flag**: A configuration mechanism to enable/disable features without code deployment

## Requirements

### Requirement 1

**User Story:** As a user creating a new swap, I want a simplified interface that only shows booking exchange options, so that I can focus on the core swap functionality without being overwhelmed by advanced features.

#### Acceptance Criteria

1. WHEN a user opens the swap creation modal, THE Swap Creation Modal SHALL display only the "Booking Exchange Only" payment type option
2. WHEN a user views the acceptance strategy section, THE Swap Creation Modal SHALL display only the "First Match Acceptance" option
3. WHILE the auction mode option exists in the code, THE Swap Creation Modal SHALL NOT render the auction mode radio button or related settings
4. WHILE the cash payment option exists in the code, THE Swap Creation Modal SHALL NOT render the cash payment radio button or related input fields
5. THE Swap Creation Modal SHALL maintain all existing validation logic for the visible options

### Requirement 2

**User Story:** As a user making a proposal on an existing swap, I want to see only booking exchange options, so that I can quickly propose my available swaps without confusion about cash offers.

#### Acceptance Criteria

1. WHEN a user opens the proposal modal, THE Proposal Modal SHALL display only eligible swap options for exchange
2. WHEN no eligible swaps are available, THE Proposal Modal SHALL display a message encouraging users to create more swaps
3. WHILE the cash offer functionality exists in the code, THE Proposal Modal SHALL NOT render the "Make Cash Offer" button or cash offer form
4. THE Proposal Modal SHALL maintain all existing compatibility scoring and swap selection functionality
5. THE Proposal Modal SHALL continue to handle wallet validation for booking exchange proposals

### Requirement 3

**User Story:** As a system administrator, I want the auction and cash swap functionality to remain intact in the backend, so that these features can be easily re-enabled in the future without data loss or system changes.

#### Acceptance Criteria

1. THE System SHALL preserve all existing API endpoints for auction and cash swap functionality
2. THE System SHALL maintain all database schemas and models related to auctions and cash swaps
3. THE System SHALL continue to process existing auction and cash swap data without modification
4. THE System SHALL keep all backend validation and business logic for hidden features
5. THE System SHALL ensure that existing auctions and cash swaps continue to function normally

### Requirement 4

**User Story:** As a developer, I want the UI changes to be implemented through conditional rendering, so that the features can be easily restored by changing configuration values.

#### Acceptance Criteria

1. THE Implementation SHALL use feature flags or configuration constants to control UI visibility
2. THE Implementation SHALL NOT remove or comment out existing component code
3. THE Implementation SHALL wrap hidden UI elements in conditional rendering blocks
4. THE Implementation SHALL maintain all existing component props and interfaces
5. THE Implementation SHALL ensure that enabling the features requires only configuration changes