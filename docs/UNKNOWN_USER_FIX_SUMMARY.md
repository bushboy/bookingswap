# Unknown User Fix - Targeting Data

## Problem
When viewing swap cards with targeting information, the system was displaying "Unknown User" for:
- **Incoming targets**: Other users targeting the current user's swap
- **Outgoing targets**: When the user is targeting someone else's swap

## Root Cause
The `display_name` column in the `users` table is **nullable**. When users don't have a display name set, the SQL query returned `NULL`, which was then displayed as "Unknown User" on the frontend.

## Solution
Updated the SQL query in `SwapRepository.ts` to use `COALESCE` to fallback to other available user fields when `display_name` is NULL.

### Fallback Order:
1. `display_name` (if set)
2. `username` (if set)
3. `email` (always available)
4. `'Unknown User'` (last resort)

## Files Modified

### `apps/backend/src/database/repositories/SwapRepository.ts`

#### Change 1: Owner Name (Lines 2947-2948)
```sql
-- BEFORE
u_owner.display_name as owner_name,

-- AFTER
COALESCE(u_owner.display_name, u_owner.username, u_owner.email, 'Unknown User') as owner_name,
```

#### Change 2: Proposer Name (Lines 2969-2970)
```sql
-- BEFORE
u_proposer.display_name as proposer_name,

-- AFTER
COALESCE(u_proposer.display_name, u_proposer.username, u_proposer.email, 'Unknown User') as proposer_name,
```

#### Change 3: Target Owner Name (Lines 3009-3010)
```sql
-- BEFORE
u_target.display_name as target_owner_name,

-- AFTER
COALESCE(u_target.display_name, u_target.username, u_target.email, 'Unknown User') as target_owner_name,
```

## Impact

### What Now Works:
✅ **Incoming Targets** - Shows actual user name (display_name, username, or email)  
✅ **Outgoing Targets** - Shows actual user name of the target owner  
✅ **Proposals** - Shows actual proposer names  
✅ **Swap Cards** - All user names displayed correctly  

### Data Flow:
1. **Database Query** → Uses COALESCE to get best available name
2. **Repository** → Returns data with proper names
3. **Service Layer** → Transforms data (lines 3640, 3669 in SwapProposalService.ts)
4. **Frontend** → Displays the actual user names instead of "Unknown User"

## Testing Instructions

### 1. Database Check
```sql
-- Check users without display_name
SELECT 
    id, 
    display_name, 
    username, 
    email,
    COALESCE(display_name, username, email, 'Unknown User') as resolved_name
FROM users 
WHERE display_name IS NULL 
LIMIT 10;
```

### 2. Frontend Test
1. Navigate to `/swaps` page
2. Look for swaps with targeting information:
   - **Incoming Targets** section (others targeting your swap)
   - **Outgoing Target** section (you targeting someone else's swap)
3. Verify user names are displayed (not "Unknown User")
4. Check that names show as:
   - Display name (if set)
   - Username (if no display name)
   - Email (if no username or display name)

### 3. API Test
```bash
# Get user swaps with targeting
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/swaps

# Check the response for ownerName in targeting data:
# - targeting.incomingTargets[].sourceSwap.ownerName
# - targeting.outgoingTarget.targetSwap.ownerName
```

## Example API Response

### Before Fix:
```json
{
  "targeting": {
    "incomingTargets": [{
      "sourceSwap": {
        "ownerName": null,  // ❌ Displayed as "Unknown User"
        "bookingDetails": { ... }
      }
    }]
  }
}
```

### After Fix:
```json
{
  "targeting": {
    "incomingTargets": [{
      "sourceSwap": {
        "ownerName": "john.doe@example.com",  // ✅ Shows email when no display_name
        "bookingDetails": { ... }
      }
    }]
  }
}
```

## Additional Notes

### Why Users Might Not Have display_name:
1. **New users** who haven't completed their profile
2. **Email/password auth users** who skipped profile setup
3. **Legacy users** from before display_name was added

### Future Improvements:
- Consider making `display_name` required during user registration
- Add a profile completion step that prompts for display_name
- Auto-generate display_name from email (e.g., "john.doe" from "john.doe@example.com")

## Status
✅ **FIXED** - No build errors, ready for testing

The fix ensures that user names are always displayed using the best available information from the database.

