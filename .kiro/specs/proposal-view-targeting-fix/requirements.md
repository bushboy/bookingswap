# Requirements Document

## Introduction

This feature addresses the persistent issue where the proposal view fails to correctly display targeting relationships between swaps. Despite multiple implementation attempts and comprehensive backend infrastructure, users are still unable to see when their swaps are being targeted by others or when their swaps are targeting other users' swaps. The core problem appears to be a disconnect between the data retrieval logic and the frontend display components, resulting in targeting information not being properly shown in the user interface.

## Requirements

### Requirement 1: Fix Proposal View Data Retrieval

**User Story:** As a user viewing my swaps, I want to see accurate targeting information so that I can understand which swaps are targeting mine and which swaps my swaps are targeting.

#### Acceptance Criteria

1. WHEN a user views their swaps THEN the system SHALL retrieve all targeting relationships from the swap_targets table
2. WHEN targeting data exists THEN the system SHALL display both incoming targets (others targeting user's swaps) and outgoing targets (user's swaps targeting others)
3. WHEN no targeting relationships exist THEN the system SHALL display an appropriate empty state
4. WHEN targeting data retrieval fails THEN the system SHALL display an error message and provide a retry option