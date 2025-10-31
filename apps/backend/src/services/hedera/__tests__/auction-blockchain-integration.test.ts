import { HederaService } from '../HederaService';
import { AuctionHederaExtensions } from '../AuctionHederaExtensions';
import { PaymentHederaExtensions } from '../PaymentHederaExtensions';

// Mock the Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn(() => ({
      setOperator: jest.fn(),
      close: jest.fn(),
    })),
  },
  AccountId: {
    fromString: jest.fn(() => ({ toString: () => 'test-account' })),
  },
  PrivateKey: {
    fromString: jest.fn(() => ({})),
  },
  TopicId: {
    fromString: jest.fn(() => ({ toString: () => 'test-topic' })),
  },
  TopicMessageSubmitTransaction: jest.fn(() => ({
    setTopicId: jest.fn().mockReturnThis(),
    setMessage: jest.fn().mockReturnThis(),
    execute: jest.fn(() => Promise.resolve({
      transactionId: { toString: () => 'test-tx-id' },
      getReceipt: jest.fn(() => Promise.resolve({
        status: { toString: () => 'SUCCESS' },
        consensusTimestamp: { toString: () => '2023-01-01T00:00:00Z' },
      })),
    })),
  })),
}));

describe('Auction Blockchain Integration', () => {
  let hederaService: HederaService;
  let auctionExtensions: AuctionHederaExtensions;

  beforeEach(() => {
    hederaService = new HederaService(
      'testnet',
      '0.0.123',
      'test-private-key',
      '0.0.456'
    );
    auctionExtensions = new AuctionHederaExtensions(hederaService);
  });

  afterEach(() => {
    hederaService.close();
  });

  describe('Auction Creation Recording', () => {
    it('should record auction creation on blockchain', async () => {
      const auctionData = {
        auctionId: 'auction-123',
        swapId: 'swap-456',
        ownerId: 'user-789',
        settings: {
          endDate: new Date('2024-12-31'),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 100,
          autoSelectAfterHours: 24,
        },
      };

      const transactionId = await hederaService.recordAuctionCreation(auctionData);

      expect(transactionId).toBe('test-tx-id');
    });

    it('should handle auction creation errors gracefully', async () => {
      // Mock a failure
      const mockSubmitTransaction = jest.spyOn(hederaService, 'submitTransaction')
        .mockRejectedValueOnce(new Error('Network error'));

      const auctionData = {
        auctionId: 'auction-123',
        swapId: 'swap-456',
        ownerId: 'user-789',
        settings: {
          endDate: new Date('2024-12-31'),
          allowBookingProposals: true,
          allowCashProposals: false,
        },
      };

      await expect(hederaService.recordAuctionCreation(auctionData))
        .rejects.toThrow('Network error');

      mockSubmitTransaction.mockRestore();
    });
  });

  describe('Auction Proposal Recording', () => {
    it('should record booking proposal on blockchain', async () => {
      const proposalData = {
        proposalId: 'proposal-123',
        auctionId: 'auction-456',
        proposerId: 'user-789',
        proposalType: 'booking' as const,
        bookingId: 'booking-123',
        message: 'Great booking for swap',
        conditions: ['verified booking', 'same location'],
      };

      const transactionId = await hederaService.recordAuctionProposal(proposalData);

      expect(transactionId).toBe('test-tx-id');
    });

    it('should record cash proposal on blockchain', async () => {
      const proposalData = {
        proposalId: 'proposal-456',
        auctionId: 'auction-789',
        proposerId: 'user-123',
        proposalType: 'cash' as const,
        cashOffer: {
          amount: 250,
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowRequired: true,
        },
        message: 'Cash offer for your booking',
        conditions: ['immediate payment', 'escrow required'],
      };

      const transactionId = await hederaService.recordAuctionProposal(proposalData);

      expect(transactionId).toBe('test-tx-id');
    });
  });

  describe('Auction Completion Recording', () => {
    it('should record auction completion with winner', async () => {
      const completionData = {
        auctionId: 'auction-123',
        winningProposalId: 'proposal-456',
        endedAt: new Date(),
        totalProposals: 5,
        completionReason: 'owner_selection' as const,
      };

      const transactionId = await hederaService.recordAuctionCompletion(completionData);

      expect(transactionId).toBe('test-tx-id');
    });

    it('should record auction timeout', async () => {
      const auctionId = 'auction-123';
      const autoSelectedProposalId = 'proposal-456';

      const transactionId = await hederaService.recordAuctionTimeout(
        auctionId,
        autoSelectedProposalId
      );

      expect(transactionId).toBe('test-tx-id');
    });
  });

  describe('Auction Cancellation Recording', () => {
    it('should record auction cancellation', async () => {
      const cancellationData = {
        auctionId: 'auction-123',
        reason: 'Owner cancelled',
        cancelledBy: 'user-456',
        cancelledAt: new Date(),
      };

      const transactionId = await hederaService.recordAuctionCancellation(cancellationData);

      expect(transactionId).toBe('test-tx-id');
    });
  });

  describe('Winner Selection Recording', () => {
    it('should record winner selection', async () => {
      const auctionId = 'auction-123';
      const winningProposalId = 'proposal-456';
      const selectedBy = 'user-789';

      const transactionId = await hederaService.recordWinnerSelection(
        auctionId,
        winningProposalId,
        selectedBy
      );

      expect(transactionId).toBe('test-tx-id');
    });
  });
});

describe('Payment Blockchain Integration', () => {
  let hederaService: HederaService;
  let paymentExtensions: PaymentHederaExtensions;

  beforeEach(() => {
    hederaService = new HederaService(
      'testnet',
      '0.0.123',
      'test-private-key',
      '0.0.456'
    );
    paymentExtensions = new PaymentHederaExtensions(hederaService);
  });

  afterEach(() => {
    hederaService.close();
  });

  describe('Cash Offer Recording', () => {
    it('should record cash offer submission on blockchain', async () => {
      const cashOfferData = {
        proposalId: 'proposal-123',
        swapId: 'swap-456',
        proposerId: 'user-789',
        amount: 250,
        currency: 'USD',
        paymentMethodId: 'pm-123',
        escrowRequired: true,
      };

      const transactionId = await hederaService.recordCashOfferSubmission(cashOfferData);

      expect(transactionId).toBe('test-tx-id');
    });
  });

  describe('Escrow Management Recording', () => {
    it('should record escrow creation on blockchain', async () => {
      const escrowData = {
        escrowId: 'escrow-123',
        amount: 500,
        currency: 'USD',
        payerId: 'user-456',
        recipientId: 'user-789',
        swapId: 'swap-123',
        proposalId: 'proposal-456',
      };

      const transactionId = await hederaService.recordEscrowCreation(escrowData);

      expect(transactionId).toBe('test-tx-id');
    });

    it('should record escrow release on blockchain', async () => {
      const releaseData = {
        escrowId: 'escrow-123',
        transactionId: 'tx-456',
        releaseAmount: 500,
        recipientId: 'user-789',
        reason: 'Swap completed successfully',
      };

      const transactionId = await hederaService.recordEscrowRelease(releaseData);

      expect(transactionId).toBe('test-tx-id');
    });
  });

  describe('Payment Transaction Recording', () => {
    it('should record payment transaction on blockchain', async () => {
      const paymentData = {
        transactionId: 'tx-123',
        swapId: 'swap-456',
        proposalId: 'proposal-789',
        amount: 300,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        fees: {
          platformFee: 15,
          processingFee: 5,
          totalFees: 20,
          netAmount: 280,
        },
      };

      const transactionId = await hederaService.recordPaymentTransaction(paymentData);

      expect(transactionId).toBe('test-tx-id');
    });

    it('should record payment completion on blockchain', async () => {
      const transactionId = 'tx-123';
      const completedAt = new Date();

      const blockchainTxId = await hederaService.recordPaymentCompletion(
        transactionId,
        completedAt
      );

      expect(blockchainTxId).toBe('test-tx-id');
    });

    it('should record payment refund on blockchain', async () => {
      const transactionId = 'tx-123';
      const refundAmount = 250;
      const reason = 'User requested refund';

      const blockchainTxId = await hederaService.recordPaymentRefund(
        transactionId,
        refundAmount,
        reason
      );

      expect(blockchainTxId).toBe('test-tx-id');
    });
  });

  describe('Dispute Resolution Recording', () => {
    it('should record dispute resolution on blockchain', async () => {
      const disputeData = {
        transactionId: 'tx-123',
        disputeId: 'dispute-456',
        resolution: 'refund' as const,
        amount: 200,
        reason: 'Booking was cancelled',
        resolvedBy: 'admin-789',
      };

      const transactionId = await hederaService.recordDisputeResolution(disputeData);

      expect(transactionId).toBe('test-tx-id');
    });
  });

  describe('Fraud Detection Recording', () => {
    it('should record fraud alert on blockchain', async () => {
      const transactionId = 'tx-123';
      const riskScore = 85;
      const flags = ['suspicious_amount', 'new_payment_method', 'unusual_location'];

      const blockchainTxId = await hederaService.recordFraudAlert(
        transactionId,
        riskScore,
        flags
      );

      expect(blockchainTxId).toBe('test-tx-id');
    });
  });
});