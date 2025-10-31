import { PrivateKey, PublicKey, AccountId } from '@hashgraph/sdk';
import { logger } from '../../utils/logger';

export interface WalletConnection {
  accountId: string;
  publicKey: string;
  isConnected: boolean;
}

export interface SignatureVerification {
  isValid: boolean;
  accountId: string;
  message: string;
}

export class WalletService {
  /**
   * Verify a wallet signature for authentication
   */
  static verifySignature(
    message: string,
    signature: string,
    publicKeyString: string
  ): SignatureVerification {
    try {
      const publicKey = PublicKey.fromString(publicKeyString);
      const messageBytes = Buffer.from(message, 'utf8');
      const signatureBytes = Buffer.from(signature, 'hex');

      const isValid = publicKey.verify(messageBytes, signatureBytes);

      // Derive account ID from public key (simplified approach)
      const accountId = publicKey.toAccountId(0, 0).toString();

      logger.info('Signature verification completed', {
        isValid,
        accountId,
        publicKey: publicKeyString,
      });

      return {
        isValid,
        accountId,
        message,
      };
    } catch (error) {
      logger.error('Signature verification failed', { error, message, signature });
      return {
        isValid: false,
        accountId: '',
        message,
      };
    }
  }

  /**
   * Generate a challenge message for wallet authentication
   */
  static generateAuthChallenge(accountId: string, timestamp?: number): string {
    const ts = timestamp || Date.now();
    const challenge = `Authenticate with Booking Swap Platform\nAccount: ${accountId}\nTimestamp: ${ts}`;
    
    logger.info('Auth challenge generated', { accountId, timestamp: ts });
    
    return challenge;
  }

  /**
   * Validate account ID format
   */
  static isValidAccountId(accountId: string): boolean {
    try {
      AccountId.fromString(accountId);
      return true;
    } catch (error) {
      logger.warn('Invalid account ID format', { accountId, error: error.message });
      return false;
    }
  }

  /**
   * Validate public key format
   */
  static isValidPublicKey(publicKeyString: string): boolean {
    try {
      PublicKey.fromString(publicKeyString);
      return true;
    } catch (error) {
      logger.warn('Invalid public key format', { publicKey: publicKeyString, error: error.message });
      return false;
    }
  }

  /**
   * Create a wallet connection object
   */
  static createWalletConnection(
    accountId: string,
    publicKey: string,
    isConnected: boolean = true
  ): WalletConnection {
    if (!this.isValidAccountId(accountId)) {
      throw new Error('Invalid account ID format');
    }

    if (!this.isValidPublicKey(publicKey)) {
      throw new Error('Invalid public key format');
    }

    const connection: WalletConnection = {
      accountId,
      publicKey,
      isConnected,
    };

    logger.info('Wallet connection created', connection);

    return connection;
  }

  /**
   * Generate a private key for testing purposes (testnet only)
   */
  static generateTestPrivateKey(): { privateKey: string; publicKey: string; accountId: string } {
    const privateKey = PrivateKey.generate();
    const publicKey = privateKey.publicKey;
    const accountId = publicKey.toAccountId(0, 0).toString();

    logger.warn('Test private key generated - USE ONLY FOR TESTING', {
      accountId,
      publicKey: publicKey.toString(),
    });

    return {
      privateKey: privateKey.toString(),
      publicKey: publicKey.toString(),
      accountId,
    };
  }

  /**
   * Validate signature timestamp to prevent replay attacks
   */
  static isValidTimestamp(timestamp: number, maxAgeMinutes: number = 5): boolean {
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    const isValid = (now - timestamp) <= maxAge && timestamp <= now;

    if (!isValid) {
      logger.warn('Invalid timestamp detected', {
        timestamp,
        now,
        maxAgeMinutes,
        age: (now - timestamp) / 1000 / 60, // Age in minutes
      });
    }

    return isValid;
  }

  /**
   * Extract account ID from public key
   */
  static getAccountIdFromPublicKey(publicKeyString: string, shard: number = 0, realm: number = 0): string {
    try {
      const publicKey = PublicKey.fromString(publicKeyString);
      const accountId = publicKey.toAccountId(shard, realm);
      return accountId.toString();
    } catch (error) {
      logger.error('Failed to extract account ID from public key', { error, publicKey: publicKeyString });
      throw new Error(`Invalid public key: ${error.message}`);
    }
  }
}