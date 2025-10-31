import { test, expect } from '@playwright/test';

test.describe('Kabila Wallet Integration E2E Tests', () => {
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

    test.describe('End-to-End Kabila Wallet Flow', () => {
        test('should complete full Kabila wallet connection flow', async ({ page }) => {
            // Setup Kabila wallet with proper interface
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    disconnect: async () => { },
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                    signTransaction: async () => ({
                        signature: 'kabila-signature',
                    }),
                };
            });

            // Step 1: Open wallet selection modal
            await page.click('[data-testid="connect-wallet-button"]');
            await expect(page.locator('[data-testid="wallet-selection-modal"]')).toBeVisible();

            // Step 2: Verify Kabila wallet is detected and available
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).toBeVisible();
            await expect(page.locator('[data-testid="provider-status-kabila"]')).toContainText('Available');
            await expect(page.locator('[data-testid="provider-name-kabila"]')).toContainText('Kabila Wallet');

            // Step 3: Connect to Kabila wallet
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Step 4: Verify connection success
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');
            await expect(page.locator('[data-testid="wallet-balance"]')).toContainText('100.5 HBAR');
            await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Testnet');
            await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Kabila Wallet');

            // Step 5: Verify modal closes after connection
            await expect(page.locator('[data-testid="wallet-selection-modal"]')).not.toBeVisible();

            // Step 6: Test wallet functionality in application
            await page.goto('/bookings/create');
            await expect(page.locator('[data-testid="wallet-info-section"]')).toBeVisible();
            await expect(page.locator('[data-testid="connected-wallet-display"]')).toContainText('0x1234...3456');

            // Step 7: Test transaction signing
            await page.fill('[data-testid="booking-title"]', 'Test Kabila Booking');
            await page.selectOption('[data-testid="booking-type"]', 'hotel');
            await page.fill('[data-testid="booking-city"]', 'Test City');
            await page.fill('[data-testid="booking-country"]', 'Test Country');
            await page.fill('[data-testid="check-in-date"]', '2024-12-20');
            await page.fill('[data-testid="check-out-date"]', '2024-12-25');
            await page.fill('[data-testid="original-price"]', '1000');
            await page.fill('[data-testid="swap-value"]', '900');

            // Mock booking API
            await page.route('**/api/bookings', async (route) => {
                if (route.request().method() === 'POST') {
                    await route.fulfill({
                        status: 201,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            id: 'booking-123',
                            title: 'Test Kabila Booking',
                            walletAddress: '0.0.123456',
                            transactionId: 'kabila-tx-123',
                        }),
                    });
                }
            });

            await page.click('[data-testid="submit-booking"]');

            // Verify transaction signing prompt
            await expect(page.locator('[data-testid="transaction-signing"]')).toBeVisible();
            await expect(page.locator('[data-testid="signing-message"]')).toContainText('Please sign the transaction');

            // Verify successful creation
            await expect(page.locator('[data-testid="booking-created-success"]')).toContainText('Booking created successfully');
            await expect(page.locator('[data-testid="transaction-id-display"]')).toContainText('kabila-tx-123');
        });

        test('should handle Kabila wallet connection persistence across sessions', async ({ page }) => {
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

            // Reload page to test persistence
            await page.reload();

            // Verify connection is restored
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');
            await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Kabila Wallet');

            // Navigate to different page
            await page.goto('/bookings');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Test browser restart simulation
            await page.context().clearCookies();
            await page.reload();

            // Connection should still be restored from localStorage
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
        });

        test('should handle proper error handling and user guidance throughout flow', async ({ page }) => {
            // Test 1: Extension not installed
            await page.addInitScript(() => {
                // No kabila object
            });

            await page.click('[data-testid="connect-wallet-button"]');

            // Verify Kabila is not shown when not installed
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).not.toBeVisible();

            // Install extension simulation
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: false, // Locked
                };
            });

            await page.click('[data-testid="refresh-providers-button"]');

            // Test 2: Extension locked
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).toBeVisible();
            await expect(page.locator('[data-testid="provider-status-kabila"]')).toContainText('Locked');

            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-locked-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="unlock-guidance"]')).toContainText('Please unlock your Kabila wallet');

            // Unlock wallet simulation
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        throw new Error('User rejected the connection request');
                    },
                };
            });

            await page.click('[data-testid="retry-after-unlock-button"]');

            // Test 3: Connection rejected
            await expect(page.locator('[data-testid="connection-rejected-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="rejection-guidance"]')).toContainText('Please try again and approve the connection');

            // Approve connection simulation
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.connect = async () => ({
                    accountId: '0.0.123456',
                    network: 'mainnet', // Wrong network
                });
                // @ts-ignore
                window.kabila.getAccountInfo = async () => ({
                    accountId: '0.0.123456',
                    network: 'mainnet',
                });
            });

            await page.click('[data-testid="retry-connection-button"]');

            // Test 4: Wrong network
            await expect(page.locator('[data-testid="wrong-network-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="network-guidance"]')).toContainText('Please switch to testnet');

            // Switch network simulation
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.getAccountInfo = async () => ({
                    accountId: '0.0.123456',
                    network: 'testnet',
                });
                // @ts-ignore
                window.kabila.getAccountBalance = async () => ({
                    balance: '100.5',
                });
                // @ts-ignore
                window.kabila.isConnected = () => true;
            });

            await page.click('[data-testid="switch-network-button"]');

            // Test 5: Final success
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Testnet');
        });

        test('should validate Kabila wallet connection properly', async ({ page }) => {
            // Setup connected Kabila wallet
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

            // Test validation in swap creation
            await page.goto('/swaps/create');

            // Verify wallet validation passes
            await expect(page.locator('[data-testid="wallet-validation-status"]')).toContainText('Connected');
            await expect(page.locator('[data-testid="wallet-validation-icon"]')).toHaveClass(/success/);

            // Test validation with insufficient balance
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.getAccountBalance = async () => ({
                    balance: '0.001', // Very low balance
                });
            });

            // Trigger validation refresh
            await page.click('[data-testid="refresh-wallet-status"]');

            // Verify balance validation
            await expect(page.locator('[data-testid="balance-warning"]')).toBeVisible();
            await expect(page.locator('[data-testid="balance-warning"]')).toContainText('Low balance detected');

            // Test validation with disconnected wallet
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.isConnected = () => false;
            });

            await page.click('[data-testid="refresh-wallet-status"]');

            // Verify disconnection detection
            await expect(page.locator('[data-testid="wallet-disconnected-notice"]')).toBeVisible();
            await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible();
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

    test.describe('Kabila Wallet Availability Detection', () => {
        test('should detect Kabila wallet availability with retry logic', async ({ page }) => {
            // Test delayed availability (simulating extension loading)
            await page.addInitScript(() => {
                // Simulate extension loading delay
                setTimeout(() => {
                    // @ts-ignore
                    window.kabila = {
                        isAvailable: true,
                        connect: async () => ({
                            accountId: '0.0.123456',
                            network: 'testnet',
                        }),
                    };
                }, 2000);
            });

            await page.click('[data-testid="connect-wallet-button"]');

            // Initially Kabila should not be visible
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).not.toBeVisible();

            // Wait for retry logic to detect the extension
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).toBeVisible({ timeout: 5000 });
            await expect(page.locator('[data-testid="provider-status-kabila"]')).toContainText('Available');
        });

        test('should handle Kabila extension timeout gracefully', async ({ page }) => {
            // Setup very slow loading extension
            await page.addInitScript(() => {
                setTimeout(() => {
                    // @ts-ignore
                    window.kabila = {
                        isAvailable: true,
                    };
                }, 10000); // 10 second delay, longer than timeout
            });

            await page.click('[data-testid="connect-wallet-button"]');

            // Should timeout and not show Kabila
            await page.waitForTimeout(4000);
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).not.toBeVisible();

            // Manual refresh should work after extension loads
            await page.waitForTimeout(7000); // Wait for extension to load
            await page.click('[data-testid="refresh-providers-button"]');

            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).toBeVisible();
        });

        test('should cache availability results to improve performance', async ({ page }) => {
            let availabilityCheckCount = 0;

            await page.addInitScript(() => {
                let checkCount = 0;
                // @ts-ignore
                window.kabila = {
                    get isAvailable() {
                        // @ts-ignore
                        window.availabilityCheckCount = ++checkCount;
                        return true;
                    },
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                };
            });

            // Open and close modal multiple times quickly
            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="close-modal-button"]');

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="close-modal-button"]');

            await page.click('[data-testid="connect-wallet-button"]');

            // Check that availability was cached (should be called fewer times than modal opens)
            const checkCount = await page.evaluate(() =>
                // @ts-ignore
                window.availabilityCheckCount
            );

            expect(checkCount).toBeLessThan(6); // Should be cached, not called every time
        });
    });

    test.describe('Kabila Connection State Management', () => {
        test('should maintain connection state across page navigation', async ({ page }) => {
            // Setup and connect Kabila wallet
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

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();

            // Navigate through different pages
            const pages = ['/bookings', '/swaps', '/profile', '/'];

            for (const pagePath of pages) {
                await page.goto(pagePath);
                await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
                await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Kabila Wallet');
                await expect(page.locator('[data-testid="wallet-address"]')).toContainText('0x1234...3456');
            }
        });

        test('should handle connection state synchronization between components', async ({ page }) => {
            // Setup Kabila wallet
            await page.addInitScript(() => {
                let connected = true;
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

            // Open multiple components that show wallet status
            await page.goto('/bookings/create');
            await expect(page.locator('[data-testid="wallet-info-section"]')).toBeVisible();
            await expect(page.locator('[data-testid="connected-wallet-display"]')).toContainText('0x1234...3456');

            // Simulate external disconnection (user disconnects from extension)
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.isConnected = () => false;
            });

            // Trigger state sync check
            await page.click('[data-testid="refresh-wallet-status"]');

            // Verify all components reflect disconnected state
            await expect(page.locator('[data-testid="wallet-disconnected-notice"]')).toBeVisible();
            await expect(page.locator('[data-testid="connect-wallet-button"]')).toBeVisible();

            // Check header also shows disconnected
            await expect(page.locator('[data-testid="wallet-connected"]')).not.toBeVisible();
        });

        test('should handle network changes and state updates', async ({ page }) => {
            // Setup Kabila wallet with network switching capability
            await page.addInitScript(() => {
                let currentNetwork = 'testnet';
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: currentNetwork,
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: currentNetwork,
                    }),
                    getAccountBalance: async () => ({
                        balance: '100.5',
                    }),
                    isConnected: () => true,
                    switchNetwork: async (network) => {
                        currentNetwork = network;
                        return { success: true, network };
                    },
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
                window.kabila.getAccountInfo = async () => ({
                    accountId: '0.0.123456',
                    network: 'mainnet',
                });
            });

            // Trigger network change detection
            await page.waitForTimeout(6000); // Wait for network check interval

            // Verify network change is detected and handled
            await expect(page.locator('[data-testid="network-change-notice"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-network"]')).toContainText('Mainnet');
        });
    });
});