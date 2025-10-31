/**
 * URL query parameter utilities for navigation state preservation
 * 
 * These utilities help manage URL query parameters for return navigation
 * context and state preservation during interface transitions.
 * 
 * Requirements addressed:
 * - 6.7: URL query parameters for return navigation context
 * - 6.8: Context switching support
 * - 6.6: Bookmark and sharing support
 */

export interface NavigationContext {
  returnTo?: string;
  preserveState?: boolean;
  hasUnsavedChanges?: boolean;
  fromInterface?: 'booking-edit' | 'swap-specification';
  bookingId?: string;
}

export interface QueryParams {
  [key: string]: string | string[] | undefined;
}

/**
 * URL query parameter manager for navigation context
 */
export class NavigationQueryManager {
  /**
   * Add navigation context to URL query parameters
   */
  static addNavigationContext(
    currentUrl: string,
    context: NavigationContext
  ): string {
    const url = new URL(currentUrl, window.location.origin);
    const searchParams = url.searchParams;

    if (context.returnTo) {
      searchParams.set('returnTo', context.returnTo);
    }

    if (context.preserveState !== undefined) {
      searchParams.set('preserveState', String(context.preserveState));
    }

    if (context.hasUnsavedChanges !== undefined) {
      searchParams.set('hasUnsavedChanges', String(context.hasUnsavedChanges));
    }

    if (context.fromInterface) {
      searchParams.set('from', context.fromInterface);
    }

    if (context.bookingId) {
      searchParams.set('bookingId', context.bookingId);
    }

    return url.toString();
  }

  /**
   * Extract navigation context from URL query parameters
   */
  static extractNavigationContext(searchParams: URLSearchParams): NavigationContext {
    return {
      returnTo: searchParams.get('returnTo') || undefined,
      preserveState: searchParams.get('preserveState') === 'true',
      hasUnsavedChanges: searchParams.get('hasUnsavedChanges') === 'true',
      fromInterface: (searchParams.get('from') as 'booking-edit' | 'swap-specification') || undefined,
      bookingId: searchParams.get('bookingId') || undefined,
    };
  }

  /**
   * Build URL with navigation context
   */
  static buildUrlWithContext(
    basePath: string,
    context: NavigationContext
  ): string {
    const url = new URL(basePath, window.location.origin);
    
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    return url.pathname + url.search;
  }

  /**
   * Clean navigation context from URL
   */
  static cleanNavigationContext(currentUrl: string): string {
    const url = new URL(currentUrl, window.location.origin);
    const searchParams = url.searchParams;

    // Remove navigation-specific parameters
    searchParams.delete('returnTo');
    searchParams.delete('preserveState');
    searchParams.delete('hasUnsavedChanges');
    searchParams.delete('from');

    return url.pathname + (url.search ? url.search : '');
  }

  /**
   * Update current URL with navigation context
   */
  static updateCurrentUrl(context: NavigationContext, replace: boolean = true): void {
    const newUrl = this.addNavigationContext(window.location.href, context);
    
    if (replace) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }
  }
}

/**
 * Hook-like utility for managing URL query parameters
 */
export class QueryParameterManager {
  private searchParams: URLSearchParams;

  constructor(search: string = window.location.search) {
    this.searchParams = new URLSearchParams(search);
  }

  /**
   * Get a query parameter value
   */
  get(key: string): string | null {
    return this.searchParams.get(key);
  }

  /**
   * Get all values for a query parameter
   */
  getAll(key: string): string[] {
    return this.searchParams.getAll(key);
  }

  /**
   * Set a query parameter value
   */
  set(key: string, value: string): this {
    this.searchParams.set(key, value);
    return this;
  }

  /**
   * Append a query parameter value
   */
  append(key: string, value: string): this {
    this.searchParams.append(key, value);
    return this;
  }

  /**
   * Delete a query parameter
   */
  delete(key: string): this {
    this.searchParams.delete(key);
    return this;
  }

  /**
   * Check if a query parameter exists
   */
  has(key: string): boolean {
    return this.searchParams.has(key);
  }

  /**
   * Get all query parameters as an object
   */
  getAllAsObject(): QueryParams {
    const params: QueryParams = {};
    
    this.searchParams.forEach((value, key) => {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value);
        } else {
          params[key] = [params[key] as string, value];
        }
      } else {
        params[key] = value;
      }
    });

    return params;
  }

  /**
   * Convert to URL search string
   */
  toString(): string {
    return this.searchParams.toString();
  }

  /**
   * Convert to full URL with base path
   */
  toUrl(basePath: string): string {
    const queryString = this.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  /**
   * Update browser URL with current parameters
   */
  updateUrl(basePath?: string, replace: boolean = true): void {
    const path = basePath || window.location.pathname;
    const queryString = this.toString();
    const newUrl = queryString ? `${path}?${queryString}` : path;

    if (replace) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }
  }
}

/**
 * Utilities for handling return navigation URLs
 */
export class ReturnNavigationHelper {
  /**
   * Encode return URL for safe inclusion in query parameters
   */
  static encodeReturnUrl(url: string): string {
    return encodeURIComponent(url);
  }

  /**
   * Decode return URL from query parameters
   */
  static decodeReturnUrl(encodedUrl: string): string {
    try {
      return decodeURIComponent(encodedUrl);
    } catch (error) {
      console.warn('Failed to decode return URL:', encodedUrl);
      return '/bookings'; // Fallback
    }
  }

  /**
   * Validate return URL for security
   */
  static validateReturnUrl(url: string): boolean {
    try {
      // Only allow relative URLs or same-origin URLs
      if (url.startsWith('/')) {
        return true;
      }

      const parsedUrl = new URL(url);
      return parsedUrl.origin === window.location.origin;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitize return URL
   */
  static sanitizeReturnUrl(url: string, fallback: string = '/bookings'): string {
    if (!url || !this.validateReturnUrl(url)) {
      return fallback;
    }

    // Remove any hash fragments for security
    try {
      const parsedUrl = new URL(url, window.location.origin);
      return parsedUrl.pathname + parsedUrl.search;
    } catch (error) {
      return fallback;
    }
  }

  /**
   * Build return URL with context
   */
  static buildReturnUrl(
    basePath: string,
    context: NavigationContext,
    fallback: string = '/bookings'
  ): string {
    const sanitizedBase = this.sanitizeReturnUrl(basePath, fallback);
    return NavigationQueryManager.buildUrlWithContext(sanitizedBase, context);
  }
}

/**
 * State preservation utilities for URL parameters
 */
export class StatePreservationUrlHelper {
  private static readonly STATE_KEY_PREFIX = 'nav_state_';

  /**
   * Save navigation state to URL parameters
   */
  static saveStateToUrl(
    stateKey: string,
    state: any,
    options: { replace?: boolean } = {}
  ): void {
    const manager = new QueryParameterManager();
    const encodedState = encodeURIComponent(JSON.stringify(state));
    
    manager.set(`${this.STATE_KEY_PREFIX}${stateKey}`, encodedState);
    manager.updateUrl(undefined, options.replace);
  }

  /**
   * Load navigation state from URL parameters
   */
  static loadStateFromUrl<T>(stateKey: string): T | null {
    const manager = new QueryParameterManager();
    const encodedState = manager.get(`${this.STATE_KEY_PREFIX}${stateKey}`);

    if (!encodedState) {
      return null;
    }

    try {
      const decodedState = decodeURIComponent(encodedState);
      return JSON.parse(decodedState) as T;
    } catch (error) {
      console.warn('Failed to parse state from URL:', error);
      return null;
    }
  }

  /**
   * Clear navigation state from URL parameters
   */
  static clearStateFromUrl(stateKey: string, options: { replace?: boolean } = {}): void {
    const manager = new QueryParameterManager();
    manager.delete(`${this.STATE_KEY_PREFIX}${stateKey}`);
    manager.updateUrl(undefined, options.replace);
  }

  /**
   * Clear all navigation state from URL parameters
   */
  static clearAllStateFromUrl(options: { replace?: boolean } = {}): void {
    const manager = new QueryParameterManager();
    const allParams = manager.getAll();

    Object.keys(allParams).forEach(key => {
      if (key.startsWith(this.STATE_KEY_PREFIX)) {
        manager.delete(key);
      }
    });

    manager.updateUrl(undefined, options.replace);
  }
}