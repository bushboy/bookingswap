# Swap Targeting API Reference

## Overview

This document provides comprehensive API documentation for the Swap Targeting system. It covers all endpoints, request/response formats, error codes, and integration examples.

## Base URL

```
Production: https://api.swapplatform.com/v1
Staging: https://staging-api.swapplatform.com/v1
Development: http://localhost:3001/api
```

## Authentication

All API requests require authentication using JWT tokens.

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
Accept: application/json
```

### Getting a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "expiresIn": 3600
}
```

## Targeting Endpoints

### Target a Swap

Creates a targeting relationship between your swap and another swap.

```http
POST /swaps/{sourceSwapId}/target
```

**Parameters:**
- `sourceSwapId` (path, required): ID of your swap that will target another swap

**Request Body:**
```json
{
  "targetSwapId": "swap-456",
  "message": "I'd love to swap with you! My place has a great view.",
  "conditions": [
    "Pet-friendly",
    "Flexible check-in time"
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "targetingId": "targeting-789",
    "sourceSwapId": "swap-123",
    "targetSwapId": "swap-456",
    "proposalId": "proposal-101",
    "status": "active",
    "createdAt": "2025-01-15T10:30:00Z",
    "message": "I'd love to swap with you! My place has a great view.",
    "conditions": [
      "Pet-friendly",
      "Flexible check-in time"
    ]
  }
}
```

**Error Responses:**
```json
// 400 Bad Request - Invalid targeting
{
  "error": "INVALID_TARGETING",
  "message": "Cannot target own swap",
  "code": "SELF_TARGETING_NOT_ALLOWED"
}

// 409 Conflict - Targeting conflict
{
  "error": "TARGETING_CONFLICT",
  "message": "Swap already has pending proposal",
  "code": "PROPOSAL_PENDING",
  "details": {
    "existingProposalId": "proposal-100",
    "swapMode": "one-for-one"
  }
}

// 422 Unprocessable Entity - Validation failed
{
  "error": "VALIDATION_FAILED",
  "message": "Circular targeting detected",
  "code": "CIRCULAR_TARGETING",
  "details": {
    "targetingChain": ["swap-123", "swap-456", "swap-789", "swap-123"]
  }
}
```

### Retarget a Swap

Changes the target of an existing targeting relationship.

```http
PUT /swaps/{sourceSwapId}/retarget
```

**Request Body:**
```json
{
  "newTargetSwapId": "swap-789",
  "message": "Actually, I prefer this swap better!",
  "reason": "Better location match"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "targetingId": "targeting-789",
    "previousTargetId": "swap-456",
    "newTargetId": "swap-789",
    "proposalId": "proposal-102",
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

### Remove Target

Removes the targeting relationship and cancels the proposal.

```http
DELETE /swaps/{sourceSwapId}/target
```

**Request Body (optional):**
```json
{
  "reason": "Found a better match elsewhere"
}
```

**Response (204 No Content)**

### Get Targeting Status

Retrieves current targeting information for a swap.

```http
GET /swaps/{swapId}/targeting-status
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "swapId": "swap-123",
    "isTargeting": true,
    "targetSwap": {
      "id": "swap-456",
      "title": "Beach House in Miami",
      "location": "Miami Beach, FL",
      "dates": "2025-07-01 to 2025-07-07",
      "owner": {
        "id": "user-456",
        "name": "Jane Smith",
        "rating": 4.8
      }
    },
    "proposalStatus": "pending",
    "targetedAt": "2025-01-15T10:30:00Z",
    "targetedBy": [
      {
        "swapId": "swap-789",
        "userId": "user-789",
        "userName": "Bob Johnson",
        "targetedAt": "2025-01-15T09:15:00Z",
        "proposalId": "proposal-103"
      }
    ]
  }
}
```

## Validation Endpoints

### Check Targeting Eligibility

Validates if a swap can be targeted before attempting to target it.

```http
GET /swaps/{targetSwapId}/can-target
```

**Query Parameters:**
- `sourceSwapId` (optional): Your swap ID for validation

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "canTarget": true,
    "eligibilityChecks": {
      "swapExists": true,
      "swapAvailable": true,
      "notOwnSwap": true,
      "noCircularTargeting": true,
      "auctionActive": true,
      "noConflictingProposal": true
    },
    "swapInfo": {
      "mode": "auction",
      "auctionEndDate": "2025-01-16T10:30:00Z",
      "currentProposalCount": 2,
      "maxProposals": null
    },
    "warnings": [
      "Auction ends in 23 hours",
      "2 other proposals already submitted"
    ]
  }
}
```

**Ineligible Response:**
```json
{
  "success": true,
  "data": {
    "canTarget": false,
    "eligibilityChecks": {
      "swapExists": true,
      "swapAvailable": true,
      "notOwnSwap": true,
      "noCircularTargeting": false,
      "auctionActive": true,
      "noConflictingProposal": true
    },
    "restrictions": [
      {
        "type": "circular_targeting",
        "message": "Would create circular targeting relationship",
        "severity": "error",
        "details": {
          "chain": ["swap-123", "swap-456", "swap-789", "swap-123"]
        }
      }
    ]
  }
}
```

### Validate Targeting Request

Performs comprehensive validation of a targeting request.

```http
POST /targeting/validate
```

**Request Body:**
```json
{
  "sourceSwapId": "swap-123",
  "targetSwapId": "swap-456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "validationResults": {
      "dateCompatibility": {
        "valid": true,
        "overlap": "2025-07-01 to 2025-07-07",
        "overlapDays": 7
      },
      "locationCompatibility": {
        "valid": true,
        "distance": 1200,
        "travelTime": "2h 30m"
      },
      "guestCompatibility": {
        "valid": true,
        "sourceCapacity": 4,
        "targetCapacity": 6,
        "suitable": true
      },
      "userCompatibility": {
        "valid": true,
        "mutualRatings": true,
        "noBlocking": true
      }
    },
    "compatibilityScore": 0.85,
    "recommendations": [
      "High compatibility match",
      "Similar guest capacity",
      "Excellent location match"
    ]
  }
}
```

## Query Endpoints

### Get Targeting History

Retrieves the targeting history for a swap.

```http
GET /swaps/{swapId}/targeting-history
```

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50): Items per page
- `sortBy` (optional, default: timestamp): Sort field
- `sortOrder` (optional, default: desc): Sort order (asc/desc)
- `action` (optional): Filter by action type

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "history-1",
        "action": "targeted",
        "targetSwap": {
          "id": "swap-456",
          "title": "Beach House in Miami",
          "owner": "Jane Smith"
        },
        "timestamp": "2025-01-15T10:30:00Z",
        "proposalId": "proposal-101",
        "outcome": "pending",
        "metadata": {
          "message": "I'd love to swap with you!",
          "conditions": ["Pet-friendly"]
        }
      },
      {
        "id": "history-2",
        "action": "retargeted",
        "previousTarget": {
          "id": "swap-789",
          "title": "Mountain Cabin",
          "owner": "Bob Johnson"
        },
        "newTarget": {
          "id": "swap-456",
          "title": "Beach House in Miami",
          "owner": "Jane Smith"
        },
        "timestamp": "2025-01-15T09:15:00Z",
        "reason": "Better location match"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### Get User Targeting Activity

Retrieves targeting activity for a specific user.

```http
GET /users/{userId}/targeting-activity
```

**Query Parameters:**
- `page`, `limit`, `sortBy`, `sortOrder`: Same as history endpoint
- `type` (optional): Filter by activity type (sent/received)
- `status` (optional): Filter by proposal status

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "activity": [
      {
        "id": "activity-1",
        "type": "sent",
        "sourceSwap": {
          "id": "swap-123",
          "title": "City Apartment"
        },
        "targetSwap": {
          "id": "swap-456",
          "title": "Beach House in Miami",
          "owner": "Jane Smith"
        },
        "status": "pending",
        "createdAt": "2025-01-15T10:30:00Z",
        "lastUpdated": "2025-01-15T10:30:00Z"
      },
      {
        "id": "activity-2",
        "type": "received",
        "sourceSwap": {
          "id": "swap-789",
          "title": "Mountain Cabin",
          "owner": "Bob Johnson"
        },
        "targetSwap": {
          "id": "swap-123",
          "title": "City Apartment"
        },
        "status": "accepted",
        "createdAt": "2025-01-14T15:20:00Z",
        "respondedAt": "2025-01-14T16:45:00Z"
      }
    ],
    "summary": {
      "totalSent": 15,
      "totalReceived": 8,
      "pendingSent": 3,
      "pendingReceived": 1,
      "successRate": 0.73
    }
  }
}
```

### Get Swaps Targeting Current Swap

Retrieves all swaps currently targeting a specific swap.

```http
GET /swaps/{swapId}/targeted-by
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "targetedBy": [
      {
        "targetingId": "targeting-1",
        "sourceSwap": {
          "id": "swap-789",
          "title": "Mountain Cabin",
          "location": "Aspen, CO",
          "dates": "2025-07-01 to 2025-07-07",
          "owner": {
            "id": "user-789",
            "name": "Bob Johnson",
            "rating": 4.6,
            "responseRate": 0.92
          }
        },
        "proposalId": "proposal-103",
        "targetedAt": "2025-01-15T09:15:00Z",
        "message": "Perfect mountain getaway for your beach house!",
        "conditions": ["Pet-friendly", "Flexible dates"]
      }
    ],
    "count": 1,
    "swapMode": "one-for-one",
    "canAcceptMore": false
  }
}
```

## Auction Mode Endpoints

### Get Auction Information

Retrieves detailed auction information for auction mode swaps.

```http
GET /swaps/{swapId}/auction-info
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "swapId": "swap-456",
    "isAuction": true,
    "auctionStartDate": "2025-01-15T00:00:00Z",
    "auctionEndDate": "2025-01-16T00:00:00Z",
    "timeRemaining": 82800, // seconds
    "status": "active",
    "proposalCount": 5,
    "maxProposals": null,
    "canReceiveProposals": true,
    "proposals": [
      {
        "id": "proposal-101",
        "sourceSwap": {
          "id": "swap-123",
          "title": "City Apartment",
          "owner": "John Doe"
        },
        "submittedAt": "2025-01-15T10:30:00Z",
        "rank": 1, // Only visible to swap owner
        "score": 0.92 // Only visible to swap owner
      }
    ]
  }
}
```

### Get Auction Statistics

Retrieves statistics for auction mode targeting.

```http
GET /auctions/statistics
```

**Query Parameters:**
- `period` (optional, default: 30d): Time period (7d, 30d, 90d, 1y)
- `userId` (optional): Filter by specific user

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "totalAuctions": 156,
    "activeAuctions": 23,
    "completedAuctions": 133,
    "averageProposalsPerAuction": 3.2,
    "averageAuctionDuration": 48, // hours
    "successRate": 0.78,
    "topPerformingCategories": [
      {
        "category": "Beach Houses",
        "auctionCount": 45,
        "avgProposals": 5.1,
        "successRate": 0.89
      }
    ]
  }
}
```

## WebSocket Events

### Connection

```javascript
const ws = new WebSocket('wss://api.swapplatform.com/ws');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-jwt-token'
}));
```

### Targeting Events

#### New Targeting

```json
{
  "type": "targeting_created",
  "data": {
    "targetingId": "targeting-789",
    "sourceSwapId": "swap-123",
    "targetSwapId": "swap-456",
    "sourceUser": {
      "id": "user-123",
      "name": "John Doe"
    },
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

#### Targeting Removed

```json
{
  "type": "targeting_removed",
  "data": {
    "targetingId": "targeting-789",
    "sourceSwapId": "swap-123",
    "targetSwapId": "swap-456",
    "reason": "User retargeted to different swap",
    "timestamp": "2025-01-15T11:00:00Z"
  }
}
```

#### Proposal Status Update

```json
{
  "type": "proposal_status_updated",
  "data": {
    "proposalId": "proposal-101",
    "targetingId": "targeting-789",
    "oldStatus": "pending",
    "newStatus": "accepted",
    "timestamp": "2025-01-15T12:00:00Z"
  }
}
```

#### Auction Events

```json
{
  "type": "auction_ending_soon",
  "data": {
    "swapId": "swap-456",
    "timeRemaining": 3600, // 1 hour
    "proposalCount": 7,
    "timestamp": "2025-01-15T23:00:00Z"
  }
}

{
  "type": "auction_ended",
  "data": {
    "swapId": "swap-456",
    "winningProposal": {
      "id": "proposal-105",
      "sourceSwapId": "swap-999"
    },
    "totalProposals": 8,
    "timestamp": "2025-01-16T00:00:00Z"
  }
}
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "ERROR_TYPE",
  "message": "Human-readable error message",
  "code": "SPECIFIC_ERROR_CODE",
  "details": {
    // Additional error-specific information
  },
  "timestamp": "2025-01-15T10:30:00Z",
  "requestId": "req-123456789"
}
```

### Common Error Codes

#### Authentication Errors (401)

| Code | Message | Solution |
|------|---------|----------|
| `TOKEN_EXPIRED` | JWT token has expired | Refresh token or re-login |
| `TOKEN_INVALID` | Invalid JWT token format | Provide valid token |
| `TOKEN_MISSING` | Authorization header missing | Include Authorization header |

#### Authorization Errors (403)

| Code | Message | Solution |
|------|---------|----------|
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions | Check account status |
| `ACCOUNT_SUSPENDED` | Account is suspended | Contact support |
| `FEATURE_NOT_AVAILABLE` | Feature not available for account type | Upgrade account |

#### Validation Errors (400/422)

| Code | Message | Solution |
|------|---------|----------|
| `INVALID_SWAP_ID` | Swap ID format is invalid | Use valid UUID format |
| `SWAP_NOT_FOUND` | Swap does not exist | Verify swap ID |
| `SELF_TARGETING_NOT_ALLOWED` | Cannot target own swap | Target different swap |
| `CIRCULAR_TARGETING` | Would create circular targeting | Choose different target |
| `PROPOSAL_PENDING` | Swap has pending proposal | Wait or choose auction mode |
| `AUCTION_ENDED` | Auction has ended | Find active auction |

#### Conflict Errors (409)

| Code | Message | Solution |
|------|---------|----------|
| `ALREADY_TARGETING` | Already targeting a swap | Retarget or remove current target |
| `CONCURRENT_MODIFICATION` | Resource modified by another request | Retry with fresh data |
| `SWAP_STATE_CHANGED` | Swap state changed during request | Refresh and retry |

#### Rate Limiting (429)

| Code | Message | Solution |
|------|---------|----------|
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait before retrying |
| `TARGETING_LIMIT_REACHED` | Daily targeting limit reached | Wait until next day |

## Rate Limits

### Standard Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /swaps/*/target` | 10 requests | 1 hour |
| `PUT /swaps/*/retarget` | 5 requests | 1 hour |
| `GET /swaps/*/targeting-status` | 100 requests | 1 hour |
| `GET /swaps/*/can-target` | 200 requests | 1 hour |

### Premium Limits

Premium users have higher limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /swaps/*/target` | 25 requests | 1 hour |
| `PUT /swaps/*/retarget` | 15 requests | 1 hour |

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642248000
X-RateLimit-Window: 3600
```

## SDK Examples

### JavaScript/Node.js

```javascript
const SwapTargetingAPI = require('@swapplatform/targeting-sdk');

const client = new SwapTargetingAPI({
  apiKey: 'your-api-key',
  baseURL: 'https://api.swapplatform.com/v1'
});

// Target a swap
try {
  const result = await client.targeting.target({
    sourceSwapId: 'swap-123',
    targetSwapId: 'swap-456',
    message: 'Great location match!'
  });
  console.log('Targeting successful:', result.data);
} catch (error) {
  console.error('Targeting failed:', error.message);
}

// Check eligibility
const eligibility = await client.targeting.canTarget('swap-456', {
  sourceSwapId: 'swap-123'
});

if (eligibility.data.canTarget) {
  console.log('Can target this swap');
} else {
  console.log('Cannot target:', eligibility.data.restrictions);
}
```

### Python

```python
from swapplatform import SwapTargetingClient

client = SwapTargetingClient(
    api_key='your-api-key',
    base_url='https://api.swapplatform.com/v1'
)

# Target a swap
try:
    result = client.targeting.target(
        source_swap_id='swap-123',
        target_swap_id='swap-456',
        message='Great location match!'
    )
    print(f"Targeting successful: {result.data}")
except SwapTargetingError as e:
    print(f"Targeting failed: {e.message}")

# Get targeting history
history = client.targeting.get_history('swap-123', page=1, limit=10)
for entry in history.data.history:
    print(f"{entry.action} at {entry.timestamp}")
```

### cURL Examples

```bash
# Target a swap
curl -X POST "https://api.swapplatform.com/v1/swaps/swap-123/target" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "targetSwapId": "swap-456",
    "message": "Perfect match for our dates!"
  }'

# Check targeting eligibility
curl -X GET "https://api.swapplatform.com/v1/swaps/swap-456/can-target?sourceSwapId=swap-123" \
  -H "Authorization: Bearer your-jwt-token"

# Get targeting history
curl -X GET "https://api.swapplatform.com/v1/swaps/swap-123/targeting-history?page=1&limit=10" \
  -H "Authorization: Bearer your-jwt-token"
```

## Webhooks

### Configuration

Configure webhooks to receive targeting events:

```http
POST /webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/targeting",
  "events": [
    "targeting.created",
    "targeting.removed",
    "proposal.status_changed",
    "auction.ended"
  ],
  "secret": "your-webhook-secret"
}
```

### Event Payloads

#### targeting.created

```json
{
  "event": "targeting.created",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "targetingId": "targeting-789",
    "sourceSwapId": "swap-123",
    "targetSwapId": "swap-456",
    "proposalId": "proposal-101",
    "sourceUser": {
      "id": "user-123",
      "name": "John Doe"
    },
    "targetUser": {
      "id": "user-456",
      "name": "Jane Smith"
    }
  }
}
```

### Webhook Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}
```

---

*For more information, visit our [Developer Portal](https://developers.swapplatform.com) or contact [API Support](mailto:api-support@swapplatform.com)*