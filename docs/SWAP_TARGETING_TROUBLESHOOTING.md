# Swap Targeting Troubleshooting Guide

## Quick Diagnosis

Use this flowchart to quickly identify and resolve common targeting issues:

```
🎯 Targeting Issue?
├── Can't see "Target My Swap" button?
│   ├── Check if you have an active swap → [No Active Swap](#no-active-swap)
│   ├── Check if viewing your own swap → [Own Swap](#targeting-own-swap)
│   └── Check swap availability → [Swap Unavailable](#swap-unavailable)
├── Button disabled/grayed out?
│   ├── One-for-one with pending proposal → [Proposal Pending](#proposal-pending)
│   ├── Auction ended → [Auction Ended](#auction-ended)
│   └── Circular targeting detected → [Circular Targeting](#circular-targeting)
├── Targeting fails with error?
│   ├── Network error → [Network Issues](#network-issues)
│   ├── Validation error → [Validation Errors](#validation-errors)
│   └── Server error → [Server Issues](#server-issues)
└── Target disappeared after targeting?
    ├── Swap was cancelled → [Target Cancelled](#target-cancelled)
    ├── Swap was matched → [Target Matched](#target-matched)
    └── Technical issue → [Contact Support](#contact-support)
```

## Common Issues and Solutions

### No Active Swap

**Symptoms:**
- "Target My Swap" button not visible anywhere
- Message: "Create a swap to start targeting"

**Causes:**
- You haven't created a swap yet
- Your swap was cancelled or deleted
- Your swap is in draft status

**Solutions:**

1. **Create a New Swap:**
   ```
   Dashboard → Create New Swap → Fill Details → Publish
   ```

2. **Check Swap Status:**
   - Go to Dashboard
   - Look for "My Swaps" section
   - Verify swap status is "Active"

3. **Restore Cancelled Swap:**
   - Check "Cancelled Swaps" in your dashboard
   - Click "Restore" if available
   - Or create a new swap with same details

**Prevention:**
- Keep at least one active swap
- Set up notifications for swap status changes
- Regularly check your dashboard

### Targeting Own Swap

**Symptoms:**
- "Target My Swap" button not visible on your swap
- Message: "This is your swap"

**Explanation:**
You cannot target your own swaps. This prevents self-proposals and maintains system integrity.

**Solutions:**

1. **Target Other Users' Swaps:**
   - Browse swaps from other users
   - Use filters to find suitable matches
   - Look for swaps with different user names

2. **Verify Swap Ownership:**
   - Check the swap owner name
   - Ensure you're not logged into wrong account
   - Contact support if ownership is incorrect

### Swap Unavailable

**Symptoms:**
- "Target My Swap" button disabled
- Various unavailability messages

**Common Unavailability Reasons:**

#### Proposal Pending

**Message:** "Proposal Pending - Cannot Target"

**Explanation:** One-for-one swap already has an active proposal

**Solutions:**
- Wait for current proposal to be resolved
- Set up notifications for when swap becomes available
- Look for auction mode swaps instead
- Find alternative swaps with similar criteria

**Timeline:** Most proposals are resolved within 24-48 hours

#### Auction Ended

**Message:** "Auction Ended - No New Proposals"

**Explanation:** Auction time period has expired

**Solutions:**
- Look for active auctions with time remaining
- Use "Active Auctions" filter in browse
- Set up alerts for new auction mode swaps
- Contact swap owner to see if they'll create new auction

**Prevention:** Target auctions early in their timeline

#### Swap Matched

**Message:** "Swap Already Matched"

**Explanation:** Swap owner has accepted a proposal

**Solutions:**
- Congratulate the matched users
- Look for similar available swaps
- Adjust your search criteria
- Create alerts for similar future swaps

#### Swap Cancelled

**Message:** "Swap No Longer Available"

**Explanation:** Swap owner cancelled their listing

**Solutions:**
- Remove from your watchlist
- Look for alternative swaps
- Contact owner to see if they'll relist
- Broaden your search criteria

### Circular Targeting

**Symptoms:**
- "Target My Swap" button disabled
- Message: "Cannot target - would create circular targeting"

**Explanation:**
Circular targeting occurs when targeting would create a loop:
- Direct: A targets B, B tries to target A
- Indirect: A targets B, B targets C, C tries to target A

**Solutions:**

1. **Break the Chain:**
   - Remove your current target
   - Wait for others to change their targets
   - Target a different swap outside the chain

2. **Find Alternative Targets:**
   - Look for swaps not in your targeting network
   - Use "Available for Targeting" filter
   - Consider swaps from new users

**Example Scenario:**
```
❌ Circular: Alice → Bob → Charlie → Alice
✅ Valid: Alice → Bob → Charlie → David
```

### Network Issues

**Symptoms:**
- "Network error during targeting"
- Targeting request times out
- Page doesn't respond after clicking target

**Immediate Solutions:**

1. **Check Connection:**
   - Verify internet connectivity
   - Try refreshing the page
   - Check if other websites work

2. **Retry Targeting:**
   - Wait 30 seconds
   - Try targeting again
   - System prevents duplicate targeting

3. **Clear Browser Cache:**
   ```
   Chrome: Ctrl+Shift+Delete
   Firefox: Ctrl+Shift+Delete
   Safari: Cmd+Option+E
   ```

4. **Try Different Browser:**
   - Use incognito/private mode
   - Try different browser entirely
   - Disable browser extensions

**Advanced Solutions:**

1. **Check Network Settings:**
   - Disable VPN temporarily
   - Try different network (mobile data)
   - Check firewall settings

2. **Browser Troubleshooting:**
   - Update browser to latest version
   - Disable ad blockers
   - Reset browser settings

### Validation Errors

**Common Validation Messages:**

#### "Swap dates don't overlap"

**Cause:** Your swap dates don't match target swap dates

**Solution:**
- Check date compatibility before targeting
- Look for swaps with overlapping dates
- Consider flexible date swaps

#### "Guest count mismatch"

**Cause:** Significant difference in guest capacity

**Solution:**
- Target swaps with similar guest counts
- Check if swap allows flexible guest numbers
- Contact owner about guest flexibility

#### "Location restrictions"

**Cause:** Geographic or travel restrictions

**Solution:**
- Check location compatibility
- Verify travel restrictions
- Look for swaps in allowed regions

#### "User restrictions"

**Cause:** User-specific blocking or restrictions

**Solution:**
- Check if you're blocked by the user
- Verify your account status
- Contact support if restriction seems incorrect

### Server Issues

**Symptoms:**
- "Server error - please try again"
- 500 error messages
- Targeting system completely unavailable

**Immediate Actions:**

1. **Check System Status:**
   - Visit status.swapplatform.com
   - Check social media for updates
   - Look for maintenance announcements

2. **Wait and Retry:**
   - Server issues are usually temporary
   - Try again in 5-10 minutes
   - Don't repeatedly click buttons

3. **Use Alternative Methods:**
   - Try mobile app if using web
   - Try web if using mobile app
   - Contact swap owner directly if urgent

### Target Cancelled

**Symptoms:**
- Notification: "Your target swap has been cancelled"
- Target disappears from dashboard
- Swap returns to general availability

**Automatic System Response:**
- Your swap automatically returns to "Available" status
- Previous proposal is cancelled
- You can immediately target new swaps

**Recommended Actions:**

1. **Find New Target:**
   - Browse for similar swaps
   - Use saved search criteria
   - Check recently added swaps

2. **Learn from Experience:**
   - Note what made the cancelled swap appealing
   - Refine your search criteria
   - Consider backup targets

### Target Matched

**Symptoms:**
- Notification: "Target swap has been matched with another user"
- Your targeting attempt was unsuccessful
- Swap no longer appears in browse results

**Understanding the Process:**
- Another user's proposal was accepted
- This is normal in competitive situations
- Your swap returns to available status

**Next Steps:**

1. **Analyze Competition:**
   - Consider what made the winning proposal attractive
   - Review your swap presentation
   - Improve your targeting message

2. **Adjust Strategy:**
   - Target less competitive swaps
   - Improve your swap description
   - Consider auction mode swaps

## Advanced Troubleshooting

### Browser-Specific Issues

#### Chrome Issues

**Common Problems:**
- Extensions blocking targeting requests
- Outdated browser version
- Cache corruption

**Solutions:**
```bash
# Clear Chrome cache and data
1. Settings → Privacy and Security → Clear browsing data
2. Select "All time" and check all boxes
3. Click "Clear data"

# Disable extensions
1. Settings → Extensions
2. Disable all extensions
3. Try targeting again
4. Re-enable extensions one by one
```

#### Safari Issues

**Common Problems:**
- Strict privacy settings
- Cross-site tracking prevention
- Outdated WebKit

**Solutions:**
```bash
# Adjust Safari settings
1. Safari → Preferences → Privacy
2. Uncheck "Prevent cross-site tracking"
3. Reload the page and try again

# Clear Safari cache
1. Safari → Preferences → Advanced
2. Check "Show Develop menu"
3. Develop → Empty Caches
```

#### Firefox Issues

**Common Problems:**
- Enhanced tracking protection
- Strict security settings
- Add-on conflicts

**Solutions:**
```bash
# Adjust tracking protection
1. Settings → Privacy & Security
2. Set tracking protection to "Standard"
3. Reload page and retry

# Safe mode testing
1. Help → Restart with Add-ons Disabled
2. Try targeting in safe mode
3. If works, disable add-ons individually
```

### Mobile App Issues

#### iOS App Issues

**Common Problems:**
- App needs update
- iOS version compatibility
- Network permissions

**Solutions:**
```bash
# Update app
1. App Store → Updates
2. Update swap app if available
3. Restart app after update

# Check permissions
1. Settings → Privacy → Location Services
2. Enable for swap app
3. Settings → Cellular → Enable for swap app
```

#### Android App Issues

**Common Problems:**
- Background app restrictions
- Data saver mode
- App permissions

**Solutions:**
```bash
# Check app permissions
1. Settings → Apps → Swap App → Permissions
2. Enable all required permissions
3. Restart app

# Disable data saver
1. Settings → Network & Internet → Data Saver
2. Turn off or add app to unrestricted list
```

### Database and Sync Issues

#### Data Synchronization Problems

**Symptoms:**
- Targeting status not updating
- Conflicting information between devices
- Old data showing

**Solutions:**

1. **Force Sync:**
   - Pull down to refresh on mobile
   - Ctrl+F5 on web browser
   - Log out and log back in

2. **Clear Local Data:**
   - Clear browser cache
   - Clear app data on mobile
   - Re-login to sync fresh data

#### Account Synchronization

**Symptoms:**
- Different targeting status on different devices
- Missing targeting history
- Inconsistent swap data

**Solutions:**

1. **Verify Account:**
   - Ensure same account on all devices
   - Check account email in settings
   - Verify no multiple accounts

2. **Force Account Sync:**
   - Log out from all devices
   - Log back in on primary device
   - Wait for sync before using other devices

## Performance Issues

### Slow Loading

**Symptoms:**
- Browse page loads slowly
- Targeting takes long time to process
- App feels sluggish

**Causes and Solutions:**

1. **Large Dataset:**
   - Use filters to reduce results
   - Enable pagination
   - Clear search history

2. **Network Speed:**
   - Check internet speed
   - Use WiFi instead of cellular
   - Close other bandwidth-heavy apps

3. **Device Performance:**
   - Close other apps
   - Restart device
   - Clear device storage

### Memory Issues

**Symptoms:**
- App crashes during targeting
- Browser tabs crash
- Device becomes slow

**Solutions:**

1. **Free Memory:**
   - Close unused browser tabs
   - Close other applications
   - Restart browser/app

2. **Device Maintenance:**
   - Restart device
   - Clear cache and temporary files
   - Update operating system

## Error Code Reference

### Client-Side Errors (4xx)

| Code | Message | Cause | Solution |
|------|---------|-------|----------|
| 400 | Bad Request | Invalid targeting data | Check swap compatibility |
| 401 | Unauthorized | Not logged in | Log in and retry |
| 403 | Forbidden | Account restrictions | Contact support |
| 404 | Not Found | Swap doesn't exist | Refresh and try different swap |
| 409 | Conflict | Targeting conflict | Wait and retry |
| 429 | Too Many Requests | Rate limiting | Wait before retrying |

### Server-Side Errors (5xx)

| Code | Message | Cause | Solution |
|------|---------|-------|----------|
| 500 | Internal Server Error | Server problem | Wait and retry |
| 502 | Bad Gateway | Server connectivity | Check system status |
| 503 | Service Unavailable | Maintenance mode | Wait for maintenance to complete |
| 504 | Gateway Timeout | Server overload | Retry in a few minutes |

## When to Contact Support

### Immediate Support Needed

Contact support immediately if:
- ❌ Account appears compromised
- ❌ Unauthorized targeting activity
- ❌ Payment or billing issues
- ❌ Harassment or abuse
- ❌ Data loss or corruption

### Standard Support

Contact support for:
- 🔧 Persistent technical issues
- ❓ Feature questions not covered in docs
- 🐛 Bug reports
- 💡 Feature requests
- 📊 Account data questions

### Support Channels

1. **Live Chat** (Fastest)
   - Available 9 AM - 6 PM EST
   - Instant response for urgent issues
   - Screen sharing available

2. **Email Support**
   - support@swapplatform.com
   - Response within 24 hours
   - Include screenshots and error messages

3. **Phone Support** (Premium users)
   - 1-800-SWAP-HELP
   - Available for complex issues
   - Callback option available

### Information to Include

When contacting support, include:

**Account Information:**
- Your username/email
- Account type (free/premium)
- Last successful login time

**Technical Details:**
- Device type and OS version
- Browser type and version
- Error messages (exact text)
- Screenshots of the issue

**Issue Description:**
- What you were trying to do
- What happened instead
- Steps to reproduce the issue
- When the issue started

**Targeting Specific:**
- Swap ID you were targeting
- Your swap ID
- Targeting timestamp
- Any error codes received

## Prevention and Best Practices

### Avoiding Common Issues

1. **Regular Maintenance:**
   - Update browser/app regularly
   - Clear cache weekly
   - Check account settings monthly

2. **Smart Targeting:**
   - Read swap details carefully
   - Check compatibility before targeting
   - Have backup targets ready

3. **Network Reliability:**
   - Use stable internet connection
   - Avoid targeting during peak hours
   - Save progress frequently

### Monitoring Tools

1. **System Status:**
   - Bookmark status.swapplatform.com
   - Follow @SwapStatus on social media
   - Enable system notifications

2. **Account Monitoring:**
   - Enable email notifications
   - Check dashboard regularly
   - Monitor targeting success rate

3. **Performance Tracking:**
   - Note slow loading times
   - Track error frequency
   - Report patterns to support

---

*Need more help? Visit our [Help Center](https://help.swapplatform.com) or contact [Support](mailto:support@swapplatform.com)*