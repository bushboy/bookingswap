import { Page } from '@playwright/test';
import { mockHederaResponses, testUsers, testBookings } from './test-data';
import {
  WALLET_CONFIG,
  createMockWalletResponse,
  createMockAccountInfo,
  createMockWalletWithPrivateKey,
  createMockTransactionId
} from '../../fixtures/wallet-config';

export class MockServices {
  constructor(private page: Page) {
    // Page is used in methods below
  }

  async mockHederaService() {
    await this.page.route('**/api/blockchain/**', async route => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'POST' && url.includes('/submit-transaction')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockHederaResponses.submitTransaction),
        });
      } else if (method === 'GET' && url.includes('/query-transaction')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockHederaResponses.queryTransaction),
        });
      } else {
        await route.continue();
      }
    });
  }

  async mockBookingProviderAPIs() {
    // Mock Booking.com API
    await this.page.route('**/api/external/booking-com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          booking: {
            confirmationNumber: 'BK123456789',
            status: 'confirmed',
            details: testBookings.hotelBooking,
          },
        }),
      });
    });

    // Mock Ticketmaster API
    await this.page.route('**/api/external/ticketmaster/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          booking: {
            confirmationNumber: 'TM987654321',
            status: 'confirmed',
            details: testBookings.eventBooking,
          },
        }),
      });
    });
  }

  async mockNotificationServices() {
    await this.page.route('**/api/notifications/**', async route => {
      const method = route.request().method();

      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, messageId: 'msg-123' }),
        });
      } else {
        await route.continue();
      }
    });
  }

  async mockWalletConnection() {
    // Mock Hedera Wallet Connect using centralized configuration
    await this.page.addInitScript((walletConfig) => {
      // @ts-ignore
      window.hederaWallet = {
        connect: async () => ({
          accountId: walletConfig.PRIMARY_TESTNET_ACCOUNT,
          publicKey: 'mock-public-key',
        }),
        signTransaction: async (transaction: any) => ({
          signature: 'mock-signature',
          transactionId: walletConfig.TRANSACTION_ID_PREFIX + Date.now() + '.123456789',
        }),
        disconnect: async () => { },
        isConnected: () => true,
      };

      // Mock HashPack wallet
      // @ts-ignore
      window.hashpack = {
        isAvailable: true,
        connect: async () => ({
          accountIds: [walletConfig.PRIMARY_TESTNET_ACCOUNT],
          network: walletConfig.NETWORK,
        }),
        getAccountInfo: async () => ({
          accountId: walletConfig.PRIMARY_TESTNET_ACCOUNT,
          balance: { hbars: walletConfig.DEFAULT_BALANCE },
        }),
        signTransaction: async (transaction: any) => ({
          signature: 'mock-signature',
          transactionId: walletConfig.TRANSACTION_ID_PREFIX + Date.now() + '.123456789',
        }),
        disconnect: async () => { },
      };

      // Mock Blade wallet
      // @ts-ignore
      window.bladeWallet = {
        isAvailable: true,
        connect: async () => ({
          accountIds: [walletConfig.PRIMARY_TESTNET_ACCOUNT],
          network: walletConfig.NETWORK,
        }),
        getAccountInfo: async () => ({
          accountId: walletConfig.PRIMARY_TESTNET_ACCOUNT,
          balance: { hbars: walletConfig.DEFAULT_BALANCE },
        }),
        signTransaction: async (transaction: any) => ({
          signature: 'mock-signature',
          transactionId: walletConfig.TRANSACTION_ID_PREFIX + Date.now() + '.123456789',
        }),
        disconnect: async () => { },
      };
    }, WALLET_CONFIG);
  }

  async setupTestDatabase() {
    // Mock database with test data
    await this.page.route('**/api/users/**', async route => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'GET' && url.includes('/profile')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(testUsers.alice),
        });
      } else {
        await route.continue();
      }
    });

    await this.page.route('**/api/bookings', async route => {
      const method = route.request().method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bookings: Object.values(testBookings),
            total: 2,
            page: 1,
            limit: 10,
          }),
        });
      } else if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            ...testBookings.hotelBooking,
            id: 'new-booking-' + Date.now(),
          }),
        });
      } else {
        await route.continue();
      }
    });
  }

  async setupAllMocks() {
    await this.mockHederaService();
    await this.mockBookingProviderAPIs();
    await this.mockNotificationServices();
    await this.mockWalletConnection();
    await this.setupTestDatabase();
  }
}
