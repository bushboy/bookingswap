import {
  debounce,
  throttle,
  optimizeImageForMobile,
  createIntersectionObserver,
  MobileMemoryManager,
  getViewportInfo,
  getSafeAreaInsets,
  getNetworkInfo,
  shouldLoadHighQualityContent,
} from '../mobilePerformance';

describe('mobilePerformance utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('should call immediately when immediate flag is true', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100, true);

      debouncedFn('arg1');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');

      jest.advanceTimersByTime(100);

      throttledFn('arg4');

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg4');
    });
  });

  describe('optimizeImageForMobile', () => {
    it('should add optimization parameters to image URL', () => {
      const originalUrl = 'https://example.com/image.jpg';
      const optimizedUrl = optimizeImageForMobile(originalUrl, {
        width: 400,
        height: 300,
        quality: 70,
        format: 'webp',
      });

      expect(optimizedUrl).toContain('w=400');
      expect(optimizedUrl).toContain('h=300');
      expect(optimizedUrl).toContain('q=70');
      expect(optimizedUrl).toContain('f=webp');
    });

    it('should return data URLs unchanged', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const result = optimizeImageForMobile(dataUrl);

      expect(result).toBe(dataUrl);
    });

    it('should return blob URLs unchanged', () => {
      const blobUrl = 'blob:https://example.com/12345678-1234-1234-1234-123456789012';
      const result = optimizeImageForMobile(blobUrl);

      expect(result).toBe(blobUrl);
    });
  });

  describe('createIntersectionObserver', () => {
    it('should create IntersectionObserver when supported', () => {
      const mockCallback = jest.fn();
      const mockObserver = {
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      };

      // Mock IntersectionObserver
      global.IntersectionObserver = jest.fn().mockImplementation(() => mockObserver);

      const observer = createIntersectionObserver(mockCallback);

      expect(observer).toBe(mockObserver);
      expect(global.IntersectionObserver).toHaveBeenCalledWith(
        mockCallback,
        expect.objectContaining({
          root: null,
          rootMargin: '50px',
          threshold: 0.1,
        })
      );
    });

    it('should return null when IntersectionObserver is not supported', () => {
      // Remove IntersectionObserver from global
      const originalIntersectionObserver = global.IntersectionObserver;
      delete (global as any).IntersectionObserver;

      const mockCallback = jest.fn();
      const observer = createIntersectionObserver(mockCallback);

      expect(observer).toBeNull();

      // Restore IntersectionObserver
      global.IntersectionObserver = originalIntersectionObserver;
    });
  });

  describe('MobileMemoryManager', () => {
    let memoryManager: MobileMemoryManager;

    beforeEach(() => {
      memoryManager = MobileMemoryManager.getInstance();
    });

    afterEach(() => {
      memoryManager.cleanup();
    });

    it('should be a singleton', () => {
      const instance1 = MobileMemoryManager.getInstance();
      const instance2 = MobileMemoryManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should register and call memory pressure observers', () => {
      const mockCallback = jest.fn();
      const cleanup = memoryManager.onMemoryPressure(mockCallback);

      // Simulate memory pressure by calling private method
      (memoryManager as any).notifyObservers();

      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Test cleanup
      cleanup();
      (memoryManager as any).notifyObservers();

      expect(mockCallback).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle visibility change events', () => {
      const mockCallback = jest.fn();
      memoryManager.onMemoryPressure(mockCallback);

      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
      });

      // Simulate visibility change
      const event = new Event('visibilitychange');
      document.dispatchEvent(event);

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getViewportInfo', () => {
    it('should return viewport information', () => {
      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, writable: true });

      const viewportInfo = getViewportInfo();

      expect(viewportInfo).toEqual({
        width: 375,
        height: 667,
        isPortrait: true,
        devicePixelRatio: 2,
      });
    });

    it('should detect landscape orientation', () => {
      Object.defineProperty(window, 'innerWidth', { value: 667, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 375, writable: true });

      const viewportInfo = getViewportInfo();

      expect(viewportInfo.isPortrait).toBe(false);
    });
  });

  describe('getSafeAreaInsets', () => {
    it('should return zero insets when CSS env() is not supported', () => {
      // Mock CSS.supports to return false
      global.CSS = {
        supports: jest.fn().mockReturnValue(false),
      } as any;

      const insets = getSafeAreaInsets();

      expect(insets).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      });
    });
  });

  describe('getNetworkInfo', () => {
    it('should return default values when connection API is not available', () => {
      const networkInfo = getNetworkInfo();

      expect(networkInfo).toEqual({
        effectiveType: '4g',
        downlink: 10,
        saveData: false,
      });
    });

    it('should return connection information when available', () => {
      // Mock navigator.connection
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '3g',
          downlink: 5,
          saveData: true,
        },
        writable: true,
      });

      const networkInfo = getNetworkInfo();

      expect(networkInfo).toEqual({
        effectiveType: '3g',
        downlink: 5,
        saveData: true,
      });
    });
  });

  describe('shouldLoadHighQualityContent', () => {
    it('should return false for slow networks', () => {
      // Mock slow network
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          saveData: false,
        },
        writable: true,
      });

      expect(shouldLoadHighQualityContent()).toBe(false);
    });

    it('should return false when save data is enabled', () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          saveData: true,
        },
        writable: true,
      });

      expect(shouldLoadHighQualityContent()).toBe(false);
    });

    it('should return true for fast networks without save data', () => {
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          saveData: false,
        },
        writable: true,
      });

      expect(shouldLoadHighQualityContent()).toBe(true);
    });
  });
});