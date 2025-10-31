import { test, expect } from '@playwright/test';

test.describe('Wallet Session Management E2E Tests', () => {
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

  test.describe('Session Persistence', () => {
    test('should persist wallet connection across browser sessions', async ({ page }) => {
      // Setup wallet with persistence
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
          isConnected: () => true,
        };
      });

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Verify session data is stored
      const sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeTruthy();
      
      const parsedSession = JSON.parse(sessionData);
      expect(parsedSession.provider).toBe('hashpack');
      expect(parsedSession.accountId).toBe('0.0.123456');
      expect(parsedSession.connected).toBe(true);

      // Simulate browser restart by reloading page
      await page.reload();

      // Verify connection is restored
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');
      await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('HashPack');
    });

    test('should handle expired session gracefully', async ({ page }) => {
      // Set expired session data
      await page.addInitScript(() => {
        const expiredSession = {
          provider: 'hashpack',
          accountId: '0.0.123456',
          connected: true,
          timestamp: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
          expiresAt: Date.now() - (1 * 60 * 60 * 1000), // Expired 1 hour ago
        };
        localStorage.setItem('wallet-session', JSON.stringify(expiredSession));

        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('Session expired');
          },
          isConnected: () => false,
        };
      });

      await page.goto('/');

      // Verify expired session is handled
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

      // Verify session data is cleared
      const sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeFalsy();

      // Verify user can connect fresh
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack.connect = async () => ({
          accountIds: ['0.0.123456'],
          network: 'testnet',
        });
      });

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    test('should maintain session across page navigation', async ({ page }) => {
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

      // Navigate to different pages
      const pages = ['/bookings', '/swaps', '/profile', '/settings'];
      
      for (const pagePath of pages) {
        await page.goto(pagePath);
        
        // Verify wallet remains connected
        await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
        await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');
      }

      // Return to home and verify still connected
      await page.goto('/');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
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

      // Verify can connect again
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });
  });

  test.describe('Session Security', () => {
    test('should validate session integrity', async ({ page }) => {
      // Setup wallet
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

      // Tamper with session data
      await page.evaluate(() => {
        const tamperedSession = {
          provider: 'hashpack',
          accountId: '0.0.999999', // Different account
          connected: true,
          timestamp: Date.now(),
        };
        localStorage.setItem('wallet-session', JSON.stringify(tamperedSession));
      });

      // Reload page
      await page.reload();

      // Verify tampered session is rejected
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

      // Verify session data is cleared
      const sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeFalsy();
    });

    test('should handle concurrent session conflicts', async ({ page, context }) => {
      // Setup wallet
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

      // Connect wallet in first tab
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Open second tab
      const secondPage = await context.newPage();
      await secondPage.goto('/');

      // Setup different wallet in second tab
      await secondPage.addInitScript(() => {
        // @ts-ignore
        window.blade = {
          isAvailable: true,
          createAccount: async () => ({
            accountId: '0.0.789012',
            network: 'testnet',
          }),
          getAccountInfo: async () => ({
            accountId: '0.0.789012',
            balance: 75.25,
          }),
        };
      });

      // Connect different wallet in second tab
      await secondPage.click('[data-testid="connect-wallet-button"]');
      await secondPage.click('[data-testid="wallet-provider-blade"]');
      await expect(secondPage.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Check first tab - should detect session conflict
      await page.reload();
      await expect(page.locator('[data-testid="session-conflict-notice"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-message"]')).toContainText('Wallet session changed in another tab');

      // Resolve conflict by reconnecting
      await page.click('[data-testid="reconnect-button"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Blade Wallet');

      await secondPage.close();
    });

    test('should enforce session timeout', async ({ page }) => {
      // Setup wallet with short session timeout
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

        // Override session timeout to 5 seconds for testing
        // @ts-ignore
        window.WALLET_SESSION_TIMEOUT = 5000;
      });

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Wait for session timeout
      await page.waitForTimeout(6000);

      // Verify session timeout notice
      await expect(page.locator('[data-testid="session-timeout-notice"]')).toBeVisible();
      await expect(page.locator('[data-testid="timeout-message"]')).toContainText('Session expired for security');

      // Verify wallet is disconnected
      await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

      // Verify can reconnect
      await page.click('[data-testid="reconnect-after-timeout"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });
  });

  test.describe('Auto-Reconnection', () => {
    test('should attempt auto-reconnection on page load', async ({ page }) => {
      // Setup wallet with stored session
      await page.addInitScript(() => {
        const validSession = {
          provider: 'hashpack',
          accountId: '0.0.123456',
          connected: true,
          timestamp: Date.now(),
          autoReconnect: true,
        };
        localStorage.setItem('wallet-session', JSON.stringify(validSession));

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
          isConnected: () => true,
        };
      });

      await page.goto('/');

      // Verify auto-reconnection attempt
      await expect(page.locator('[data-testid="auto-reconnecting"]')).toBeVisible();
      await expect(page.locator('[data-testid="reconnection-message"]')).toContainText('Restoring wallet connection');

      // Verify successful reconnection
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="auto-reconnecting"]')).not.toBeVisible();
    });

    test('should handle failed auto-reconnection gracefully', async ({ page }) => {
      // Setup wallet with stored session but connection fails
      await page.addInitScript(() => {
        const validSession = {
          provider: 'hashpack',
          accountId: '0.0.123456',
          connected: true,
          timestamp: Date.now(),
          autoReconnect: true,
        };
        localStorage.setItem('wallet-session', JSON.stringify(validSession));

        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('Auto-reconnection failed');
          },
          isConnected: () => false,
        };
      });

      await page.goto('/');

      // Verify failed reconnection handling
      await expect(page.locator('[data-testid="auto-reconnect-failed"]')).toBeVisible();
      await expect(page.locator('[data-testid="reconnect-failure-message"]')).toContainText('Could not restore wallet connection');

      // Verify fallback to manual connection
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="manual-reconnect-button"]')).toBeVisible();

      // Verify session data is cleared
      const sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeFalsy();
    });

    test('should respect user preference for auto-reconnection', async ({ page }) => {
      // Setup wallet with auto-reconnect disabled
      await page.addInitScript(() => {
        const sessionWithoutAutoReconnect = {
          provider: 'hashpack',
          accountId: '0.0.123456',
          connected: true,
          timestamp: Date.now(),
          autoReconnect: false,
        };
        localStorage.setItem('wallet-session', JSON.stringify(sessionWithoutAutoReconnect));

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

      await page.goto('/');

      // Verify no auto-reconnection attempt
      await expect(page.locator('[data-testid="auto-reconnecting"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

      // Verify manual connection still works
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });
  });

  test.describe('Session Cleanup', () => {
    test('should clean up session on explicit disconnect', async ({ page }) => {
      // Setup connected wallet
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: ['0.0.123456'],
            network: 'testnet',
          }),
          disconnect: async () => {},
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

      // Verify session data exists
      let sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeTruthy();

      // Disconnect wallet
      await page.click('[data-testid="disconnect-wallet-button"]');

      // Verify session cleanup
      sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeFalsy();

      // Verify UI state
      await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
    });

    test('should clean up session on window close', async ({ page, context }) => {
      // Setup connected wallet
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: ['0.0.123456'],
            network: 'testnet',
          }),
          disconnect: async () => {},
          getAccountInfo: async () => ({
            accountId: '0.0.123456',
            balance: { hbars: 100.5 },
          }),
        };

        // Setup beforeunload handler
        window.addEventListener('beforeunload', () => {
          // Cleanup session on window close
          localStorage.removeItem('wallet-session');
        });
      });

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Close page
      await page.close();

      // Open new page and verify session is cleaned
      const newPage = await context.newPage();
      await newPage.goto('/');

      const sessionData = await newPage.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeFalsy();

      await newPage.close();
    });

    test('should handle partial session cleanup gracefully', async ({ page }) => {
      // Setup wallet
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: ['0.0.123456'],
            network: 'testnet',
          }),
          disconnect: async () => {
            // Simulate partial cleanup failure
            throw new Error('Disconnect failed');
          },
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

      // Attempt disconnect
      await page.click('[data-testid="disconnect-wallet-button"]');

      // Verify graceful handling of disconnect failure
      await expect(page.locator('[data-testid="disconnect-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="force-disconnect-button"]')).toBeVisible();

      // Force disconnect
      await page.click('[data-testid="force-disconnect-button"]');

      // Verify session is cleaned up despite provider error
      const sessionData = await page.evaluate(() => localStorage.getItem('wallet-session'));
      expect(sessionData).toBeFalsy();
      await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
    });
  });
});
