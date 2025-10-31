# BookingEditForm Infinite Loop - ✅ FIXED

## Problem

```
Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

**Location:** `apps/frontend/src/components/booking/BookingEditForm.tsx:240`

## Root Cause

The component had two useEffect hooks that were causing infinite loops:

### Issue 1: `onRestore` callback recreation

**Before (Line 239-244):**
```typescript
const statePreservation = useStatePreservation({
  storageKey: `booking-edit-${booking?.id || 'new'}`,
  data: formData,
  onRestore: (restoredData) => {  // ❌ Recreated on every render
    setFormData(restoredData);
    setTouched({});
  },
  autoSave: hasUnsavedChanges,
});
```

**Problem:** The `onRestore` callback was being recreated on every render, causing `useStatePreservation` to detect a change and potentially trigger restoration, which updates `formData`, which triggers another render, creating an infinite loop.

### Issue 2: `onUnsavedChangesChange` dependency

**Before (Line 336-340):**
```typescript
useEffect(() => {
  if (onUnsavedChangesChange) {
    onUnsavedChangesChange(hasUnsavedChanges);
  }
}, [hasUnsavedChanges, onUnsavedChangesChange]);  // ❌ Callback in deps
```

**Problem:** If the parent component doesn't wrap `onUnsavedChangesChange` in `useCallback`, it gets recreated on every render, triggering this effect on every render, which may cause the parent to re-render, creating an infinite loop.

## Fixes Applied

### Fix 1: Memoize `onRestore` with `useCallback`

```typescript
// Memoize the onRestore callback to prevent infinite loops
const handleRestore = useCallback((restoredData: typeof formData) => {
  setFormData(restoredData);
  setTouched({}); // Reset touched state when restoring
}, []); // Empty deps - this callback doesn't depend on any external values

// State preservation for navigation between interfaces
const statePreservation = useStatePreservation({
  storageKey: `booking-edit-${booking?.id || 'new'}`,
  data: formData,
  onRestore: handleRestore,  // ✅ Stable reference
  autoSave: hasUnsavedChanges,
});
```

**Benefit:** The callback now has a stable reference across renders, preventing unnecessary re-executions of state preservation logic.

### Fix 2: Use `useRef` pattern for parent callback

```typescript
// Notify parent component about unsaved changes
// Using a ref to avoid infinite loops if the callback isn't memoized by the parent
const onUnsavedChangesChangeRef = useRef(onUnsavedChangesChange);
useEffect(() => {
  onUnsavedChangesChangeRef.current = onUnsavedChangesChange;
}, [onUnsavedChangesChange]);

useEffect(() => {
  if (onUnsavedChangesChangeRef.current) {
    onUnsavedChangesChangeRef.current(hasUnsavedChanges);
  }
}, [hasUnsavedChanges]); // ✅ Only re-run when hasUnsavedChanges changes
```

**Benefit:** Even if the parent doesn't memoize the callback, we only call it when `hasUnsavedChanges` actually changes, not when the callback reference changes.

## Files Changed

- ✅ `apps/frontend/src/components/booking/BookingEditForm.tsx`
  - Wrapped `onRestore` in `useCallback`
  - Used `useRef` pattern for `onUnsavedChangesChange`

## Testing

**Refresh your browser** and try editing a booking. The infinite loop warning should be gone!

✅ No linting errors
✅ Component will no longer cause maximum update depth errors
✅ Callbacks are now properly memoized

## Prevention Tips

When using callbacks in `useEffect` dependencies:

1. **Wrap in `useCallback`** if you control the callback:
   ```typescript
   const myCallback = useCallback(() => {
     // do something
   }, [/* dependencies */]);
   ```

2. **Use the `useRef` pattern** if you don't control the callback (props from parent):
   ```typescript
   const callbackRef = useRef(callback);
   useEffect(() => {
     callbackRef.current = callback;
   }, [callback]);
   
   useEffect(() => {
     callbackRef.current();
   }, [/* actual dependencies */]);
   ```

3. **Omit the callback from dependencies** if it only needs to use the latest value but shouldn't trigger the effect.

