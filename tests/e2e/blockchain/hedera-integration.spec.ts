import { test, expect } from '@playwright/test';
import { MockServices } from '../fixtures/mock-services';

test.describe('Hedera Blockchain Integration Tests', () => {
  let mockServices: MockServices;

  test.beforeEach(async ({ page }) => {
    mockServices = new MockServices(page);
    await mockServices.setupAllMocks();
  });

  test('Blockchain transaction submission and verification', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Create a booking to trigger blockchain transaction
    await page.click('[data-testid="list-booking-button"]');
    
    // Fill booking form
    await page.fill('[data-testid="booking-title"]', 'Blockchain Test Booking');
    await page.selectOption('[data-testid="booking-type"]', 'hotel');
    await page.fill('[data-testid="booking-city"]', 'Test City');
    await page.fill('[data-testid="booking-country"]', 'Test Country');
    await page.fill('[data-testid="check-in-date"]', '2024-12-20');
    await page.fill('[data-testid="check-out-date"]', '2024-12-25');
    await page.fill('[data-testid="original-price"]', '1000');
    await page.fill('[data-testid="swap-value"]', '900');
    await page.fill('[data-testid="provider"]', 'Test Provider');
    await page.fill('[data-testid="confirmation-number"]', 'TEST123');
    
    // Monitor blockchain transaction
    let transactionSubmitted = false;
    let transactionId = '';
    
    await page.route('**/api/blockchain/submit-transaction', async (route) => {
      transactionSubmitted = true;
      const response = {
        transactionId: '0.0.123456@1704067200.123456789',
        consensusTimestamp: '1704067200.123456789',
        receipt: {
          status: 'SUCCESS',
          topicId: '0.0.654321',
        },
      };
      transactionId = response.transactionId;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
    
    await page.click('[data-testid="submit-booking"]');
    
    // Verify transaction was submitted
    expect(transactionSubmitted).toBe(true);
    
    // Verify blockchain confirmation UI
    await expect(page.locator('[data-testid="blockchain-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="transaction-id"]')).toContainText(transactionId);
    await expect(page.locator('[data-testid="consensus-timestamp"]')).toBeVisible();
    
    // Test transaction verification
    await page.click('[data-testid="verify-transaction"]');
    
    await expect(page.locator('[data-testid="verification-success"]')).toContainText('Transaction verified on Hedera');
    await expect(page.locator('[data-testid="topic-id"]')).toContainText('0.0.654321');
  });

  test('Smart contract interaction for swap execution', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Navigate to a swap ready for execution
    await page.goto('/swaps/swap-ready-001');
    
    // Mock smart contract deployment and execution
    let contractDeployed = false;
    let contractExecuted = false;
    
    await page.route('**/api/blockchain/deploy-contract', async (route) => {
      contractDeployed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contractId: '0.0.987654',
          transactionId: '0.0.123456@1704067300.123456789',
          bytecodeHash: 'contract-hash-123',
        }),
      });
    });
    
    await page.route('**/api/blockchain/execute-contract', async (route) => {
      contractExecuted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transactionId: '0.0.123456@1704067400.123456789',
          result: 'SUCCESS',
          gasUsed: '150000',
          contractResult: {
            swapCompleted: true,
            escrowReleased: true,
          },
        }),
      });
    });
    
    // Execute swap
    await page.click('[data-testid="execute-swap-button"]');
    
    // Verify contract deployment
    await expect(page.locator('[data-testid="contract-deploying"]')).toBeVisible();
    expect(contractDeployed).toBe(true);
    
    // Verify contract execution
    await expect(page.locator('[data-testid="contract-executing"]')).toBeVisible();
    expect(contractExecuted).toBe(true);
    
    // Verify execution results
    await expect(page.locator('[data-testid="execution-success"]')).toContainText('Swap executed successfully');
    await expect(page.locator('[data-testid="gas-used"]')).toContainText('150000');
    await expect(page.locator('[data-testid="escrow-released"]')).toBeVisible();
  });

  test('Hedera Consensus Service topic management', async ({ page }) => {
    await page.goto('/admin');
    
    // Mock admin authentication
    await page.route('**/api/auth/admin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ role: 'admin', permissions: ['manage-topics'] }),
      });
    });
    
    await page.fill('[data-testid="admin-username"]', 'admin');
    await page.fill('[data-testid="admin-password"]', 'password');
    await page.click('[data-testid="admin-login"]');
    
    // Navigate to topic management
    await page.click('[data-testid="blockchain-management"]');
    await page.click('[data-testid="topic-management"]');
    
    // Create new topic
    let topicCreated = false;
    
    await page.route('**/api/blockchain/create-topic', async (route) => {
      topicCreated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          topicId: '0.0.999888',
          transactionId: '0.0.123456@1704067500.123456789',
          memo: 'Booking Swap Platform - Swap Records',
        }),
      });
    });
    
    await page.click('[data-testid="create-topic-button"]');
    await page.fill('[data-testid="topic-memo"]', 'Booking Swap Platform - Swap Records');
    await page.click('[data-testid="submit-topic"]');
    
    expect(topicCreated).toBe(true);
    await expect(page.locator('[data-testid="topic-created"]')).toContainText('Topic created: 0.0.999888');
    
    // Submit message to topic
    await page.click('[data-testid="submit-message-button"]');
    await page.fill('[data-testid="message-content"]', JSON.stringify({
      type: 'swap-completed',
      swapId: 'swap-001',
      timestamp: new Date().toISOString(),
    }));
    
    let messageSubmitted = false;
    
    await page.route('**/api/blockchain/submit-message', async (route) => {
      messageSubmitted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transactionId: '0.0.123456@1704067600.123456789',
          sequenceNumber: 1,
          runningHash: 'running-hash-123',
        }),
      });
    });
    
    await page.click('[data-testid="submit-message"]');
    
    expect(messageSubmitted).toBe(true);
    await expect(page.locator('[data-testid="message-submitted"]')).toContainText('Message submitted to topic');
  });

  test('Mirror Node API integration for transaction history', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Navigate to transaction history
    await page.goto('/dashboard');
    await page.click('[data-testid="transaction-history-tab"]');
    
    // Mock Mirror Node API responses
    await page.route('**/api/mirror-node/transactions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transactions: [
            {
              transaction_id: '0.0.123456@1704067200.123456789',
              consensus_timestamp: '1704067200.123456789',
              transaction_hash: 'hash123',
              result: 'SUCCESS',
              transaction_fee: '0.001',
              transfers: [
                { account: '0.0.123456', amount: -1000000 },
                { account: '0.0.654321', amount: 1000000 },
              ],
            },
            {
              transaction_id: '0.0.123456@1704067300.123456789',
              consensus_timestamp: '1704067300.123456789',
              transaction_hash: 'hash456',
              result: 'SUCCESS',
              transaction_fee: '0.0015',
              transfers: [
                { account: '0.0.123456', amount: -1500000 },
                { account: '0.0.789012', amount: 1500000 },
              ],
            },
          ],
        }),
      });
    });
    
    // Verify transaction history display
    await expect(page.locator('[data-testid="transaction-item"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="transaction-item"]').first()).toContainText('SUCCESS');
    await expect(page.locator('[data-testid="transaction-fee"]').first()).toContainText('0.001');
    
    // Test transaction detail view
    await page.click('[data-testid="transaction-item"]').first();
    
    await expect(page.locator('[data-testid="transaction-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="consensus-timestamp"]')).toContainText('1704067200.123456789');
    await expect(page.locator('[data-testid="transaction-hash"]')).toContainText('hash123');
    await expect(page.locator('[data-testid="transfers-list"]')).toBeVisible();
  });

  test('Wallet integration and transaction signing', async ({ page }) => {
    // Mock wallet connection with specific capabilities
    await page.addInitScript(() => {
      // @ts-ignore
      window.hederaWallet = {
        connect: async () => ({
          accountId: '0.0.123456',
          publicKey: '302a300506032b6570032100...',
          network: 'testnet',
        }),
        signTransaction: async (transaction: any) => {
          // Simulate signing delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          return {
            signature: '304502210...',
            signedTransaction: 'signed-tx-bytes',
          };
        },
        signMessage: async (message: string) => ({
          signature: '304502210...',
          publicKey: '302a300506032b6570032100...',
        }),
        disconnect: async () => {},
        isConnected: () => true,
      };
    });
    
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Verify wallet connection
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-id"]')).toContainText('0.0.123456');
    
    // Test transaction signing flow
    await page.click('[data-testid="list-booking-button"]');
    
    // Fill minimal form to trigger signing
    await page.fill('[data-testid="booking-title"]', 'Wallet Test Booking');
    await page.selectOption('[data-testid="booking-type"]', 'hotel');
    await page.fill('[data-testid="booking-city"]', 'Test City');
    await page.fill('[data-testid="booking-country"]', 'Test Country');
    await page.fill('[data-testid="check-in-date"]', '2024-12-20');
    await page.fill('[data-testid="check-out-date"]', '2024-12-25');
    await page.fill('[data-testid="original-price"]', '1000');
    await page.fill('[data-testid="swap-value"]', '900');
    await page.fill('[data-testid="provider"]', 'Test Provider');
    await page.fill('[data-testid="confirmation-number"]', 'TEST123');
    
    await page.click('[data-testid="submit-booking"]');
    
    // Verify signing prompt
    await expect(page.locator('[data-testid="signing-prompt"]')).toBeVisible();
    await expect(page.locator('[data-testid="signing-message"]')).toContainText('Please sign the transaction');
    
    // Wait for signing completion
    await expect(page.locator('[data-testid="signing-success"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="transaction-signed"]')).toContainText('Transaction signed successfully');
    
    // Test message signing for authentication
    await page.goto('/profile');
    await page.click('[data-testid="verify-identity-button"]');
    
    await expect(page.locator('[data-testid="message-signing"]')).toBeVisible();
    await expect(page.locator('[data-testid="identity-verified"]')).toBeVisible({ timeout: 3000 });
  });

  test('Blockchain error handling and recovery', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');
    
    // Test network connectivity issues
    await page.route('**/api/blockchain/**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Hedera network unavailable',
          code: 'NETWORK_UNAVAILABLE',
          retryAfter: 30,
        }),
      });
    });
    
    await page.click('[data-testid="list-booking-button"]');
    // ... fill form ...
    await page.click('[data-testid="submit-booking"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="network-error"]')).toContainText('Hedera network unavailable');
    await expect(page.locator('[data-testid="retry-countdown"]')).toBeVisible();
    
    // Test insufficient balance error
    await page.route('**/api/blockchain/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient account balance',
          code: 'INSUFFICIENT_BALANCE',
          required: '0.01',
          available: '0.005',
        }),
      });
    });
    
    await page.click('[data-testid="retry-button"]');
    
    await expect(page.locator('[data-testid="balance-error"]')).toContainText('Insufficient account balance');
    await expect(page.locator('[data-testid="required-balance"]')).toContainText('0.01');
    await expect(page.locator('[data-testid="top-up-suggestion"]')).toBeVisible();
    
    // Test transaction timeout
    await page.route('**/api/blockchain/**', async (route) => {
      // Simulate long delay
      await new Promise(resolve => setTimeout(resolve, 35000));
      await route.continue();
    });
    
    await page.click('[data-testid="retry-button"]');
    
    await expect(page.locator('[data-testid="transaction-timeout"]')).toBeVisible({ timeout: 40000 });
    await expect(page.locator('[data-testid="timeout-recovery"]')).toContainText('Transaction may still be processing');
  });
});