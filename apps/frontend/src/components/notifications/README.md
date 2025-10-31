# Real-time Notifications System

This directory contains the complete real-time notification system for swap management, including WebSocket integration, browser notifications, and in-app notification management.

## Components

### Core Components

- **NotificationProvider**: Main provider that wraps the app and handles WebSocket connections
- **SwapNotificationHandler**: Specialized handler for swap-related notifications
- **NotificationBell**: Bell icon with unread count badge
- **NotificationCenter**: Slide-out panel for viewing notification history
- **NotificationToast**: Individual toast notification component
- **ToastContainer**: Container for managing multiple toast notifications
- **NotificationPreferences**: Component for managing notification settings

### Hooks

- **useSwapWebSocket**: Specialized hook for swap-specific WebSocket events

## Usage

### Basic Setup

```tsx
import { NotificationProvider, NotificationBell } from './components/notifications';

function App() {
  return (
    <NotificationProvider>
      <header>
        <NotificationBell />
      </header>
      <main>
        {/* Your app content */}
      </main>
    </NotificationProvider>
  );
}
```

### Using in Swap Components

```tsx
import { useSwapWebSocket } from './hooks/useSwapWebSocket';

function SwapCard({ swap }) {
  const { isConnected } = useSwapWebSocket({
    swapId: swap.id,
    autoJoinRoom: true,
    onSwapUpdate: (swapId, event) => {
      console.log('Swap updated:', swapId, event);
    },
    onProposalReceived: (swapId, proposalId) => {
      console.log('New proposal:', swapId, proposalId);
    }
  });

  return (
    <div>
      {/* Swap content */}
      {isConnected && <span>🟢 Live</span>}
    </div>
  );
}
```

### Managing Notification Preferences

```tsx
import { NotificationPreferences } from './components/notifications';

function SettingsPage() {
  const [preferences, setPreferences] = useState(defaultPreferences);

  const handleSave = (newPreferences) => {
    // Save to backend
    setPreferences(newPreferences);
  };

  return (
    <NotificationPreferences
      preferences={preferences}
      onSave={handleSave}
      onCancel={() => {/* handle cancel */}}
    />
  );
}
```

## Features

### Real-time Updates
- WebSocket connection for live swap updates
- Automatic reconnection handling
- Room-based notifications for specific swaps

### Browser Notifications
- Native browser notifications with permission handling
- Different notification sounds for different event types
- Click-to-navigate functionality

### In-app Notifications
- Toast notifications for immediate feedback
- Notification center with history
- Unread count tracking
- Filter by notification type

### Notification Types
- `swap_proposal`: New swap proposals
- `swap_accepted`: Swap accepted
- `swap_rejected`: Swap rejected
- `swap_expired`: Swap expired
- `swap_cancelled`: Swap cancelled
- `booking_verified`: Booking verified
- `booking_expired`: Booking expired

### Accessibility
- ARIA labels and roles
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support

## Configuration

### Environment Variables
- `VITE_API_BASE_URL`: Backend API URL for WebSocket connection

### Notification Preferences
Users can configure:
- Email notifications
- SMS notifications
- Push notifications
- In-app notifications
- Per-notification-type channel preferences

## Testing

Run tests with:
```bash
npm test src/components/notifications
```

Tests cover:
- Component rendering
- WebSocket integration
- Notification handling
- User interactions
- Accessibility features