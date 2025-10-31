# Requirements Document

## Introduction

This feature enhances the existing swap proposal system by adding payment flexibility and auction mechanisms. Users can now specify whether they accept only like-for-like booking exchanges or also cash payments. Additionally, users can choose between immediate acceptance of the first matching proposal or running an auction process that must conclude at least one week before the event date. This provides more control and potentially better value for swap creators while maintaining fairness and preventing last-minute complications.

## Requirements

### Requirement 1: Payment Type Specification

**User Story:** As a booking owner creating a swap proposal, I want to specify acceptable payment types so that I can control whether I accept only booking exchanges or also cash payments.

#### Acceptance Criteria

1. WHEN a user creates a swap proposal THEN the system SHALL provide options to select "booking exchange only" or "booking exchange and cash"
2. WHEN "booking exchange only" is selected THEN the system SHALL only allow other users to propose booking swaps
3. WHEN "booking exchange and cash" is selected THEN the system SHALL allow both booking swap proposals and cash offers
4. WHEN a cash payment option is enabled THEN the system SHALL require the user to specify minimum acceptable cash amount
5. IF a user tries to make a cash offer on a "booking exchange only" swap THEN the system SHALL prevent the proposal and display an appropriate message
6. WHEN displaying swap details THEN the system SHALL clearly indicate which payment types are accepted
7. WHEN a swap proposal is saved THEN the system SHALL store the payment preferences and enforce them throughout the swap lifecycle

### Requirement 2: Deal Acceptance Strategy Selection

**User Story:** As a booking owner creating a swap proposal, I want to choose between immediate acceptance and auction mode so that I can optimize the value I receive for my booking.

#### Acceptance Criteria

1. WHEN creating a swap proposal THEN the system SHALL provide options to select "first match acceptance" or "auction mode"
2. WHEN "first match acceptance" is selected THEN the system SHALL automatically accept the first proposal that meets the specified criteria
3. WHEN "auction mode" is selected THEN the system SHALL collect multiple proposals and allow the owner to choose the best one
4. WHEN auction mode is enabled THEN the system SHALL require setting an auction end date that is at least one week before the event date
5. IF the event date is less than one week away THEN the system SHALL only allow "first match acceptance" mode
6. WHEN an auction is active THEN the system SHALL display the auction end date and time remaining to all potential bidders
7. WHEN an auction ends THEN the system SHALL notify the swap owner to review and select from received proposals
8. IF no proposals are received during an auction THEN the system SHALL convert the swap to "first match acceptance" mode automatically

### Requirement 3: Auction Timeline Management

**User Story:** As a platform user, I want auctions to end with sufficient time before events so that booking transfers can be completed without last-minute complications.

#### Acceptance Criteria

1. WHEN a user selects auction mode THEN the system SHALL calculate the maximum allowed auction end date as one week before the event date
2. WHEN setting auction duration THEN the system SHALL validate that the end date is at least one week before the event
3. IF a user tries to set an auction end date less than one week before the event THEN the system SHALL reject the setting and display an error message
4. WHEN an event date is less than one week away THEN the system SHALL disable auction mode option entirely
5. WHEN an auction is created THEN the system SHALL display countdown timers showing time remaining until auction end
6. WHEN an auction ends THEN the system SHALL immediately stop accepting new proposals and notify the swap owner
7. WHEN the one-week-before-event deadline approaches THEN the system SHALL send reminders to complete any pending swap transactions
8. IF a swap owner doesn't select a winning proposal within 24 hours of auction end THEN the system SHALL automatically select the highest-value proposal

### Requirement 4: Proposal Evaluation and Selection

**User Story:** As a booking owner running an auction, I want to review and compare all received proposals so that I can select the most valuable offer.

#### Acceptance Criteria

1. WHEN an auction ends THEN the system SHALL display all received proposals in a comparison view
2. WHEN displaying proposals THEN the system SHALL show proposal value, booking details, and proposer information
3. WHEN comparing cash offers THEN the system SHALL rank them by offered amount in descending order
4. WHEN comparing booking swaps THEN the system SHALL display booking details and allow manual comparison
5. WHEN mixed proposal types exist THEN the system SHALL group them by type and allow filtering
6. WHEN a swap owner selects a winning proposal THEN the system SHALL initiate the standard swap completion process
7. WHEN a proposal is selected THEN the system SHALL notify the winning proposer and reject all other proposals
8. IF the swap owner wants to reject all proposals THEN the system SHALL allow this and convert the swap back to active status

### Requirement 5: Last-Minute Booking Restrictions

**User Story:** As a platform administrator, I want to prevent auction complications for last-minute bookings so that all swaps can be completed with adequate time for processing.

#### Acceptance Criteria

1. WHEN a booking's event date is less than one week away THEN the system SHALL classify it as a "last-minute booking"
2. WHEN creating a swap for a last-minute booking THEN the system SHALL only allow "first match acceptance" mode
3. WHEN displaying swap creation options THEN the system SHALL explain why auction mode is unavailable for last-minute bookings
4. WHEN a booking becomes last-minute while an auction is active THEN the system SHALL immediately end the auction and notify the owner
5. IF an active auction is force-ended due to timing THEN the system SHALL give the owner 24 hours to select from existing proposals
6. WHEN processing last-minute swaps THEN the system SHALL prioritize them for faster completion
7. WHEN a last-minute swap is created THEN the system SHALL display urgency indicators to attract quick responses

### Requirement 6: Enhanced Proposal Management

**User Story:** As a platform user making proposals, I want to understand the swap terms and competition so that I can make competitive offers.

#### Acceptance Criteria

1. WHEN viewing a swap in auction mode THEN the system SHALL display the auction end date and current proposal count
2. WHEN making a proposal on an auction swap THEN the system SHALL indicate that the owner will review all proposals before deciding
3. WHEN making a proposal on a first-match swap THEN the system SHALL indicate that acceptance may be immediate
4. WHEN a cash payment is accepted THEN the system SHALL display the minimum acceptable amount clearly
5. IF a user's proposal doesn't meet minimum requirements THEN the system SHALL prevent submission and explain the requirements
6. WHEN an auction has active proposals THEN the system SHALL show anonymized competition level (e.g., "3 other proposals received")
7. WHEN a proposal is submitted to an auction THEN the system SHALL confirm receipt and provide the auction timeline

### Requirement 7: Notification and Communication Enhancement

**User Story:** As a platform user, I want timely notifications about auction progress and outcomes so that I can stay informed about my swaps and proposals.

#### Acceptance Criteria

1. WHEN an auction is created THEN the system SHALL notify interested users based on their preferences and search history
2. WHEN an auction is ending soon THEN the system SHALL send reminder notifications to the swap owner and active proposers
3. WHEN an auction ends THEN the system SHALL immediately notify the swap owner to review proposals
4. WHEN a winning proposal is selected THEN the system SHALL notify the winner and send rejection notifications to others
5. WHEN auction mode is unavailable due to timing THEN the system SHALL explain this in the swap creation interface
6. WHEN a swap owner doesn't respond within the selection timeframe THEN the system SHALL send escalating reminders
7. WHEN automatic proposal selection occurs THEN the system SHALL notify both parties and explain the automatic selection reason