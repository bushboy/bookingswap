import {
  Client,
  AccountId,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
  TransactionId,
  TransactionRecord,
  TransactionReceipt,
  ContractCreateTransaction,
  ContractExecuteTransaction,
  ContractId,
  Hbar,
  Status,
  TopicInfoQuery,
  AccountBalanceQuery,
  TransactionReceiptQuery,
} from '@hashgraph/sdk';
import { logger } from '../../utils/logger';
import {
  PaymentHederaExtensions,
  EscrowCreationData,
  PaymentTransactionData,
  EscrowReleaseData
} from './PaymentHederaExtensions';
import {
  AuctionHederaExtensions,
  AuctionCreationData,
  AuctionProposalData,
  AuctionCompletionData,
  AuctionCancellationData
} from './AuctionHederaExtensions';
import {
  SwapMatchingHederaExtensions,
  BrowseProposalCreationData,
  ProposalStatusChangeData,
  CompatibilityAnalysisData,
  ProposalVerificationData,
  DisputeResolutionData
} from './SwapMatchingHederaExtensions';
import {
  TargetingHederaExtensions,
  TargetingCreationData,
  TargetingRetargetData,
  TargetingRemovalData,
  TargetingStatusChangeData,
  TargetingVerificationData,
  TargetingDisputeData
} from './TargetingHederaExtensions';
import { NFTService } from './NFTService';

export interface TransactionData {
  type: 'booking_listing' | 'swap_proposal' | 'swap_execution' | 'swap_cancellation' |
  'enhanced_swap_created' | 'auction_created' | 'auction_ended' | 'auction_cancelled' |
  'auction_proposal_submitted' | 'auction_winner_selected' | 'auction_converted_to_first_match' |
  'cash_proposal_created' | 'auction_proposals_rejected' | 'swap_proposal_cancelled' |
  'swap_proposal_expired' | 'swap_proposal_accepted' | 'swap_proposal_rejected' |
  'browse_proposal_created' | 'proposal_metadata_recorded' | 'compatibility_analysis_recorded' |
  'proposal_status_changed' | 'proposal_verification_recorded' | 'dispute_resolution_recorded' |
  'booking_nft_minted' | 'booking_nft_transferred' | 'booking_nft_burned' |
  'targeting_created' | 'targeting_retargeted' | 'targeting_removed' | 'targeting_status_changed' |
  'targeting_verified' | 'targeting_dispute_reported' | 'targeting_accepted' | 'targeting_rejected' |
  'targeting_expired';
  payload: Record<string, any>;
  timestamp: Date;
}

export interface TransactionResult {
  transactionId: string;
  consensusTimestamp?: string;
  status: string;
  receipt?: TransactionReceipt;
}

export interface ContractResult {
  contractId: string;
  transactionId: string;
  status: string;
}

export class HederaService {
  private client: Client;
  private operatorAccountId: AccountId;
  private operatorPrivateKey: PrivateKey;
  private topicId?: TopicId;
  private paymentExtensions: PaymentHederaExtensions;
  private auctionExtensions: AuctionHederaExtensions;
  private swapMatchingExtensions: SwapMatchingHederaExtensions;
  private targetingExtensions: TargetingHederaExtensions;
  private nftService: NFTService;

  constructor(
    network: 'testnet' | 'mainnet' = 'testnet',
    accountId: string,
    privateKey: string,
    topicId?: string
  ) {
    // Initialize client based on network
    if (network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }

    // Set operator account
    this.operatorAccountId = AccountId.fromString(accountId);
    this.operatorPrivateKey = PrivateKey.fromString(privateKey);

    this.client.setOperator(this.operatorAccountId, this.operatorPrivateKey);

    // Set topic ID if provided
    if (topicId) {
      this.topicId = TopicId.fromString(topicId);
    }

    // Initialize payment extensions
    this.paymentExtensions = new PaymentHederaExtensions(this);

    // Initialize auction extensions
    this.auctionExtensions = new AuctionHederaExtensions(this);

    // Initialize swap matching extensions
    this.swapMatchingExtensions = new SwapMatchingHederaExtensions(this);

    // Initialize targeting extensions
    this.targetingExtensions = new TargetingHederaExtensions(this);

    // Initialize NFT service
    this.nftService = new NFTService(this);

    logger.info('HederaService initialized', {
      network,
      accountId,
      topicId,
    });
  }

  /**
   * Submit a transaction to the Hedera Consensus Service
   */
  async submitTransaction(data: TransactionData): Promise<TransactionResult> {
    try {
      if (!this.topicId) {
        throw new Error('Topic ID not configured');
      }

      const message = JSON.stringify({
        ...data,
        submittedBy: this.operatorAccountId.toString(),
      });

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(this.topicId)
        .setMessage(message);

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      logger.info('Transaction submitted to HCS', {
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
        topicId: this.topicId.toString(),
      });

      return {
        transactionId: txResponse.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to submit transaction to HCS', { error, data });
      throw new Error(`HCS transaction failed: ${error.message}`);
    }
  }

  /**
   * Query a transaction record from Hedera
   */
  async queryTransaction(transactionId: string): Promise<TransactionRecord> {
    try {
      const txId = TransactionId.fromString(transactionId);
      const record = await new TransactionReceiptQuery()
        .setTransactionId(txId)
        .execute(this.client);

      logger.info('Transaction queried successfully', {
        transactionId,
        status: record.status.toString(),
      });

      return record as any; // Type assertion for compatibility
    } catch (error) {
      logger.error('Failed to query transaction', { error, transactionId });
      throw new Error(`Transaction query failed: ${error.message}`);
    }
  }

  /**
   * Create a smart contract on Hedera
   */
  async createSmartContract(bytecode: string, gas: number = 100000): Promise<ContractResult> {
    try {
      const transaction = new ContractCreateTransaction()
        .setBytecode(bytecode)
        .setGas(gas)
        .setConstructorParameters();

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      if (!receipt.contractId) {
        throw new Error('Contract creation failed - no contract ID returned');
      }

      logger.info('Smart contract created', {
        contractId: receipt.contractId.toString(),
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
      });

      return {
        contractId: receipt.contractId.toString(),
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
      };
    } catch (error) {
      logger.error('Failed to create smart contract', { error });
      throw new Error(`Smart contract creation failed: ${error.message}`);
    }
  }

  /**
   * Execute a smart contract function
   */
  async executeContract(
    contractId: string,
    functionName: string,
    params: any[] = [],
    gas: number = 100000
  ): Promise<TransactionResult> {
    try {
      const contractIdObj = ContractId.fromString(contractId);

      const transaction = new ContractExecuteTransaction()
        .setContractId(contractIdObj)
        .setGas(gas)
        .setFunction(functionName, params);

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      logger.info('Smart contract executed', {
        contractId,
        functionName,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
      });

      return {
        transactionId: txResponse.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to execute smart contract', { error, contractId, functionName });
      throw new Error(`Smart contract execution failed: ${error.message}`);
    }
  }

  /**
   * Create a new topic for consensus service
   */
  async createTopic(memo?: string): Promise<string> {
    try {
      const transaction = new TopicCreateTransaction();

      if (memo) {
        transaction.setTopicMemo(memo);
      }

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      if (!receipt.topicId) {
        throw new Error('Topic creation failed - no topic ID returned');
      }

      const topicId = receipt.topicId.toString();

      logger.info('Topic created', {
        topicId,
        transactionId: txResponse.transactionId.toString(),
        memo,
      });

      return topicId;
    } catch (error) {
      logger.error('Failed to create topic', { error, memo });
      throw new Error(`Topic creation failed: ${error.message}`);
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(accountId?: string): Promise<Hbar> {
    try {
      const targetAccountId = accountId
        ? AccountId.fromString(accountId)
        : this.operatorAccountId;

      const balance = await new AccountBalanceQuery()
        .setAccountId(targetAccountId)
        .execute(this.client);

      logger.info('Account balance retrieved', {
        accountId: targetAccountId.toString(),
        balance: balance.hbars.toString(),
      });

      return balance.hbars;
    } catch (error) {
      logger.error('Failed to get account balance', { error, accountId });
      throw new Error(`Account balance query failed: ${error.message}`);
    }
  }

  /**
   * Get topic information
   */
  async getTopicInfo(topicId?: string): Promise<any> {
    try {
      const targetTopicId = topicId
        ? TopicId.fromString(topicId)
        : this.topicId;

      if (!targetTopicId) {
        throw new Error('No topic ID provided');
      }

      const topicInfo = await new TopicInfoQuery()
        .setTopicId(targetTopicId)
        .execute(this.client);

      logger.info('Topic info retrieved', {
        topicId: targetTopicId.toString(),
        memo: topicInfo.topicMemo,
      });

      return topicInfo;
    } catch (error) {
      logger.error('Failed to get topic info', { error, topicId });
      throw new Error(`Topic info query failed: ${error.message}`);
    }
  }



  /**
   * Close the client connection
   */
  close(): void {
    this.client.close();
    logger.info('HederaService client closed');
  }

  /**
   * Get the configured topic ID
   */
  getTopicId(): string | undefined {
    return this.topicId?.toString();
  }

  /**
   * Get the operator account ID
   */
  getOperatorAccountId(): string {
    return this.operatorAccountId.toString();
  }

  // Auction-related blockchain operations
  async recordAuctionCreation(data: AuctionCreationData): Promise<string> {
    return this.auctionExtensions.recordAuctionCreation(data);
  }

  async recordAuctionProposal(data: AuctionProposalData): Promise<string> {
    return this.auctionExtensions.recordAuctionProposal(data);
  }

  async recordAuctionCompletion(data: AuctionCompletionData): Promise<string> {
    return this.auctionExtensions.recordAuctionCompletion(data);
  }

  async recordWinnerSelection(auctionId: string, winningProposalId: string, selectedBy: string): Promise<string> {
    return this.auctionExtensions.recordWinnerSelection(auctionId, winningProposalId, selectedBy);
  }

  async recordAuctionCancellation(data: AuctionCancellationData): Promise<string> {
    return this.auctionExtensions.recordAuctionCancellation(data);
  }

  async recordAuctionTimeout(auctionId: string, autoSelectedProposalId?: string): Promise<string> {
    return this.auctionExtensions.recordAuctionTimeout(auctionId, autoSelectedProposalId);
  }

  async recordAuctionConversion(auctionId: string, reason: string): Promise<string> {
    return this.auctionExtensions.recordAuctionConversion(auctionId, reason);
  }

  async recordAuctionProposalRejection(proposalId: string, auctionId: string, reason: string): Promise<string> {
    return this.auctionExtensions.recordProposalRejection(proposalId, auctionId, reason);
  }

  // Payment-related blockchain operations
  async recordEscrowCreation(data: EscrowCreationData): Promise<string> {
    return this.paymentExtensions.recordEscrowCreation(data);
  }

  async recordPaymentTransaction(data: PaymentTransactionData): Promise<string> {
    return this.paymentExtensions.recordPaymentTransaction(data);
  }

  async recordEscrowRelease(data: EscrowReleaseData): Promise<string> {
    return this.paymentExtensions.recordEscrowRelease(data);
  }

  async recordPaymentCompletion(transactionId: string, completedAt: Date): Promise<string> {
    return this.paymentExtensions.recordPaymentCompletion(transactionId, completedAt);
  }

  async recordPaymentRefund(transactionId: string, refundAmount: number, reason: string): Promise<string> {
    return this.paymentExtensions.recordPaymentRefund(transactionId, refundAmount, reason);
  }

  async recordCashOfferSubmission(data: {
    proposalId: string;
    swapId: string;
    proposerId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    escrowRequired: boolean;
  }): Promise<string> {
    return this.paymentExtensions.recordCashOfferSubmission(data);
  }

  async recordPaymentDisputeResolution(data: {
    transactionId: string;
    disputeId: string;
    resolution: 'refund' | 'release' | 'partial_refund';
    amount: number;
    reason: string;
    resolvedBy: string;
  }): Promise<string> {
    return this.paymentExtensions.recordDisputeResolution(data);
  }

  async recordFraudAlert(transactionId: string, riskScore: number, flags: string[]): Promise<string> {
    return this.paymentExtensions.recordFraudAlert(transactionId, riskScore, flags);
  }

  // Swap matching proposal-related blockchain operations
  async recordBrowseProposalCreation(data: BrowseProposalCreationData): Promise<string> {
    return this.swapMatchingExtensions.recordBrowseProposalCreation(data);
  }

  async recordProposalMetadata(metadata: any): Promise<string> {
    return this.swapMatchingExtensions.recordProposalMetadata(metadata);
  }

  async recordCompatibilityAnalysis(data: CompatibilityAnalysisData): Promise<string> {
    return this.swapMatchingExtensions.recordCompatibilityAnalysis(data);
  }

  async recordProposalStatusChange(data: ProposalStatusChangeData): Promise<string> {
    return this.swapMatchingExtensions.recordProposalStatusChange(data);
  }

  async recordProposalVerification(data: ProposalVerificationData): Promise<string> {
    return this.swapMatchingExtensions.recordProposalVerification(data);
  }

  async recordDisputeResolution(data: DisputeResolutionData): Promise<string> {
    return this.swapMatchingExtensions.recordDisputeResolution(data);
  }

  async recordProposalExpiration(proposalId: string, expiredAt: Date): Promise<string> {
    return this.swapMatchingExtensions.recordProposalExpiration(proposalId, expiredAt);
  }

  async recordProposalAcceptance(proposalId: string, acceptedBy: string, acceptedAt: Date): Promise<string> {
    return this.swapMatchingExtensions.recordProposalAcceptance(proposalId, acceptedBy, acceptedAt);
  }

  async recordProposalRejection(proposalId: string, rejectedBy: string, rejectedAt: Date, reason?: string): Promise<string> {
    return this.swapMatchingExtensions.recordProposalRejection(proposalId, rejectedBy, rejectedAt, reason);
  }

  // Targeting-related blockchain operations
  async recordTargetingCreation(data: TargetingCreationData): Promise<string> {
    return this.targetingExtensions.recordTargetingCreation(data);
  }

  async recordTargetingRetarget(data: TargetingRetargetData): Promise<string> {
    return this.targetingExtensions.recordTargetingRetarget(data);
  }

  async recordTargetingRemoval(data: TargetingRemovalData): Promise<string> {
    return this.targetingExtensions.recordTargetingRemoval(data);
  }

  async recordTargetingStatusChange(data: TargetingStatusChangeData): Promise<string> {
    return this.targetingExtensions.recordTargetingStatusChange(data);
  }

  async recordTargetingVerification(data: TargetingVerificationData): Promise<string> {
    return this.targetingExtensions.recordTargetingVerification(data);
  }

  async recordTargetingDispute(data: TargetingDisputeData): Promise<string> {
    return this.targetingExtensions.recordTargetingDispute(data);
  }

  async recordTargetingAcceptance(
    targetingId: string,
    sourceSwapId: string,
    targetSwapId: string,
    proposalId: string,
    acceptedBy: string,
    acceptedAt: Date
  ): Promise<string> {
    return this.targetingExtensions.recordTargetingAcceptance(
      targetingId,
      sourceSwapId,
      targetSwapId,
      proposalId,
      acceptedBy,
      acceptedAt
    );
  }

  async recordTargetingRejection(
    targetingId: string,
    sourceSwapId: string,
    targetSwapId: string,
    proposalId: string,
    rejectedBy: string,
    rejectedAt: Date,
    reason?: string
  ): Promise<string> {
    return this.targetingExtensions.recordTargetingRejection(
      targetingId,
      sourceSwapId,
      targetSwapId,
      proposalId,
      rejectedBy,
      rejectedAt,
      reason
    );
  }

  async recordTargetingExpiration(
    targetingId: string,
    sourceSwapId: string,
    targetSwapId: string,
    proposalId: string,
    expiredAt: Date
  ): Promise<string> {
    return this.targetingExtensions.recordTargetingExpiration(
      targetingId,
      sourceSwapId,
      targetSwapId,
      proposalId,
      expiredAt
    );
  }

  // Getters for service extensions
  getPaymentExtensions(): PaymentHederaExtensions {
    return this.paymentExtensions;
  }

  getAuctionExtensions(): AuctionHederaExtensions {
    return this.auctionExtensions;
  }

  getSwapMatchingExtensions(): SwapMatchingHederaExtensions {
    return this.swapMatchingExtensions;
  }

  getTargetingExtensions(): TargetingHederaExtensions {
    return this.targetingExtensions;
  }

  getNFTService(): NFTService {
    return this.nftService;
  }
}