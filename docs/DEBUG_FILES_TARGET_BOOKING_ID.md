# Debug/Test Files Using `target_booking_id`

## Overview
These files are **NOT** part of production code. They are debug/test scripts that still reference the old schema with `target_booking_id`.

## Files in Root Directory
These can be safely deleted or updated as needed:

1. **debug-swap-creation.js**
   - Uses: `s.target_booking_id`
   - Purpose: Debug script for testing swap creation

2. **debug-targeting-data-fixed.js**
   - Uses: `target_booking_id` in multiple queries
   - Purpose: Debug script for targeting data

3. **debug-targeting-data-mismatch.js**
   - Uses: `target_booking_id` in queries
   - Purpose: Debug script for data consistency

4. **debug-targeting-data.js**
   - Uses: `target_booking_id` extensively
   - Purpose: Debug script for targeting

5. **debug-targeting-flow.js**
   - Uses: `target_booking_id`
   - Purpose: Debug script for targeting flow

6. **test-updated-targeting-queries.js**
   - Uses: `target_booking_id` in test queries
   - Purpose: Test script for queries

## Files in apps/backend/src/debug/

1. **create-test-targeting-data.ts**
   - Uses: `target_booking_id` in INSERT statement
   - Purpose: Creates test data for targeting

2. **diagnose-targeting-data-flow.ts**
   - Uses: `target_booking_id` in queries and logging
   - Purpose: Diagnoses targeting data flow

3. **validate-targeting-simple.js**
   - Uses: `target_booking_id` in queries
   - Purpose: Simple validation script

4. **test-api-endpoint.js**
   - Uses: `target_booking_id` in queries
   - Purpose: Tests API endpoints

## Recommendation

### Option 1: Delete (Recommended)
These are old debug scripts. If you don't need them for historical reference, delete them:

```bash
# Root directory
rm debug-swap-creation.js
rm debug-targeting-data*.js
rm debug-targeting-flow.js
rm test-updated-targeting-queries.js

# Debug directory  
rm apps/backend/src/debug/create-test-targeting-data.ts
rm apps/backend/src/debug/diagnose-targeting-data-flow.ts
rm apps/backend/src/debug/validate-targeting-simple.js
```

### Option 2: Update
If you want to keep them for testing, update them to use `swap_targets` table:

**Old pattern:**
```sql
SELECT s.*, s.target_booking_id
FROM swaps s
WHERE s.target_booking_id IS NOT NULL
```

**New pattern:**
```sql
SELECT s.*, ts.source_booking_id as target_booking_id
FROM swaps s
JOIN swap_targets st ON s.id = st.source_swap_id
JOIN swaps ts ON st.target_swap_id = ts.id
WHERE st.status = 'active'
```

### Option 3: Keep as Historical Reference
Move them to an archive folder:

```bash
mkdir -p old-debug-scripts
mv debug-*.js old-debug-scripts/
mv test-updated-targeting-queries.js old-debug-scripts/
mv apps/backend/src/debug/*targeting* old-debug-scripts/
```

## Impact
**None** - These files are not used by the production application and don't affect functionality.

