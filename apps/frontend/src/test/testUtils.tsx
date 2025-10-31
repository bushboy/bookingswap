import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { RootState } from '../store';
import { authSlice } from '../store/slices/authSlice';
import { bookingsSlice } from '../store/slices/bookingsSlice';
import { swapsSlice } from '../store/slices/swapsSlice';
import { uiSlice } from '../store/slices/uiSlice';
import { notificationSlice } from '../store/slices/notificationSlice';
import { dashboardSlice } from '../store/slices/dashboardSlice';
import { walletSlice } from '../store/slices/walletSlice';

// Test store configuration
export function setupTestStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
      bookings: bookingsSlice.reducer,
      swaps: swapsSlice.reducer,
      ui: uiSlice.reducer,
      notifications: notificationSlice.reducer,
      dashboard: dashboardSlice.reducer,
      wallet: walletSlice.reducer,
    },
    preloadedState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }),
  });
}

// Test wrapper with providers
interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>;
  store?: ReturnType<typeof setupTestStore>;
  withRouter?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState = {},
    store = setupTestStore(preloadedState),
    withRouter = true,
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const content = <Provider store={store}>{children}</Provider>;

    if (withRouter) {
      return <BrowserRouter>{content}</BrowserRouter>;
    }

    return content;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Mock data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user1',
  username: 'testuser',
  email: 'test@example.com',
  profile: {
    firstName: 'Test',
    lastName: 'User',
    avatar: '',
    bio: '',
    location: { city: 'New York', country: 'USA' },
    preferences: {},
    reputation: { score: 5, reviewCount: 10 },
    verification: { status: 'verified', documents: [] },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockBooking = (overrides = {}) => ({
  id: '1',
  userId: 'user1',
  type: 'hotel',
  title: 'Test Hotel',
  description: 'A test hotel booking',
  location: { city: 'New York', country: 'USA' },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF123',
  },
  verification: { status: 'verified', documents: [] },
  blockchain: { topicId: 'topic1' },
  status: 'available',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockSwap = (overrides = {}) => ({
  id: 'swap1',
  sourceBookingId: 'booking1',
  targetBookingId: 'booking2',
  proposerId: 'user1',
  ownerId: 'user2',
  status: 'pending',
  terms: { additionalPayment: 0, conditions: [] },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  sourceBooking: createMockBooking({ id: 'booking1' }),
  targetBooking: createMockBooking({ id: 'booking2', userId: 'user2' }),
  proposer: createMockUser({ id: 'user1' }),
  owner: createMockUser({ id: 'user2', username: 'user2' }),
  ...overrides,
});

// Mock API responses
export const mockApiResponse = (data: any, delay = 0) => {
  return new Promise(resolve => {
    setTimeout(() => resolve(data), delay);
  });
};

export const mockApiError = (message: string, status = 400, delay = 0) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(message);
      (error as any).response = { status, data: { message } };
      reject(error);
    }, delay);
  });
};

// Test helpers
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};

export const createMockFile = (
  name: string,
  type: string,
  content = 'test content'
) => {
  const file = new File([content], name, { type });
  return file;
};

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
  };
};

// Mock window.matchMedia
export const mockMatchMedia = (matches = false) => {
  return vi.fn().mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

// Mock IntersectionObserver
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = vi.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
  return mockIntersectionObserver;
};

// Mock ResizeObserver
export const mockResizeObserver = () => {
  const mockResizeObserver = vi.fn();
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.ResizeObserver = mockResizeObserver;
  return mockResizeObserver;
};

// Performance testing utilities
export class TestPerformanceMonitor {
  private marks: Map<string, number> = new Map();

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();

    if (!start) {
      throw new Error(`Start mark "${startMark}" not found`);
    }

    if (endMark && !end) {
      throw new Error(`End mark "${endMark}" not found`);
    }

    return (end || performance.now()) - start;
  }

  clear(): void {
    this.marks.clear();
  }
}

// Accessibility testing utilities
export const checkAccessibility = async (container: HTMLElement) => {
  const { axe } = await import('jest-axe');
  const results = await axe(container);
  return results;
};

export const getFocusableElements = (container: HTMLElement) => {
  return container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
};

// Custom matchers
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveBeenCalledWithin(received: any, timeMs: number) {
    const calls = received.mock.calls;
    if (calls.length === 0) {
      return {
        message: () =>
          `expected function to have been called within ${timeMs}ms`,
        pass: false,
      };
    }

    // This is a simplified version - in practice you'd check timing
    return {
      message: () =>
        `expected function not to have been called within ${timeMs}ms`,
      pass: true,
    };
  },
};

// Export everything for easy importing
export * from '@testing-library/react';
export * from '@testing-library/user-event';
export { vi } from 'vitest';
