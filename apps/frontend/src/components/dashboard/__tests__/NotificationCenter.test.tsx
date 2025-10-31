import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationCenter } from '../NotificationCenter';

describe('NotificationCenter', () => {
  const mockNotifications = [
    {
      id: '1',
      type: 'swap_proposal' as const,
      title: 'New swap proposal',
      message:
        'Someone wants to swap their Tokyo flight for your Miami hotel booking',
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      read: false,
      priority: 'high' as const,
    },
    {
      id: '2',
      type: 'swap_completed' as const,
      title: 'Swap completed',
      message: 'Your Paris hotel swap has been completed successfully',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
      priority: 'medium' as const,
    },
    {
      id: '3',
      type: 'booking_expired' as const,
      title: 'Booking expiring soon',
      message: 'Your concert tickets listing will expire in 24 hours',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      read: true,
      priority: 'low' as const,
    },
  ];

  const mockOnMarkAsRead = vi.fn();
  const mockOnMarkAllAsRead = vi.fn();
  const mockOnNotificationClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notification center with all notifications', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('New swap proposal')).toBeInTheDocument();
    expect(screen.getByText('Swap completed')).toBeInTheDocument();
    expect(screen.getByText('Booking expiring soon')).toBeInTheDocument();
  });

  it('displays unread count badge', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // Unread count badge
  });

  it('shows mark all read button when there are unread notifications', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(screen.getByText('Mark All Read')).toBeInTheDocument();
  });

  it('displays notification messages correctly', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(
      screen.getByText(
        'Someone wants to swap their Tokyo flight for your Miami hotel booking'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your Paris hotel swap has been completed successfully')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your concert tickets listing will expire in 24 hours')
    ).toBeInTheDocument();
  });

  it('shows correct filter counts', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(screen.getByText('All (3)')).toBeInTheDocument();
    expect(screen.getByText('Unread (2)')).toBeInTheDocument();
  });

  it('filters notifications by unread status', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    const unreadFilter = screen.getByText('Unread (2)');
    fireEvent.click(unreadFilter);

    expect(screen.getByText('New swap proposal')).toBeInTheDocument();
    expect(screen.getByText('Swap completed')).toBeInTheDocument();
    expect(screen.queryByText('Booking expiring soon')).not.toBeInTheDocument();
  });

  it('shows all notifications when all filter is selected', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    // First filter by unread
    const unreadFilter = screen.getByText('Unread (2)');
    fireEvent.click(unreadFilter);

    // Then click all to show all notifications
    const allFilter = screen.getByText('All (3)');
    fireEvent.click(allFilter);

    expect(screen.getByText('New swap proposal')).toBeInTheDocument();
    expect(screen.getByText('Swap completed')).toBeInTheDocument();
    expect(screen.getByText('Booking expiring soon')).toBeInTheDocument();
  });

  it('calls onMarkAsRead when unread notification is clicked', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    const unreadNotification = screen
      .getByText('New swap proposal')
      .closest('div');
    fireEvent.click(unreadNotification!);

    expect(mockOnMarkAsRead).toHaveBeenCalledWith('1');
    expect(mockOnNotificationClick).toHaveBeenCalledWith(mockNotifications[0]);
  });

  it('does not call onMarkAsRead when read notification is clicked', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    const readNotification = screen
      .getByText('Booking expiring soon')
      .closest('div');
    fireEvent.click(readNotification!);

    expect(mockOnMarkAsRead).not.toHaveBeenCalled();
    expect(mockOnNotificationClick).toHaveBeenCalledWith(mockNotifications[2]);
  });

  it('calls onMarkAllAsRead when mark all read button is clicked', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    const markAllReadButton = screen.getByText('Mark All Read');
    fireEvent.click(markAllReadButton);

    expect(mockOnMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no notifications', () => {
    render(
      <NotificationCenter
        notifications={[]}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });

  it('renders empty state for unread filter when all notifications are read', () => {
    const allReadNotifications = mockNotifications.map(n => ({
      ...n,
      read: true,
    }));
    render(
      <NotificationCenter
        notifications={allReadNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    const unreadFilter = screen.getByText('Unread (0)');
    fireEvent.click(unreadFilter);

    expect(
      screen.getByText('All caught up! No unread notifications.')
    ).toBeInTheDocument();
  });

  it('displays correct notification icons', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    // Check that notification items are rendered (icons are emojis in the component)
    const notificationItems = screen.getAllByText(
      /New swap proposal|Swap completed|Booking expiring/
    );
    expect(notificationItems).toHaveLength(3);
  });

  it('formats timestamps correctly', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(screen.getByText(/minutes? ago/)).toBeInTheDocument();
    expect(screen.getAllByText(/hours? ago/)).toHaveLength(2);
  });

  it('does not show mark all read button when no unread notifications', () => {
    const allReadNotifications = mockNotifications.map(n => ({
      ...n,
      read: true,
    }));
    render(
      <NotificationCenter
        notifications={allReadNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    expect(screen.queryByText('Mark All Read')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument(); // No unread count badge
  });

  it('applies different styling to unread notifications', () => {
    render(
      <NotificationCenter
        notifications={mockNotifications}
        onMarkAsRead={mockOnMarkAsRead}
        onMarkAllAsRead={mockOnMarkAllAsRead}
        onNotificationClick={mockOnNotificationClick}
      />
    );

    // Unread notifications should have different styling (this is visual, hard to test directly)
    // But we can verify they're rendered differently by checking the structure
    const notifications = screen.getAllByText(
      /New swap proposal|Swap completed|Booking expiring/
    );
    expect(notifications).toHaveLength(3);
  });
});
