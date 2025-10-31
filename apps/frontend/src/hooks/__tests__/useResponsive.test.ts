import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsive } from '../useResponsive';

// Mock matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

describe('useResponsive', () => {
  const mockMediaQueryList = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia.mockReturnValue(mockMediaQueryList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default breakpoint state', () => {
    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isLargeDesktop).toBe(false);
  });

  it('should detect mobile breakpoint', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(max-width: 767px)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should detect tablet breakpoint', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(min-width: 768px) and (max-width: 1023px)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should detect large desktop breakpoint', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(min-width: 1440px)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isLargeDesktop).toBe(true);
    expect(result.current.isDesktop).toBe(true);
  });

  it('should provide current breakpoint name', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(max-width: 767px)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.currentBreakpoint).toBe('mobile');
  });

  it('should detect orientation', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(orientation: portrait)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
  });

  it('should detect touch capability', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(pointer: coarse)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isTouchDevice).toBe(true);
  });

  it('should update on media query changes', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;

    mockMatchMedia.mockImplementation(query => ({
      matches: query === '(max-width: 767px)',
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') {
          changeHandler = handler;
        }
      }),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);

    // Simulate media query change
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: false } as MediaQueryListEvent);
      }
    });

    expect(result.current.isMobile).toBe(false);
  });

  it('should provide responsive value selector', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(max-width: 767px)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    const responsiveValue = result.current.getResponsiveValue({
      mobile: 1,
      tablet: 2,
      desktop: 3,
      largeDesktop: 4,
    });

    expect(responsiveValue).toBe(1);
  });

  it('should handle missing responsive values', () => {
    mockMatchMedia.mockImplementation(query => {
      if (query === '(min-width: 1440px)') {
        return { ...mockMediaQueryList, matches: true };
      }
      return { ...mockMediaQueryList, matches: false };
    });

    const { result } = renderHook(() => useResponsive());

    const responsiveValue = result.current.getResponsiveValue({
      mobile: 1,
      desktop: 3,
    });

    // Should fall back to desktop value when largeDesktop is not defined
    expect(responsiveValue).toBe(3);
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListener = vi.fn();
    mockMatchMedia.mockReturnValue({
      ...mockMediaQueryList,
      removeEventListener,
    });

    const { unmount } = renderHook(() => useResponsive());

    unmount();

    expect(removeEventListener).toHaveBeenCalled();
  });

  it('should provide window dimensions', () => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });

    const { result } = renderHook(() => useResponsive());

    expect(result.current.windowSize.width).toBe(1024);
    expect(result.current.windowSize.height).toBe(768);
  });
});
