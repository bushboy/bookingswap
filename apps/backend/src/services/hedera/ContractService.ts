import { 
  ContractId, 
  ContractCreateTransaction, 
  ContractExecuteTransaction,
  ContractCallQuery,
  Hbar,
  ContractFunctionParameters,
  ContractFunctionResult,
  FileCreateTransaction,
  FileId,
  TransactionReceipt
} from '@hashgraph/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { HederaService, TransactionResult } from './HederaService';
import { logger } from '../../utils/logger';

export interface BookingData {
  bookingId: string;
  value: number; // in tinybars
  metadata: string; // IPFS hash
}

export interface SwapProposal {
  swapId: string;
  sourceBookingId: string;
  targetBookingId: string;
  additionalPayment: number; // in tinybars
  expirationTime: number; // Unix timestamp
}

export interface SwapDetails {
  swapId: string;
  proposer: string;
  acceptor: string;
  sourceBookingId: string;
  targetBookingId: string;
  additionalPayment: number;
  status: number; // SwapStatus enum value
  expiresAt: number;
  createdAt: number;
}

export interface BookingDetails {
  bookingId: string;
  owner: string;
  value: number;
  metadata: string;
  isLocked: boolean;
}

export class ContractService {
  private hederaService: HederaService;
  private escrowContractId?: ContractId;
  private contractBytecode?: string;

  constructor(hederaService: HederaService, escrowContractId?: string) {
    this.hederaService = hederaService;
    if (escrowContractId) {
      this.escrowContractId = ContractId.fromString(escrowContractId);
    }
  }

  /**
   * Deploy the BookingEscrow smart contract to Hedera
   */
  async deployEscrowContract(gas: number = 1000000): Promise<string> {
    try {
      // Load contract bytecode
      if (!this.contractBytecode) {
        await this.loadContractBytecode();
      }

      if (!this.contractBytecode) {
        throw new Error('Contract bytecode not loaded');
      }

      // Create file on Hedera to store bytecode
      const fileCreateTx = new FileCreateTransaction()
        .setContents(this.contractBytecode)
        .setKeys([this.hederaService.getOperatorAccountId()]);

      const fileCreateResponse = await fileCreateTx.execute(this.hederaService['client']);
      const fileCreateReceipt = await fileCreateResponse.getReceipt(this.hederaService['client']);
      
      if (!fileCreateReceipt.fileId) {
        throw new Error('Failed to create bytecode file');
      }

      // Deploy contract
      const contractCreateTx = new ContractCreateTransaction()
        .setBytecodeFileId(fileCreateReceipt.fileId)
        .setGas(gas)
        .setConstructorParameters(new ContractFunctionParameters());

      const contractCreateResponse = await contractCreateTx.execute(this.hederaService['client']);
      const contractCreateReceipt = await contractCreateResponse.getReceipt(this.hederaService['client']);

      if (!contractCreateReceipt.contractId) {
        throw new Error('Contract deployment failed - no contract ID returned');
      }

      this.escrowContractId = contractCreateReceipt.contractId;
      const contractIdString = this.escrowContractId.toString();

      logger.info('BookingEscrow contract deployed successfully', {
        contractId: contractIdString,
        transactionId: contractCreateResponse.transactionId.toString(),
        gas,
      });

      return contractIdString;
    } catch (error) {
      logger.error('Failed to deploy escrow contract', { error });
      throw new Error(`Contract deployment failed: ${error.message}`);
    }
  }

  /**
   * Register a booking in the escrow contract
   */
  async registerBooking(booking: BookingData, paymentAmount: number): Promise<TransactionResult> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addString(booking.bookingId)
        .addUint256(booking.value)
        .addString(booking.metadata);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId!)
        .setGas(300000)
        .setFunction('registerBooking', functionParameters)
        .setPayableAmount(Hbar.fromTinybars(paymentAmount));

      const response = await contractExecuteTx.execute(this.hederaService['client']);
      const receipt = await response.getReceipt(this.hederaService['client']);

      logger.info('Booking registered in escrow contract', {
        bookingId: booking.bookingId,
        contractId: this.escrowContractId!.toString(),
        transactionId: response.transactionId.toString(),
      });

      return {
        transactionId: response.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to register booking in escrow', { error, booking });
      throw new Error(`Booking registration failed: ${error.message}`);
    }
  }

  /**
   * Propose a swap between two bookings
   */
  async proposeSwap(proposal: SwapProposal, additionalPayment: number = 0): Promise<TransactionResult> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addString(proposal.swapId)
        .addString(proposal.sourceBookingId)
        .addString(proposal.targetBookingId)
        .addUint256(proposal.additionalPayment)
        .addUint256(proposal.expirationTime);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId!)
        .setGas(400000)
        .setFunction('proposeSwap', functionParameters);

      if (additionalPayment > 0) {
        contractExecuteTx.setPayableAmount(Hbar.fromTinybars(additionalPayment));
      }

      const response = await contractExecuteTx.execute(this.hederaService['client']);
      const receipt = await response.getReceipt(this.hederaService['client']);

      logger.info('Swap proposed in escrow contract', {
        swapId: proposal.swapId,
        contractId: this.escrowContractId!.toString(),
        transactionId: response.transactionId.toString(),
      });

      return {
        transactionId: response.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to propose swap in escrow', { error, proposal });
      throw new Error(`Swap proposal failed: ${error.message}`);
    }
  }

  /**
   * Accept a swap proposal
   */
  async acceptSwap(swapId: string): Promise<TransactionResult> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addString(swapId);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId!)
        .setGas(200000)
        .setFunction('acceptSwap', functionParameters);

      const response = await contractExecuteTx.execute(this.hederaService['client']);
      const receipt = await response.getReceipt(this.hederaService['client']);

      logger.info('Swap accepted in escrow contract', {
        swapId,
        contractId: this.escrowContractId!.toString(),
        transactionId: response.transactionId.toString(),
      });

      return {
        transactionId: response.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to accept swap in escrow', { error, swapId });
      throw new Error(`Swap acceptance failed: ${error.message}`);
    }
  }

  /**
   * Execute a swap (complete the atomic exchange)
   */
  async executeSwap(swapId: string): Promise<TransactionResult> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addString(swapId);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId!)
        .setGas(500000)
        .setFunction('executeSwap', functionParameters);

      const response = await contractExecuteTx.execute(this.hederaService['client']);
      const receipt = await response.getReceipt(this.hederaService['client']);

      logger.info('Swap executed in escrow contract', {
        swapId,
        contractId: this.escrowContractId!.toString(),
        transactionId: response.transactionId.toString(),
      });

      return {
        transactionId: response.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to execute swap in escrow', { error, swapId });
      throw new Error(`Swap execution failed: ${error.message}`);
    }
  }

  /**
   * Cancel a swap proposal
   */
  async cancelSwap(swapId: string): Promise<TransactionResult> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addString(swapId);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId!)
        .setGas(300000)
        .setFunction('cancelSwap', functionParameters);

      const response = await contractExecuteTx.execute(this.hederaService['client']);
      const receipt = await response.getReceipt(this.hederaService['client']);

      logger.info('Swap cancelled in escrow contract', {
        swapId,
        contractId: this.escrowContractId!.toString(),
        transactionId: response.transactionId.toString(),
      });

      return {
        transactionId: response.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to cancel swap in escrow', { error, swapId });
      throw new Error(`Swap cancellation failed: ${error.message}`);
    }
  }

  /**
   * Get booking details from the contract
   */
  async getBooking(bookingId: string): Promise<BookingDetails> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addString(bookingId);

      const contractCallQuery = new ContractCallQuery()
        .setContractId(this.escrowContractId!)
        .setGas(100000)
        .setFunction('getBooking', functionParameters);

      const result = await contractCallQuery.execute(this.hederaService['client']);

      // Parse the result based on the contract's return values
      const bookingDetails: BookingDetails = {
        bookingId: result.getString(0),
        owner: result.getAddress(1),
        value: result.getUint256(2).toNumber(),
        metadata: result.getString(3),
        isLocked: result.getBool(4),
      };

      logger.info('Booking details retrieved from contract', {
        bookingId,
        owner: bookingDetails.owner,
        isLocked: bookingDetails.isLocked,
      });

      return bookingDetails;
    } catch (error) {
      logger.error('Failed to get booking from contract', { error, bookingId });
      throw new Error(`Booking query failed: ${error.message}`);
    }
  }

  /**
   * Get swap details from the contract
   */
  async getSwap(swapId: string): Promise<SwapDetails> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addString(swapId);

      const contractCallQuery = new ContractCallQuery()
        .setContractId(this.escrowContractId!)
        .setGas(100000)
        .setFunction('getSwap', functionParameters);

      const result = await contractCallQuery.execute(this.hederaService['client']);

      // Parse the result based on the contract's return values
      const swapDetails: SwapDetails = {
        swapId: result.getString(0),
        proposer: result.getAddress(1),
        acceptor: result.getAddress(2),
        sourceBookingId: result.getString(3),
        targetBookingId: result.getString(4),
        additionalPayment: result.getUint256(5).toNumber(),
        status: result.getUint8(6),
        expiresAt: result.getUint256(7).toNumber(),
        createdAt: result.getUint256(8).toNumber(),
      };

      logger.info('Swap details retrieved from contract', {
        swapId,
        status: swapDetails.status,
        proposer: swapDetails.proposer,
        acceptor: swapDetails.acceptor,
      });

      return swapDetails;
    } catch (error) {
      logger.error('Failed to get swap from contract', { error, swapId });
      throw new Error(`Swap query failed: ${error.message}`);
    }
  }

  /**
   * Get user balance from the contract
   */
  async getUserBalance(userAddress: string): Promise<number> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addAddress(userAddress);

      const contractCallQuery = new ContractCallQuery()
        .setContractId(this.escrowContractId!)
        .setGas(50000)
        .setFunction('getUserBalance', functionParameters);

      const result = await contractCallQuery.execute(this.hederaService['client']);
      const balance = result.getUint256(0).toNumber();

      logger.info('User balance retrieved from contract', {
        userAddress,
        balance,
      });

      return balance;
    } catch (error) {
      logger.error('Failed to get user balance from contract', { error, userAddress });
      throw new Error(`Balance query failed: ${error.message}`);
    }
  }

  /**
   * Withdraw funds from the contract
   */
  async withdrawFunds(amount: number): Promise<TransactionResult> {
    try {
      this.ensureContractDeployed();

      const functionParameters = new ContractFunctionParameters()
        .addUint256(amount);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId!)
        .setGas(200000)
        .setFunction('withdraw', functionParameters);

      const response = await contractExecuteTx.execute(this.hederaService['client']);
      const receipt = await response.getReceipt(this.hederaService['client']);

      logger.info('Funds withdrawn from escrow contract', {
        amount,
        contractId: this.escrowContractId!.toString(),
        transactionId: response.transactionId.toString(),
      });

      return {
        transactionId: response.transactionId.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        status: receipt.status.toString(),
        receipt,
      };
    } catch (error) {
      logger.error('Failed to withdraw funds from escrow', { error, amount });
      throw new Error(`Withdrawal failed: ${error.message}`);
    }
  }

  /**
   * Get the deployed contract ID
   */
  getContractId(): string | undefined {
    return this.escrowContractId?.toString();
  }

  /**
   * Set the contract ID (for existing deployed contracts)
   */
  setContractId(contractId: string): void {
    this.escrowContractId = ContractId.fromString(contractId);
    logger.info('Contract ID set', { contractId });
  }

  /**
   * Load contract bytecode from file
   */
  private async loadContractBytecode(): Promise<void> {
    try {
      // In a real implementation, you would compile the Solidity contract
      // and load the bytecode. For now, we'll use a placeholder.
      const contractPath = join(__dirname, '../../../contracts/BookingEscrow.sol');
      
      // This is a placeholder - in reality you'd need to compile the Solidity
      // contract using solc or similar tool to get the bytecode
      logger.warn('Contract bytecode loading is a placeholder - implement Solidity compilation');
      
      // For testing purposes, we'll use a minimal bytecode placeholder
      this.contractBytecode = '0x608060405234801561001057600080fd5b50600080546001600160a01b031916331790556102c8806100326000396000f3fe';
      
      logger.info('Contract bytecode loaded (placeholder)', {
        bytecodeLength: this.contractBytecode.length,
      });
    } catch (error) {
      logger.error('Failed to load contract bytecode', { error });
      throw new Error(`Bytecode loading failed: ${error.message}`);
    }
  }

  /**
   * Ensure contract is deployed before operations
   */
  private ensureContractDeployed(): void {
    if (!this.escrowContractId) {
      throw new Error('Escrow contract not deployed. Call deployEscrowContract() first.');
    }
  }
}