import { test, expect } from '@playwright/test';
import { WALLET_CONFIG, createMockWalletResponse, createMockAccountInfo } from '../fixtures/wallet-config';

test.describe('Wallet Integration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user1',
            username: 'testuser',
            email: 'test@example.com',
            profile: {
              firstName: 'Test',
              lastName: 'User',
              verification: { status: 'verified' },
            },
          },
          token: 'mock-jwt-token',
        }),
      });
    });

    await page.goto('/');
  });

  test.describe('Wallet Connection User Journey', () => {
    test('should successfully connect HashPack wallet', async ({ page }) => {
      // Mock HashPack wallet availability and connection
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          disconnect: async () => { },
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
          signTransaction: async () => ({
            signature: 'mock-signature',
          }),
        };
      }, WALLET_CONFIG);

      // Click connect wallet button
      await page.click('[data-testid="connect-wallet-button"]');

      // Verify wallet selection modal opens
      await expect(page.locator('[data-testid="wallet-selection-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="modal-title"]')).toContainText('Connect Wallet');

      // Select HashPack wallet
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify connection success
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9687');
      await expect(page.locator('[data-testid="wallet-balance"]')).toContainText('100.5 HBAR');
      await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Testnet');

      // Verify modal closes after successful connection
      await expect(page.locator('[data-testid="wallet-selection-modal"]')).not.toBeVisible();
    });

    test('should successfully connect Blade wallet', async ({ page }) => {
      // Mock Blade wallet availability and connection
      await page.addInitScript((config) => {
        // @ts-ignore
        window.blade = {
          isAvailable: true,
          createAccount: async () => ({
            accountId: config.SECONDARY_TESTNET_ACCOUNT,
            network: config.NETWORK,
          }),
          getAccountInfo: async () => ({
            accountId: config.SECONDARY_TESTNET_ACCOUNT,
            balance: 75.25,
          }),
          disconnect: async () => { },
          signTransaction: async () => ({
            signature: 'blade-signature',
          }),
        };
      }, WALLET_CONFIG);

      // Click connect wallet button
      await page.click('[data-testid="connect-wallet-button"]');

      // Select Blade wallet
      await page.click('[data-testid="wallet-provider-blade"]');

      // Verify connection success
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9688');
      await expect(page.locator('[data-testid="wallet-balance"]')).toContainText('75.25 HBAR');
    });

    test('should display loading state during connection', async ({ page }) => {
      // Mock delayed wallet connection
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            // Simulate connection delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            return {
              accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
              network: config.NETWORK,
            };
          },
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify loading state
      await expect(page.locator('[data-testid="wallet-connecting"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-spinner"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-message"]')).toContainText('Connecting to HashPack');

      // Wait for connection to complete
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="wallet-connecting"]')).not.toBeVisible();
    });

    test('should show wallet info with copy address functionality', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify truncated address display
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9687');

      // Test address hover to show full address
      await page.hover('[data-testid="wallet-address"]');
      await expect(page.locator('[data-testid="full-address-tooltip"]')).toContainText('0.0.6199687');

      // Test copy address functionality
      await page.click('[data-testid="wallet-address"]');
      await expect(page.locator('[data-testid="copy-feedback"]')).toContainText('Copied!');

      // Verify clipboard content (if supported by browser)
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe('0.0.6199687');
    });
  });

  test.describe('Wallet Provider Selection and Connection Process', () => {
    test('should display available wallet providers', async ({ page }) => {
      // Mock multiple wallet providers
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = { isAvailable: true };
        // @ts-ignore
        window.blade = { isAvailable: true };
      });

      await page.click('[data-testid="connect-wallet-button"]');

      // Verify all available providers are shown
      await expect(page.locator('[data-testid="wallet-provider-hashpack"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-provider-blade"]')).toBeVisible();

      // Verify provider information
      await expect(page.locator('[data-testid="provider-name-hashpack"]')).toContainText('HashPack');
      await expect(page.locator('[data-testid="provider-description-hashpack"]')).toContainText('The most popular Hedera wallet');

      await expect(page.locator('[data-testid="provider-name-blade"]')).toContainText('Blade Wallet');
      await expect(page.locator('[data-testid="provider-description-blade"]')).toContainText('Secure Hedera wallet with advanced features');
    });

    test('should show installation guidance for unavailable providers', async ({ page }) => {
      // Mock only HashPack available
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = { isAvailable: true };
        // Blade not available
      });

      await page.click('[data-testid="connect-wallet-button"]');

      // Verify available provider is enabled
      await expect(page.locator('[data-testid="wallet-provider-hashpack"]')).not.toHaveClass(/disabled/);

      // Verify unavailable provider shows installation option
      await expect(page.locator('[data-testid="wallet-provider-blade"]')).toHaveClass(/disabled/);
      await expect(page.locator('[data-testid="provider-status-blade"]')).toContainText('Not installed');
      await expect(page.locator('[data-testid="install-button-blade"]')).toBeVisible();

      // Test install button opens correct URL
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.click('[data-testid="install-button-blade"]')
      ]);

      expect(newPage.url()).toContain('bladewallet.io');
      await newPage.close();
    });

    test('should handle provider detection refresh', async ({ page }) => {
      // Initially no providers available
      await page.addInitScript(() => {
        // No wallet providers initially
      });

      await page.click('[data-testid="connect-wallet-button"]');

      // Verify no providers available message
      await expect(page.locator('[data-testid="no-providers-message"]')).toContainText('No wallet providers detected');
      await expect(page.locator('[data-testid="refresh-providers-button"]')).toBeVisible();

      // Mock provider becoming available
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = { isAvailable: true };
      });

      // Click refresh
      await page.click('[data-testid="refresh-providers-button"]');

      // Verify provider now appears
      await expect(page.locator('[data-testid="wallet-provider-hashpack"]')).toBeVisible();
      await expect(page.locator('[data-testid="no-providers-message"]')).not.toBeVisible();
    });

    test('should show terms and privacy policy notice', async ({ page }) => {
      await page.click('[data-testid="connect-wallet-button"]');

      // Verify terms notice is displayed
      await expect(page.locator('[data-testid="terms-notice"]')).toContainText('By connecting a wallet, you agree to our Terms of Service and Privacy Policy');
      await expect(page.locator('[data-testid="security-notice"]')).toContainText('Make sure you trust this site with your wallet');

      // Verify links are present
      await expect(page.locator('[data-testid="terms-link"]')).toHaveAttribute('href', '/terms');
      await expect(page.locator('[data-testid="privacy-link"]')).toHaveAttribute('href', '/privacy');
    });
  });

  test.describe('Error Scenarios and User Guidance', () => {
    test('should handle wallet extension not installed error', async ({ page }) => {
      // Mock no wallet extensions available
      await page.addInitScript(() => {
        // No wallet objects available
      });

      await page.click('[data-testid="connect-wallet-button"]');

      // Verify error message and guidance
      await expect(page.locator('[data-testid="provider-error"]')).toContainText('Wallet provider not found');
      await expect(page.locator('[data-testid="installation-guidance"]')).toContainText('Please install the wallet extension');

      // Verify installation links
      await expect(page.locator('[data-testid="install-hashpack-link"]')).toHaveAttribute('href', 'https://www.hashpack.app/');
      await expect(page.locator('[data-testid="install-blade-link"]')).toHaveAttribute('href', 'https://bladewallet.io/');
    });

    test('should handle connection rejection error', async ({ page }) => {
      // Mock wallet that rejects connection
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('User rejected the connection request');
          },
        };
      });

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify error handling
      await expect(page.locator('[data-testid="connection-error"]')).toContainText('Connection was rejected');
      await expect(page.locator('[data-testid="error-guidance"]')).toContainText('Please try again and approve the connection');
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

      // Test retry functionality
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack.connect = async () => ({
          accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
          network: config.NETWORK,
        });
      }, WALLET_CONFIG);

      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    test('should handle wallet locked error', async ({ page }) => {
      // Mock locked wallet
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('Wallet is locked');
          },
        };
      });

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify error handling
      await expect(page.locator('[data-testid="wallet-locked-error"]')).toContainText('Wallet is locked');
      await expect(page.locator('[data-testid="unlock-guidance"]')).toContainText('Please unlock your wallet and try again');
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle wrong network error', async ({ page }) => {
      // Mock wallet on wrong network
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: 'mainnet', // Wrong network
          }),
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify network error
      await expect(page.locator('[data-testid="network-error"]')).toContainText('Wrong network detected');
      await expect(page.locator('[data-testid="network-guidance"]')).toContainText('Please switch to testnet in your wallet');
      await expect(page.locator('[data-testid="expected-network"]')).toContainText('Expected: Testnet');
      await expect(page.locator('[data-testid="current-network"]')).toContainText('Current: Mainnet');
    });

    test('should handle network connectivity error', async ({ page }) => {
      // Mock network error
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('Network request failed');
          },
        };
      });

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify network error handling
      await expect(page.locator('[data-testid="network-connectivity-error"]')).toContainText('Network connection error');
      await expect(page.locator('[data-testid="connectivity-guidance"]')).toContainText('Please check your internet connection and try again');
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should provide clear error recovery options', async ({ page }) => {
      // Mock various error scenarios
      await page.addInitScript((config) => {
        let attemptCount = 0;
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            attemptCount++;
            if (attemptCount === 1) {
              throw new Error('Network request failed');
            } else if (attemptCount === 2) {
              throw new Error('User rejected the connection request');
            } else {
              return {
                accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
                network: config.NETWORK,
              };
            }
          },
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // First error - network
      await expect(page.locator('[data-testid="network-connectivity-error"]')).toBeVisible();
      await page.click('[data-testid="retry-button"]');

      // Second error - rejection
      await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
      await page.click('[data-testid="retry-button"]');

      // Third attempt - success
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });
  });

  test.describe('Wallet Disconnection and Session Management', () => {
    test('should successfully disconnect wallet', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          disconnect: async () => { },
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Disconnect wallet
      await page.click('[data-testid="disconnect-wallet-button"]');

      // Verify disconnection
      await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toContainText('Connect Wallet');
    });

    test('should clear wallet session data on disconnect', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          disconnect: async () => { },
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      // Connect and verify session data
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify session data exists
      const sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeTruthy();

      // Disconnect
      await page.click('[data-testid="disconnect-wallet-button"]');

      // Verify session data is cleared
      const clearedSessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(clearedSessionData).toBeFalsy();
    });

    test('should maintain connection across page navigation', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Navigate to different page
      await page.goto('/bookings');

      // Verify wallet still connected
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9687');

      // Navigate to another page
      await page.goto('/swaps');

      // Verify wallet still connected
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    test('should restore connection on page reload', async ({ page }) => {
      // Setup connected wallet with persistence
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
          isConnected: () => true,
        };
      }, WALLET_CONFIG);

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Reload page
      await page.reload();

      // Verify connection is restored
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9687');
    });

    test('should handle invalid stored connection gracefully', async ({ page }) => {
      // Set invalid session data
      await page.addInitScript(() => {
        localStorage.setItem('wallet-session', JSON.stringify({
          provider: 'hashpack',
          accountId: '0.0.invalid',
          connected: true,
        }));

        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('Invalid session');
          },
          isConnected: () => false,
        };
      });

      await page.goto('/');

      // Verify graceful fallback to disconnected state
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

      // Verify session data is cleared
      const sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeFalsy();
    });

    test('should handle browser data clearing', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: ['0.0.123456'],
            network: 'testnet',
          }),
          getAccountInfo: async () => ({
            accountId: '0.0.123456',
            balance: { hbars: 100.5 },
          }),
        };
      });

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Clear browser data
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Reload page
      await page.reload();

      // Verify requires fresh connection
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();
    });
  });

  test.describe('Wallet Status and Network Validation', () => {
    test('should display correct network status', async ({ page }) => {
      // Setup wallet on testnet
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: ['0.0.123456'],
            network: 'testnet',
          }),
          getAccountInfo: async () => ({
            accountId: '0.0.123456',
            balance: { hbars: 100.5 },
          }),
        };
      });

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify network status indicator
      await expect(page.locator('[data-testid="network-status"]')).toContainText('Testnet');
      await expect(page.locator('[data-testid="network-indicator"]')).toHaveClass(/testnet/);
    });

    test('should show connection status indicator', async ({ page }) => {
      // Test disconnected state
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected');
      await expect(page.locator('[data-testid="status-indicator"]')).toHaveClass(/disconnected/);

      // Setup and connect wallet
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: ['0.0.123456'],
            network: 'testnet',
          }),
          getAccountInfo: async () => ({
            accountId: '0.0.123456',
            balance: { hbars: 100.5 },
          }),
        };
      });

      await page.click('[data-testid="connect-wallet-button"]');

      // Test connecting state
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connecting');
      await expect(page.locator('[data-testid="status-indicator"]')).toHaveClass(/connecting/);

      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Test connected state
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
      await expect(page.locator('[data-testid="status-indicator"]')).toHaveClass(/connected/);
    });

    test('should handle network switching prompts', async ({ page }) => {
      // Setup wallet on wrong network
      await page.addInitScript((config) => {
        let networkSwitched = false;
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: networkSwitched ? config.NETWORK : 'mainnet',
          }),
          switchNetwork: async (network: string) => {
            networkSwitched = true;
            return { network: config.NETWORK };
          },
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify network switch prompt
      await expect(page.locator('[data-testid="network-switch-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="switch-network-message"]')).toContainText('Please switch to Testnet');
      await expect(page.locator('[data-testid="current-network-display"]')).toContainText('Mainnet');
      await expect(page.locator('[data-testid="target-network-display"]')).toContainText('Testnet');

      // Click switch network
      await page.click('[data-testid="switch-network-button"]');

      // Verify successful switch
      await expect(page.locator('[data-testid="network-switch-success"]')).toContainText('Network switched successfully');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Testnet');
    });
  });

  test.describe('Integration with Application Features', () => {
    test('should integrate wallet with booking creation', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
          signTransaction: async () => ({
            signature: 'mock-signature',
          }),
        };
      }, WALLET_CONFIG);

      // Mock booking API
      await page.route('**/api/bookings', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'booking-123',
              title: 'Test Booking',
              walletAddress: '0.0.6199687',
              transactionId: 'tx-123',
            }),
          });
        }
      });

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Navigate to create booking
      await page.goto('/bookings/create');

      // Verify wallet integration in booking form
      await expect(page.locator('[data-testid="wallet-info-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="connected-wallet-display"]')).toContainText('0x6199...9687');

      // Fill and submit booking form
      await page.fill('[data-testid="booking-title"]', 'Test Booking');
      await page.selectOption('[data-testid="booking-type"]', 'hotel');
      await page.fill('[data-testid="booking-city"]', 'Test City');
      await page.fill('[data-testid="booking-country"]', 'Test Country');
      await page.fill('[data-testid="check-in-date"]', '2024-12-20');
      await page.fill('[data-testid="check-out-date"]', '2024-12-25');
      await page.fill('[data-testid="original-price"]', '1000');
      await page.fill('[data-testid="swap-value"]', '900');

      await page.click('[data-testid="submit-booking"]');

      // Verify wallet signing prompt
      await expect(page.locator('[data-testid="transaction-signing"]')).toBeVisible();
      await expect(page.locator('[data-testid="signing-message"]')).toContainText('Please sign the transaction to create your booking');

      // Verify successful creation with wallet integration
      await expect(page.locator('[data-testid="booking-created-success"]')).toContainText('Booking created successfully');
      await expect(page.locator('[data-testid="transaction-id-display"]')).toContainText('tx-123');
    });

    test('should show wallet requirement for protected features', async ({ page }) => {
      // Navigate to protected feature without wallet
      await page.goto('/bookings/create');

      // Verify wallet requirement message
      await expect(page.locator('[data-testid="wallet-required-message"]')).toContainText('Please connect your wallet to create bookings');
      await expect(page.locator('[data-testid="connect-wallet-prompt"]')).toBeVisible();

      // Connect wallet from prompt
      await page.click('[data-testid="connect-wallet-from-prompt"]');

      // Setup wallet
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify access granted after connection
      await expect(page.locator('[data-testid="booking-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-required-message"]')).not.toBeVisible();
    });
  });
});