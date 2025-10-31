import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NotificationBell } from '../NotificationBell';
import notificationSlice from '../../../store/slices/notificationSlice';

const createTestStore = (unreadCount = 0) => {
  return configureStore({
    reducer: {
      notifications: notificationSlice,
    },
    preloadedState: {
      notifications: {
        notifications: [],
        unreadCount,
        total: 0,
        loading: false,
        error: null,
        hasMore: false,
      },
    },
  });
};

describe('NotificationBell', () => {
  it('renders bell icon', () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <NotificationBell />
      </Provider>
    );

    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it('shows unread count badge when there are unread notifications', () => {
    const store = createTestStore(5);

    render(
      <Provider store={store}>
        <NotificationBell />
      </Provider>
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows 99+ for counts over 99', () => {
    const store = createTestStore(150);

    render(
      <Provider store={store}>
        <NotificationBell />
      </Provider>
    );

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('does not show badge when showCount is false', () => {
    const store = createTestStore(5);

    render(
      <Provider store={store}>
        <NotificationBell showCount={false} />
      </Provider>
    );

    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('opens notification center when clicked', () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <NotificationBell />
      </Provider>
    );

    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    // Check if notification center is opened (backdrop should be visible)
    const backdrop = document.querySelector('[style*="position: fixed"]');
    expect(backdrop).toBeInTheDocument();
  });

  it('applies correct size styles', () => {
    const store = createTestStore();

    const { rerender } = render(
      <Provider store={store}>
        <NotificationBell size="sm" />
      </Provider>
    );

    let button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toHaveStyle({ width: '32px', height: '32px' });

    rerender(
      <Provider store={store}>
        <NotificationBell size="lg" />
      </Provider>
    );

    button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toHaveStyle({ width: '48px', height: '48px' });
  });

  it('includes unread count in aria-label', () => {
    const store = createTestStore(3);

    render(
      <Provider store={store}>
        <NotificationBell />
      </Provider>
    );

    const button = screen.getByRole('button', {
      name: 'Notifications (3 unread)',
    });
    expect(button).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <NotificationBell className="custom-class" />
      </Provider>
    );

    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toHaveClass('custom-class');
  });
});
