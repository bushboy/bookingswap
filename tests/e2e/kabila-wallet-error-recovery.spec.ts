import { test, expect } from '@playwright/test';

test.describe('Kabila Wallet Error Scenarios and Recovery E2E Tests', () => {
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

    test.describe('Extension Not Installed Scenarios', () => {
        test('should handle Kabila extension not installed error', async ({ page }) => {
            // No kabila object in window
            await page.addInitScript(() => {
                // Ensure no kabila object exists
                // @ts-ignore
                delete window.kabila;
            });

            await page.click('[data-testid="connect-wallet-button"]');

            // Verify Kabila is not shown in available providers
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).not.toBeVisible();

            // Verify general guidance is shown
            await expect(page.locator('[data-testid="no-providers-message"]')).toContainText('No wallet providers detected');
            await expect(page.locator('[data-testid="installation-instructions"]')).toBeVisible();

            // Test installation guidance
            await expect(page.locator('[data-testid="install-kabila-link"]')).toHaveAttribute('href', 'https://chrome.google.com/webstore/detail/kabila-wallet');

            // Simulate extension installation
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: 'testnet',
                    }),
                };
            });

            // Refresh providers
            await page.click('[data-testid="refresh-providers-button"]');

            // Verify Kabila now appears
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).toBeVisible();
            await expect(page.locator('[data-testid="provider-status-kabila"]')).toContainText('Available');
        });

        test('should provide specific Kabila installation guidance', async ({ page }) => {
            // No kabila extension
            await page.click('[data-testid="connect-wallet-button"]');

            // Check for Kabila-specific installation guidance
            await expect(page.locator('[data-testid="kabila-install-guidance"]')).toBeVisible();
            await expect(page.locator('[data-testid="kabila-install-steps"]')).toContainText('Install Kabila Wallet extension');
            await expect(page.locator('[data-testid="kabila-install-steps"]')).toContainText('Create or import your Hedera account');
            await expect(page.locator('[data-testid="kabila-install-steps"]')).toContainText('Return to this page and refresh');

            // Test direct installation link
            const [newPage] = await Promise.all([
                page.context().waitForEvent('page'),
                page.click('[data-testid="install-kabila-button"]')
            ]);

            expect(newPage.url()).toContain('chrome.google.com/webstore');
            await newPage.close();
        });
    });

    test.describe('Extension Locked Scenarios', () => {
        test('should handle Kabila wallet locked error with recovery', async ({ page }) => {
            // Setup locked Kabila wallet
            await page.addInitScript(() => {
                let unlocked = false;
                // @ts-ignore
                window.kabila = {
                    isAvailable: false, // Locked state
                    connect: async () => {
                        if (!unlocked) {
                            throw new Error('Wallet is locked. Please unlock your wallet.');
                        }
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                    unlock: () => {
                        unlocked = true;
                        // @ts-ignore
                        window.kabila.isAvailable = true;
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');

            // Verify Kabila shows as locked
            await expect(page.locator('[data-testid="wallet-provider-kabila"]')).toBeVisible();
            await expect(page.locator('[data-testid="provider-status-kabila"]')).toContainText('Locked');

            // Try to connect
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Verify locked error message
            await expect(page.locator('[data-testid="wallet-locked-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="locked-message"]')).toContainText('Kabila wallet is locked');
            await expect(page.locator('[data-testid="unlock-guidance"]')).toContainText('Please unlock your wallet');

            // Verify unlock instructions
            await expect(page.locator('[data-testid="unlock-instructions"]')).toBeVisible();
            await expect(page.locator('[data-testid="unlock-steps"]')).toContainText('Click the Kabila extension icon');
            await expect(page.locator('[data-testid="unlock-steps"]')).toContainText('Enter your password');

            // Simulate wallet unlock
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.unlock();
            });

            // Retry connection
            await page.click('[data-testid="retry-after-unlock-button"]');

            // Verify successful connection
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="wallet-provider-name"]')).toContainText('Kabila Wallet');
        });

        test('should handle multiple unlock attempts', async ({ page }) => {
            let unlockAttempts = 0;

            await page.addInitScript(() => {
                let attempts = 0;
                // @ts-ignore
                window.kabila = {
                    isAvailable: false,
                    connect: async () => {
                        attempts++;
                        if (attempts < 3) {
                            throw new Error('Wallet is locked. Please unlock your wallet.');
                        }
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // First attempt - locked
            await expect(page.locator('[data-testid="wallet-locked-error"]')).toBeVisible();
            await page.click('[data-testid="retry-after-unlock-button"]');

            // Second attempt - still locked
            await expect(page.locator('[data-testid="wallet-locked-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="unlock-attempts-count"]')).toContainText('Attempt 2');
            await page.click('[data-testid="retry-after-unlock-button"]');

            // Third attempt - success
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
        });
    });

    test.describe('Connection Rejected Scenarios', () => {
        test('should handle user rejection with retry options', async ({ page }) => {
            // Setup wallet that rejects connection initially
            await page.addInitScript(() => {
                let rejectionCount = 0;
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        rejectionCount++;
                        if (rejectionCount <= 2) {
                            throw new Error('User rejected the connection request');
                        }
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Verify rejection error
            await expect(page.locator('[data-testid="connection-rejected-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="rejection-message"]')).toContainText('Connection was rejected');
            await expect(page.locator('[data-testid="rejection-guidance"]')).toContainText('Please try again and approve the connection');

            // Verify retry options
            await expect(page.locator('[data-testid="retry-connection-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="try-different-wallet-button"]')).toBeVisible();

            // First retry - still rejected
            await page.click('[data-testid="retry-connection-button"]');
            await expect(page.locator('[data-testid="connection-rejected-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="rejection-count"]')).toContainText('Attempt 2');

            // Second retry - success
            await page.click('[data-testid="retry-connection-button"]');
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
        });

        test('should provide detailed rejection recovery guidance', async ({ page }) => {
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        throw new Error('User rejected the connection request');
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Verify detailed guidance
            await expect(page.locator('[data-testid="rejection-help"]')).toBeVisible();
            await expect(page.locator('[data-testid="rejection-help"]')).toContainText('When the Kabila popup appears');
            await expect(page.locator('[data-testid="rejection-help"]')).toContainText('Click "Connect" or "Approve"');
            await expect(page.locator('[data-testid="rejection-help"]')).toContainText('Do not close the popup');

            // Test help video/guide link
            await expect(page.locator('[data-testid="connection-help-link"]')).toHaveAttribute('href', '/help/wallet-connection');
        });
    });

    test.describe('Network Error Scenarios', () => {
        test('should handle network connectivity issues with automatic retry', async ({ page }) => {
            let networkAttempts = 0;

            await page.addInitScript(() => {
                let attempts = 0;
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        attempts++;
                        if (attempts <= 2) {
                            throw new Error('Network request failed');
                        }
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Verify network error
            await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="network-error-message"]')).toContainText('Network connection error');
            await expect(page.locator('[data-testid="connectivity-guidance"]')).toContainText('Please check your internet connection');

            // Verify automatic retry countdown
            await expect(page.locator('[data-testid="auto-retry-countdown"]')).toBeVisible();
            await expect(page.locator('[data-testid="retry-countdown"]')).toContainText('Retrying in');

            // Wait for automatic retry
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 10000 });
        });

        test('should handle wrong network error with switch guidance', async ({ page }) => {
            await page.addInitScript(() => {
                let networkSwitched = false;
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => ({
                        accountId: '0.0.123456',
                        network: networkSwitched ? 'testnet' : 'mainnet',
                    }),
                    getAccountInfo: async () => ({
                        accountId: '0.0.123456',
                        network: networkSwitched ? 'testnet' : 'mainnet',
                    }),
                    switchNetwork: async (network) => {
                        networkSwitched = true;
                        return { success: true, network: 'testnet' };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

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

        test('should handle Hedera network outage gracefully', async ({ page }) => {
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

            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        // Simulate network check failure
                        const response = await fetch('/api/hedera/status');
                        if (!response.ok) {
                            throw new Error('Hedera network unavailable');
                        }
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

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

    test.describe('Automatic Retry Mechanisms', () => {
        test('should implement exponential backoff for connection retries', async ({ page }) => {
            let attemptTimes: number[] = [];

            await page.addInitScript(() => {
                let attempts = 0;
                const attemptTimes: number[] = [];
                // @ts-ignore
                window.attemptTimes = attemptTimes;

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        attempts++;
                        attemptTimes.push(Date.now());

                        if (attempts <= 3) {
                            throw new Error('Connection timeout');
                        }
                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Wait for all retries to complete
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible({ timeout: 15000 });

            // Verify exponential backoff timing
            const times = await page.evaluate(() =>
                // @ts-ignore
                window.attemptTimes
            );

            expect(times.length).toBe(4); // Initial + 3 retries

            // Check that delays increase (exponential backoff)
            const delay1 = times[1] - times[0];
            const delay2 = times[2] - times[1];
            const delay3 = times[3] - times[2];

            expect(delay2).toBeGreaterThan(delay1);
            expect(delay3).toBeGreaterThan(delay2);
        });

        test('should limit maximum retry attempts', async ({ page }) => {
            let attemptCount = 0;

            await page.addInitScript(() => {
                let attempts = 0;
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        attempts++;
                        // @ts-ignore
                        window.attemptCount = attempts;
                        throw new Error('Persistent connection error');
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Wait for all retries to exhaust
            await expect(page.locator('[data-testid="max-retries-exceeded"]')).toBeVisible({ timeout: 20000 });

            // Verify maximum attempts were made
            const finalAttemptCount = await page.evaluate(() =>
                // @ts-ignore
                window.attemptCount
            );

            expect(finalAttemptCount).toBeLessThanOrEqual(5); // Should not exceed max retries

            // Verify manual retry option is available
            await expect(page.locator('[data-testid="manual-retry-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="contact-support-button"]')).toBeVisible();
        });

        test('should allow user-initiated retries after automatic retries fail', async ({ page }) => {
            let manualRetryTriggered = false;

            await page.addInitScript(() => {
                let attempts = 0;
                let manualRetry = false;

                // @ts-ignore
                window.triggerManualRetry = () => {
                    manualRetry = true;
                };

                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        attempts++;

                        // Fail automatic retries but succeed on manual retry
                        if (!manualRetry && attempts <= 4) {
                            throw new Error('Automatic retry failed');
                        }

                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Wait for automatic retries to fail
            await expect(page.locator('[data-testid="max-retries-exceeded"]')).toBeVisible({ timeout: 20000 });

            // Trigger manual retry
            await page.addInitScript(() => {
                // @ts-ignore
                window.triggerManualRetry();
            });

            await page.click('[data-testid="manual-retry-button"]');

            // Verify manual retry succeeds
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
        });
    });

    test.describe('User-Initiated Retries', () => {
        test('should provide clear retry options for different error types', async ({ page }) => {
            const errorScenarios = [
                {
                    error: 'User rejected the connection request',
                    expectedButton: 'retry-connection-button',
                    expectedGuidance: 'Please approve the connection request'
                },
                {
                    error: 'Wallet is locked',
                    expectedButton: 'retry-after-unlock-button',
                    expectedGuidance: 'Please unlock your wallet'
                },
                {
                    error: 'Network request failed',
                    expectedButton: 'retry-network-button',
                    expectedGuidance: 'Check your internet connection'
                },
                {
                    error: 'Wrong network detected',
                    expectedButton: 'switch-network-button',
                    expectedGuidance: 'Switch to the correct network'
                }
            ];

            for (const scenario of errorScenarios) {
                // Setup error scenario
                await page.addInitScript((errorMessage) => {
                    // @ts-ignore
                    window.kabila = {
                        isAvailable: true,
                        connect: async () => {
                            throw new Error(errorMessage);
                        },
                    };
                }, scenario.error);

                await page.click('[data-testid="connect-wallet-button"]');
                await page.click('[data-testid="wallet-provider-kabila"]');

                // Verify appropriate retry button and guidance
                await expect(page.locator(`[data-testid="${scenario.expectedButton}"]`)).toBeVisible();
                await expect(page.locator('[data-testid="error-guidance"]')).toContainText(scenario.expectedGuidance);

                // Close modal for next test
                await page.click('[data-testid="close-modal-button"]');
            }
        });

        test('should track retry attempts and provide escalation options', async ({ page }) => {
            let retryCount = 0;

            await page.addInitScript(() => {
                let attempts = 0;
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        attempts++;
                        // @ts-ignore
                        window.retryCount = attempts;

                        if (attempts <= 5) {
                            throw new Error('Persistent connection error');
                        }

                        return {
                            accountId: '0.0.123456',
                            network: 'testnet',
                        };
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Make multiple manual retry attempts
            for (let i = 0; i < 3; i++) {
                await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
                await expect(page.locator('[data-testid="retry-count"]')).toContainText(`Attempt ${i + 1}`);
                await page.click('[data-testid="retry-connection-button"]');
            }

            // After multiple failures, escalation options should appear
            await expect(page.locator('[data-testid="escalation-options"]')).toBeVisible();
            await expect(page.locator('[data-testid="try-different-wallet-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="contact-support-button"]')).toBeVisible();
            await expect(page.locator('[data-testid="troubleshooting-guide-link"]')).toBeVisible();
        });
    });

    test.describe('Comprehensive Error Recovery Flow', () => {
        test('should handle complete error recovery journey', async ({ page }) => {
            // Multi-stage error recovery test
            let errorStage = 'not-installed';

            await page.addInitScript(() => {
                // @ts-ignore
                window.setErrorStage = (stage) => {
                    // @ts-ignore
                    window.errorStage = stage;
                };
            });

            // Stage 1: Extension not installed
            await page.click('[data-testid="connect-wallet-button"]');
            await expect(page.locator('[data-testid="no-providers-available"]')).toBeVisible();

            // Install extension
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: false, // Locked
                    connect: async () => {
                        throw new Error('Wallet is locked');
                    },
                };
            });

            await page.click('[data-testid="refresh-providers-button"]');

            // Stage 2: Extension locked
            await page.click('[data-testid="wallet-provider-kabila"]');
            await expect(page.locator('[data-testid="wallet-locked-error"]')).toBeVisible();

            // Unlock wallet
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila.isAvailable = true;
                // @ts-ignore
                window.kabila.connect = async () => {
                    throw new Error('User rejected the connection request');
                };
            });

            await page.click('[data-testid="retry-after-unlock-button"]');

            // Stage 3: Connection rejected
            await expect(page.locator('[data-testid="connection-rejected-error"]')).toBeVisible();

            // Approve connection
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

            // Stage 4: Wrong network
            await expect(page.locator('[data-testid="wrong-network-error"]')).toBeVisible();

            // Switch network
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

            // Stage 5: Final success
            await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
            await expect(page.locator('[data-testid="recovery-success-message"]')).toContainText('Successfully connected after resolving issues');

            // Verify error history tracking
            await page.click('[data-testid="connection-history-button"]');
            await expect(page.locator('[data-testid="error-history-modal"]')).toBeVisible();
            await expect(page.locator('[data-testid="error-entry"]')).toHaveCount(4); // All errors tracked
            await expect(page.locator('[data-testid="error-entry"]')).toHaveClass(/resolved/); // All resolved
        });

        test('should provide contextual help throughout error recovery', async ({ page }) => {
            // Setup error scenario
            await page.addInitScript(() => {
                // @ts-ignore
                window.kabila = {
                    isAvailable: true,
                    connect: async () => {
                        throw new Error('Connection timeout');
                    },
                };
            });

            await page.click('[data-testid="connect-wallet-button"]');
            await page.click('[data-testid="wallet-provider-kabila"]');

            // Verify contextual help is available
            await expect(page.locator('[data-testid="error-help-section"]')).toBeVisible();
            await expect(page.locator('[data-testid="troubleshooting-tips"]')).toBeVisible();
            await expect(page.locator('[data-testid="help-center-link"]')).toBeVisible();

            // Test help expansion
            await page.click('[data-testid="show-detailed-help"]');
            await expect(page.locator('[data-testid="detailed-troubleshooting"]')).toBeVisible();
            await expect(page.locator('[data-testid="common-solutions"]')).toContainText('Common solutions');
            await expect(page.locator('[data-testid="step-by-step-guide"]')).toBeVisible();

            // Test help links
            const [helpPage] = await Promise.all([
                page.context().waitForEvent('page'),
                page.click('[data-testid="help-center-link"]')
            ]);

            expect(helpPage.url()).toContain('/help/kabila-wallet-connection');
            await helpPage.close();
        });
    });
});