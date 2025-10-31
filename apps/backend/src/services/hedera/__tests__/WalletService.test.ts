import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from '../WalletService';
import { PrivateKey, PublicKey, AccountId } from '@hashgraph/sdk';

// Mock the Hedera SDK
vi.mock('@hashgraph/sdk', () => ({
  PrivateKey: {
    generate: vi.fn(),
    fromString: vi.fn(),
  },
  PublicKey: {
    fromString: vi.fn(),
  },
  AccountId: {
    fromString: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('WalletService', () => {
  let mockPublicKey: any;
  let mockPrivateKey: any;
  let mockAccountId: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock public key
    mockPublicKey = {
      verify: vi.fn(),
      toAccountId: vi.fn(),
      toString: () => 'mock-public-key',
    };

    // Setup mock private key
    mockPrivateKey = {
      publicKey: mockPublicKey,
      toString: () => 'mock-private-key',
    };

    // Setup mock account ID
    mockAccountId = {
      toString: () => '0.0.123456',
    };

    (PublicKey.fromString as any).mockReturnValue(mockPublicKey);
    (PrivateKey.fromString as any).mockReturnValue(mockPrivateKey);
    (PrivateKey.generate as any).mockReturnValue(mockPrivateKey);
    (AccountId.fromString as any).mockReturnValue(mockAccountId);
    mockPublicKey.toAccountId.mockReturnValue(mockAccountId);
  });

  describe('verifySignature', () => {
    it('should verify valid signature successfully', () => {
      const message = 'test message';
      const signature = 'valid-signature-hex';
      const publicKeyString = 'valid-public-key';

      mockPublicKey.verify.mockReturnValue(true);

      const result = WalletService.verifySignature(message, signature, publicKeyString);

      expect(result).toEqual({
        isValid: true,
        accountId: '0.0.123456',
        message,
      });

      expect(PublicKey.fromString).toHaveBeenCalledWith(publicKeyString);
      expect(mockPublicKey.verify).toHaveBeenCalled();
    });

    it('should return false for invalid signature', () => {
      const message = 'test message';
      const signature = 'invalid-signature-hex';
      const publicKeyString = 'valid-public-key';

      mockPublicKey.verify.mockReturnValue(false);

      const result = WalletService.verifySignature(message, signature, publicKeyString);

      expect(result).toEqual({
        isValid: false,
        accountId: '0.0.123456',
        message,
      });
    });

    it('should handle verification errors gracefully', () => {
      const message = 'test message';
      const signature = 'invalid-signature-hex';
      const publicKeyString = 'invalid-public-key';

      (PublicKey.fromString as any).mockImplementation(() => {
        throw new Error('Invalid public key format');
      });

      const result = WalletService.verifySignature(message, signature, publicKeyString);

      expect(result).toEqual({
        isValid: false,
        accountId: '',
        message,
      });
    });
  });

  describe('generateAuthChallenge', () => {
    it('should generate auth challenge with current timestamp', () => {
      const accountId = '0.0.123456';
      const mockTimestamp = 1234567890000;
      
      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const challenge = WalletService.generateAuthChallenge(accountId);

      expect(challenge).toBe(
        `Authenticate with Booking Swap Platform\nAccount: ${accountId}\nTimestamp: ${mockTimestamp}`
      );
    });

    it('should generate auth challenge with provided timestamp', () => {
      const accountId = '0.0.123456';
      const timestamp = 1234567890000;

      const challenge = WalletService.generateAuthChallenge(accountId, timestamp);

      expect(challenge).toBe(
        `Authenticate with Booking Swap Platform\nAccount: ${accountId}\nTimestamp: ${timestamp}`
      );
    });
  });

  describe('isValidAccountId', () => {
    it('should return true for valid account ID', () => {
      const accountId = '0.0.123456';

      const result = WalletService.isValidAccountId(accountId);

      expect(result).toBe(true);
      expect(AccountId.fromString).toHaveBeenCalledWith(accountId);
    });

    it('should return false for invalid account ID', () => {
      const accountId = 'invalid-account-id';

      (AccountId.fromString as any).mockImplementation(() => {
        throw new Error('Invalid account ID format');
      });

      const result = WalletService.isValidAccountId(accountId);

      expect(result).toBe(false);
    });
  });

  describe('isValidPublicKey', () => {
    it('should return true for valid public key', () => {
      const publicKey = 'valid-public-key';

      const result = WalletService.isValidPublicKey(publicKey);

      expect(result).toBe(true);
      expect(PublicKey.fromString).toHaveBeenCalledWith(publicKey);
    });

    it('should return false for invalid public key', () => {
      const publicKey = 'invalid-public-key';

      (PublicKey.fromString as any).mockImplementation(() => {
        throw new Error('Invalid public key format');
      });

      const result = WalletService.isValidPublicKey(publicKey);

      expect(result).toBe(false);
    });
  });

  describe('createWalletConnection', () => {
    it('should create wallet connection successfully', () => {
      const accountId = '0.0.123456';
      const publicKey = 'valid-public-key';

      const connection = WalletService.createWalletConnection(accountId, publicKey);

      expect(connection).toEqual({
        accountId,
        publicKey,
        isConnected: true,
      });
    });

    it('should create wallet connection with custom connection status', () => {
      const accountId = '0.0.123456';
      const publicKey = 'valid-public-key';
      const isConnected = false;

      const connection = WalletService.createWalletConnection(accountId, publicKey, isConnected);

      expect(connection).toEqual({
        accountId,
        publicKey,
        isConnected,
      });
    });

    it('should throw error for invalid account ID', () => {
      const accountId = 'invalid-account-id';
      const publicKey = 'valid-public-key';

      (AccountId.fromString as any).mockImplementation(() => {
        throw new Error('Invalid account ID format');
      });

      expect(() => WalletService.createWalletConnection(accountId, publicKey))
        .toThrow('Invalid account ID format');
    });

    it('should throw error for invalid public key', () => {
      const accountId = '0.0.123456';
      const publicKey = 'invalid-public-key';

      (PublicKey.fromString as any).mockImplementation(() => {
        throw new Error('Invalid public key format');
      });

      expect(() => WalletService.createWalletConnection(accountId, publicKey))
        .toThrow('Invalid public key format');
    });
  });

  describe('generateTestPrivateKey', () => {
    it('should generate test private key successfully', () => {
      const result = WalletService.generateTestPrivateKey();

      expect(result).toEqual({
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
        accountId: '0.0.123456',
      });

      expect(PrivateKey.generate).toHaveBeenCalled();
    });
  });

  describe('isValidTimestamp', () => {
    it('should return true for recent timestamp', () => {
      const now = Date.now();
      const recentTimestamp = now - 60000; // 1 minute ago

      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = WalletService.isValidTimestamp(recentTimestamp);

      expect(result).toBe(true);
    });

    it('should return false for old timestamp', () => {
      const now = Date.now();
      const oldTimestamp = now - 600000; // 10 minutes ago

      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = WalletService.isValidTimestamp(oldTimestamp);

      expect(result).toBe(false);
    });

    it('should return false for future timestamp', () => {
      const now = Date.now();
      const futureTimestamp = now + 60000; // 1 minute in future

      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = WalletService.isValidTimestamp(futureTimestamp);

      expect(result).toBe(false);
    });

    it('should use custom max age', () => {
      const now = Date.now();
      const timestamp = now - 120000; // 2 minutes ago

      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Should be invalid with default 5 minute max age
      expect(WalletService.isValidTimestamp(timestamp)).toBe(true);

      // Should be invalid with 1 minute max age
      expect(WalletService.isValidTimestamp(timestamp, 1)).toBe(false);
    });
  });

  describe('getAccountIdFromPublicKey', () => {
    it('should extract account ID from public key', () => {
      const publicKeyString = 'valid-public-key';

      const result = WalletService.getAccountIdFromPublicKey(publicKeyString);

      expect(result).toBe('0.0.123456');
      expect(PublicKey.fromString).toHaveBeenCalledWith(publicKeyString);
      expect(mockPublicKey.toAccountId).toHaveBeenCalledWith(0, 0);
    });

    it('should use custom shard and realm', () => {
      const publicKeyString = 'valid-public-key';
      const shard = 1;
      const realm = 2;

      const result = WalletService.getAccountIdFromPublicKey(publicKeyString, shard, realm);

      expect(result).toBe('0.0.123456');
      expect(mockPublicKey.toAccountId).toHaveBeenCalledWith(shard, realm);
    });

    it('should throw error for invalid public key', () => {
      const publicKeyString = 'invalid-public-key';

      (PublicKey.fromString as any).mockImplementation(() => {
        throw new Error('Invalid public key format');
      });

      expect(() => WalletService.getAccountIdFromPublicKey(publicKeyString))
        .toThrow('Invalid public key: Invalid public key format');
    });
  });
});