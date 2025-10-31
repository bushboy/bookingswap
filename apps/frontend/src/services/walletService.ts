import { HederaWalletConnect } from '@hashgraph/hedera-wallet-connect';
import { WALLET_CONFIG } from '../config/wallet';

export interface WalletAccount {
  accountId: string;
  network: string;
}

export interface WalletConnection {
  isConnected: boolean;
  account: WalletAccount | null;
  balance?: string;
}

class WalletService {
  private walletConnect: HederaWalletConnect | null = null;
  private connection: WalletConnection = {
    isConnected: false,
    account: null,
  };

  async initialize(): Promise<void> {
    try {
      // For now, we'll create a mock implementation since the actual Hedera Wallet Connect
      // integration requires proper setup and configuration
      this.walletConnect = {
        init: async () => { },
        connect: async () => ({
          namespaces: {
            hedera: {
              accounts: [`hedera:${WALLET_CONFIG.NETWORK}:${WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT}`],
            },
          },
        }),
        disconnect: async () => { },
        signTransaction: async (bytes: Uint8Array) => bytes,
        signMessage: async (message: string) => message,
        onSessionUpdate: () => { },
        onSessionDelete: () => { },
      } as any;

      console.log('Wallet service initialized (mock mode)');
    } catch (error) {
      console.error('Failed to initialize wallet service:', error);
      throw error;
    }
  }

  async connect(): Promise<WalletConnection> {
    if (!this.walletConnect) {
      throw new Error('Wallet service not initialized');
    }

    try {
      const session = await this.walletConnect.connect();

      if (session && session.namespaces?.hedera?.accounts?.length > 0) {
        const accountString = session.namespaces.hedera.accounts[0];
        const [network, , accountId] = accountString.split(':');

        this.connection = {
          isConnected: true,
          account: {
            accountId,
            network,
          },
        };

        // Get account balance
        await this.updateBalance();

        return this.connection;
      } else {
        throw new Error('No accounts found in wallet session');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.walletConnect) {
      return;
    }

    try {
      await this.walletConnect.disconnect();
      this.connection = {
        isConnected: false,
        account: null,
      };
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }

  async updateBalance(): Promise<void> {
    if (!this.connection.account) {
      return;
    }

    try {
      // In a real implementation, you would query the Hedera Mirror Node API
      // For now, we'll simulate a balance
      this.connection.balance = '1,234.56 HBAR';
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  }

  async signTransaction(transactionBytes: Uint8Array): Promise<Uint8Array> {
    if (!this.walletConnect || !this.connection.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await this.walletConnect.signTransaction(transactionBytes);
      return result;
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.walletConnect || !this.connection.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await this.walletConnect.signMessage(message);
      return result;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }

  getConnection(): WalletConnection {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection.isConnected;
  }

  getAccountId(): string | null {
    return this.connection.account?.accountId || null;
  }

  onSessionUpdate(callback: (connection: WalletConnection) => void): void {
    if (!this.walletConnect) {
      return;
    }

    this.walletConnect.onSessionUpdate(() => {
      callback(this.connection);
    });
  }

  onSessionDelete(callback: () => void): void {
    if (!this.walletConnect) {
      return;
    }

    this.walletConnect.onSessionDelete(() => {
      this.connection = {
        isConnected: false,
        account: null,
      };
      callback();
    });
  }

  async checkSufficientBalance(requiredAmount: number): Promise<{
    isSufficient: boolean;
    currentBalance: number;
    shortfall?: number;
  }> {
    if (!this.connection.isConnected || !this.connection.account) {
      throw new Error('Wallet not connected');
    }

    // Parse current balance from the balance string
    const balanceString = this.connection.balance || '0 HBAR';
    const currentBalance = parseFloat(balanceString.replace(/[^\d.]/g, '')) || 0;

    const isSufficient = currentBalance >= requiredAmount;
    const shortfall = isSufficient ? undefined : requiredAmount - currentBalance;

    return {
      isSufficient,
      currentBalance,
      shortfall,
    };
  }
}

export const walletService = new WalletService();
