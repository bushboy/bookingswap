# Swap Location Fix - Troubleshooting Guide

## Summary
The code has been updated to include booking location and date information for proposals. However, you're still seeing "Unknown City, Unknown Country" which suggests one of these issues:

## ✅ Steps to Fix

### Step 1: Restart the Backend Server
**The SQL query changes won't take effect until you restart the backend.**

```bash
# Stop the backend server (Ctrl+C if running in terminal)
# Then restart it:
cd apps/backend
npm run dev
# OR
npm start
```

### Step 2: Clear Browser Cache
After restarting the backend, clear your browser cache or do a hard refresh:
- **Chrome/Edge**: Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac)
- **Firefox**: Ctrl + F5 (Windows) or Cmd + Shift + R (Mac)

### Step 3: Check Database Data
Run the debug script to verify your bookings have location data:

```bash
# From project root:
cd apps/backend
node debug-swap-location.js
```

This will show you:
- ✅ If bookings have city/country data
- ✅ If swap proposals are linking to booking data correctly
- ✅ What the actual SQL query returns

### Step 4: If Data is Missing
If the debug script shows NULL values for city/country, you need to add location data to your bookings:

```sql
-- Update existing bookings with location data
UPDATE bookings 
SET 
  city = 'Paris',  -- Replace with actual city
  country = 'France'  -- Replace with actual country
WHERE city IS NULL OR country IS NULL;
```

## 🔍 What Was Fixed

### Backend Changes

1. **SQL Query** (`apps/backend/src/database/repositories/SwapRepository.ts`):
   - Added `proposerBookingCity`, `proposerBookingCountry` to incoming proposals JSON
   - Added `proposerBookingCheckIn`, `proposerBookingCheckOut` to incoming proposals JSON
   - Added same fields for outgoing targets
   - Added all fields to GROUP BY clause

2. **Data Transformation** (`apps/backend/src/services/swap/SwapProposalService.ts`):
   - Updated transformation to use actual booking location instead of "Unknown City"
   - Updated to use actual booking dates instead of proposal creation date

3. **Debug Logging**:
   - Added logging to see what data is actually in the proposal objects

## 📋 Verification

After restarting the backend, check the backend logs for:

```
[transformToEnhancedSwapCardData] Sample proposal object:
```

This will show you if the `proposerBookingCity` and `proposerBookingCountry` fields are present and have values.

## 🐛 Still Not Working?

If you're still seeing "Unknown" after all these steps:

1. **Check the backend logs** - Look for the debug log message showing proposal data
2. **Run the debug script** - This will pinpoint if it's a data issue or code issue
3. **Verify the database** - Check if `bookings` table has data in `city` and `country` columns
4. **Check for errors** - Look for any SQL errors in the backend logs

## 📝 Files Changed

- `apps/backend/src/database/repositories/SwapRepository.ts` - SQL query updated
- `apps/backend/src/services/swap/SwapProposalService.ts` - Transformation logic updated  
- `apps/backend/src/utils/swapDataValidator.ts` - Type definitions updated
- `apps/backend/src/utils/fallbackDataProvider.ts` - Fallback data updated

All changes have been accepted and are ready - you just need to restart the backend!

