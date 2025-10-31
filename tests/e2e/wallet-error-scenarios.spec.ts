import { test, expect } from '@playwright/test';
import { WALLET_CONFIG } from '../fixtures/wallet-config';

test.describe('Wallet Error Scenarios and Recovery E2E Tests', () => {
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

  test.describe('Provider Installation and Availability Errors', () => {
    test('should handle no wallet providers installed', async ({ page }) => {
      // No wallet providers available
      await page.addInitScript(() => {
        // Ensure no wallet objects exist
        // @ts-ignore
        delete window.hashpack;
        // @ts-ignore
        delete window.blade;
      });

      await page.click('[data-testid="connect-wallet-button"]');

      // Verify no providers message
      await expect(page.locator('[data-testid="no-providers-available"]')).toBeVisible();
      await expect(page.locator('[data-testid="no-providers-message"]')).toContainText('No Hedera wallet providers detected');
      await expect(page.locator('[data-testid="installation-instructions"]')).toBeVisible();

      // Verify installation links
      await expect(page.locator('[data-testid="install-hashpack-link"]')).toHaveAttribute('href', 'https://www.hashpack.app/');
      await expect(page.locator('[data-testid="install-blade-link"]')).toHaveAttribute('href', 'https://bladewallet.io/');

      // Test refresh functionality
      await expect(page.locator('[data-testid="refresh-providers-button"]')).toBeVisible();

      // Simulate provider installation
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="refresh-providers-button"]');

      // Verify provider now appears
      await expect(page.locator('[data-testid="wallet-provider-hashpack"]')).toBeVisible();
      await expect(page.locator('[data-testid="no-providers-available"]')).not.toBeVisible();
    });

    test('should handle partial provider availability', async ({ page }) => {
      // Only HashPack available
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => ({
            accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
            network: config.NETWORK,
          }),
        };
        // Blade not available
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');

      // Verify available provider is enabled
      await expect(page.locator('[data-testid="wallet-provider-hashpack"]')).not.toHaveClass(/disabled/);
      await expect(page.locator('[data-testid="provider-status-hashpack"]')).toContainText('Available');

      // Verify unavailable provider shows installation option
      await expect(page.locator('[data-testid="wallet-provider-blade"]')).toHaveClass(/disabled/);
      await expect(page.locator('[data-testid="provider-status-blade"]')).toContainText('Not installed');
      await expect(page.locator('[data-testid="install-button-blade"]')).toBeVisible();

      // Test installation guidance
      await page.click('[data-testid="install-button-blade"]');

      // Verify installation modal or new tab
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.click('[data-testid="install-button-blade"]')
      ]);

      expect(newPage.url()).toContain('bladewallet.io');
      await newPage.close();
    });

    test('should handle provider detection failures', async ({ page }) => {
      // Mock provider detection error
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: false, // Provider exists but reports unavailable
        };
      });

      await page.click('[data-testid="connect-wallet-button"]');

      // Verify detection failure handling
      await expect(page.locator('[data-testid="provider-detection-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="detection-error-message"]')).toContainText('Unable to detect wallet providers');
      await expect(page.locator('[data-testid="troubleshooting-tips"]')).toBeVisible();

      // Verify troubleshooting guidance
      await expect(page.locator('[data-testid="troubleshooting-tips"]')).toContainText('Try refreshing the page');
      await expect(page.locator('[data-testid="troubleshooting-tips"]')).toContainText('Check if your wallet extension is enabled');
      await expect(page.locator('[data-testid="troubleshooting-tips"]')).toContainText('Restart your browser');

      // Test retry functionality
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack.isAvailable = true;
      });

      await page.click('[data-testid="retry-detection-button"]');
      await expect(page.locator('[data-testid="wallet-provider-hashpack"]')).toBeVisible();
    });
  });

  test.describe('Connection and Authentication Errors', () => {
    test('should handle user rejection of connection', async ({ page }) => {
      // Mock user rejection
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

      // Verify rejection error handling
      await expect(page.locator('[data-testid="connection-rejected-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="rejection-message"]')).toContainText('Connection was rejected');
      await expect(page.locator('[data-testid="rejection-guidance"]')).toContainText('Please try again and approve the connection in your wallet');

      // Verify retry options
      await expect(page.locator('[data-testid="retry-connection-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="try-different-wallet-button"]')).toBeVisible();

      // Test retry with approval
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack.connect = async () => ({
          accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
          network: config.NETWORK,
        });
      }, WALLET_CONFIG);

      await page.click('[data-testid="retry-connection-button"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    test('should handle wallet locked error', async ({ page }) => {
      // Mock locked wallet
      await page.addInitScript((config) => {
        let unlocked = false;
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            if (!unlocked) {
              throw new Error('Wallet is locked. Please unlock your wallet.');
            }
            return {
              accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
              network: config.NETWORK,
            };
          },
          unlock: async () => {
            unlocked = true;
          },
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify locked wallet error
      await expect(page.locator('[data-testid="wallet-locked-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="locked-message"]')).toContainText('Wallet is locked');
      await expect(page.locator('[data-testid="unlock-guidance"]')).toContainText('Please unlock your wallet and try again');

      // Verify unlock instructions
      await expect(page.locator('[data-testid="unlock-instructions"]')).toBeVisible();
      await expect(page.locator('[data-testid="unlock-steps"]')).toContainText('Open your wallet extension');
      await expect(page.locator('[data-testid="unlock-steps"]')).toContainText('Enter your password');

      // Test retry after unlock
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack.unlock();
      });

      await page.click('[data-testid="retry-after-unlock-button"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    test('should handle authentication timeout', async ({ page }) => {
      // Mock connection timeout
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            // Simulate long delay that times out
            await new Promise(resolve => setTimeout(resolve, 35000));
            return {
              accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
              network: config.NETWORK,
            };
          },
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify timeout handling
      await expect(page.locator('[data-testid="connection-timeout-error"]')).toBeVisible({ timeout: 40000 });
      await expect(page.locator('[data-testid="timeout-message"]')).toContainText('Connection timed out');
      await expect(page.locator('[data-testid="timeout-guidance"]')).toContainText('The wallet took too long to respond');

      // Verify recovery options
      await expect(page.locator('[data-testid="retry-connection-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="check-wallet-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-connection-button"]')).toBeVisible();
    });

    test('should handle multiple rapid connection attempts', async ({ page }) => {
      let attemptCount = 0;

      // Mock rate limiting
      await page.addInitScript((config) => {
        let attemptCount = 0;
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            attemptCount++;
            if (attemptCount <= 3) {
              throw new Error('Too many connection attempts. Please wait.');
            }
            return {
              accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
              network: config.NETWORK,
            };
          },
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');

      // Make multiple rapid attempts
      for (let i = 0; i < 3; i++) {
        await page.click('[data-testid="wallet-provider-hashpack"]');
        await page.waitForTimeout(500);
      }

      // Verify rate limiting error
      await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="rate-limit-message"]')).toContainText('Too many connection attempts');
      await expect(page.locator('[data-testid="cooldown-timer"]')).toBeVisible();

      // Wait for cooldown and retry
      await page.waitForTimeout(5000);
      await page.click('[data-testid="retry-after-cooldown-button"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });
  });

  test.describe('Network and Connectivity Errors', () => {
    test('should handle network connectivity issues', async ({ page }) => {
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
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="network-error-message"]')).toContainText('Network connection error');
      await expect(page.locator('[data-testid="connectivity-guidance"]')).toContainText('Please check your internet connection');

      // Verify diagnostic information
      await expect(page.locator('[data-testid="network-diagnostics"]')).toBeVisible();
      await page.click('[data-testid="run-diagnostics-button"]');

      await expect(page.locator('[data-testid="diagnostic-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="internet-status"]')).toContainText('Checking internet connection');
      await expect(page.locator('[data-testid="hedera-network-status"]')).toContainText('Checking Hedera network');

      // Test retry with restored connection
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack.connect = async () => ({
          accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
          network: config.NETWORK,
        });
      }, WALLET_CONFIG);

      await page.click('[data-testid="retry-connection-button"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    test('should handle wrong network errors', async ({ page }) => {
      // Mock wrong network
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
            return { success: true, network: config.NETWORK };
          },
          getAccountInfo: async () => ({
            accountId: config.PRIMARY_TESTNET_ACCOUNT,
            balance: { hbars: config.DEFAULT_BALANCE },
          }),
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify wrong network error
      await expect(page.locator('[data-testid="wrong-network-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="network-mismatch-message"]')).toContainText('Wrong network detected');
      await expect(page.locator('[data-testid="expected-network"]')).toContainText('Expected: Testnet');
      await expect(page.locator('[data-testid="current-network"]')).toContainText('Current: Mainnet');

      // Verify network switch options
      await expect(page.locator('[data-testid="switch-network-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="manual-switch-instructions"]')).toBeVisible();

      // Test automatic network switch
      await page.click('[data-testid="switch-network-button"]');

      await expect(page.locator('[data-testid="switching-network"]')).toBeVisible();
      await expect(page.locator('[data-testid="switch-progress"]')).toContainText('Switching to Testnet');

      // Verify successful switch
      await expect(page.locator('[data-testid="network-switch-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Testnet');
    });

    test('should handle Hedera network outages', async ({ page }) => {
      // Mock Hedera network outage
      await page.route('**/api/hedera/**', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Hedera network temporarily unavailable',
            code: 'NETWORK_OUTAGE',
            estimatedRecovery: '2024-01-01T12:00:00Z',
          }),
        });
      });

      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            // Simulate network check failure
            const response = await fetch('/api/hedera/status');
            if (!response.ok) {
              throw new Error('Hedera network unavailable');
            }
            return {
              accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
              network: config.NETWORK,
            };
          },
        };
      }, WALLET_CONFIG);

      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Verify network outage handling
      await expect(page.locator('[data-testid="hedera-outage-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="outage-message"]')).toContainText('Hedera network temporarily unavailable');
      await expect(page.locator('[data-testid="estimated-recovery"]')).toContainText('Estimated recovery');

      // Verify status page link
      await expect(page.locator('[data-testid="status-page-link"]')).toHaveAttribute('href', 'https://status.hedera.com');

      // Verify retry countdown
      await expect(page.locator('[data-testid="retry-countdown"]')).toBeVisible();
      await expect(page.locator('[data-testid="auto-retry-notice"]')).toContainText('Will retry automatically');
    });
  });

  test.describe('Transaction and Operation Errors', () => {
    test('should handle insufficient balance errors', async ({ page }) => {
      // Setup connected wallet with low balance
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
            balance: { hbars: 0.001 }, // Very low balance
          }),
          signTransaction: async () => {
            throw new Error('Insufficient account balance for transaction fee');
          },
        };
      }, WALLET_CONFIG);

      // Connect wallet
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      // Try to perform transaction (e.g., create booking)
      await page.goto('/bookings/create');
      await page.fill('[data-testid="booking-title"]', 'Test Booking');
      await page.selectOption('[data-testid="booking-type"]', 'hotel');
      await page.fill('[data-testid="booking-city"]', 'Test City');
      await page.fill('[data-testid="booking-country"]', 'Test Country');
      await page.fill('[data-testid="check-in-date"]', '2024-12-20');
      await page.fill('[data-testid="check-out-date"]', '2024-12-25');
      await page.fill('[data-testid="original-price"]', '1000');
      await page.fill('[data-testid="swap-value"]', '900');

      await page.click('[data-testid="submit-booking"]');

      // Verify insufficient balance error
      await expect(page.locator('[data-testid="insufficient-balance-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="balance-error-message"]')).toContainText('Insufficient account balance');
      await expect(page.locator('[data-testid="current-balance"]')).toContainText('0.001 HBAR');
      await expect(page.locator('[data-testid="required-balance"]')).toContainText('Minimum required');

      // Verify top-up guidance
      await expect(page.locator('[data-testid="top-up-guidance"]')).toBeVisible();
      await expect(page.locator('[data-testid="faucet-link"]')).toHaveAttribute('href', 'https://portal.hedera.com/faucet');
      await expect(page.locator('[data-testid="exchange-links"]')).toBeVisible();
    });

    test('should handle transaction signing errors', async ({ page }) => {
      // Setup wallet that fails to sign
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
          signTransaction: async () => {
            throw new Error('User cancelled transaction signing');
          },
        };
      }, WALLET_CONFIG);

      // Connect and try transaction
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      await page.goto('/bookings/create');
      // Fill form and submit...
      await page.fill('[data-testid="booking-title"]', 'Test Booking');
      await page.selectOption('[data-testid="booking-type"]', 'hotel');
      await page.fill('[data-testid="booking-city"]', 'Test City');
      await page.fill('[data-testid="booking-country"]', 'Test Country');
      await page.fill('[data-testid="check-in-date"]', '2024-12-20');
      await page.fill('[data-testid="check-out-date"]', '2024-12-25');
      await page.fill('[data-testid="original-price"]', '1000');
      await page.fill('[data-testid="swap-value"]', '900');

      await page.click('[data-testid="submit-booking"]');

      // Verify signing error
      await expect(page.locator('[data-testid="signing-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="signing-error-message"]')).toContainText('Transaction signing was cancelled');
      await expect(page.locator('[data-testid="signing-guidance"]')).toContainText('Please try again and approve the transaction');

      // Verify retry options
      await expect(page.locator('[data-testid="retry-signing-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="cancel-transaction-button"]')).toBeVisible();
    });

    test('should handle transaction broadcast failures', async ({ page }) => {
      // Setup successful signing but failed broadcast
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
            signature: 'valid-signature',
            signedTransaction: 'signed-tx-bytes',
          }),
        };
      }, WALLET_CONFIG);

      // Mock failed broadcast
      await page.route('**/api/hedera/submit-transaction', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Transaction broadcast failed',
            code: 'BROADCAST_FAILURE',
            details: 'Network congestion',
          }),
        });
      });

      // Connect and try transaction
      await page.click('[data-testid="connect-wallet-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

      await page.goto('/bookings/create');
      // Fill and submit form...
      await page.fill('[data-testid="booking-title"]', 'Test Booking');
      await page.selectOption('[data-testid="booking-type"]', 'hotel');
      await page.fill('[data-testid="booking-city"]', 'Test City');
      await page.fill('[data-testid="booking-country"]', 'Test Country');
      await page.fill('[data-testid="check-in-date"]', '2024-12-20');
      await page.fill('[data-testid="check-out-date"]', '2024-12-25');
      await page.fill('[data-testid="original-price"]', '1000');
      await page.fill('[data-testid="swap-value"]', '900');

      await page.click('[data-testid="submit-booking"]');

      // Verify broadcast error
      await expect(page.locator('[data-testid="broadcast-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="broadcast-error-message"]')).toContainText('Transaction broadcast failed');
      await expect(page.locator('[data-testid="broadcast-details"]')).toContainText('Network congestion');

      // Verify retry with exponential backoff
      await expect(page.locator('[data-testid="retry-broadcast-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-countdown"]')).toBeVisible();
      await expect(page.locator('[data-testid="save-draft-button"]')).toBeVisible();
    });
  });

  test.describe('Error Recovery and User Guidance', () => {
    test('should provide comprehensive error recovery flows', async ({ page }) => {
      // Test complete error recovery journey
      let errorStage = 'no-provider';

      await page.addInitScript(() => {
        // Dynamic error simulation
        // @ts-ignore
        window.simulateError = (stage) => {
          // @ts-ignore
          window.errorStage = stage;
        };
      });

      // Stage 1: No provider
      await page.click('[data-testid="connect-wallet-button"]');
      await expect(page.locator('[data-testid="no-providers-available"]')).toBeVisible();

      // Install provider
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('Wallet is locked');
          },
        };
      });

      await page.click('[data-testid="refresh-providers-button"]');

      // Stage 2: Wallet locked
      await page.click('[data-testid="wallet-provider-hashpack"]');
      await expect(page.locator('[data-testid="wallet-locked-error"]')).toBeVisible();

      // Unlock wallet
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack.connect = async () => ({
          accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
          network: 'mainnet', // Wrong network
        });
      }, WALLET_CONFIG);

      await page.click('[data-testid="retry-after-unlock-button"]');

      // Stage 3: Wrong network
      await expect(page.locator('[data-testid="wrong-network-error"]')).toBeVisible();

      // Switch network
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack.connect = async () => ({
          accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
          network: config.NETWORK,
        });
        // @ts-ignore
        window.hashpack.getAccountInfo = async () => ({
          accountId: config.PRIMARY_TESTNET_ACCOUNT,
          balance: { hbars: config.DEFAULT_BALANCE },
        });
      }, WALLET_CONFIG);

      await page.click('[data-testid="switch-network-button"]');

      // Final success
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await expect(page.locator('[data-testid="recovery-success-message"]')).toContainText('Successfully connected after resolving issues');
    });

    test('should track and display error resolution progress', async ({ page }) => {
      // Setup error tracking
      await page.addInitScript(() => {
        // @ts-ignore
        window.errorHistory = [];
        // @ts-ignore
        window.trackError = (error) => {
          // @ts-ignore
          window.errorHistory.push({
            error,
            timestamp: Date.now(),
            resolved: false,
          });
        };
      });

      // Simulate multiple errors and resolutions
      await page.click('[data-testid="connect-wallet-button"]');

      // Error 1: Provider not found
      await expect(page.locator('[data-testid="no-providers-available"]')).toBeVisible();

      // Check error tracking
      await page.click('[data-testid="error-history-button"]');
      await expect(page.locator('[data-testid="error-history-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-entry"]')).toContainText('No providers detected');

      // Resolve and continue
      await page.addInitScript(() => {
        // @ts-ignore
        window.hashpack = {
          isAvailable: true,
          connect: async () => {
            throw new Error('Connection rejected');
          },
        };
      });

      await page.click('[data-testid="close-error-history"]');
      await page.click('[data-testid="refresh-providers-button"]');
      await page.click('[data-testid="wallet-provider-hashpack"]');

      // Error 2: Connection rejected
      await expect(page.locator('[data-testid="connection-rejected-error"]')).toBeVisible();

      // Check updated error history
      await page.click('[data-testid="error-history-button"]');
      await expect(page.locator('[data-testid="error-entry"]')).toHaveCount(2);
      await expect(page.locator('[data-testid="error-entry"]').first()).toHaveClass(/resolved/);
      await expect(page.locator('[data-testid="error-entry"]').last()).toContainText('Connection rejected');

      // Final resolution
      await page.addInitScript((config) => {
        // @ts-ignore
        window.hashpack.connect = async () => ({
          accountIds: [config.PRIMARY_TESTNET_ACCOUNT],
          network: config.NETWORK,
        });
      }, WALLET_CONFIG);

      await page.click('[data-testid="close-error-history"]');
      await page.click('[data-testid="retry-connection-button"]');

      // Verify all errors resolved
      await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
      await page.click('[data-testid="error-history-button"]');
      await expect(page.locator('[data-testid="error-entry"]')).toHaveCount(2);
      await expect(page.locator('[data-testid="error-entry"]')).toHaveClass(/resolved/);
    });

    test('should provide contextual help and documentation links', async ({ page }) => {
      // Test help system integration
      await page.click('[data-testid="connect-wallet-button"]');
      await expect(page.locator('[data-testid="no-providers-available"]')).toBeVisible();

      // Verify help options
      await expect(page.locator('[data-testid="help-center-link"]')).toBeVisible();
      await expect(page.locator('[data-testid="troubleshooting-guide-link"]')).toBeVisible();
      await expect(page.locator('[data-testid="contact-support-button"]')).toBeVisible();

      // Test contextual help
      await page.click('[data-testid="help-center-link"]');

      const [helpPage] = await Promise.all([
        page.context().waitForEvent('page'),
        page.click('[data-testid="help-center-link"]')
      ]);

      expect(helpPage.url()).toContain('/help/wallet-connection');
      await helpPage.close();

      // Test in-app guidance
      await page.click('[data-testid="show-guided-setup"]');
      await expect(page.locator('[data-testid="guided-setup-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="setup-step-1"]')).toContainText('Install a Hedera wallet');
      await expect(page.locator('[data-testid="setup-step-2"]')).toContainText('Create or import an account');
      await expect(page.locator('[data-testid="setup-step-3"]')).toContainText('Connect to the application');

      // Test step-by-step guidance
      await page.click('[data-testid="start-guided-setup"]');
      await expect(page.locator('[data-testid="setup-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-step-indicator"]')).toContainText('Step 1 of 3');
    });
  });
});