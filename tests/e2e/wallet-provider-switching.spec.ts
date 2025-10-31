import { test, expect } from '@playwright/test';
import { WALLET_CONFIG } from '../fixtures/wallet-config';

test.describe('Wallet Provider Switching E2E Tests', () => {
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
          },
          token: 'mock-jwt-token',
        }),
      });
    });

    await page.goto('/');
  });

  test.describe('Multi-Provider Support', () => {
    test('should switch between different wallet providers', async ({ page }) => {
      // Setup both wallet providers
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

        // @ts-ignore
        window.blade = {
          isAvailable: true,
          createAccount: async () => ({
            accountId: config.SECONDARY_TESTNET_ACCOUNT,
            network: config.NETWORK,
          }),
          disconnect: async () => { },
          getAccountInfo: async () => ({
            accountId: config.SECONDARY_TESTNET_ACCOUNT,
            balance: 75.25,
          }),
        };
      }, WALLET_CONFIG);

      // Connect to HashPack first
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify HashPack connection
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9687');
      await expect(page.locator('[data-testid="wallet-balance"]')).toContainText('100.5 HBAR');
      await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('HashPack');

      // Switch to Blade wallet
      await page.click('[data-testid="wallet-menu-button"]');
      await page.click('[data-testid="switch-wallet-option"]');

      // Verify wallet selection modal opens
      await expect(page.locator('[data-testid="wallet-selection-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-provider-notice"]')).toContainText('Currently connected to HashPack');

      // Select Blade wallet
      await page.click('[data-testid="wallet-provider-blade"]');

      // Verify switch confirmation
      await expect(page.locator('[data-testid="switch-confirmation-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="switch-warning"]')).toContainText('This will disconnect your current wallet');
      await page.click('[data-testid="confirm-switch-button"]');

      // Verify Blade connection
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9688');
      await expect(page.locator('[data-testid="wallet-balance"]')).toContainText('75.25 HBAR');
      await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Blade Wallet');
    });

    test('should handle provider switching cancellation', async ({ page }) => {
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

        // @ts-ignore
        window.blade = {
          isAvailable: true,
          createAccount: async () => ({
            accountId: config.SECONDARY_TESTNET_ACCOUNT,
            network: config.NETWORK,
          }),
        };
      }, WALLET_CONFIG);

      // Connect to HashPack
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Start switching process
      await page.click('[data-testid="wallet-menu-button"]');
      await page.click('[data-testid="switch-wallet-option"]');
      await page.click('[data-testid="wallet-provider-blade"]');

      // Cancel the switch
      await expect(page.locator('[data-testid="switch-confirmation-modal"]')).toBeVisible();
      await page.click('[data-testid="cancel-switch-button"]');

      // Verify original connection maintained
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x6199...9687');
      await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('HashPack');
      await expect(page.locator('[data-testid="switch-confirmation-modal"]')).not.toBeVisible();
    });

    test('should remember last used provider preference', async ({ page }) => {
      // Setup both providers
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
        };
      }, WALLET_CONFIG);

      // Connect to Blade wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-blade"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Disconnect
      await page.click('[data-testid="disconnect-wallet-button"]');
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

      // Reconnect - should suggest last used provider
      await page.click('[data-testid="connect-wallet-button"]');

      // Verify Blade is highlighted as last used
      await expect(page.locator('[data-testid="wallet-provider-blade"]')).toHaveClass(/last-used/);
      await expect(page.locator('[data-testid="last-used-indicator"]')).toContainText('Last used');

      // Quick connect with last used provider
      await page.click('[data-testid="quick-connect-last-used"]');

      // Verify connection to Blade
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Blade Wallet');
    });

    test('should handle provider availability changes during switching', async ({ page }) => {
      // Setup initial state with both providers
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

        // @ts-ignore
        window.blade = {
          isAvailable: true,
          createAccount: async () => ({
            accountId: config.SECONDARY_TESTNET_ACCOUNT,
            network: config.NETWORK,
          }),
        };
      }, WALLET_CONFIG);

      // Connect to HashPack
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Start switching process
      await page.click('[data-testid="wallet-menu-button"]');
      await page.click('[data-testid="switch-wallet-option"]');

      // Simulate Blade becoming unavailable
      await page.addInitScript(() => {
        // @ts-ignore
        delete window.blade;
      });

      // Refresh provider availability
      await page.click('[data-testid="refresh-providers-button"]');

      // Verify Blade is now shown as unavailable
      await expect(page.locator('[data-testid="wallet-provider-blade"]')).toHaveClass(/disabled/);
      await expect(page.locator('[data-testid="provider-status-blade"]')).toContainText('Not available');
      await expect(page.locator('[data-testid="install-button-blade"]')).toBeVisible();

      // Verify HashPack is still available and can be selected
      await expect(page.locator('[data-testid="wallet-provider-hashpack"]')).not.toHaveClass(/disabled/);
    });
  });

  test.describe('Provider-Specific Features', () => {
    test('should handle HashPack-specific features', async ({ page }) => {
      // Setup HashPack with specific features
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
          // HashPack-specific methods
          getAccountBalance: async () => ({ hbars: config.DEFAULT_BALANCE, tokens: [] }),
          signMessage: async (message: string) => ({ signature: 'hashpack-signature' }),
          getNetworkInfo: async () => ({
            network: config.NETWORK,
            mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Test HashPack-specific features
      await page.click('[data-testid="wallet-menu-button"]');
      await expect(page.locator('[data-testid="hashpack-features"]')).toBeVisible();
      await expect(page.locator('[data-testid="view-tokens-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="sign-message-button"]')).toBeVisible();

      // Test message signing
      await page.click('[data-testid="sign-message-button"]');
      await page.fill('[data-testid="message-input"]', 'Test message');
      await page.click('[data-testid="sign-button"]');

      await expect(page.locator('[data-testid="signature-result"]')).toContainText('hashpack-signature');
    });

    test('should handle Blade-specific features', async ({ page }) => {
      // Setup Blade with specific features
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
          // Blade-specific methods
          getAccountKeys: async () => ({ publicKey: 'blade-public-key' }),
          transferHbar: async (to: string, amount: number) => ({
            transactionId: 'blade-tx-123'
          }),
          associateToken: async (tokenId: string) => ({
            success: true
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-blade"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Test Blade-specific features
      await page.click('[data-testid="wallet-menu-button"]');
      await expect(page.locator('[data-testid="blade-features"]')).toBeVisible();
      await expect(page.locator('[data-testid="transfer-hbar-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="manage-tokens-button"]')).toBeVisible();

      // Test HBAR transfer
      await page.click('[data-testid="transfer-hbar-button"]');
      await page.fill('[data-testid="recipient-input"]', '0.0.654321');
      await page.fill('[data-testid="amount-input"]', '10');
      await page.click('[data-testid="transfer-button"]');

      await expect(page.locator('[data-testid="transfer-success"]')).toContainText('blade-tx-123');
    });

    test('should gracefully handle unsupported features', async ({ page }) => {
      // Setup wallet with limited features
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
          // Missing some advanced features
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Check feature availability
      await page.click('[data-testid="wallet-menu-button"]');

      // Verify unsupported features are disabled or hidden
      await expect(page.locator('[data-testid="unsupported-feature-notice"]')).toContainText('Some features may not be available with this wallet version');
      await expect(page.locator('[data-testid="advanced-features"]')).toHaveClass(/disabled/);
    });
  });

  test.describe('Provider Error Handling', () => {
    test('should handle provider-specific connection errors', async ({ page }) => {
      // Setup providers with different error behaviors
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('HashPack: User rejected connection');
          },
        };

        // @ts-ignore
        window.blade = {
          isAvailable: true,
          createAccount: async () => {
            throw new Error('Blade: Insufficient permissions');
          },
        };
      });

      // Try HashPack first
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify HashPack-specific error
      await expect(page.locator('[data-testid="provider-error"]')).toContainText('HashPack: User rejected connection');
      await expect(page.locator('[data-testid="hashpack-error-guidance"]')).toBeVisible();

      // Try Blade
      await page.click('[data-testid="wallet-provider-blade"]');

      // Verify Blade-specific error
      await expect(page.locator('[data-testid="provider-error"]')).toContainText('Blade: Insufficient permissions');
      await expect(page.locator('[data-testid="blade-error-guidance"]')).toBeVisible();
    });

    test('should handle provider disconnection during operation', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript((config) => {
        let connected = true;
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
          getAccountInfo: async () => {
            if (!connected) {
              throw new Error('Wallet disconnected');
            }
            return {
              accountId: config.PRIMARY_TESTNET_ACCOUNT,
              balance: { hbars: config.DEFAULT_BALANCE },
            };
          },
          disconnect: async () => {
            connected = false;
          },
        };

        // Simulate unexpected disconnection after 3 seconds
        setTimeout(() => {
          connected = false;
        }, 3000);
      }, WALLET_CONFIG);

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Wait for disconnection
      await page.waitForTimeout(4000);

      // Verify disconnection detection
      await expect(page.locator('[data-testid="wallet-disconnected-notice"]')).toBeVisible();
      await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
    });

    test('should handle provider update/reload scenarios', async ({ page }) => {
      // Setup initial connection
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
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Simulate provider update (version change)
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          version: '2.0.0', // Updated version
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

      // Trigger provider detection refresh
      await page.click('[data-testid="wallet-menu-button"]');
      await page.click('[data-testid="refresh-connection-button"]');

      // Verify connection maintained with updated provider
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="provider-version"]')).toContainText('2.0.0');
    });
  });
});