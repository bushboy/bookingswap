import { test, expect } from '@playwright/test';

test.describe('Kabila Wallet Connection State Management E2E Tests', () => {
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

    test.describe('Connection State Synchronization Across Components', () => {
        test('should synchronize Kabila connection state across all UI components', async ({ page }) => {
            // Setup Kabila wallet
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Verify state synchronization in header
            await expect(page.locator('[data-testid="header-wallet-status"]')).toContainText('Connected');
            await expect(page.locator('[data-testid="header-wallet-address"]')).toContainText('0x1234...3456');
            await expect(page.locator('[data-testid="header-wallet-provider"]')).toContainText('Kabila');

            // Navigate to booking creation page
            await page.goto('/bookings/create');

            // Verify state synchronization in booking form
            await expect(page.locator('[data-testid="booking-wallet-status"]')).toContainText('Connected');
            await expect(page.locator('[data-testid="booking-wallet-address"]')).toContainText('0x1234...3456');
            await expect(page.locator('[data-testid="booking-wallet-balance"]')).toContainText('100.5 HBAR');

            // Navigate to swap creation page
            await page.goto('/swaps/create');

            // Verify state synchronization in swap form
            await expect(page.locator('[data-testid="swap-wallet-status"]')).toContainText('Connected');
            await expect(page.locator('[data-testid="swap-wallet-address"]')).toContainText('0x1234...3456');
            await expect(page.locator('[data-testid="swap-wallet-network"]')).toContainText('Testnet');

            // Navigate to profile page
            await page.goto('/profile');

            // Verify state synchronization in profile
            await expect(page.locator('[data-testid="profile-wallet-section"]')).toBeVisible();
            await expect(page.locator('[data-testid="profile-connected-wallet"]')).toContainText('Kabila Wallet');
            await expect(page.locator('[data-testid="profile-wallet-account"]')).toContainText('0.0.123456');
        });

        test('should handle connection state changes and propagate to all components', async ({ page }) => {
            let connectionState = true;

            // Setup Kabila wallet with dynamic connection state
            await page.addInitScript(() => {
                let connected = true;
                // @ts-ignore
                window.setConnectionState = (state) => {
                    connected = state;
                };

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => connected,
                    disconnect: async () => {
                        connected = false;
                    },
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Open multiple pages in different tabs/contexts to test state sync
            const bookingPage = await page.context().newPage();
            await bookingPage.goto('/bookings/create');
            await expect(bookingPage.locator('[data-testid="booking-wallet-status"]')).toContainText('Connected');

            const swapPage = await page.context().newPage();
            await swapPage.goto('/swaps/create');
            await expect(swapPage.locator('[data-testid="swap-wallet-status"]')).toContainText('Connected');

            // Simulate disconnection from extension
            await page.addInitScript(() => {
                // @ts-ignore
                window.setConnectionState(false);
            });

            // Trigger state sync check on main page
            await page.click('[data-testid="refresh-wallet-status"]');

            // Verify disconnection is detected on main page
            await expect(page.locator('[data-testid="wallet-disconnected-notice"]')).toBeVisible();
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

            // Verify state propagation to other pages
            await bookingPage.reload();
            await expect(bookingPage.locator('[data-testid="wallet-required-message"]')).toBeVisible();

            await swapPage.reload();
            await expect(swapPage.locator('[data-testid="connect-wallet-prompt"]')).toBeVisible();

            await bookingPage.close();
            await swapPage.close();
        });

        test('should maintain consistent state during rapid component updates', async ({ page }) => {
            // Setup Kabila wallet
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Rapidly navigate between pages to test state consistency
            const pages = ['/bookings', '/swaps', '/profile', '/', '/bookings/create', '/swaps/create'];

            for (let i = 0; i < 3; i++) { // Repeat cycle 3 times
                for (const pagePath of pages) {
                    await page.goto(pagePath);

                    // Verify wallet state is consistent on each page
                    if (pagePath.includes('create')) {
                        await expect(page.locator('[data-testid="wallet-info-section"]')).toBeVisible();
                    } else {
                        await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
                    }

                    // Quick navigation - don't wait for full page load
                    await page.waitForTimeout(100);
                }
            }

            // Final verification that state is still consistent
            await page.goto('/');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Kabila Wallet');
        });
    });

    test.describe('Connection Restoration After Browser Restart', () => {
        test('should restore Kabila connection after browser restart simulation', async ({ page }) => {
            // Setup Kabila wallet
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Verify connection state is saved
            const connectionState = await page.evaluate(() =>
                localStorage.getItem('kabila_connection_state')
            );
            expect(connectionState).toBeTruthy();

            // Simulate browser restart by clearing session storage but keeping localStorage
            await page.evaluate(() => {
                sessionStorage.clear();
                // Keep localStorage to simulate browser restart (not data clearing)
            });

            // Reload page to simulate browser restart
            await page.reload();

            // Verify connection is automatically restored
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');
            await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Kabila Wallet');

            // Verify restoration works across different pages
            await page.goto('/bookings/create');
            await expect(page.locator('[data-testid="booking-wallet-status"]')).toContainText('Connected');

            await page.goto('/swaps/create');
            await expect(page.locator('[data-testid="swap-wallet-status"]')).toContainText('Connected');
        });

        test('should handle invalid stored connection gracefully', async ({ page }) => {
            // Set invalid connection state in localStorage
            await page.addInitScript(() => {
                localStorage.setItem('kabila_connection_state', JSON.stringify({
                    accountId: '0.0.invalid',
                    network: 'testnet',
                    timestamp: Date.now(),
                }));

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    isConnected: () => false, // Extension shows disconnected
                    getAccountInfo: async () => {
                        throw new Error('No connection found');
                    },
                };
            });

            await page.goto('/');

            // Verify graceful fallback to disconnected state
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

            // Verify invalid session data is cleared
            const clearedState = await page.evaluate(() =>
                localStorage.getItem('kabila_connection_state')
            );
            expect(clearedState).toBeFalsy();
        });

        test('should handle connection restoration with account changes', async ({ page }) => {
            // Setup initial connection
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Simulate account change in extension (user switched accounts)
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.getAccountInfo = async () => ({
                    accountId: '0.0.789012', // Different account
                    network: 'testnet',
                });
            });

            // Reload page
            await page.reload();

            // Verify stored connection is invalidated due to account mismatch
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

            // Verify user can connect with new account
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x7890...9012');
        });

        test('should handle connection restoration timeout gracefully', async ({ page }) => {
            // Setup slow restoration scenario
            await page.addInitScript(() => {
                localStorage.setItem('kabila_connection_state', JSON.stringify({
                    accountId: '0.0.123456',
                    network: 'testnet',
                    timestamp: Date.now(),
                }));

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    isConnected: () => true,
                    getAccountInfo: async () => {
                        // Simulate very slow response
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.goto('/');

            // Should show loading state initially
            await expect(page.locator('[data-testid="wallet-restoring"]')).toBeVisible();

            // Should timeout and fallback to disconnected state
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible({ timeout: 15000 });
            await expect(page.locator('[data-testid="wallet-restoring"]')).not.toBeVisible();

            // Verify restoration timeout message
            await expect(page.locator('[data-testid="restoration-timeout-notice"]')).toBeVisible();
            await expect(page.locator('[data-testid="manual-reconnect-button"]')).toBeVisible();
        });
    });

    test.describe('Network Change Detection and State Updates', () => {
        test('should detect and handle Kabila network changes', async ({ page }) => {
            let currentNetwork = 'testnet';

            // Setup Kabila wallet with network switching
            await page.addInitScript(() => {
                let network = 'testnet';
                // @ts-ignore
                window.switchNetwork = (newNetwork) => {
                    network = newNetwork;
                };

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: network,
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: network,
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Testnet');

            // Simulate network change in extension
            await page.addInitScript(() => {
                // @ts-ignore
                window.switchNetwork('mainnet');
            });

            // Wait for network change detection (should happen within 5-10 seconds)
            await expect(page.locator('[data-testid="network-change-detected"]')).toBeVisible({ timeout: 12000 });
            await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Mainnet');

            // Verify network change is reflected across components
            await page.goto('/bookings/create');
            await expect(page.locator('[data-testid="booking-wallet-network"]')).toContainText('Mainnet');

            await page.goto('/swaps/create');
            await expect(page.locator('[data-testid="swap-wallet-network"]')).toContainText('Mainnet');
        });

        test('should handle unsupported network changes', async ({ page }) => {
            // Setup Kabila wallet
            await page.addInitScript(() => {
                let network = 'testnet';
                // @ts-ignore
                window.switchToUnsupportedNetwork = () => {
                    network = 'previewnet'; // Unsupported network
                };

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: network,
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: network,
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Switch to unsupported network
            await page.addInitScript(() => {
                // @ts-ignore
                window.switchToUnsupportedNetwork();
            });

            // Wait for network change detection
            await page.waitForTimeout(6000);

            // Verify unsupported network warning
            await expect(page.locator('[data-testid="unsupported-network-warning"]')).toBeVisible();
            await expect(page.locator('[data-testid="network-warning-message"]')).toContainText('Unsupported network detected');
            await expect(page.locator('[data-testid="supported-networks-list"]')).toContainText('Mainnet, Testnet');

            // Verify wallet functionality is limited
            await page.goto('/bookings/create');
            await expect(page.locator('[data-testid="network-restriction-notice"]')).toBeVisible();
            await expect(page.locator('[data-testid="booking-form"]')).toHaveClass(/disabled/);
        });

        test('should handle network change failures gracefully', async ({ page }) => {
            // Setup Kabila wallet with network change detection issues
            await page.addInitScript(() => {
                let networkCallCount = 0;
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountInfo: async () => {
                        networkCallCount++;
                        if (networkCallCount > 3) {
                            throw new Error('Network detection failed');
                        }
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Wait for network detection to fail
            await page.waitForTimeout(8000);

            // Verify graceful handling of network detection failure
            await expect(page.locator('[data-testid="network-detection-warning"]')).toBeVisible();
            await expect(page.locator('[data-testid="manual-network-refresh-button"]')).toBeVisible();

            // Verify wallet remains connected despite network detection issues
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');
        });
    });

    test.describe('Connection State Persistence and Recovery', () => {
        test('should persist connection state across browser sessions', async ({ page }) => {
            // Setup Kabila wallet
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                };
            });

            // Connect wallet
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Verify connection data is persisted
            const connectionData = await page.evaluate(() => {
                const stored = localStorage.getItem('kabila_connection_state');
                return stored ? JSON.parse(stored) : null;
            });

            expect(connectionData).toBeTruthy();
            expect(connectionData.accountId).toBe('0.0.123456');
            expect(connectionData.network).toBe('testnet');
            expect(connectionData.timestamp).toBeTruthy();

            // Create new page context to simulate new browser session
            const newContext = await page.context().browser()?.newContext();
            const newPage = await newContext?.newPage();

            if (newPage) {
                // Copy localStorage to new context
                await newPage.addInitScript((data) => {
                    localStorage.setItem('kabila_connection_state', JSON.stringify(data));

                    // @ts-ignore
                    window.kabila = {
                        isAvailable: true,
                        getAccountInfo: async () => ({
                            accountId: '0.0.123456',
                            network: 'testnet',
                        }),
                        getAccountBalance: async () => ({
                            balance: '100.5',
                        }),
                        isConnected: () => true,
                    };
                }, connectionData);

                await newPage.goto('/');

                // Verify connection is restored in new session
                await expect(newPage.locator('[data-testid="wallet-connected"]')).toBeVisible();
                await expect(newPage.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');

                await newContext?.close();
            }
        });

        test('should handle connection state corruption gracefully', async ({ page }) => {
            // Set corrupted connection state
            await page.addInitScript(() => {
                localStorage.setItem('kabila_connection_state', 'invalid-json-data');

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    isConnected: () => false,
                };
            });

            await page.goto('/');

            // Verify graceful handling of corrupted state
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

            // Verify corrupted state is cleared
            const clearedState = await page.evaluate(() =>
                localStorage.getItem('kabila_connection_state')
            );
            expect(clearedState).toBeFalsy();
        });

        test('should handle expired connection state', async ({ page }) => {
            // Set expired connection state (older than 24 hours)
            const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

            await page.addInitScript((timestamp) => {
                localStorage.setItem('kabila_connection_state', JSON.stringify({
                    accountId: '0.0.123456',
                    network: 'testnet',
                    timestamp: timestamp,
                }));

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    isConnected: () => false,
                };
            }, expiredTimestamp);

            await page.goto('/');

            // Verify expired state is not restored
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

            // Verify expired state is cleared
            const clearedState = await page.evaluate(() =>
                localStorage.getItem('kabila_connection_state')
            );
            expect(clearedState).toBeFalsy();
        });

        test('should handle connection state validation failures', async ({ page }) => {
            // Setup connection state with validation that will fail
            await page.addInitScript(() => {
                localStorage.setItem('kabila_connection_state', JSON.stringify({
                    accountId: '0.0.123456',
                    network: 'testnet',
                    timestamp: Date.now(),
                }));

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    isConnected: () => true,
                    getAccountInfo: async () => {
                        // Return different account than stored
                        return {
                            accountId: '0.0.789012',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.goto('/');

            // Verify validation failure is handled gracefully
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();

            // Verify invalid state is cleared
            const clearedState = await page.evaluate(() =>
                localStorage.getItem('kabila_connection_state')
            );
            expect(clearedState).toBeFalsy();

            // Verify user can establish new connection
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x7890...9012');
        });
    });
});