import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { NetworkType } from '../types/wallet';
import {
  NetworkValidator,
  NetworkValidationResult,
  NetworkSwitchRequest,
} from '../services/wallet/NetworkValidator';
import { walletService } from '../services/wallet/WalletService';

interface UseNetworkValidationReturn {
  /** Current network validation result */
  validation: NetworkValidationResult | null;
  /** Whether network validation is in progress */
  isValidating: boolean;
  /** Whether a network switch is in progress */
  isSwitching: boolean;
  /** Whether the network switch modal should be shown */
  showSwitchModal: boolean;
  /** Network validator instance */
  networkValidator: NetworkValidator;
  /** Validate the current network */
  validateNetwork: () => void;
  /** Request a network switch */
  requestNetworkSwitch: (targetNetwork: NetworkType) => Promise<void>;
  /** Show the network switch modal */
  showNetworkSwitchModal: () => void;
  /** Hide the network switch modal */
  hideNetworkSwitchModal: () => void;
  /** Handle network switch confirmation */
  handleSwitchConfirm: (request: NetworkSwitchRequest) => Promise<void>;
  /** Set expected network */
  setExpectedNetwork: (network: NetworkType) => void;
  /** Get expected network */
  getExpectedNetwork: () => NetworkType;
}

/**
 * Hook for managing network validation and switching
 */
export const useNetworkValidation = (): UseNetworkValidationReturn => {
  const [validation, setValidation] = useState<NetworkValidationResult | null>(
    null
  );
  const [isValidating, setIsValidating] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  // Get wallet state from Redux
  const { isConnected, accountInfo, currentProvider } = useSelector(
    (state: RootState) => state.wallet
  );

  // Get network validator instance
  const networkValidator = walletService.getNetworkValidator();

  /**
   * Validate the current network
   */
  const validateNetwork = useCallback(() => {
    if (!isConnected || !accountInfo) {
      setValidation(null);
      return;
    }

    setIsValidating(true);
    try {
      const result = networkValidator.validateNetwork(accountInfo.network);
      setValidation(result);
    } catch (error) {
      console.error('Error validating network:', error);
      setValidation(null);
    } finally {
      setIsValidating(false);
    }
  }, [isConnected, accountInfo, networkValidator]);

  /**
   * Request a network switch
   */
  const requestNetworkSwitch = useCallback(
    async (targetNetwork: NetworkType) => {
      if (!currentProvider) {
        throw new Error('No wallet provider connected');
      }

      setIsSwitching(true);
      try {
        await walletService.requestNetworkSwitch(targetNetwork);
      } catch (error) {
        // The service will throw an error with instructions for manual switching
        // This is expected behavior for now
        throw error;
      } finally {
        setIsSwitching(false);
      }
    },
    [currentProvider]
  );

  /**
   * Show the network switch modal
   */
  const showNetworkSwitchModal = useCallback(() => {
    setShowSwitchModal(true);
  }, []);

  /**
   * Hide the network switch modal
   */
  const hideNetworkSwitchModal = useCallback(() => {
    setShowSwitchModal(false);
  }, []);

  /**
   * Handle network switch confirmation from modal
   */
  const handleSwitchConfirm = useCallback(
    async (request: NetworkSwitchRequest) => {
      setIsSwitching(true);
      try {
        // For now, we'll just show instructions since automatic switching isn't implemented
        // In a real implementation, this would attempt to switch the network
        await requestNetworkSwitch(request.targetNetwork);
      } catch (error) {
        // Re-throw to let the modal handle the error display
        throw error;
      } finally {
        setIsSwitching(false);
      }
    },
    [requestNetworkSwitch]
  );

  /**
   * Set expected network
   */
  const setExpectedNetwork = useCallback(
    (network: NetworkType) => {
      walletService.setExpectedNetwork(network);
      // Re-validate after changing expected network
      validateNetwork();
    },
    [validateNetwork]
  );

  /**
   * Get expected network
   */
  const getExpectedNetwork = useCallback(() => {
    return walletService.getExpectedNetwork();
  }, []);

  // Validate network when wallet state changes
  useEffect(() => {
    validateNetwork();
  }, [validateNetwork]);

  // Listen for network validation events from wallet service
  useEffect(() => {
    const handleNetworkValidated = (result: NetworkValidationResult) => {
      setValidation(result);
    };

    const handleNetworkValidationFailed = (event: any) => {
      setValidation(event.validation);
      // Automatically show switch modal for network validation failures
      if (!event.validation.isValid) {
        setShowSwitchModal(true);
      }
    };

    const handleNetworkChanged = (event: any) => {
      // Re-validate when network changes
      validateNetwork();
    };

    // Add event listeners
    walletService.addEventListener('networkValidated', handleNetworkValidated);
    walletService.addEventListener(
      'networkValidationFailed',
      handleNetworkValidationFailed
    );
    walletService.addEventListener('networkChanged', handleNetworkChanged);

    // Cleanup
    return () => {
      walletService.removeEventListener(
        'networkValidated',
        handleNetworkValidated
      );
      walletService.removeEventListener(
        'networkValidationFailed',
        handleNetworkValidationFailed
      );
      walletService.removeEventListener('networkChanged', handleNetworkChanged);
    };
  }, [validateNetwork]);

  return {
    validation,
    isValidating,
    isSwitching,
    showSwitchModal,
    networkValidator,
    validateNetwork,
    requestNetworkSwitch,
    showNetworkSwitchModal,
    hideNetworkSwitchModal,
    handleSwitchConfirm,
    setExpectedNetwork,
    getExpectedNetwork,
  };
};
