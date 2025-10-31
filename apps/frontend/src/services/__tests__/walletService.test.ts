import { describe, it, expect, vi, beforeEach } from 'vitest';
import { walletService } from '../walletService';

// Mock the Hedera Wallet Connect
vi.mock('@hashgraph/hedera-wallet-connect', () => ({
  HederaWalletConnect: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue({
      namespaces: {
        hedera: {
          accounts: ['testnet:0:0.0.123456'],
        },
      },
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    signTransaction: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    signMessage: vi.fn().mockResolvedValue('signed_message'),
    onSessionUpdate: vi.fn(),
    onSessionDelete: vi.fn(),
  })),
}));

describe('WalletService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset wallet service state
    await walletService.disconnect();
  });

  it('initializes successfully', async () => {
    await expect(walletService.initialize()).resolves.not.toThrow();
  });

  it('connects to wallet successfully', async () => {
    await walletService.initialize();
    const connection = await walletService.connect();

    expect(connection.isConnected).toBe(true);
    expect(connection.account).toEqual({
      accountId: '0.0.123456',
      network: 'testnet',
    });
  });

  it('disconnects from wallet successfully', async () => {
    await walletService.initialize();
    await walletService.connect();
    await walletService.disconnect();

    const connection = walletService.getConnection();
    expect(connection.isConnected).toBe(false);
    expect(connection.account).toBe(null);
  });

  it('returns correct connection status', async () => {
    expect(walletService.isConnected()).toBe(false);

    await walletService.initialize();
    await walletService.connect();

    expect(walletService.isConnected()).toBe(true);
  });

  it('returns account ID when connected', async () => {
    await walletService.initialize();
    await walletService.connect();

    expect(walletService.getAccountId()).toBe('0.0.123456');
  });

  it('returns null account ID when not connected', () => {
    expect(walletService.getAccountId()).toBe(null);
  });

  it('signs transactions when connected', async () => {
    await walletService.initialize();
    await walletService.connect();

    const transactionBytes = new Uint8Array([1, 2, 3, 4]);
    const result = await walletService.signTransaction(transactionBytes);

    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('signs messages when connected', async () => {
    await walletService.initialize();
    await walletService.connect();

    const message = 'test message';
    const result = await walletService.signMessage(message);

    expect(result).toBe('signed_message');
  });

  it('throws error when signing without connection', async () => {
    // Ensure wallet is not connected
    await walletService.disconnect();

    await expect(
      walletService.signTransaction(new Uint8Array([1, 2, 3]))
    ).rejects.toThrow('Wallet not connected');

    await expect(walletService.signMessage('test')).rejects.toThrow(
      'Wallet not connected'
    );
  });
});
