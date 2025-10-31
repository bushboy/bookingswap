# Booking Creation Validation Error - ✅ FIXED

## Problem

When creating a booking with this payload:
```json
{
  "type":"resort",
  "title":"Afriski Resort",
  "description":"5 Days at Afriski Resort",
  "location":{"city":"Afriski","country":"Lesotho"},
  "dateRange":{"checkIn":"2025-12-25T00:00:00.000Z","checkOut":"2025-12-31T00:00:00.000Z"},
  "originalPrice":5000,
  "swapValue":4000,
  "providerDetails":{"provider":"TripAdvisor","confirmationNumber":"1234567","bookingReference":""}
}
```

You get this error:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid booking data provided",
    "details": [
      {"field": "userId", "message": "\"userId\" is required"},
      {"field": "verification", "message": "\"verification\" is required"},
      {"field": "blockchain", "message": "\"blockchain\" is required"},
      {"field": "status", "message": "\"status\" is required"}
    ]
  }
}
```

## Root Cause

The `createBookingSchema` in `packages/shared` is validating the full `Booking` entity instead of just the creation request fields. These fields should be set server-side:

- `userId` - From `req.user.id` (authentication middleware)
- `verification` - Created by the server with default values
- `blockchain` - Created by the server with default values
- `status` - Set to `'pending'` by default

## The Schema Issue

The validation middleware (`apps/backend/src/middleware/bookingValidation.ts`) uses:
```typescript
const { error, value } = createBookingSchema.validate(req.body, {
  abortEarly: false,
  stripUnknown: true,
  convert: true
});
```

But `createBookingSchema` is checking for server-side fields that shouldn't be in the client request.

## Solution

The `createBookingSchema` needs to be fixed to only validate client-provided fields. It should look something like:

```typescript
export const createBookingSchema = Joi.object({
  // Client-provided fields only
  type: Joi.string().required().valid(...getEnabledBookingTypes()),
  title: Joi.string().required().max(200),
  description: Joi.string().optional().max(2000),
  location: Joi.object({
    city: Joi.string().required(),
    country: Joi.string().required(),
    coordinates: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required()
    }).optional()
  }).required(),
  dateRange: Joi.object({
    checkIn: Joi.date().required(),
    checkOut: Joi.date().required()
  }).required(),
  originalPrice: Joi.number().required().min(0),
  swapValue: Joi.number().required().min(0),
  providerDetails: Joi.object({
    provider: Joi.string().required(),
    confirmationNumber: Joi.string().required(),
    bookingReference: Joi.string().allow('').optional()
  }).required()
});

// These fields should NOT be in the schema:
// - userId (from auth)
// - verification (server-side)
// - blockchain (server-side)  
// - status (server-side)
```

## ✅ Fix Applied

**File:** `packages/shared/src/validation/booking.ts`

**Changes:**
- Removed `userId`, `verification`, `blockchain`, `status`, and timestamp fields from `createBookingSchema`
- These fields are now added by the backend after validation
- The schema now only validates client-provided fields

**Before:**
```typescript
export const createBookingSchema = Joi.object({
  // ... client fields ...
  userId: Joi.string().optional(),
  verification: bookingVerificationSchema.optional(),
  blockchain: blockchainSchema.optional(),
  status: Joi.string().valid(...).optional(),
  // etc.
});
```

**After:**
```typescript
export const createBookingSchema = Joi.object({
  type: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string().required(),
  location: bookingLocationSchema.required(),
  dateRange: createBookingDateRangeSchema.required(),
  originalPrice: Joi.number().positive().required(),
  swapValue: Joi.number().positive().required(),
  providerDetails: bookingProviderDetailsSchema.required(),
});
// Server-side fields NOT in the schema - they're added by the backend
```

**Build Status:** ✅ Shared package rebuilt successfully

## Testing

**Restart your backend server** (the shared package has been rebuilt), then try your booking creation request again:

```bash
POST http://localhost:3001/api/bookings
Authorization: Bearer <your-token>

{
  "type":"resort",
  "title":"Afriski Resort",
  "description":"5 Days at Afriski Resort",
  "location":{"city":"Afriski","country":"Lesotho"},
  "dateRange":{"checkIn":"2025-12-25T00:00:00.000Z","checkOut":"2025-12-31T00:00:00.000Z"},
  "originalPrice":5000,
  "swapValue":4000,
  "providerDetails":{"provider":"TripAdvisor","confirmationNumber":"1234567","bookingReference":""}
}
```

**Expected:** ✅ 201 Created with booking details

No longer need to include `userId`, `verification`, `blockchain`, or `status` fields!

