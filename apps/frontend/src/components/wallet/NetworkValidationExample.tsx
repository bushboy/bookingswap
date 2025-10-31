import React from 'react';
import { useNetworkValidation } from '../../hooks/useNetworkValidation';
import { NetworkSwitchModal } from './NetworkSwitchModal';

/**
 * Example component demonstrating network validation integration
 * This shows how to use the network validation hook and modal together
 */
export const NetworkValidationExample: React.FC = () => {
  const {
    validation,
    isValidating,
    isSwitching,
    showSwitchModal,
    networkValidator,
    validateNetwork,
    showNetworkSwitchModal,
    hideNetworkSwitchModal,
    handleSwitchConfirm,
    setExpectedNetwork,
    getExpectedNetwork,
  } = useNetworkValidation();

  const handleNetworkSwitchRequest = async (request: any) => {
    try {
      await handleSwitchConfirm(request);
      hideNetworkSwitchModal();
    } catch (error) {
      console.error('Network switch failed:', error);
      // In a real app, you might show an error message to the user
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Network Validation Example</h2>

      {/* Network Status Display */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Current Network Status</h3>
        {validation ? (
          <div className="space-y-2">
            <p>
              Current Network:{' '}
              {networkValidator.getNetworkDisplayName(
                validation.currentNetwork
              )}
            </p>
            <p>
              Expected Network:{' '}
              {networkValidator.getNetworkDisplayName(
                validation.expectedNetwork
              )}
            </p>
            <p
              className={`font-medium ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}
            >
              Status: {validation.isValid ? 'Valid' : 'Invalid'}
            </p>
            {!validation.isValid && validation.suggestedAction && (
              <p className="text-sm text-gray-600">
                {validation.suggestedAction}
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-500">
            No wallet connected or validation not available
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <button
          onClick={validateNetwork}
          disabled={isValidating}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isValidating ? 'Validating...' : 'Validate Network'}
        </button>

        <button
          onClick={() => setExpectedNetwork('mainnet')}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 ml-2"
        >
          Set Expected: Mainnet
        </button>

        <button
          onClick={() => setExpectedNetwork('testnet')}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 ml-2"
        >
          Set Expected: Testnet
        </button>

        {validation && !validation.isValid && (
          <button
            onClick={showNetworkSwitchModal}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 ml-2"
          >
            Show Network Switch Modal
          </button>
        )}
      </div>

      {/* Network Switch Modal */}
      {validation && !validation.isValid && (
        <NetworkSwitchModal
          isOpen={showSwitchModal}
          currentNetwork={validation.currentNetwork}
          expectedNetwork={validation.expectedNetwork}
          providerId="hashpack" // This would come from your wallet state
          networkValidator={networkValidator}
          onSwitchConfirm={handleNetworkSwitchRequest}
          onCancel={hideNetworkSwitchModal}
          onClose={hideNetworkSwitchModal}
          isLoading={isSwitching}
        />
      )}
    </div>
  );
};
