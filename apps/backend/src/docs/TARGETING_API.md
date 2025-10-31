# Swap Targeting API Documentation

## Overview

The Swap Targeting API provides endpoints for managing swap-to-swap targeting relationships. This allows users to redirect their existing swaps to target other swaps directly, rather than creating multiple swap instances.

## Base URL

All targeting endpoints are prefixed with `/api/`

## Authentication

All targeting endpoints require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting

Targeting operations are rate-limited to prevent abuse:

- **Targeting Operations**: 10 requests per minute
- **Retargeting Operations**: 5 requests per minute  
- **Remove Target Operations**: 10 requests per minute
- **Status/Query Operations**: 50-100 requests per minute

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "category": "error_category",
    "details": {}
  },
  "metadata": {
    "requestId": "unique-request-id",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "executionTime": 123
  }
}
```

### Error Categories

- `authentication`: Authentication required or invalid
- `authorization`: Access denied
- `validation`: Invalid request data
- `business`: Business logic violations
- `system`: Internal system errors
- `rate_limit`: Rate limit exceeded

## Endpoints

### 1. Target a Swap

Target a swap with the user's existing swap.

**Endpoint:** `POST /api/swaps/:id/target`

**Parameters:**
- `id` (path): Target swap ID (UUID)

**Request Body:**
```json
{
  "sourceSwapId": "uuid",
  "message": "Optional message for the target owner",
  "conditions": ["Optional array of conditions"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "targeting": {
      "id": "targeting-uuid",
      "sourceSwapId": "source-uuid",
      "targetSwapId": "target-uuid", 
      "proposalId": "proposal-uuid",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 123,
    "warnings": []
  }
}
```

**Error Responses:**
- `400`: Validation error, cannot target own swap, circular targeting
- `401`: Authentication required
- `404`: Swap not found
- `409`: Auction ended, proposal pending, swap unavailable
- `429`: Rate limit exceeded

---

### 2. Retarget a Swap

Change the target of an existing swap targeting relationship.

**Endpoint:** `PUT /api/swaps/:id/retarget`

**Parameters:**
- `id` (path): New target swap ID (UUID)

**Request Body:**
```json
{
  "sourceSwapId": "uuid"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "targeting": {
      "id": "targeting-uuid",
      "sourceSwapId": "source-uuid",
      "targetSwapId": "new-target-uuid",
      "proposalId": "new-proposal-uuid", 
      "status": "active",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 123,
    "warnings": []
  }
}
```

---

### 3. Remove Target

Remove targeting from a swap, returning it to general availability.

**Endpoint:** `DELETE /api/swaps/:id/target`

**Request Body:**
```json
{
  "sourceSwapId": "uuid"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Targeting removed successfully"
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 123
  }
}
```

---

### 4. Get Targeting Status

Get the current targeting status for a swap.

**Endpoint:** `GET /api/swaps/:id/targeting-status`

**Parameters:**
- `id` (path): Swap ID (UUID)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "targeting": {
      "id": "targeting-uuid",
      "sourceSwapId": "source-uuid",
      "targetSwapId": "target-uuid",
      "proposalId": "proposal-uuid",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "hasActiveTargeting": true
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 45
  }
}
```

---

### 5. Check Targeting Eligibility

Check if a swap can be targeted by the current user.

**Endpoint:** `GET /api/swaps/:id/can-target`

**Parameters:**
- `id` (path): Target swap ID (UUID)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "canTarget": true,
    "targetSwapId": "target-uuid",
    "userId": "user-uuid"
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 67
  }
}
```

---

### 6. Get Targeting History

Get the targeting history for a specific swap.

**Endpoint:** `GET /api/swaps/:id/targeting-history`

**Parameters:**
- `id` (path): Swap ID (UUID)
- `limit` (query): Number of results (1-100, default: 50)
- `offset` (query): Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "history-uuid",
        "sourceSwapId": "source-uuid",
        "targetSwapId": "target-uuid",
        "action": "targeted",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "metadata": {}
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 1,
      "hasMore": false
    }
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 89
  }
}
```

**Targeting Actions:**
- `targeted`: Initial targeting
- `retargeted`: Changed target
- `removed`: Targeting removed
- `accepted`: Target accepted
- `rejected`: Target rejected
- `cancelled`: Targeting cancelled

---

### 7. Get User Targeting Activity

Get targeting activity for a specific user.

**Endpoint:** `GET /api/users/:id/targeting-activity`

**Parameters:**
- `id` (path): User ID (UUID) - must be current user unless admin
- `limit` (query): Number of results (1-100, default: 50)
- `offset` (query): Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "targetingActivity": [
      {
        "id": "target-uuid",
        "sourceSwapId": "source-uuid",
        "targetSwapId": "target-uuid",
        "proposalId": "proposal-uuid",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 1,
      "hasMore": false
    }
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 112
  }
}
```

---

### 8. Get Swaps Targeting Current Swap

Get all swaps that are currently targeting a specific swap.

**Endpoint:** `GET /api/swaps/:id/targeted-by`

**Parameters:**
- `id` (path): Swap ID (UUID)
- `limit` (query): Number of results (1-100, default: 50)
- `offset` (query): Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "targetingSwaps": [
      {
        "id": "target-uuid",
        "sourceSwapId": "source-uuid",
        "targetSwapId": "current-swap-uuid",
        "proposalId": "proposal-uuid",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 1,
      "hasMore": false
    }
  },
  "metadata": {
    "requestId": "unique-request-id",
    "executionTime": 98
  }
}
```

## Business Rules

### Targeting Restrictions

1. **Own Swap**: Users cannot target their own swaps
2. **Circular Targeting**: Prevents A→B→A targeting loops
3. **Auction Mode**: Multiple targeting allowed until auction ends
4. **One-for-One Mode**: Only one active proposal allowed at a time
5. **Swap Availability**: Target swap must be active and available

### Auction Mode vs One-for-One

- **Auction Mode**: Accepts multiple simultaneous proposals until auction end date
- **One-for-One Mode**: Accepts only one proposal at a time; new proposals blocked until current proposal is resolved

### Proposal Lifecycle

1. **Targeting**: Creates active proposal relationship
2. **Retargeting**: Cancels previous proposal, creates new one
3. **Acceptance**: Finalizes swap, prevents further targeting
4. **Rejection**: Allows new targeting attempts
5. **Removal**: Returns swap to general availability

## Integration Examples

### Frontend Integration

```javascript
// Target a swap
const targetSwap = async (sourceSwapId, targetSwapId, message) => {
  const response = await fetch(`/api/swaps/${targetSwapId}/target`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sourceSwapId,
      message
    })
  });
  
  return response.json();
};

// Check if can target
const canTarget = async (targetSwapId) => {
  const response = await fetch(`/api/swaps/${targetSwapId}/can-target`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

### Error Handling Example

```javascript
try {
  const result = await targetSwap(sourceId, targetId, message);
  
  if (result.success) {
    console.log('Targeting successful:', result.data.targeting);
  } else {
    console.error('Targeting failed:', result.error.message);
    
    // Handle specific error types
    switch (result.error.code) {
      case 'CANNOT_TARGET_OWN_SWAP':
        showError('You cannot target your own swap');
        break;
      case 'AUCTION_ENDED':
        showError('This auction has ended');
        break;
      case 'PROPOSAL_PENDING':
        showError('This swap already has a pending proposal');
        break;
      default:
        showError(result.error.message);
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## Performance Considerations

- All endpoints include execution time in metadata
- Rate limiting prevents abuse and ensures fair usage
- Pagination is available for list endpoints
- Database queries are optimized with proper indexing
- Caching strategies can be implemented for frequently accessed data

## Security Features

- JWT authentication required for all endpoints
- User authorization checks (users can only access their own data)
- Input validation and sanitization
- Rate limiting to prevent abuse
- Audit trail for all targeting operations
- Protection against circular targeting and other business rule violations