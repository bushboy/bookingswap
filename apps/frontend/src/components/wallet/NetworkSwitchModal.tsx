import React, { useState } from 'react';
import { NetworkType } from '../../types/wallet';
import {
  NetworkValidator,
  NetworkSwitchRequest,
} from '../../services/wallet/NetworkValidator';

interface NetworkSwitchModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Current network the wallet is connected to */
  currentNetwork: NetworkType;
  /** Expected network for the application */
  expectedNetwork: NetworkType;
  /** Wallet provider ID */
  providerId: string;
  /** Network validator instance */
  networkValidator: NetworkValidator;
  /** Callback when user confirms network switch */
  onSwitchConfirm: (request: NetworkSwitchRequest) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when modal should close */
  onClose: () => void;
  /** Whether switching is in progress */
  isLoading?: boolean;
}

/**
 * Modal component for prompting users to switch networks
 * Displays network mismatch information and switching instructions
 */
export const NetworkSwitchModal: React.FC<NetworkSwitchModalProps> = ({
  isOpen,
  currentNetwork,
  expectedNetwork,
  providerId,
  networkValidator,
  onSwitchConfirm,
  onCancel,
  onClose,
  isLoading = false,
}) => {
  const [showInstructions, setShowInstructions] = useState(false);

  if (!isOpen) {
    return null;
  }

  const guidance = networkValidator.getNetworkGuidance(
    currentNetwork,
    expectedNetwork
  );
  const instructions = networkValidator.getProviderSwitchInstructions(
    providerId,
    expectedNetwork
  );

  const handleSwitchClick = () => {
    const switchRequest = networkValidator.createSwitchRequest(
      expectedNetwork,
      providerId,
      false
    );
    onSwitchConfirm(switchRequest);
  };

  const handleShowInstructions = () => {
    setShowInstructions(true);
  };

  const handleBackToMain = () => {
    setShowInstructions(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {showInstructions ? instructions.title : guidance.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!showInstructions ? (
            // Main network switch prompt
            <div className="space-y-4">
              {/* Network status */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-yellow-600 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Network Mismatch
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Current:{' '}
                        <span className="font-medium">
                          {networkValidator.getNetworkDisplayName(
                            currentNetwork
                          )}
                        </span>
                      </p>
                      <p>
                        Required:{' '}
                        <span className="font-medium">
                          {networkValidator.getNetworkDisplayName(
                            expectedNetwork
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message */}
              <p className="text-gray-600 text-sm leading-relaxed">
                {guidance.message}
              </p>

              {/* Action buttons */}
              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleSwitchClick}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Switching...</span>
                    </div>
                  ) : (
                    `Switch to ${networkValidator.getNetworkDisplayName(expectedNetwork)}`
                  )}
                </button>

                <button
                  onClick={handleShowInstructions}
                  disabled={isLoading}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Show Manual Instructions
                </button>

                <button
                  onClick={onCancel}
                  disabled={isLoading}
                  className="w-full text-gray-500 py-2 px-4 rounded-lg hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Manual instructions view
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={handleBackToMain}
                className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>

              {/* Instructions */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Steps to switch networks:
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                    {instructions.steps.map((step, index) => (
                      <li key={index} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {instructions.notes && instructions.notes.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">
                      Important Notes:
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                      {instructions.notes.map((note, index) => (
                        <li key={index} className="leading-relaxed">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action button */}
              <button
                onClick={onClose}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                I've Switched Networks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkSwitchModal;
