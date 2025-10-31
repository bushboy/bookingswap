# WalletStatusIndicator Integration Guide

## Overview

The `WalletStatusIndicator` component provides a visual representation of the current wallet connection status, network information, and error states. It integrates seamlessly with the existing Redux wallet state management.

## Basic Usage

```tsx
import { WalletStatusIndicator } from '@/components/wallet';

// Basic usage with default settings
<WalletStatusIndicator />

// Compact variant for headers/navigation
<WalletStatusIndicator variant="compact" />

// Minimal variant for space-constrained areas
<WalletStatusIndicator variant="minimal" />
```

## Integration Examples

### 1. Header Integration

```tsx
// In your Header component
import { WalletStatusIndicator } from '@/components/wallet';

export const Header: React.FC = () => {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Logo />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <WalletStatusIndicator variant="compact" />
        <UserMenu />
      </div>
    </header>
  );
};
```

### 2. Sidebar Integration

```tsx
// In your Sidebar component
import { WalletStatusIndicator } from '@/components/wallet';

export const Sidebar: React.FC = () => {
  return (
    <aside>
      <nav>
        {/* Navigation items */}
      </nav>
      <div style={{ marginTop: 'auto', padding: '16px' }}>
        <WalletStatusIndicator variant="detailed" />
      </div>
    </aside>
  );
};
```

### 3. Dashboard Widget

```tsx
// In your Dashboard component
import { WalletStatusIndicator } from '@/components/wallet';

export const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <div className="widget-grid">
        <div className="wallet-status-widget">
          <h3>Wallet Status</h3>
          <WalletStatusIndicator 
            variant="detailed" 
            showNetwork={true}
            showErrorDetails={true}
          />
        </div>
        {/* Other widgets */}
      </div>
    </div>
  );
};
```

### 4. Mobile-Responsive Usage

```tsx
import { useResponsive } from '@/hooks/useResponsive';
import { WalletStatusIndicator } from '@/components/wallet';

export const ResponsiveWalletStatus: React.FC = () => {
  const { isMobile } = useResponsive();
  
  return (
    <WalletStatusIndicator 
      variant={isMobile ? "minimal" : "compact"}
      showNetwork={!isMobile}
    />
  );
};
```

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'compact' \| 'detailed' \| 'minimal'` | `'detailed'` | Display variant of the component |
| `showNetwork` | `boolean` | `true` | Whether to show network information |
| `showErrorDetails` | `boolean` | `true` | Whether to show detailed error messages |
| `className` | `string` | `undefined` | Additional CSS class name |
| `style` | `React.CSSProperties` | `undefined` | Inline styles |

## State Indicators

### Connection Status
- **Idle**: Gray dot, "Not Connected"
- **Connecting**: Animated spinner, "Connecting..."
- **Connected**: Green dot, "Connected"
- **Error**: Red dot, "Connection Error"

### Network Display
- **Mainnet**: Green badge with "Mainnet"
- **Testnet**: Orange badge with "Testnet"
- **Unknown**: Gray badge with network name

### Error Types
- **Provider Not Found**: "Wallet not installed"
- **Connection Rejected**: "Connection rejected"
- **Wallet Locked**: "Wallet locked"
- **Wrong Network**: "Wrong network"
- **Network Error**: "Network error"
- **Unknown Error**: "Connection failed"

## Styling Customization

The component uses the design system tokens for consistent styling. You can customize the appearance by:

1. **Using CSS classes**:
```tsx
<WalletStatusIndicator className="custom-wallet-status" />
```

2. **Using inline styles**:
```tsx
<WalletStatusIndicator 
  style={{ 
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px'
  }} 
/>
```

3. **Creating themed variants** (in your CSS):
```css
.wallet-status-dark {
  background-color: #1a1a1a;
  color: white;
}

.wallet-status-compact {
  padding: 8px 12px;
  font-size: 14px;
}
```

## Accessibility Features

- Proper ARIA labels for status indicators
- Screen reader friendly status text
- Keyboard navigation support
- High contrast color schemes
- Semantic HTML structure

## Requirements Satisfied

This component satisfies the following requirements from the specification:

- **Requirement 2.3**: Shows network (mainnet/testnet) functionality ✅
- **Requirement 4.4**: Displays loading and error state indicators ✅

The component provides:
- Current connection status display
- Network information (mainnet/testnet)
- Loading states during connection
- Comprehensive error state indicators
- Multiple display variants for different use cases
- Full accessibility support
- Integration with existing Redux state management

## Testing

The component includes comprehensive unit tests covering:
- All connection states (idle, connecting, connected, error)
- Network display functionality
- Error handling for all error types
- Different variants (minimal, compact, detailed)
- Accessibility features
- Edge cases and error conditions

Run tests with:
```bash
npm test -- src/components/wallet/__tests__/WalletStatusIndicator.test.tsx
```