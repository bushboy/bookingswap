import { HederaService } from './HederaService';
import { BlockchainVerificationService } from './BlockchainVerificationService';
import { TargetingBlockchainService } from './TargetingBlockchainService';
import { createHederaService } from './factory';

/**
 * Factory for creating targeting blockchain service instances
 * Requirements: 5.4, 5.5, 5.6, 8.4, 8.5
 */
export function createTargetingBlockchainService(): TargetingBlockchainService {
    // Create Hedera service instance
    const hederaService = createHederaService();

    // Create blockchain verification service
    const blockchainVerificationService = new BlockchainVerificationService(hederaService);

    // Create and return targeting blockchain service
    return new TargetingBlockchainService(hederaService, blockchainVerificationService);
}

/**
 * Create targeting blockchain service with custom Hedera service
 */
export function createTargetingBlockchainServiceWithHedera(
    hederaService: HederaService
): TargetingBlockchainService {
    const blockchainVerificationService = new BlockchainVerificationService(hederaService);
    return new TargetingBlockchainService(hederaService, blockchainVerificationService);
}