# Swap Targeting Display - Troubleshooting Guide

## Quick Diagnosis

Use this flowchart to quickly identify and resolve common targeting display issues:

### Issue Categories

1. **[Display Issues](#display-issues)** - Targeting information not showing correctly
2. **[Action Issues](#action-issues)** - Targeting actions not working
3. **[Performance Issues](#performance-issues)** - Slow loading or responsiveness
4. **[Notification Issues](#notification-issues)** - Not receiving updates
5. **[Data Issues](#data-issues)** - Incorrect or missing information

## Display Issues

### Targeting Indicators Not Showing

**Problem**: Swap cards don't show targeting indicators or show "No targeting information available"

#### Possible Causes & Solutions

**1. Data Loading Failure**
- **Symptoms**: Blank targeting sections, loading spinners that don't complete
- **Solution**: 
  ```
  1. Refresh the page (Ctrl+F5 or Cmd+Shift+R)
  2. Wait 30 seconds and try again
  3. Check browser console for errors (F12 → Console tab)
  ```

**2. Network Connectivity Issues**
- **Symptoms**: Partial page loading, timeout errors
- **Solution**:
  ```
  1. Check your internet connection
  2. Try accessing other parts of the site
  3. Switch to mobile data or different WiFi network
  4. Disable VPN if using one
  ```

**3. Browser Compatibility**
- **Symptoms**: Features work in one browser but not another
- **Solution**:
  ```
  1. Update your browser to the latest version
  2. Try in Chrome, Firefox, Safari, or Edge
  3. Disable browser extensions temporarily
  4. Clear browser cache and cookies
  ```

**4. Account Permissions**
- **Symptoms**: Some users see targeting info, others don't
- **Solution**:
  ```
  1. Ensure you're logged into the correct account
  2. Check if your account has targeting permissions
  3. Verify your swap is set to accept proposals
  4. Contact support if permissions seem incorrect
  ```

### Incorrect Targeting Information

**Problem**: Targeting indicators show wrong numbers or outdated information

#### Diagnostic Steps

1. **Check Data Freshness**:
   ```
   - Note the timestamp on targeting information
   - Compare with recent activity you know about
   - Look for "Last updated" indicators
   ```

2. **Force Data Refresh**:
   ```
   - Click refresh button on swap card (if available)
   - Navigate away and back to /swaps page
   - Log out and log back in
   ```

3. **Verify Source Data**:
   ```
   - Check if the targeting activity exists in your history
   - Ask the other user to confirm their targeting status
   - Look for conflicting information in notifications
   ```

### Visual Display Problems

**Problem**: Targeting elements appear broken, overlapping, or incorrectly styled

#### Common Visual Issues

**1. Layout Problems**
- **Mobile**: Elements too small or overlapping
- **Desktop**: Indicators in wrong positions
- **Solution**: 
  ```
  1. Check your zoom level (should be 100%)
  2. Try different screen resolutions
  3. Clear browser cache
  4. Disable custom CSS extensions
  ```

**2. Missing Icons or Images**
- **Symptoms**: Broken image icons, missing status badges
- **Solution**:
  ```
  1. Check if images load on other pages
  2. Disable ad blockers temporarily
  3. Check browser security settings
  4. Try incognito/private browsing mode
  ```

## Action Issues

### Targeting Actions Not Working

**Problem**: Buttons don't respond, actions fail, or error messages appear

#### Button Not Responding

**1. JavaScript Errors**
- **Check**: Open browser console (F12) and look for red error messages
- **Solution**:
  ```
  1. Refresh the page
  2. Disable browser extensions
  3. Try in incognito mode
  4. Update your browser
  ```

**2. Network Request Failures**
- **Check**: Network tab in browser dev tools shows failed requests
- **Solution**:
  ```
  1. Check internet connection stability
  2. Try again in a few minutes
  3. Contact support if problem persists
  ```

#### Action Fails with Error Message

**Common Error Messages and Solutions**:

**"Swap is no longer available for targeting"**
- **Cause**: Another user targeted the swap first, or swap was removed
- **Solution**: Choose a different swap to target

**"You don't have permission to perform this action"**
- **Cause**: Account restrictions or swap ownership issues
- **Solution**: 
  ```
  1. Verify you're logged into the correct account
  2. Check if your account is in good standing
  3. Ensure you own the swap you're trying to manage
  ```

**"Network error - please try again"**
- **Cause**: Temporary connectivity or server issues
- **Solution**:
  ```
  1. Wait 30 seconds and retry
  2. Check your internet connection
  3. Try refreshing the page
  ```

**"Circular targeting detected"**
- **Cause**: Your targeting would create a circular chain (A→B→C→A)
- **Solution**: Choose a different swap that doesn't create circular targeting

### Slow Action Response

**Problem**: Actions take a long time to complete or seem to hang

#### Optimization Steps

1. **Check System Performance**:
   ```
   - Close unnecessary browser tabs
   - Check available RAM and CPU usage
   - Restart browser if it's been open for a long time
   ```

2. **Network Optimization**:
   ```
   - Use wired connection instead of WiFi if possible
   - Close other applications using internet
   - Try during off-peak hours
   ```

3. **Clear Browser Data**:
   ```
   1. Go to browser settings
   2. Clear browsing data (cache, cookies, stored data)
   3. Restart browser
   4. Log back in and try again
   ```

## Performance Issues

### Slow Page Loading

**Problem**: Swaps page takes a long time to load targeting information

#### Performance Optimization

**1. Browser Optimization**
```
1. Update to latest browser version
2. Close unnecessary tabs (keep only 5-10 open)
3. Disable unused browser extensions
4. Clear cache and cookies
5. Restart browser periodically
```

**2. Network Optimization**
```
1. Use wired internet connection when possible
2. Close streaming services and downloads
3. Check internet speed (should be >5 Mbps for good performance)
4. Try different DNS servers (8.8.8.8, 1.1.1.1)
```

**3. Device Optimization**
```
1. Close other applications
2. Ensure sufficient free storage space (>1GB)
3. Restart device if it's been on for days
4. Check for system updates
```

### Memory Issues

**Problem**: Browser becomes slow or crashes when viewing targeting information

#### Memory Management

**1. Browser Memory**
```
1. Check Task Manager for browser memory usage
2. Close tabs you're not using
3. Restart browser every few hours
4. Use browser's built-in task manager (Shift+Esc in Chrome)
```

**2. System Memory**
```
1. Close unnecessary applications
2. Check available RAM (should have >2GB free)
3. Restart computer if memory usage is consistently high
4. Consider upgrading RAM if you frequently run out
```

## Notification Issues

### Not Receiving Targeting Notifications

**Problem**: Missing notifications for new proposals, acceptances, or rejections

#### Notification Troubleshooting

**1. Check Notification Settings**
```
1. Go to Settings → Notifications
2. Ensure targeting notifications are enabled
3. Check email notification preferences
4. Verify your email address is correct
```

**2. Browser Notification Permissions**
```
1. Check if browser notifications are allowed for the site
2. Look for notification permission prompt
3. Check browser notification settings
4. Try enabling notifications in incognito mode first
```

**3. Email Notification Issues**
```
1. Check spam/junk folder
2. Add our domain to your email whitelist
3. Verify email address in your profile
4. Check if emails from us are being blocked
```

### Delayed Notifications

**Problem**: Notifications arrive late or out of order

#### Timing Issues

**1. Real-time Connection Problems**
```
1. Check if WebSocket connections are blocked
2. Disable VPN temporarily
3. Try different network connection
4. Check firewall settings
```

**2. Server Load Issues**
```
1. Check if delays happen at specific times
2. Try during off-peak hours
3. Contact support if delays are consistent
```

## Data Issues

### Inconsistent Targeting Data

**Problem**: Different pages show different targeting information

#### Data Synchronization

**1. Cache Issues**
```
1. Clear browser cache completely
2. Hard refresh all pages (Ctrl+Shift+R)
3. Log out and log back in
4. Try in incognito mode
```

**2. Database Synchronization**
```
1. Wait 5-10 minutes for data to sync
2. Check if other users see the same information
3. Contact support if data remains inconsistent
```

### Missing Historical Data

**Problem**: Targeting history is incomplete or missing

#### History Recovery

**1. Data Loading Issues**
```
1. Try loading history in smaller date ranges
2. Check if specific time periods are missing
3. Use different filters to narrow down the issue
```

**2. Account Data Issues**
```
1. Verify you're looking at the correct account
2. Check if data exists for the time period in question
3. Contact support for data recovery assistance
```

## Advanced Troubleshooting

### Browser Developer Tools

Use these tools to diagnose complex issues:

**1. Console Tab (F12)**
```
- Look for red error messages
- Note any warnings about failed requests
- Check for JavaScript errors
```

**2. Network Tab**
```
- Monitor API requests to /api/targeting/*
- Check response times and status codes
- Look for failed requests (red entries)
```

**3. Application Tab**
```
- Check Local Storage for cached data
- Clear site data if needed
- Inspect cookies for authentication issues
```

### Mobile-Specific Issues

**Mobile App Troubleshooting**:

**1. App Performance**
```
1. Force close and restart the app
2. Update to latest app version
3. Restart your device
4. Clear app cache (Android) or reinstall (iOS)
```

**2. Mobile Network Issues**
```
1. Switch between WiFi and cellular data
2. Check mobile data permissions for the app
3. Try in airplane mode, then reconnect
```

### When to Contact Support

Contact our support team if:

- Issues persist after trying all troubleshooting steps
- You see error messages not covered in this guide
- Data appears to be permanently lost or corrupted
- Multiple users report the same issue
- You suspect a security or privacy issue

### Support Information

**Email**: support@swapplatform.com
**Live Chat**: Available on the website 9 AM - 6 PM EST
**Phone**: 1-800-SWAP-HELP

**When contacting support, please provide**:
- Your username and email
- Swap ID(s) if applicable
- Browser and device information
- Screenshots of any error messages
- Steps you've already tried
- Detailed description of the issue

---

*This troubleshooting guide is updated regularly. Check back for new solutions and tips.*