import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useUnsavedChanges, useStatePreservation } from '../useUnsavedChanges';

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/bookings', search: '' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock window methods
const mockConfirm = vi.fn();
const mockAlert = vi.fn();

Object.defineProperty(window, 'confirm', {
  writable: true,
  value: mockConfirm,
});

Object.defineProperty(window, 'alert', {
  writable: true,
  value: mockAlert,
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  writable: true,
  value: mockSessionStorage,
});

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  describe('basic functionality', () => {
    it('should detect unsaved changes', () => {
      let hasChanges = false;
      
      const { result, rerender } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => hasChanges,
        })
      );

      expect(result.current.hasUnsavedChanges).toBe(false);

      hasChanges = true;
      rerender();

      expect(result.current.hasUnsavedChanges).toBe(true);
    });

    it('should navigate without confirmation when no unsaved changes', async () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => false,
        })
      );

      const success = await act(async () => {
        return result.current.navigateWithConfirmation('/test');
      });

      expect(success).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith('/test', {});
      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it('should show confirmation dialog when there are unsaved changes', async () => {
      mockConfirm.mockReturnValue(false); // User cancels

      const { result } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => true,
        })
      );

      const success = await act(async () => {
        return result.current.navigateWithConfirmation('/test');
      });

      expect(success).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockConfirm).toHaveBeenCalled();
    });
  });

  describe('save functionality', () => {
    it('should save changes and navigate when user confirms', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);
      mockConfirm.mockReturnValue(true); // User confirms save

      const { result } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => true,
          onSave: mockSave,
        })
      );

      const success = await act(async () => {
        return result.current.navigateWithConfirmation('/test');
      });

      expect(success).toBe(true);
      expect(mockSave).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/test', {});
    });

    it('should handle save errors gracefully', async () => {
      const mockSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      mockConfirm.mockReturnValue(true); // User confirms save

      const { result } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => true,
          onSave: mockSave,
        })
      );

      const success = await act(async () => {
        return result.current.navigateWithConfirmation('/test');
      });

      expect(success).toBe(false);
      expect(mockSave).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith('Failed to save changes. Please try again.');
    });

    it('should use saveAndNavigate method directly', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => true,
          onSave: mockSave,
        })
      );

      const success = await act(async () => {
        return result.current.saveAndNavigate('/test');
      });

      expect(success).toBe(true);
      expect(mockSave).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/test', {});
    });
  });

  describe('discard functionality', () => {
    it('should discard changes and navigate', () => {
      const mockDiscard = vi.fn();

      const { result } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => true,
          onDiscard: mockDiscard,
        })
      );

      act(() => {
        result.current.discardAndNavigate('/test');
      });

      expect(mockDiscard).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/test', {});
    });
  });

  describe('browser navigation protection', () => {
    let mockAddEventListener: any;
    let mockRemoveEventListener: any;

    beforeEach(() => {
      mockAddEventListener = vi.spyOn(window, 'addEventListener');
      mockRemoveEventListener = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
      mockAddEventListener.mockRestore();
      mockRemoveEventListener.mockRestore();
    });

    it('should set up browser navigation protection', () => {
      const { result } = renderHook(() =>
        useUnsavedChanges({
          hasUnsavedChanges: () => true,
        })
      );

      const cleanup = result.current.setupBrowserProtection();

      expect(mockAddEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));

      cleanup();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    });
  });
});

describe('useStatePreservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save state to sessionStorage', () => {
    const testData = { field1: 'value1', field2: 'value2' };
    const mockOnRestore = vi.fn();

    renderHook(() =>
      useStatePreservation({
        storageKey: 'test-key',
        data: testData,
        onRestore: mockOnRestore,
        autoSave: true,
      })
    );

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify(testData)
    );
  });

  it('should restore state from sessionStorage', () => {
    const testData = { field1: 'value1', field2: 'value2' };
    const mockOnRestore = vi.fn();

    mockSessionStorage.getItem.mockReturnValue(JSON.stringify(testData));

    renderHook(() =>
      useStatePreservation({
        storageKey: 'test-key',
        data: {},
        onRestore: mockOnRestore,
      })
    );

    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('test-key');
    expect(mockOnRestore).toHaveBeenCalledWith(testData);
  });

  it('should clear state from sessionStorage', () => {
    const mockOnRestore = vi.fn();

    const { result } = renderHook(() =>
      useStatePreservation({
        storageKey: 'test-key',
        data: {},
        onRestore: mockOnRestore,
      })
    );

    act(() => {
      result.current.clearState();
    });

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('test-key');
  });

  it('should check if saved state exists', () => {
    const mockOnRestore = vi.fn();
    mockSessionStorage.getItem.mockReturnValue('{"test": "data"}');

    const { result } = renderHook(() =>
      useStatePreservation({
        storageKey: 'test-key',
        data: {},
        onRestore: mockOnRestore,
      })
    );

    expect(result.current.hasSavedState()).toBe(true);

    mockSessionStorage.getItem.mockReturnValue(null);
    expect(result.current.hasSavedState()).toBe(false);
  });

  it('should handle custom serialization', () => {
    const testData = { date: new Date('2023-01-01') };
    const mockSerialize = vi.fn().mockReturnValue('custom-serialized');
    const mockOnRestore = vi.fn();

    renderHook(() =>
      useStatePreservation({
        storageKey: 'test-key',
        data: testData,
        onRestore: mockOnRestore,
        serialize: mockSerialize,
        autoSave: true,
      })
    );

    expect(mockSerialize).toHaveBeenCalledWith(testData);
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('test-key', 'custom-serialized');
  });

  it('should handle custom deserialization', () => {
    const mockDeserialize = vi.fn().mockReturnValue({ restored: 'data' });
    const mockOnRestore = vi.fn();

    mockSessionStorage.getItem.mockReturnValue('custom-serialized');

    renderHook(() =>
      useStatePreservation({
        storageKey: 'test-key',
        data: {},
        onRestore: mockOnRestore,
        deserialize: mockDeserialize,
      })
    );

    expect(mockDeserialize).toHaveBeenCalledWith('custom-serialized');
    expect(mockOnRestore).toHaveBeenCalledWith({ restored: 'data' });
  });
});