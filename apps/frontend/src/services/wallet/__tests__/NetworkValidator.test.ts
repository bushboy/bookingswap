import {
  NetworkValidator,
  NetworkConfig,
  defaultNetworkConfig,
} from '../NetworkValidator';
import { NetworkType, WalletErrorType } from '../../../types/wallet';

describe('NetworkValidator', () => {
  let validator: NetworkValidator;
  let mockConfig: NetworkConfig;

  beforeEach(() => {
    mockConfig = {
      expectedNetwork: 'testnet',
      allowAutoSwitch: false,
    };
    validator = new NetworkValidator(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const config = validator.getConfig();
      expect(config.expectedNetwork).toBe('testnet');
      expect(config.allowAutoSwitch).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      validator.updateConfig({
        expectedNetwork: 'mainnet',
        allowAutoSwitch: true,
      });

      const config = validator.getConfig();
      expect(config.expectedNetwork).toBe('mainnet');
      expect(config.allowAutoSwitch).toBe(true);
    });

    it('should emit configUpdated event', () => {
      const mockListener = jest.fn();
      validator.addEventListener('configUpdated', mockListener);

      const newConfig = { expectedNetwork: 'mainnet' as NetworkType };
      validator.updateConfig(newConfig);

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedNetwork: 'mainnet',
          allowAutoSwitch: false,
        })
      );
    });
  });

  describe('validateNetwork', () => {
    it('should return valid result when networks match', () => {
      const result = validator.validateNetwork('testnet');

      expect(result.isValid).toBe(true);
      expect(result.currentNetwork).toBe('testnet');
      expect(result.expectedNetwork).toBe('testnet');
      expect(result.error).toBeUndefined();
    });

    it('should return invalid result when networks do not match', () => {
      const result = validator.validateNetwork('mainnet');

      expect(result.isValid).toBe(false);
      expect(result.currentNetwork).toBe('mainnet');
      expect(result.expectedNetwork).toBe('testnet');
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe(WalletErrorType.WRONG_NETWORK);
    });

    it('should apply custom validation when provided', () => {
      const customValidator = new NetworkValidator({
        expectedNetwork: 'testnet',
        allowAutoSwitch: false,
        customValidation: network => network === 'mainnet', // Only allow mainnet
      });

      const testnetResult = customValidator.validateNetwork('testnet');
      const mainnetResult = customValidator.validateNetwork('mainnet');

      expect(testnetResult.isValid).toBe(false); // testnet expected but custom validation fails
      expect(mainnetResult.isValid).toBe(false); // mainnet passes custom but doesn't match expected
    });

    it('should emit networkValidated event', () => {
      const mockListener = jest.fn();
      validator.addEventListener('networkValidated', mockListener);

      const result = validator.validateNetwork('mainnet');

      expect(mockListener).toHaveBeenCalledWith(result);
    });

    it('should set canSwitch property correctly', () => {
      const validResult = validator.validateNetwork('testnet');
      const invalidResult = validator.validateNetwork('mainnet');

      expect(validResult.canSwitch).toBe(false); // Same network, no switch needed
      expect(invalidResult.canSwitch).toBe(true); // Different network, switch possible
    });

    it('should include suggested action for invalid networks', () => {
      const result = validator.validateNetwork('mainnet');

      expect(result.suggestedAction).toBeDefined();
      expect(result.suggestedAction).toContain('Hedera Testnet');
    });
  });

  describe('canSwitchNetwork', () => {
    it('should return true for different networks', () => {
      expect(validator.canSwitchNetwork('mainnet', 'testnet')).toBe(true);
      expect(validator.canSwitchNetwork('testnet', 'mainnet')).toBe(true);
    });

    it('should return false for same networks', () => {
      expect(validator.canSwitchNetwork('mainnet', 'mainnet')).toBe(false);
      expect(validator.canSwitchNetwork('testnet', 'testnet')).toBe(false);
    });
  });

  describe('createSwitchRequest', () => {
    it('should create switch request with correct properties', () => {
      const request = validator.createSwitchRequest(
        'mainnet',
        'hashpack',
        true
      );

      expect(request.targetNetwork).toBe('mainnet');
      expect(request.providerId).toBe('hashpack');
      expect(request.isAutomatic).toBe(true);
    });

    it('should default isAutomatic to false', () => {
      const request = validator.createSwitchRequest('mainnet', 'hashpack');

      expect(request.isAutomatic).toBe(false);
    });
  });

  describe('validateSwitchRequest', () => {
    it('should validate valid switch request', () => {
      const request = validator.createSwitchRequest('mainnet', 'hashpack');
      const result = validator.validateSwitchRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid target network', () => {
      const request = {
        targetNetwork: 'invalid' as NetworkType,
        providerId: 'hashpack',
        isAutomatic: false,
      };
      const result = validator.validateSwitchRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error?.type).toBe(WalletErrorType.WRONG_NETWORK);
    });

    it('should reject invalid provider ID', () => {
      const request = {
        targetNetwork: 'mainnet' as NetworkType,
        providerId: '',
        isAutomatic: false,
      };
      const result = validator.validateSwitchRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error?.type).toBe(WalletErrorType.PROVIDER_NOT_FOUND);
    });
  });

  describe('getNetworkDisplayName', () => {
    it('should return correct display names', () => {
      expect(validator.getNetworkDisplayName('mainnet')).toBe('Hedera Mainnet');
      expect(validator.getNetworkDisplayName('testnet')).toBe('Hedera Testnet');
    });

    it('should handle unknown networks', () => {
      const result = validator.getNetworkDisplayName('unknown' as NetworkType);
      expect(result).toContain('Unknown Network');
      expect(result).toContain('unknown');
    });
  });

  describe('getNetworkGuidance', () => {
    it('should provide guidance for network mismatch', () => {
      const guidance = validator.getNetworkGuidance('mainnet', 'testnet');

      expect(guidance.title).toBe('Wrong Network Detected');
      expect(guidance.message).toContain('Hedera Mainnet');
      expect(guidance.message).toContain('Hedera Testnet');
      expect(guidance.actions).toHaveLength(2);
      expect(guidance.actions[0].action).toBe('switch');
      expect(guidance.actions[1].action).toBe('cancel');
    });
  });

  describe('getProviderSwitchInstructions', () => {
    it('should provide HashPack-specific instructions', () => {
      const instructions = validator.getProviderSwitchInstructions(
        'hashpack',
        'mainnet'
      );

      expect(instructions.title).toContain('HashPack');
      expect(instructions.title).toContain('Hedera Mainnet');
      expect(instructions.steps.length).toBeGreaterThan(0);
      expect(instructions.notes).toBeDefined();
    });

    it('should provide Blade-specific instructions', () => {
      const instructions = validator.getProviderSwitchInstructions(
        'blade',
        'testnet'
      );

      expect(instructions.title).toContain('Blade');
      expect(instructions.title).toContain('Hedera Testnet');
      expect(instructions.steps.length).toBeGreaterThan(0);
      expect(instructions.notes).toBeDefined();
    });

    it('should provide generic instructions for unknown providers', () => {
      const instructions = validator.getProviderSwitchInstructions(
        'unknown',
        'mainnet'
      );

      expect(instructions.title).toContain('Hedera Mainnet');
      expect(instructions.steps.length).toBeGreaterThan(0);
      expect(instructions.notes).toBeDefined();
    });
  });

  describe('event handling', () => {
    it('should add and remove event listeners', () => {
      const mockListener = jest.fn();

      validator.addEventListener('test', mockListener);
      (validator as any).emit('test', 'data');
      expect(mockListener).toHaveBeenCalledWith('data');

      validator.removeEventListener('test', mockListener);
      (validator as any).emit('test', 'data2');
      expect(mockListener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle errors in event listeners gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      validator.addEventListener('test', errorListener);
      (validator as any).emit('test');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('defaultNetworkConfig', () => {
    it('should have correct default values', () => {
      expect(defaultNetworkConfig.expectedNetwork).toBe('testnet');
      expect(defaultNetworkConfig.allowAutoSwitch).toBe(false);
    });
  });
});
