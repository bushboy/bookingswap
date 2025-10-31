import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook for detecting and handling unsaved changes in forms
 * 
 * This hook provides comprehensive unsaved changes detection and handling
 * for booking edit and swap specification interfaces.
 * 
 * Requirements addressed:
 * - 6.5: Unsaved changes detection and user prompts
 * - 6.6: State preservation during navigation
 * - 6.4: Browser back/forward navigation handling
 */

export interface UnsavedChangesOptions {
  /**
   * Function to determine if there are unsaved changes
   */
  hasUnsavedChanges: () => boolean;
  
  /**
   * Function to save changes
   */
  onSave?: () => Promise<void> | void;
  
  /**
   * Function to discard changes
   */
  onDiscard?: () => void;
  
  /**
   * Custom message for unsaved changes prompt
   */
  message?: string;
  
  /**
   * Whether to show save option in confirmation dialog
   */
  allowSave?: boolean;
  
  /**
   * Whether to prevent navigation entirely (for critical forms)
   */
  preventNavigation?: boolean;
}

export interface UnsavedChangesState {
  /**
   * Whether there are currently unsaved changes
   */
  hasUnsavedChanges: boolean;
  
  /**
   * Whether a navigation attempt is in progress
   */
  isNavigating: boolean;
  
  /**
   * Whether changes are being saved
   */
  isSaving: boolean;
  
  /**
   * Last attempted navigation destination
   */
  pendingNavigation: string | null;
}

export interface UnsavedChangesActions {
  /**
   * Navigate with unsaved changes confirmation
   */
  navigateWithConfirmation: (destination: string, options?: { replace?: boolean }) => Promise<boolean>;
  
  /**
   * Discard changes and navigate immediately
   */
  discardAndNavigate: (destination: string, options?: { replace?: boolean }) => void;
  
  /**
   * Save changes and then navigate
   */
  saveAndNavigate: (destination: string, options?: { replace?: boolean }) => Promise<boolean>;
  
  /**
   * Mark changes as saved (clears unsaved state)
   */
  markAsSaved: () => void;
  
  /**
   * Reset unsaved changes state
   */
  reset: () => void;
  
  /**
   * Set up browser navigation protection
   */
  setupBrowserProtection: () => () => void;
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

export const useUnsavedChanges = (
  options: UnsavedChangesOptions
): UnsavedChangesState & UnsavedChangesActions => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  
  // Use refs to avoid stale closures in event handlers
  const optionsRef = useRef(options);
  optionsRef.current = options;
  
  const hasUnsavedChanges = options.hasUnsavedChanges();
  
  /**
   * Show confirmation dialog for unsaved changes
   */
  const showUnsavedChangesDialog = useCallback((destination: string): Promise<'save' | 'discard' | 'cancel'> => {
    return new Promise((resolve) => {
      const message = optionsRef.current.message || DEFAULT_MESSAGE;
      const allowSave = optionsRef.current.allowSave !== false;
      
      if (allowSave && optionsRef.current.onSave) {
        // Show three-option dialog: Save, Don't Save, Cancel
        const result = window.confirm(
          `${message}\n\nClick OK to save changes and continue, or Cancel to stay on this page.`
        );
        
        if (result) {
          resolve('save');
        } else {
          // Show second dialog for discard option
          const discardResult = window.confirm(
            'Do you want to discard your changes and continue anyway?'
          );
          resolve(discardResult ? 'discard' : 'cancel');
        }
      } else {
        // Show simple confirm/cancel dialog
        const result = window.confirm(message);
        resolve(result ? 'discard' : 'cancel');
      }
    });
  }, []);
  
  /**
   * Navigate with unsaved changes confirmation
   */
  const navigateWithConfirmation = useCallback(async (
    destination: string,
    options: { replace?: boolean } = {}
  ): Promise<boolean> => {
    if (!optionsRef.current.hasUnsavedChanges()) {
      navigate(destination, options);
      return true;
    }
    
    if (optionsRef.current.preventNavigation) {
      return false;
    }
    
    setIsNavigating(true);
    setPendingNavigation(destination);
    
    try {
      const action = await showUnsavedChangesDialog(destination);
      
      switch (action) {
        case 'save':
          if (optionsRef.current.onSave) {
            setIsSaving(true);
            try {
              await optionsRef.current.onSave();
              navigate(destination, options);
              return true;
            } catch (error) {
              console.error('Failed to save changes:', error);
              alert('Failed to save changes. Please try again.');
              return false;
            } finally {
              setIsSaving(false);
            }
          }
          break;
          
        case 'discard':
          if (optionsRef.current.onDiscard) {
            optionsRef.current.onDiscard();
          }
          navigate(destination, options);
          return true;
          
        case 'cancel':
        default:
          return false;
      }
    } finally {
      setIsNavigating(false);
      setPendingNavigation(null);
    }
    
    return false;
  }, [navigate, showUnsavedChangesDialog]);
  
  /**
   * Discard changes and navigate immediately
   */
  const discardAndNavigate = useCallback((
    destination: string,
    options: { replace?: boolean } = {}
  ) => {
    if (optionsRef.current.onDiscard) {
      optionsRef.current.onDiscard();
    }
    navigate(destination, options);
  }, [navigate]);
  
  /**
   * Save changes and then navigate
   */
  const saveAndNavigate = useCallback(async (
    destination: string,
    options: { replace?: boolean } = {}
  ): Promise<boolean> => {
    if (!optionsRef.current.onSave) {
      navigate(destination, options);
      return true;
    }
    
    setIsSaving(true);
    try {
      await optionsRef.current.onSave();
      navigate(destination, options);
      return true;
    } catch (error) {
      console.error('Failed to save changes:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [navigate]);
  
  /**
   * Mark changes as saved
   */
  const markAsSaved = useCallback(() => {
    // This is handled by the parent component updating hasUnsavedChanges
    // We just reset navigation state
    setIsNavigating(false);
    setPendingNavigation(null);
  }, []);
  
  /**
   * Reset unsaved changes state
   */
  const reset = useCallback(() => {
    setIsNavigating(false);
    setIsSaving(false);
    setPendingNavigation(null);
  }, []);
  
  /**
   * Set up browser navigation protection
   */
  const setupBrowserProtection = useCallback((): (() => void) => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (optionsRef.current.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = optionsRef.current.message || DEFAULT_MESSAGE;
        return event.returnValue;
      }
    };
    
    const handlePopState = (event: PopStateEvent) => {
      if (optionsRef.current.hasUnsavedChanges()) {
        // Prevent the navigation
        window.history.pushState(null, '', window.location.href);
        
        // Show confirmation dialog
        showUnsavedChangesDialog(document.referrer || '/bookings').then((action) => {
          if (action === 'save' && optionsRef.current.onSave) {
            optionsRef.current.onSave().then(() => {
              window.history.back();
            }).catch((error) => {
              console.error('Failed to save changes:', error);
            });
          } else if (action === 'discard') {
            if (optionsRef.current.onDiscard) {
              optionsRef.current.onDiscard();
            }
            window.history.back();
          }
          // If 'cancel', do nothing - stay on current page
        });
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showUnsavedChangesDialog]);
  
  // Set up browser protection automatically
  useEffect(() => {
    const cleanup = setupBrowserProtection();
    return cleanup;
  }, [setupBrowserProtection]);
  
  return {
    // State
    hasUnsavedChanges,
    isNavigating,
    isSaving,
    pendingNavigation,
    
    // Actions
    navigateWithConfirmation,
    discardAndNavigate,
    saveAndNavigate,
    markAsSaved,
    reset,
    setupBrowserProtection,
  };
};

/**
 * Hook for preserving form state during navigation
 * 
 * This hook saves form state to sessionStorage and restores it
 * when navigating between booking edit and swap specification.
 */
export interface StatePreservationOptions<T> {
  /**
   * Unique key for storing state
   */
  storageKey: string;
  
  /**
   * Current form data
   */
  data: T;
  
  /**
   * Function to restore state
   */
  onRestore: (data: T) => void;
  
  /**
   * Whether to automatically save state on changes
   */
  autoSave?: boolean;
  
  /**
   * Custom serialization function
   */
  serialize?: (data: T) => string;
  
  /**
   * Custom deserialization function
   */
  deserialize?: (data: string) => T;
}

export const useStatePreservation = <T>(
  options: StatePreservationOptions<T>
) => {
  const { storageKey, data, onRestore, autoSave = true, serialize, deserialize } = options;
  
  /**
   * Save current state to storage
   */
  const saveState = useCallback(() => {
    try {
      const serializedData = serialize ? serialize(data) : JSON.stringify(data);
      sessionStorage.setItem(storageKey, serializedData);
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }, [storageKey, data, serialize]);
  
  /**
   * Restore state from storage
   */
  const restoreState = useCallback(() => {
    try {
      const savedData = sessionStorage.getItem(storageKey);
      if (savedData) {
        const parsedData = deserialize ? deserialize(savedData) : JSON.parse(savedData);
        onRestore(parsedData);
        return true;
      }
    } catch (error) {
      console.error('Failed to restore state:', error);
    }
    return false;
  }, [storageKey, onRestore, deserialize]);
  
  /**
   * Clear saved state
   */
  const clearState = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear state:', error);
    }
  }, [storageKey]);
  
  /**
   * Check if saved state exists
   */
  const hasSavedState = useCallback(() => {
    return sessionStorage.getItem(storageKey) !== null;
  }, [storageKey]);
  
  // Auto-save state when data changes
  useEffect(() => {
    if (autoSave) {
      saveState();
    }
  }, [data, autoSave, saveState]);
  
  // Restore state on mount
  useEffect(() => {
    restoreState();
  }, [restoreState]);
  
  return {
    saveState,
    restoreState,
    clearState,
    hasSavedState,
  };
};