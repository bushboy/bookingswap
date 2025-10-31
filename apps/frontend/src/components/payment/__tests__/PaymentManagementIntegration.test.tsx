import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { PaymentManagementDashboard } from '../PaymentManagementDashboard';
import { PaymentAnalyticsDashboard } from '../PaymentAnalyticsDashboard';
import { paymentService } from '../../../services/paymentService';

// Mock the payment service
jest.mock('../../../services/paymentService');
const mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;

// Mock hooks
jest.mock('../../../hooks/usePaymentMethods', () => ({
  usePaymentMethods: () => ({
    paymentMethods: [
      {
        id: 'pm_1',
        type: 'credit_card',
        displayName: 'Visa ending in 4242',
        isVerified: true,
      },
      {
        id: 'pm_2',
        type: 'bank_transfer',
        displayName: 'Bank Account ending in 1234',
        isVerified: false,
      },
    ],
    loading: false,
    error: null,
    fetchPaymentMethods: jest.fn(),
  }),
}));

jest.mock('../../../hooks/usePaymentTransactions', () => ({
  usePaymentTransactions: () => ({
    transactions: [
      {
        id: 'txn_1',
        amount: 150.00,
        currency: 'USD',
        status: 'completed',
        platformFee: 7.50,
        netAmount: 142.50,
        paymentMethod: 'credit_card',
        createdAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15'),
      },
      {
        id: 'txn_2',
        amount: 200.00,
        currency: 'USD',
        status: 'pending',
        platformFee: 10.00,
        netAmount: 190.00,
        paymentMethod: 'bank_transfer',
        createdAt: new Date('2024-01-20'),
      },
    ],
    loading: false,
    error: null,
    fetchTransactions: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useEscrowAccounts', () => ({
  useEscrowAccounts: () => ({
    escrowAccounts: [
      {
        id: 'escrow_1',
        amount: 150.00,
        currency: 'USD',
        status: 'active',
        payerId: 'user_1',
        recipientId: 'user_2',
        swapId: 'swap_1',
        proposalId: 'proposal_1',
        createdAt: new Date('2024-01-15'),
      },
      {
        id: 'escrow_2',
        amount: 200.00,
        currency: 'USD',
        status: 'released',
        payerId: 'user_2',
        recipientId: 'user_1',
        swapId: 'swap_2',
        proposalId: 'proposal_2',
        createdAt: new Date('2024-01-10'),
        releasedAt: new Date('2024-01-12'),
      },
    ],
    loading: false,
    error: null,
    fetchEscrowAccounts: jest.fn(),
  }),
}));

// Create a mock store
const createMockStore = () => {
  return configureStore({
    reducer: {
      auth: (state = { user: { id: 'user_1' } }) => state,
    },
  });
};

describe('Payment Management Integration', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    jest.clearAllMocks();
  });

  describe('PaymentManagementDashboard', () => {
    it('renders all tabs and switches between them', async () => {
      render(
        <Provider store={store}>
          <PaymentManagementDashboard userId="user_1" />
        </Provider>
      );

      // Check that all tabs are present
      expect(screen.getByText('Payment Methods')).toBeInTheDocument();
      expect(screen.getByText('Transaction History')).toBeInTheDocument();
      expect(screen.getByText('Escrow Accounts')).toBeInTheDocument();
      expect(screen.getByText('Disputes')).toBeInTheDocument();

      // Check that payment methods tab is active by default
      expect(screen.getByText('Your Payment Methods')).toBeInTheDocument();

      // Switch to transaction history tab
      fireEvent.click(screen.getByText('Transaction History'));
      await waitFor(() => {
        expect(screen.getByText('Filter Transactions')).toBeInTheDocument();
      });

      // Switch to escrow accounts tab
      fireEvent.click(screen.getByText('Escrow Accounts'));
      await waitFor(() => {
        expect(screen.getByText('Filter Escrow Accounts')).toBeInTheDocument();
      });

      // Switch to disputes tab
      fireEvent.click(screen.getByText('Disputes'));
      await waitFor(() => {
        expect(screen.getByText('Payment Disputes')).toBeInTheDocument();
      });
    });

    it('displays correct statistics in each tab', async () => {
      render(
        <Provider store={store}>
          <PaymentManagementDashboard userId="user_1" />
        </Provider>
      );

      // Check payment methods stats
      expect(screen.getByText('2')).toBeInTheDocument(); // Total payment methods
      expect(screen.getByText('1')).toBeInTheDocument(); // Verified methods

      // Switch to transaction history and check stats
      fireEvent.click(screen.getByText('Transaction History'));
      await waitFor(() => {
        expect(screen.getByText('$350.00')).toBeInTheDocument(); // Total volume
      });

      // Switch to escrow accounts and check stats
      fireEvent.click(screen.getByText('Escrow Accounts'));
      await waitFor(() => {
        expect(screen.getByText('$150.00')).toBeInTheDocument(); // Active escrow
      });
    });
  });

  describe('PaymentAnalyticsDashboard', () => {
    const mockTransactions = [
      {
        id: 'txn_1',
        amount: 150.00,
        currency: 'USD',
        status: 'completed' as const,
        platformFee: 7.50,
        netAmount: 142.50,
        paymentMethod: 'credit_card',
        createdAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15'),
      },
      {
        id: 'txn_2',
        amount: 200.00,
        currency: 'USD',
        status: 'completed' as const,
        platformFee: 10.00,
        netAmount: 190.00,
        paymentMethod: 'bank_transfer',
        createdAt: new Date('2024-01-20'),
        completedAt: new Date('2024-01-20'),
      },
    ];

    const mockEscrowAccounts = [
      {
        id: 'escrow_1',
        amount: 150.00,
        currency: 'USD',
        status: 'active' as const,
        payerId: 'user_1',
        recipientId: 'user_2',
        swapId: 'swap_1',
        proposalId: 'proposal_1',
        createdAt: new Date('2024-01-15'),
      },
    ];

    it('renders analytics dashboard with correct metrics', () => {
      render(
        <PaymentAnalyticsDashboard
          transactions={mockTransactions}
          escrowAccounts={mockEscrowAccounts}
          userId="user_1"
        />
      );

      // Check key metrics
      expect(screen.getByText('$350.00')).toBeInTheDocument(); // Total volume
      expect(screen.getByText('$17.50')).toBeInTheDocument(); // Total fees
      expect(screen.getByText('$175.00')).toBeInTheDocument(); // Average transaction
      expect(screen.getByText('100.0%')).toBeInTheDocument(); // Success rate
    });

    it('allows changing time range filter', async () => {
      render(
        <PaymentAnalyticsDashboard
          transactions={mockTransactions}
          escrowAccounts={mockEscrowAccounts}
          userId="user_1"
        />
      );

      // Find and change the time range selector
      const timeRangeSelect = screen.getByDisplayValue('Last 30 Days');
      fireEvent.change(timeRangeSelect, { target: { value: '7d' } });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Last 7 Days')).toBeInTheDocument();
      });
    });

    it('exports analytics data when export button is clicked', async () => {
      // Mock URL.createObjectURL and related functions
      const mockCreateObjectURL = jest.fn(() => 'mock-url');
      const mockRevokeObjectURL = jest.fn();
      const mockClick = jest.fn();
      const mockAppendChild = jest.fn();
      const mockRemoveChild = jest.fn();

      Object.defineProperty(URL, 'createObjectURL', {
        value: mockCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: mockRevokeObjectURL,
      });

      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
      };

      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

      render(
        <PaymentAnalyticsDashboard
          transactions={mockTransactions}
          escrowAccounts={mockEscrowAccounts}
          userId="user_1"
        />
      );

      // Click export button
      const exportButton = screen.getByText('📊 Export Data');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(mockClick).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalled();
      });
    });

    it('displays payment method breakdown correctly', () => {
      render(
        <PaymentAnalyticsDashboard
          transactions={mockTransactions}
          escrowAccounts={mockEscrowAccounts}
          userId="user_1"
        />
      );

      // Check payment method breakdown section
      expect(screen.getByText('Payment Methods')).toBeInTheDocument();
      expect(screen.getByText('credit_card')).toBeInTheDocument();
      expect(screen.getByText('bank_transfer')).toBeInTheDocument();
    });

    it('displays escrow analytics correctly', () => {
      render(
        <PaymentAnalyticsDashboard
          transactions={mockTransactions}
          escrowAccounts={mockEscrowAccounts}
          userId="user_1"
        />
      );

      // Check escrow analytics section
      expect(screen.getByText('Escrow Account Analytics')).toBeInTheDocument();
      expect(screen.getByText('Total Escrowed')).toBeInTheDocument();
      expect(screen.getByText('Active Escrow')).toBeInTheDocument();
    });
  });

  describe('Integration between components', () => {
    it('payment management dashboard integrates with analytics', async () => {
      render(
        <Provider store={store}>
          <PaymentManagementDashboard userId="user_1" />
        </Provider>
      );

      // Verify that the dashboard loads with data from hooks
      expect(screen.getByText('Payment Management')).toBeInTheDocument();
      
      // Check that statistics are displayed correctly
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Total payment methods
      });
    });

    it('handles error states gracefully', async () => {
      // Mock error state
      jest.doMock('../../../hooks/usePaymentMethods', () => ({
        usePaymentMethods: () => ({
          paymentMethods: [],
          loading: false,
          error: 'Failed to load payment methods',
          fetchPaymentMethods: jest.fn(),
        }),
      }));

      const { PaymentManagementDashboard: ErrorDashboard } = await import('../PaymentManagementDashboard');

      render(
        <Provider store={store}>
          <ErrorDashboard userId="user_1" />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load payment methods')).toBeInTheDocument();
      });
    });
  });
});