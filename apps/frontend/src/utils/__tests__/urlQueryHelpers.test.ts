import { vi } from 'vitest';
import {
  NavigationQueryManager,
  QueryParameterManager,
  ReturnNavigationHelper,
  StatePreservationUrlHelper,
} from '../urlQueryHelpers';

// Mock window.location
const mockLocation = {
  origin: 'https://example.com',
  href: 'https://example.com/bookings',
  pathname: '/bookings',
  search: '',
};

Object.defineProperty(window, 'location', {
  writable: true,
  value: mockLocation,
});

// Mock window.history
const mockHistory = {
  pushState: vi.fn(),
  replaceState: vi.fn(),
};

Object.defineProperty(window, 'history', {
  writable: true,
  value: mockHistory,
});

describe('NavigationQueryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addNavigationContext', () => {
    it('should add navigation context to URL', () => {
      const context = {
        returnTo: '/previous-page',
        preserveState: true,
        hasUnsavedChanges: true,
        fromInterface: 'booking-edit' as const,
        bookingId: 'booking-123',
      };

      const result = NavigationQueryManager.addNavigationContext(
        'https://example.com/bookings',
        context
      );

      const url = new URL(result);
      expect(url.searchParams.get('returnTo')).toBe('/previous-page');
      expect(url.searchParams.get('preserveState')).toBe('true');
      expect(url.searchParams.get('hasUnsavedChanges')).toBe('true');
      expect(url.searchParams.get('from')).toBe('booking-edit');
      expect(url.searchParams.get('bookingId')).toBe('booking-123');
    });

    it('should skip undefined values', () => {
      const context = {
        returnTo: '/previous-page',
        preserveState: undefined,
        hasUnsavedChanges: false,
      };

      const result = NavigationQueryManager.addNavigationContext(
        'https://example.com/bookings',
        context
      );

      const url = new URL(result);
      expect(url.searchParams.get('returnTo')).toBe('/previous-page');
      expect(url.searchParams.has('preserveState')).toBe(false);
      expect(url.searchParams.get('hasUnsavedChanges')).toBe('false');
    });
  });

  describe('extractNavigationContext', () => {
    it('should extract navigation context from search params', () => {
      const searchParams = new URLSearchParams();
      searchParams.set('returnTo', '/previous-page');
      searchParams.set('preserveState', 'true');
      searchParams.set('hasUnsavedChanges', 'true');
      searchParams.set('from', 'swap-specification');
      searchParams.set('bookingId', 'booking-123');

      const context = NavigationQueryManager.extractNavigationContext(searchParams);

      expect(context).toEqual({
        returnTo: '/previous-page',
        preserveState: true,
        hasUnsavedChanges: true,
        fromInterface: 'swap-specification',
        bookingId: 'booking-123',
      });
    });

    it('should handle missing parameters', () => {
      const searchParams = new URLSearchParams();
      const context = NavigationQueryManager.extractNavigationContext(searchParams);

      expect(context).toEqual({
        returnTo: undefined,
        preserveState: false,
        hasUnsavedChanges: false,
        fromInterface: undefined,
        bookingId: undefined,
      });
    });
  });

  describe('buildUrlWithContext', () => {
    it('should build URL with navigation context', () => {
      const context = {
        returnTo: '/previous-page',
        preserveState: true,
        bookingId: 'booking-123',
      };

      const result = NavigationQueryManager.buildUrlWithContext('/bookings', context);

      expect(result).toContain('/bookings');
      expect(result).toContain('returnTo=%2Fprevious-page');
      expect(result).toContain('preserveState=true');
      expect(result).toContain('bookingId=booking-123');
    });
  });

  describe('cleanNavigationContext', () => {
    it('should remove navigation parameters from URL', () => {
      const url = 'https://example.com/bookings?returnTo=/prev&preserveState=true&other=keep';
      const result = NavigationQueryManager.cleanNavigationContext(url);

      expect(result).toContain('other=keep');
      expect(result).not.toContain('returnTo');
      expect(result).not.toContain('preserveState');
    });
  });
});

describe('QueryParameterManager', () => {
  describe('basic operations', () => {
    it('should get query parameter values', () => {
      const manager = new QueryParameterManager('?param1=value1&param2=value2');

      expect(manager.get('param1')).toBe('value1');
      expect(manager.get('param2')).toBe('value2');
      expect(manager.get('nonexistent')).toBeNull();
    });

    it('should set query parameter values', () => {
      const manager = new QueryParameterManager();
      manager.set('param1', 'value1');

      expect(manager.get('param1')).toBe('value1');
    });

    it('should delete query parameters', () => {
      const manager = new QueryParameterManager('?param1=value1&param2=value2');
      manager.delete('param1');

      expect(manager.get('param1')).toBeNull();
      expect(manager.get('param2')).toBe('value2');
    });

    it('should check if parameter exists', () => {
      const manager = new QueryParameterManager('?param1=value1');

      expect(manager.has('param1')).toBe(true);
      expect(manager.has('nonexistent')).toBe(false);
    });
  });

  describe('multiple values', () => {
    it('should handle multiple values for same parameter', () => {
      const manager = new QueryParameterManager('?param=value1&param=value2');

      expect(manager.getAll('param')).toEqual(['value1', 'value2']);
    });

    it('should append values to existing parameters', () => {
      const manager = new QueryParameterManager('?param=value1');
      manager.append('param', 'value2');

      expect(manager.getAll('param')).toEqual(['value1', 'value2']);
    });
  });

  describe('URL generation', () => {
    it('should convert to query string', () => {
      const manager = new QueryParameterManager();
      manager.set('param1', 'value1');
      manager.set('param2', 'value2');

      const queryString = manager.toString();
      expect(queryString).toContain('param1=value1');
      expect(queryString).toContain('param2=value2');
    });

    it('should convert to full URL', () => {
      const manager = new QueryParameterManager();
      manager.set('param1', 'value1');

      const url = manager.toUrl('/bookings');
      expect(url).toBe('/bookings?param1=value1');
    });

    it('should handle empty parameters', () => {
      const manager = new QueryParameterManager();
      const url = manager.toUrl('/bookings');
      expect(url).toBe('/bookings');
    });
  });
});

describe('ReturnNavigationHelper', () => {
  describe('URL validation', () => {
    it('should validate relative URLs', () => {
      expect(ReturnNavigationHelper.validateReturnUrl('/bookings')).toBe(true);
      expect(ReturnNavigationHelper.validateReturnUrl('/bookings/123')).toBe(true);
    });

    it('should validate same-origin URLs', () => {
      expect(ReturnNavigationHelper.validateReturnUrl('https://example.com/bookings')).toBe(true);
    });

    it('should reject external URLs', () => {
      expect(ReturnNavigationHelper.validateReturnUrl('https://evil.com/bookings')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(ReturnNavigationHelper.validateReturnUrl('javascript:alert(1)')).toBe(false);
      expect(ReturnNavigationHelper.validateReturnUrl('not-a-url')).toBe(false);
    });
  });

  describe('URL sanitization', () => {
    it('should sanitize valid URLs', () => {
      const result = ReturnNavigationHelper.sanitizeReturnUrl('/bookings?param=value');
      expect(result).toBe('/bookings?param=value');
    });

    it('should remove hash fragments', () => {
      const result = ReturnNavigationHelper.sanitizeReturnUrl('/bookings#dangerous');
      expect(result).toBe('/bookings');
    });

    it('should return fallback for invalid URLs', () => {
      const result = ReturnNavigationHelper.sanitizeReturnUrl('javascript:alert(1)', '/safe');
      expect(result).toBe('/safe');
    });

    it('should return fallback for empty URLs', () => {
      const result = ReturnNavigationHelper.sanitizeReturnUrl('', '/fallback');
      expect(result).toBe('/fallback');
    });
  });

  describe('URL encoding/decoding', () => {
    it('should encode return URLs', () => {
      const encoded = ReturnNavigationHelper.encodeReturnUrl('/bookings?param=value');
      expect(encoded).toBe(encodeURIComponent('/bookings?param=value'));
    });

    it('should decode return URLs', () => {
      const encoded = encodeURIComponent('/bookings?param=value');
      const decoded = ReturnNavigationHelper.decodeReturnUrl(encoded);
      expect(decoded).toBe('/bookings?param=value');
    });

    it('should handle decode errors gracefully', () => {
      const result = ReturnNavigationHelper.decodeReturnUrl('invalid%url');
      expect(result).toBe('/bookings'); // fallback
    });
  });
});

describe('StatePreservationUrlHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.search = '';
  });

  describe('state saving and loading', () => {
    it('should save state to URL parameters', () => {
      const state = { field1: 'value1', field2: 'value2' };

      StatePreservationUrlHelper.saveStateToUrl('test', state);

      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    it('should load state from URL parameters', () => {
      const state = { field1: 'value1', field2: 'value2' };
      const encodedState = encodeURIComponent(JSON.stringify(state));
      mockLocation.search = `?nav_state_test=${encodedState}`;

      const result = StatePreservationUrlHelper.loadStateFromUrl('test');

      expect(result).toEqual(state);
    });

    it('should return null for missing state', () => {
      mockLocation.search = '';

      const result = StatePreservationUrlHelper.loadStateFromUrl('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle malformed state gracefully', () => {
      mockLocation.search = '?nav_state_test=invalid-json';

      const result = StatePreservationUrlHelper.loadStateFromUrl('test');

      expect(result).toBeNull();
    });
  });

  describe('state clearing', () => {
    it('should clear specific state from URL', () => {
      StatePreservationUrlHelper.clearStateFromUrl('test');

      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    it('should clear all state from URL', () => {
      StatePreservationUrlHelper.clearAllStateFromUrl();

      expect(mockHistory.replaceState).toHaveBeenCalled();
    });
  });
});