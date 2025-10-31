import { renderHook, act } from '@testing-library/react';
import { useTouchGestures, usePullToRefresh } from '../useTouchGestures';

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  const event = new Event(type) as any;
  event.touches = touches;
  event.changedTouches = touches;
  return event;
};

describe('useTouchGestures', () => {
  let mockElement: HTMLElement;
  let mockOnSwipeLeft: jest.Mock;
  let mockOnSwipeRight: jest.Mock;
  let mockOnTap: jest.Mock;
  let mockOnLongPress: jest.Mock;

  beforeEach(() => {
    mockElement = document.createElement('div');
    mockOnSwipeLeft = jest.fn();
    mockOnSwipeRight = jest.fn();
    mockOnTap = jest.fn();
    mockOnLongPress = jest.fn();
    
    // Mock setTimeout and clearTimeout
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should detect swipe left gesture', () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onSwipeLeft: mockOnSwipeLeft,
        swipeThreshold: 50,
      })
    );

    act(() => {
      result.current.attachGestures(mockElement);
    });

    // Simulate swipe left
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchend', [{ clientX: 30, clientY: 100 }]));
    });

    expect(mockOnSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('should detect swipe right gesture', () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onSwipeRight: mockOnSwipeRight,
        swipeThreshold: 50,
      })
    );

    act(() => {
      result.current.attachGestures(mockElement);
    });

    // Simulate swipe right
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 30, clientY: 100 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]));
    });

    expect(mockOnSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('should detect tap gesture', () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onTap: mockOnTap,
      })
    );

    act(() => {
      result.current.attachGestures(mockElement);
    });

    // Simulate tap (quick touch with minimal movement)
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchend', [{ clientX: 102, clientY: 101 }]));
    });

    expect(mockOnTap).toHaveBeenCalledTimes(1);
  });

  it('should detect long press gesture', () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onLongPress: mockOnLongPress,
        longPressDelay: 500,
      })
    );

    act(() => {
      result.current.attachGestures(mockElement);
    });

    // Simulate long press
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    });

    // Fast-forward time to trigger long press
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockOnLongPress).toHaveBeenCalledTimes(1);
  });

  it('should cancel long press on touch move', () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onLongPress: mockOnLongPress,
        longPressDelay: 500,
      })
    );

    act(() => {
      result.current.attachGestures(mockElement);
    });

    // Start touch
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    });

    // Move finger (should cancel long press)
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 110, clientY: 100 }]));
    });

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockOnLongPress).not.toHaveBeenCalled();
  });

  it('should not trigger swipe if threshold not met', () => {
    const { result } = renderHook(() =>
      useTouchGestures({
        onSwipeLeft: mockOnSwipeLeft,
        swipeThreshold: 100,
      })
    );

    act(() => {
      result.current.attachGestures(mockElement);
    });

    // Simulate small movement (below threshold)
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchend', [{ clientX: 80, clientY: 100 }]));
    });

    expect(mockOnSwipeLeft).not.toHaveBeenCalled();
  });
});

describe('usePullToRefresh', () => {
  let mockOnRefresh: jest.Mock;
  let mockElement: HTMLElement;

  beforeEach(() => {
    mockOnRefresh = jest.fn().mockResolvedValue(undefined);
    mockElement = document.createElement('div');
    
    // Mock window.scrollY
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should trigger refresh when pull threshold is met', async () => {
    const { result } = renderHook(() =>
      usePullToRefresh(mockOnRefresh, 80)
    );

    act(() => {
      result.current.attachPullToRefresh(mockElement);
    });

    // Simulate pull down gesture
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 50 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 100, clientY: 150 }]));
    });

    await act(async () => {
      mockElement.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 150 }]));
    });

    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('should not trigger refresh when not at top of page', () => {
    // Set scroll position away from top
    Object.defineProperty(window, 'scrollY', {
      value: 100,
      writable: true,
    });

    const { result } = renderHook(() =>
      usePullToRefresh(mockOnRefresh, 80)
    );

    act(() => {
      result.current.attachPullToRefresh(mockElement);
    });

    // Simulate pull down gesture
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 50 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 100, clientY: 150 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 150 }]));
    });

    expect(mockOnRefresh).not.toHaveBeenCalled();
  });

  it('should not trigger refresh when pull threshold not met', () => {
    const { result } = renderHook(() =>
      usePullToRefresh(mockOnRefresh, 100)
    );

    act(() => {
      result.current.attachPullToRefresh(mockElement);
    });

    // Simulate small pull (below threshold)
    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 50 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]));
    });

    act(() => {
      mockElement.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 100 }]));
    });

    expect(mockOnRefresh).not.toHaveBeenCalled();
  });
});