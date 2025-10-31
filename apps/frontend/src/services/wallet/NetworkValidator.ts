import { NetworkType, WalletError, WalletErrorType } from '../../types/wallet';

/**
 * Configuration for network validation
 */
export interface NetworkConfig {
  /** The expected/required network for the application */
  expectedNetwork: NetworkType;
  /** Whether to allow automatic network switching */
  allowAutoSwitch: boolean;
  /** Custom network validation rules */
  customValidation?: (network: NetworkType) => boolean;
}

/**
 * Result of network validation
 */
export interface NetworkValidationResult {
  /** Whether the network is valid */
  isValid: boolean;
  /** The current network */
  currentNetwork: NetworkType;
  /** The expected network */
  expectedNetwork: NetworkType;
  /** Error details if validation failed */
  error?: WalletError;
  /** Whether switching is possible */
  canSwitch: boolean;
  /** Suggested action for the user */
  suggestedAction?: string;
}

/**
 * Network switching request
 */
export interface NetworkSwitchRequest {
  /** Target network to switch to */
  targetNetwork: NetworkType;
  /** Provider ID that should perform the switch */
  providerId: string;
  /** Whether this is an automatic switch */
  isAutomatic: boolean;
}

/**
 * Network validation and switching service
 * Handles network detection, validation, and switching prompts
 */
export class NetworkValidator {
  private config: NetworkConfig;
  private listeners: Map<string, Function[]> = new Map();

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  /**
   * Update network configuration
   */
  public updateConfig(config: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current network configuration
   */
  public getConfig(): NetworkConfig {
    return { ...this.config };
  }

  /**
   * Validate if the current network matches expected network
   */
  public validateNetwork(currentNetwork: NetworkType): NetworkValidationResult {
    const { expectedNetwork, customValidation } = this.config;

    // Check if networks match
    const networksMatch = currentNetwork === expectedNetwork;

    // Apply custom validation if provided
    const customValidationPassed = customValidation
      ? customValidation(currentNetwork)
      : true;

    const isValid = networksMatch && customValidationPassed;

    const result: NetworkValidationResult = {
      isValid,
      currentNetwork,
      expectedNetwork,
      canSwitch: this.canSwitchNetwork(currentNetwork, expectedNetwork),
    };

    if (!isValid) {
      result.error = this.createNetworkError(currentNetwork, expectedNetwork);
      result.suggestedAction = this.getSuggestedAction(
        currentNetwork,
        expectedNetwork
      );
    }

    // Emit validation event
    this.emit('networkValidated', result);

    return result;
  }

  /**
   * Check if network switching is possible between two networks
   */
  public canSwitchNetwork(from: NetworkType, to: NetworkType): boolean {
    // For Hedera, switching between mainnet and testnet is typically possible
    // but depends on wallet provider capabilities
    return from !== to;
  }

  /**
   * Create a network switch request
   */
  public createSwitchRequest(
    targetNetwork: NetworkType,
    providerId: string,
    isAutomatic: boolean = false
  ): NetworkSwitchRequest {
    return {
      targetNetwork,
      providerId,
      isAutomatic,
    };
  }

  /**
   * Validate a network switch request
   */
  public validateSwitchRequest(request: NetworkSwitchRequest): {
    isValid: boolean;
    error?: WalletError;
  } {
    const { targetNetwork, providerId } = request;

    // Validate target network
    if (!this.isValidNetwork(targetNetwork)) {
      return {
        isValid: false,
        error: {
          type: WalletErrorType.WRONG_NETWORK,
          message: `Invalid target network: ${targetNetwork}`,
          details: { targetNetwork, providerId },
        },
      };
    }

    // Validate provider ID
    if (!providerId || typeof providerId !== 'string') {
      return {
        isValid: false,
        error: {
          type: WalletErrorType.PROVIDER_NOT_FOUND,
          message: 'Invalid provider ID for network switch',
          details: { targetNetwork, providerId },
        },
      };
    }

    return { isValid: true };
  }

  /**
   * Get user-friendly network display name
   */
  public getNetworkDisplayName(network: NetworkType): string {
    switch (network) {
      case 'mainnet':
        return 'Hedera Mainnet';
      case 'testnet':
        return 'Hedera Testnet';
      default:
        return `Unknown Network (${network})`;
    }
  }

  /**
   * Get network-specific guidance for users
   */
  public getNetworkGuidance(
    currentNetwork: NetworkType,
    expectedNetwork: NetworkType
  ): {
    title: string;
    message: string;
    actions: Array<{
      label: string;
      type: 'primary' | 'secondary';
      action: string;
    }>;
  } {
    const currentName = this.getNetworkDisplayName(currentNetwork);
    const expectedName = this.getNetworkDisplayName(expectedNetwork);

    return {
      title: 'Wrong Network Detected',
      message: `Your wallet is connected to ${currentName}, but this application requires ${expectedName}. Please switch your wallet to the correct network.`,
      actions: [
        {
          label: `Switch to ${expectedName}`,
          type: 'primary',
          action: 'switch',
        },
        {
          label: 'Cancel',
          type: 'secondary',
          action: 'cancel',
        },
      ],
    };
  }

  /**
   * Get provider-specific network switching instructions
   */
  public getProviderSwitchInstructions(
    providerId: string,
    targetNetwork: NetworkType
  ): {
    title: string;
    steps: string[];
    notes?: string[];
  } {
    const targetName = this.getNetworkDisplayName(targetNetwork);

    switch (providerId.toLowerCase()) {
      case 'hashpack':
        return {
          title: `Switch HashPack to ${targetName}`,
          steps: [
            'Open your HashPack wallet extension',
            'Click on the network selector (usually at the top)',
            `Select "${targetName}" from the dropdown`,
            'Confirm the network switch',
            'Return to this application and try connecting again',
          ],
          notes: [
            'HashPack may require you to unlock your wallet before switching networks',
            'The network switch will affect all connected applications',
          ],
        };

      case 'blade':
        return {
          title: `Switch Blade to ${targetName}`,
          steps: [
            'Open your Blade wallet extension',
            'Navigate to Settings or Network section',
            `Select "${targetName}" as your active network`,
            'Save the changes',
            'Return to this application and try connecting again',
          ],
          notes: [
            'Blade wallet network switching may vary depending on the version',
            'Some Blade versions may require a wallet restart after network changes',
          ],
        };

      default:
        return {
          title: `Switch to ${targetName}`,
          steps: [
            'Open your wallet extension',
            'Look for network or settings options',
            `Switch to "${targetName}"`,
            'Return to this application and try connecting again',
          ],
          notes: [
            'Network switching steps may vary by wallet provider',
            "Consult your wallet's documentation for specific instructions",
          ],
        };
    }
  }

  /**
   * Check if a network type is valid
   */
  private isValidNetwork(network: NetworkType): boolean {
    return network === 'mainnet' || network === 'testnet';
  }

  /**
   * Create a network-related error
   */
  private createNetworkError(
    currentNetwork: NetworkType,
    expectedNetwork: NetworkType
  ): WalletError {
    const currentName = this.getNetworkDisplayName(currentNetwork);
    const expectedName = this.getNetworkDisplayName(expectedNetwork);

    return {
      type: WalletErrorType.WRONG_NETWORK,
      message: `Wrong network: connected to ${currentName}, expected ${expectedName}`,
      details: {
        currentNetwork,
        expectedNetwork,
        currentNetworkName: currentName,
        expectedNetworkName: expectedName,
      },
    };
  }

  /**
   * Get suggested action for network mismatch
   */
  private getSuggestedAction(
    currentNetwork: NetworkType,
    expectedNetwork: NetworkType
  ): string {
    const expectedName = this.getNetworkDisplayName(expectedNetwork);
    return `Please switch your wallet to ${expectedName} and try again.`;
  }

  /**
   * Add event listener
   */
  public addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(
            `Error in network validator event listener for ${event}:`,
            error
          );
        }
      });
    }
  }
}

// Default network configuration for the application
export const defaultNetworkConfig: NetworkConfig = {
  expectedNetwork: 'testnet', // Default to testnet for development
  allowAutoSwitch: false, // Require user confirmation for network switches
};

// Export singleton instance
export const networkValidator = new NetworkValidator(defaultNetworkConfig);
