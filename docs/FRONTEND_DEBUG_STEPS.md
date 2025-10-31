# Frontend Location Display - Debug Steps

## What We've Fixed

### Backend ✅
- SQL query returns `proposerBookingCity`, `proposerBookingCountry`, `proposerBookingCheckIn`, `proposerBookingCheckOut`
- Transformation maps these to `sourceSwap.bookingDetails.location` and `sourceSwap.bookingDetails.dateRange`
- Test script confirms data is correct

### Frontend
- Added debug logging to see what data reaches the component
- Component tries to display: `target.sourceSwap.bookingDetails?.location?.city`

## Debug Steps

### 1. Open Browser DevTools
- Press F12 or right-click → Inspect
- Go to the **Console** tab

### 2. Navigate to /swaps Page
- You should see console logs like:
```
[SwapCard.enhanced] First incoming target: {
  targetId: "...",
  sourceSwap: {...},
  bookingDetails: {...},
  location: { city: "...", country: "..." }
  city: "Paris",
  country: "France"
}
```

### 3. Check What You See

#### If city and country show actual values (not "Unknown"):
✅ **Data is reaching the frontend correctly**
- Problem: Frontend cache
- Solution: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Or clear browser cache and reload

#### If city and country are `undefined`:
❌ **Data is not in the response**
- Check the Network tab in DevTools
- Find the `/api/swaps` request
- Look at the Response tab
- Check if `incomingTargets[0].sourceSwap.bookingDetails.location` exists

### 4. Check API Response Directly

In the Console tab, run this:
```javascript
fetch('/api/swaps', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('auth_token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('API Response:', data);
  console.log('First swap:', data.data.swapCards[0]);
  console.log('First target:', data.data.swapCards[0]?.targeting?.incomingTargets?.[0]);
  console.log('Location:', data.data.swapCards[0]?.targeting?.incomingTargets?.[0]?.sourceSwap?.bookingDetails?.location);
});
```

This will show you EXACTLY what the API is returning.

## Expected vs Actual Structure

### Expected Structure (what frontend needs):
```javascript
{
  targeting: {
    incomingTargets: [{
      targetId: "...",
      sourceSwap: {
        bookingDetails: {
          title: "...",
          location: {
            city: "Paris",        // ← This is what we need
            country: "France"     // ← This is what we need
          },
          dateRange: {
            checkIn: "2024-...",  // ← This is what we need
            checkOut: "2024-..."  // ← This is what we need
          }
        }
      }
    }]
  }
}
```

## Common Issues

### Issue: Old cached data
**Solution:** Hard refresh (Ctrl+Shift+R)

### Issue: Backend not restarted
**Solution:** Restart backend server
```bash
# Stop backend (Ctrl+C)
cd apps/backend
npm run dev
```

### Issue: Data structure mismatch
**Solution:** Check the console logs and API response to see what structure is actually being sent

## Next Steps

1. Open browser DevTools Console
2. Navigate to /swaps
3. Look for the `[SwapCard.enhanced]` log message
4. Copy the output and share it if you still see "Unknown"

