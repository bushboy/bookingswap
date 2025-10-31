# Design Document

## Overview

This design outlines the integration of the MakeProposalModal component with backend API services to replace mock data with real-time swap matching and proposal creation. The solution focuses on creating robust API service layers, implementing proper error handling, and maintaining excellent user experience during data loading and submission states.

## Architecture

### API Service Layer

The design introduces a dedicated API service layer that handles all swap-related API communications:

```typescript
// services/swapApiService.ts
class SwapApiService {
  async getEligibleSwaps(userId: string, targetSwapId: string): Promise<EligibleSwap[]>
  async createProposal(targetSwapId: string, proposalData: CreateProposalRequest): Promise<ProposalResponse>
  async getSwapCompatibility(sourceSwapId: string, targetSwapId: string): Promise<CompatibilityAnalysis>
}
```

### State Management Architecture

The modal will use a custom hook `useProposalModal` that encapsulates all API interactions and state management:

```typescript
// hooks/useProposalModal.ts
interface ProposalModalState {
  eligibleSwaps: EligibleSwap[]
  loading: boolean
  error: string | null
  submitting: boolean
  submitError: string | null
}

const useProposalModal = (targetSwap: SwapWithProposalInfo | null) => {
  // Returns state and actions for the modal
}
```

## Components and Interfaces

### Enhanced MakeProposalModal Component

The modal component will be refactored to use the new API service:

- **Loading States**: Skeleton loaders for eligible swaps list
- **Error Handling**: Inline error messages with retry actions
- **Real-time Updates**: Live compatibility scores and eligibility reasons
- **Accessibility**: Screen reader announcements for state changes

### API Response Interfaces

```typescript
interface EligibleSwapResponse {
  swaps: EligibleSwap[]
  totalCount: number
  compatibilityThreshold: number
}

interface EligibleSwap {
  id: string
  title: string
  bookingDetails: BookingDetails
  compatibilityScore: number
  eligibilityReasons: string[]
  isEligible: boolean
  restrictions?: string[]
}

interface CreateProposalRequest {
  sourceSwapId: string
  message?: string
  conditions: string[]
  agreedToTerms: boolean
}

interface ProposalResponse {
  proposalId: string
  status: 'pending' | 'submitted'
  estimatedResponseTime: string
}
```

## Data Models

### API Endpoint Specifications

#### GET /api/users/{userId}/swaps/eligible
- **Query Parameters**: `targetSwapId`, `limit`, `offset`
- **Response**: `EligibleSwapResponse`
- **Error Codes**: 401 (Unauthorized), 404 (User not found), 500 (Server error)

#### POST /api/swaps/{targetSwapId}/proposals
- **Request Body**: `CreateProposalRequest`
- **Response**: `ProposalResponse`
- **Error Codes**: 400 (Validation error), 401 (Unauthorized), 403 (Forbidden), 409 (Duplicate proposal)

#### GET /api/swaps/{sourceSwapId}/compatibility/{targetSwapId}
- **Response**: `CompatibilityAnalysis`
- **Error Codes**: 404 (Swap not found), 500 (Analysis failed)

### Error Response Format

```typescript
interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
  timestamp: string
  requestId: string
}
```

## Error Handling

### Error Categories and Responses

1. **Network Errors**: "Unable to connect. Please check your internet connection."
2. **Authentication Errors**: Redirect to login with return URL
3. **Authorization Errors**: "You don't have permission to access this swap."
4. **Validation Errors**: Field-specific error messages
5. **Server Errors**: "Something went wrong. Please try again."

### Retry Logic

- **Exponential Backoff**: For transient network errors
- **Manual Retry**: User-initiated retry buttons for failed operations
- **Circuit Breaker**: Prevent excessive API calls during outages

## Testing Strategy

### Unit Tests

- **API Service Tests**: Mock HTTP responses and test error handling
- **Hook Tests**: Test state transitions and error scenarios
- **Component Tests**: Test loading states and user interactions

### Integration Tests

- **API Integration**: Test actual API endpoints with test data
- **End-to-End**: Complete proposal creation flow
- **Error Scenarios**: Network failures, authentication issues

### Performance Tests

- **Load Testing**: Modal opening with large numbers of eligible swaps
- **Response Time**: API call performance under various conditions
- **Memory Usage**: Component cleanup and memory leak prevention

## Implementation Phases

### Phase 1: API Service Layer
- Create SwapApiService with proper error handling
- Implement authentication token management
- Add request/response logging for debugging

### Phase 2: State Management
- Create useProposalModal hook
- Implement loading and error states
- Add retry mechanisms

### Phase 3: Component Integration
- Update MakeProposalModal to use real API data
- Add loading skeletons and error UI
- Implement accessibility announcements

### Phase 4: Error Handling & Polish
- Comprehensive error handling for all scenarios
- User-friendly error messages
- Performance optimizations

## Security Considerations

- **Token Management**: Secure storage and automatic refresh of auth tokens
- **Input Validation**: Client-side validation before API calls
- **CSRF Protection**: Include CSRF tokens in state-changing requests
- **Rate Limiting**: Respect API rate limits and implement client-side throttling

## Performance Optimizations

- **Caching**: Cache eligible swaps for short periods to reduce API calls
- **Debouncing**: Debounce compatibility score requests
- **Lazy Loading**: Load additional swap details on demand
- **Request Cancellation**: Cancel in-flight requests when modal closes