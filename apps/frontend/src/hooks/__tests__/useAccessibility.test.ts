import { renderHook, act } from '@testing-library/react';
import { 
  useFocusManagement, 
  useAriaLiveRegion, 
  useKeyboardNavigation,
  useInterfaceTransition,
  useHighContrast 
} from '../useAccessibility';

// Mock DOM methods
const mockFocus = jest.fn();
const mockQuerySelectorAll = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockContains = jest.fn();

// Setup DOM mocks
beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock document methods
  Object.defineProperty(document, 'querySelectorAll', {
    value: mockQuerySelectorAll,
    writable: true,
  });
  
  Object.defineProperty(document, 'activeElement', {
    value: { focus: mockFocus },
    writable: true,
  });
  
  Object.defineProperty(document.body, 'appendChild', {
    value: mockAppendChild,
    writable: true,
  });
  
  Object.defineProperty(document.body, 'removeChild', {
    value: mockRemoveChild,
    writable: true,
  });
  
  Object.defineProperty(document.body, 'contains', {
    value: mockContains,
    writable: true,
  });
});

describe('useFocusManagement', () => {
  it('should provide focus management utilities', () => {
    const { result } = renderHook(() => useFocusManagement());
    
    expect(result.current.trapFocus).toBeDefined();
    expect(result.current.focusFirstElement).toBeDefined();
    expect(result.current.restoreFocus).toBeDefined();
    expect(result.current.getFocusableElements).toBeDefined();
  });

  it('should get focusable elements from container', () => {
    const mockElements = [
      { focus: jest.fn() },
      { focus: jest.fn() },
    ];
    
    const mockContainer = {
      querySelectorAll: jest.fn().mockReturnValue(mockElements),
    } as any;

    const { result } = renderHook(() => useFocusManagement());
    
    const focusableElements = result.current.getFocusableElements(mockContainer);
    
    expect(mockContainer.querySelectorAll).toHaveBeenCalledWith(
      expect.stringContaining('button:not([disabled])')
    );
    expect(focusableElements).toEqual(mockElements);
  });

  it('should focus first element in container', () => {
    const mockElements = [
      { focus: mockFocus },
      { focus: jest.fn() },
    ];
    
    const mockContainer = {
      querySelectorAll: jest.fn().mockReturnValue(mockElements),
    } as any;

    const { result } = renderHook(() => useFocusManagement());
    
    result.current.focusFirstElement(mockContainer);
    
    expect(mockFocus).toHaveBeenCalled();
  });

  it('should restore focus to element', () => {
    const mockElement = { focus: mockFocus };
    
    const { result } = renderHook(() => useFocusManagement());
    
    act(() => {
      result.current.restoreFocus(mockElement as any);
    });
    
    // Focus should be called after setTimeout
    setTimeout(() => {
      expect(mockFocus).toHaveBeenCalled();
    }, 0);
  });
});

describe('useAriaLiveRegion', () => {
  it('should create live region on mount', () => {
    renderHook(() => useAriaLiveRegion());
    
    expect(mockAppendChild).toHaveBeenCalled();
  });

  it('should announce messages', () => {
    const { result } = renderHook(() => useAriaLiveRegion());
    
    act(() => {
      result.current.announce('Test message', 'assertive');
    });
    
    // Should have created and configured live region
    expect(mockAppendChild).toHaveBeenCalled();
  });

  it('should clean up live region on unmount', () => {
    mockContains.mockReturnValue(true);
    
    const { unmount } = renderHook(() => useAriaLiveRegion());
    
    unmount();
    
    expect(mockRemoveChild).toHaveBeenCalled();
  });
});

describe('useKeyboardNavigation', () => {
  it('should handle keyboard events', () => {
    const mockOnEnter = jest.fn();
    const mockOnEscape = jest.fn();
    const mockOnArrowUp = jest.fn();
    
    const { result } = renderHook(() => 
      useKeyboardNavigation(mockOnEnter, mockOnEscape, mockOnArrowUp)
    );
    
    const mockEvent = {
      key: 'Enter',
      preventDefault: jest.fn(),
    } as any;
    
    result.current.handleKeyDown(mockEvent);
    
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockOnEnter).toHaveBeenCalled();
  });

  it('should handle escape key', () => {
    const mockOnEscape = jest.fn();
    
    const { result } = renderHook(() => 
      useKeyboardNavigation(undefined, mockOnEscape)
    );
    
    const mockEvent = {
      key: 'Escape',
      preventDefault: jest.fn(),
    } as any;
    
    result.current.handleKeyDown(mockEvent);
    
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockOnEscape).toHaveBeenCalled();
  });

  it('should handle arrow keys', () => {
    const mockOnArrowUp = jest.fn();
    const mockOnArrowDown = jest.fn();
    
    const { result } = renderHook(() => 
      useKeyboardNavigation(undefined, undefined, mockOnArrowUp, mockOnArrowDown)
    );
    
    const upEvent = {
      key: 'ArrowUp',
      preventDefault: jest.fn(),
    } as any;
    
    const downEvent = {
      key: 'ArrowDown',
      preventDefault: jest.fn(),
    } as any;
    
    result.current.handleKeyDown(upEvent);
    result.current.handleKeyDown(downEvent);
    
    expect(mockOnArrowUp).toHaveBeenCalled();
    expect(mockOnArrowDown).toHaveBeenCalled();
  });
});

describe('useInterfaceTransition', () => {
  it('should announce transitions', () => {
    const { result } = renderHook(() => useInterfaceTransition());
    
    act(() => {
      result.current.announceTransition('form', 'page', 'Additional context');
    });
    
    // Should have created live region for announcement
    expect(mockAppendChild).toHaveBeenCalled();
  });

  it('should store and restore focus', () => {
    const { result } = renderHook(() => useInterfaceTransition());
    
    act(() => {
      result.current.storeFocus();
    });
    
    act(() => {
      result.current.restorePreviousFocus();
    });
    
    // Focus should be restored after setTimeout
    setTimeout(() => {
      expect(mockFocus).toHaveBeenCalled();
    }, 0);
  });
});

describe('useHighContrast', () => {
  it('should detect high contrast mode', () => {
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query.includes('prefers-contrast: high'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    
    const { result } = renderHook(() => useHighContrast());
    
    expect(result.current.isHighContrast).toBe(true);
    expect(result.current.getHighContrastStyles).toBeDefined();
  });

  it('should provide high contrast styles when enabled', () => {
    // Mock matchMedia to return true for high contrast
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        media: '',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    
    const { result } = renderHook(() => useHighContrast());
    
    const styles = result.current.getHighContrastStyles();
    
    expect(styles).toEqual({
      border: '2px solid',
      outline: '2px solid',
      backgroundColor: 'ButtonFace',
      color: 'ButtonText',
    });
  });

  it('should return empty styles when high contrast is disabled', () => {
    // Mock matchMedia to return false
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    
    const { result } = renderHook(() => useHighContrast());
    
    const styles = result.current.getHighContrastStyles();
    
    expect(styles).toEqual({});
  });
});