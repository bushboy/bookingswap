# Design Document

## Overview

The Accept/Reject button functionality issue stems from multiple potential causes in the current implementation. Based on code analysis, the buttons are controlled by several conditions including proposal status, user permissions, loading states, and component rendering logic. This design addresses the root causes and ensures reliable button functionality.

## Architecture

### Current Implementation Analysis

The Accept/Reject buttons are implemented through several components:
- `ProposalActionButtons`: Core button component with status-based rendering
- `ReceivedProposalsSection`: Container for proposal lists with action buttons
- `EnhancedSwapCard`: Main swap card that renders proposals
- Redux store: Manages loading states and active operations

### Key Issues Identified

1. **Conditional Rendering**: Buttons only show when `status === 'pending'` and `!disabled`
2. **Loading State Management**: Multiple loading states can conflict
3. **Permission Validation**: User role validation may be inconsistent
4. **State Synchronization**: WebSocket updates may not properly sync button states

## Components and Interfaces

### Enhanced ProposalActionButtons Component

```typescript
interface ProposalActionButtonsProps {
    proposalId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    disabled?: boolean;
    isProcessing?: boolean;
    onAccept: (proposalId: string) => Promise<void> | void;
    onReject: (proposalId: string, reason?: string) => Promise<void> | void;
    // Enhanced props
    currentUserId?: string;
    proposalOwnerId?: string;
    debugMode?: boolean;
    forceShow?: boolean; // For debugging
}
```

### Button State Manager

```typescript
interface ButtonStateManager {
    canShowButtons(proposal: SwapProposal, currentUserId: string): boolean;
    canInteractWithButtons(proposal: SwapProposal, isProcessing: boolean): boolean;
    getButtonDisabledReason(proposal: SwapProposal): string | null;
    validateUserPermissions(proposal: SwapProposal, currentUserId: string): boolean;
}
```

### Enhanced Error Handling

```typescript
interface ActionResult {
    success: boolean;
    error?: string;
    shouldRetry?: boolean;
    newStatus?: ProposalStatus;
}

interface ErrorHandler {
    handleActionError(error: Error, action: 'accept' | 'reject'): ActionResult;
    shouldShowRetryButton(error: Error): boolean;
    getErrorMessage(error: Error): string;
}
```

## Data Models

### Proposal State Model

```typescript
interface ProposalState {
    id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    ownerId: string;
    proposerId: string;
    expiresAt?: Date;
    isProcessing: boolean;
    lastActionAttempt?: Date;
    actionHistory: ActionHistoryEntry[];
}

interface ActionHistoryEntry {
    action: 'accept' | 'reject' | 'view';
    timestamp: Date;
    userId: string;
    success: boolean;
    error?: string;
}
```

### Button Visibility Rules

```typescript
interface ButtonVisibilityRules {
    // Core conditions
    mustBePending: boolean;
    mustNotBeExpired: boolean;
    mustBeOwner: boolean;
    mustNotBeProcessing: boolean;
    
    // Debug overrides
    debugForceShow?: boolean;
    debugIgnoreStatus?: boolean;
}
```

## Error Handling

### Comprehensive Error Categories

1. **Network Errors**: Connection issues, timeouts
2. **Permission Errors**: User not authorized, invalid state
3. **Validation Errors**: Proposal expired, already processed
4. **System Errors**: Server errors, unexpected failures

### Error Recovery Strategies

```typescript
interface ErrorRecoveryStrategy {
    retryable: boolean;
    maxRetries: number;
    retryDelay: number;
    fallbackAction?: () => void;
    userMessage: string;
}

const ERROR_STRATEGIES: Record<string, ErrorRecoveryStrategy> = {
    NETWORK_ERROR: {
        retryable: true,
        maxRetries: 3,
        retryDelay: 1000,
        userMessage: "Connection issue. Click to retry."
    },
    PERMISSION_ERROR: {
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        fallbackAction: () => refreshProposalData(),
        userMessage: "You don't have permission for this action."
    },
    EXPIRED_PROPOSAL: {
        retryable: false,
        maxRetries: 0,
        retryDelay: 0,
        fallbackAction: () => hideButtons(),
        userMessage: "This proposal has expired."
    }
};
```

## Testing Strategy

### Unit Tests

1. **Button Visibility Logic**
   - Test all combinations of proposal status and user roles
   - Verify disabled states are properly applied
   - Test permission validation logic

2. **Action Processing**
   - Test successful accept/reject flows
   - Test error handling and retry logic
   - Test loading state management

3. **State Management**
   - Test Redux store updates
   - Test WebSocket synchronization
   - Test optimistic updates and rollbacks

### Integration Tests

1. **End-to-End Button Interactions**
   - Test complete accept flow from button click to completion
   - Test complete reject flow with reason input
   - Test error scenarios and recovery

2. **Multi-User Scenarios**
   - Test concurrent actions on same proposal
   - Test real-time updates between users
   - Test permission changes during active sessions

### Debug Tools

```typescript
interface DebugTools {
    logButtonState(proposalId: string): void;
    forceShowButtons(proposalId: string): void;
    simulateError(errorType: string): void;
    inspectPermissions(userId: string, proposalId: string): PermissionReport;
}

interface PermissionReport {
    canView: boolean;
    canAccept: boolean;
    canReject: boolean;
    reasons: string[];
    debugInfo: any;
}
```

## Implementation Approach

### Phase 1: Diagnostic Enhancement
- Add comprehensive logging to button rendering logic
- Implement debug mode for troubleshooting
- Add permission validation reporting

### Phase 2: State Management Improvements
- Enhance Redux store for better loading state management
- Improve WebSocket synchronization
- Add optimistic updates with proper rollback

### Phase 3: Error Handling Enhancement
- Implement comprehensive error categorization
- Add retry mechanisms for recoverable errors
- Improve user feedback for all error scenarios

### Phase 4: Testing and Validation
- Add comprehensive test coverage
- Implement debug tools for production troubleshooting
- Add monitoring and analytics for button interactions

## Security Considerations

1. **Permission Validation**: Always validate user permissions server-side
2. **Action Verification**: Verify proposal state before processing actions
3. **Rate Limiting**: Prevent rapid-fire button clicking abuse
4. **Audit Logging**: Log all proposal actions for security monitoring

## Performance Considerations

1. **Debounced Actions**: Prevent duplicate submissions
2. **Optimistic Updates**: Immediate UI feedback with rollback capability
3. **Efficient Re-renders**: Minimize unnecessary component updates
4. **Memory Management**: Proper cleanup of event listeners and timers