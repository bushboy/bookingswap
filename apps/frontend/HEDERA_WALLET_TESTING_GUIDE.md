# Hedera Wallet Testing Guide

This guide provides alternatives to HashPack and Blade wallets for testing the Hedera wallet integration.

## 🔗 Available Wallet Options

### 1. **Mock Wallet (Recommended for Development)**
- ✅ **Always Available** - No installation required
- ✅ **Instant Testing** - Simulates all wallet operations
- ✅ **Configurable** - Test different scenarios and error cases
- ✅ **No Email Auth** - Works immediately

**How to Use:**
1. Open the application
2. Click "Connect Wallet"
3. Select "Mock Wallet (Testing)"
4. Connection happens automatically after 1 second

**Features:**
- Simulates account: `0.0.123456`
- Mock balance: `100.50 HBAR` (fluctuates for testing)
- Network switching simulation
- Transaction signing simulation
- Error scenario testing

### 2. **Kabila Wallet**
- 🌐 **Web & Mobile** - Available as browser extension and mobile app
- 🔒 **Secure** - Well-established Hedera wallet
- 📱 **User-Friendly** - Simple interface

**Installation:**
- **Chrome Extension**: [Kabila Wallet Extension](https://chrome.google.com/webstore/detail/kabila-wallet)
- **Mobile App**: Available on iOS and Android app stores
- **Web Version**: Visit [kabila.app](https://kabila.app)

### 3. **Yamgo Wallet**
- 🚀 **Fast Setup** - Quick installation and setup
- 💼 **Business Features** - Good for testing enterprise scenarios
- 🔄 **Multi-Network** - Supports testnet and mainnet

**Installation:**
- **Browser Extension**: Available for Chrome and Firefox
- **Web Interface**: Direct browser access
- **API Integration**: Good developer tools

### 4. **HashPack (Troubleshooting)**
If you want to continue using HashPack but are having email issues:

**Alternative Setup Methods:**
1. **Skip Email Verification** (if available in settings)
2. **Use Different Email Provider** (Gmail, Outlook, etc.)
3. **Check Spam Folder** for verification emails
4. **Use HashPack Mobile App** instead of browser extension
5. **Clear Browser Cache** and retry setup

### 5. **Blade Wallet Alternatives**
Since Blade appears to be inactive, here are similar options:

**D'CENT Wallet:**
- Hardware wallet with Hedera support
- Mobile app available
- Good for testing hardware wallet scenarios

**Wallawallet:**
- Simple web-based wallet
- No installation required
- Good for quick testing

## 🛠 Testing Scenarios

### Basic Connection Testing
```typescript
// Test with Mock Wallet
const mockWallet = new MockWalletAdapter();
await mockWallet.connect();
console.log('Connected:', await mockWallet.getAccountInfo());
```

### Error Scenario Testing
```typescript
// Simulate different error conditions with Mock Wallet
mockWallet.simulateWalletLock();     // Test locked wallet
mockWallet.simulateNetworkError();   // Test network issues
mockWallet.setMockAccount('0.0.999', '0', 'mainnet'); // Test different accounts
```

### Network Switching Testing
```typescript
// Test network switching
await mockWallet.switchNetwork('mainnet');
await mockWallet.switchNetwork('testnet');
```

## 🚀 Quick Start for Testing

### Option 1: Use Mock Wallet (Fastest)
1. Start the application: `npm run dev`
2. Navigate to the app
3. Click "Connect Wallet"
4. Select "Mock Wallet (Testing)"
5. ✅ **Ready to test immediately!**

### Option 2: Install Kabila Wallet
1. Install [Kabila Chrome Extension](https://chrome.google.com/webstore/detail/kabila-wallet)
2. Create a new wallet or import existing
3. Switch to Hedera Testnet
4. Get testnet HBAR from [Hedera Faucet](https://portal.hedera.com/faucet)
5. Connect to your application

### Option 3: Use Yamgo Wallet
1. Visit [Yamgo Wallet](https://yamgo.io)
2. Create account or install extension
3. Set up testnet configuration
4. Fund with testnet HBAR
5. Connect to your application

## 🔧 Configuration

### Environment Variables
Add these to your `.env` file for wallet testing:

```bash
# Enable mock wallet in development
VITE_ENABLE_MOCK_WALLET=true

# Default network for testing
VITE_DEFAULT_NETWORK=testnet

# Enable wallet debugging
VITE_WALLET_DEBUG=true
```

### Wallet Provider Priority
The application will try wallets in this order:
1. **Mock Wallet** (if enabled in development)
2. **HashPack** (if installed)
3. **Kabila** (if installed)
4. **Yamgo** (if installed)
5. **Blade** (if installed)

## 🐛 Troubleshooting

### Common Issues and Solutions

**"No wallet detected"**
- ✅ Use Mock Wallet for immediate testing
- ✅ Ensure browser extension is installed and enabled
- ✅ Refresh the page after installing wallet extension

**"Connection rejected"**
- ✅ Check if wallet is unlocked
- ✅ Ensure you're on the correct network (testnet/mainnet)
- ✅ Try disconnecting and reconnecting

**"Network mismatch"**
- ✅ Switch wallet to testnet for development
- ✅ Use Mock Wallet which handles network switching automatically

**"Insufficient balance"**
- ✅ Get testnet HBAR from [Hedera Faucet](https://portal.hedera.com/faucet)
- ✅ Use Mock Wallet with simulated balance

### HashPack Email Issues Specifically

**If HashPack email verification is not working:**

1. **Try Alternative Email Providers:**
   - Use Gmail, Outlook, or ProtonMail
   - Avoid temporary email services

2. **Check Email Settings:**
   - Look in spam/junk folders
   - Add HashPack to safe senders list
   - Try different email address

3. **Use HashPack Mobile App:**
   - Download from app store
   - Create account on mobile
   - Use WalletConnect to bridge to web app

4. **Contact HashPack Support:**
   - Visit [HashPack Support](https://www.hashpack.app/support)
   - Join their Discord community
   - Check their documentation

## 📊 Testing Matrix

| Wallet | Installation | Email Required | Testnet Support | Development Ready |
|--------|-------------|----------------|-----------------|-------------------|
| **Mock Wallet** | ❌ None | ❌ No | ✅ Yes | ✅ **Immediate** |
| **Kabila** | 🔧 Extension/App | ✅ Yes | ✅ Yes | ✅ **Good** |
| **Yamgo** | 🔧 Extension/Web | ✅ Yes | ✅ Yes | ✅ **Good** |
| **HashPack** | 🔧 Extension/App | ✅ Yes (Issues) | ✅ Yes | ⚠️ **Email Issues** |
| **Blade** | 🔧 Extension | ✅ Yes | ✅ Yes | ❌ **Inactive** |

## 🎯 Recommendations

### For Development & Testing:
1. **Start with Mock Wallet** - Get immediate feedback
2. **Add Kabila Wallet** - Test real wallet integration
3. **Test with Yamgo** - Verify cross-wallet compatibility

### For Production:
1. **Support Multiple Wallets** - Better user experience
2. **Graceful Fallbacks** - Handle wallet unavailability
3. **Clear Error Messages** - Help users troubleshoot

### For Debugging:
1. **Enable Wallet Debug Mode** - See detailed logs
2. **Use Mock Wallet Error Simulation** - Test error handling
3. **Test Network Switching** - Verify network compatibility

## 🔗 Useful Links

- **Hedera Testnet Faucet**: https://portal.hedera.com/faucet
- **Hedera Documentation**: https://docs.hedera.com
- **Kabila Wallet**: https://kabila.app
- **Yamgo Wallet**: https://yamgo.io
- **HashPack Support**: https://www.hashpack.app/support

---

**💡 Pro Tip**: Start with the Mock Wallet for immediate testing, then gradually add real wallets as needed. The Mock Wallet simulates all the functionality you need for development without any external dependencies!