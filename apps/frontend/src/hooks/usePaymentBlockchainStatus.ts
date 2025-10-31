import { useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import { ProposalStatusData } from '@/components/swap/ProposalStatusDisplay';
import { PaymentStatus } from '@booking-swap/shared';

export interface PaymentBlockchainStatusHook {
    getProposalStatusData: (proposalId: string) => ProposalStatusData | undefined;
    isProcessing: (proposalId: string) => boolean;
    hasError: (proposalId: string) => boolean;
    getError: (proposalId: string) => string | undefined;
}

/**
 * Hook to manage payment and blockchain status for proposals
 * Integrates with Redux store to provide real-time status updates
 */
export const usePaymentBlockchainStatus = (): PaymentBlockchainStatusHook => {
    const proposalAcceptanceState = useAppSelector(state => state.proposalAcceptance);

    const getProposalStatusData = useCallback((proposalId: string): ProposalStatusData | undefined => {
        const operation = proposalAcceptanceState.activeOperations[proposalId];
        const recentResponse = proposalAcceptanceState.recentResponses.find(r => r.proposalId === proposalId);
        const successOperation = proposalAcceptanceState.successOperations.find(s => s.proposalId === proposalId);

        if (!operation && !recentResponse && !successOperation) {
            return undefined;
        }

        // Determine overall status based on operation state
        let overallStatus: 'processing' | 'completed' | 'failed' | 'partial' = 'processing';

        if (operation?.error) {
            overallStatus = 'failed';
        } else if (successOperation && !operation?.loading) {
            overallStatus = 'completed';
        } else if (operation?.loading) {
            overallStatus = 'processing';
        } else if (recentResponse) {
            overallStatus = 'completed';
        }

        // Determine action type
        const actionType = operation?.action || recentResponse?.action || successOperation?.action || 'accept';

        // Extract payment information
        const hasPaymentInfo = actionType === 'accept' || (recentResponse && recentResponse.paymentTransactionId);
        let paymentStatus: PaymentStatus | undefined;
        let paymentError: string | undefined;
        let isPaymentProcessing = false;

        if (hasPaymentInfo) {
            if (operation?.loading && actionType === 'accept') {
                paymentStatus = 'processing';
                isPaymentProcessing = true;
            } else if (operation?.error && operation.error.toLowerCase().includes('payment')) {
                paymentStatus = 'failed';
                paymentError = operation.error;
            } else if (overallStatus === 'completed') {
                paymentStatus = 'completed';
            } else {
                paymentStatus = 'pending';
            }
        }

        // Extract blockchain information
        let blockchainStatus: 'pending' | 'confirmed' | 'failed' = 'pending';
        let blockchainError: string | undefined;
        let isBlockchainProcessing = false;

        if (operation?.loading) {
            blockchainStatus = 'pending';
            isBlockchainProcessing = true;
        } else if (operation?.error && !operation.error.toLowerCase().includes('payment')) {
            blockchainStatus = 'failed';
            blockchainError = operation.error;
        } else if (overallStatus === 'completed' || recentResponse?.blockchainTransactionId) {
            blockchainStatus = 'confirmed';
        }

        // Get blockchain transaction ID
        const blockchainTransactionId = recentResponse?.blockchainTransactionId ||
            (operation?.optimisticUpdate ? `pending-${proposalId}` : undefined);

        return {
            proposalId,
            actionType: actionType as 'accept' | 'reject',
            overallStatus,

            // Payment information
            paymentStatus,
            paymentAmount: hasPaymentInfo ? 100 : undefined, // This would come from actual proposal data
            paymentCurrency: hasPaymentInfo ? 'USD' : undefined,
            paymentError,
            isPaymentProcessing,

            // Blockchain information
            blockchainTransactionId,
            blockchainStatus,
            blockchainError,
            isBlockchainProcessing,
        };
    }, [proposalAcceptanceState]);

    const isProcessing = useCallback((proposalId: string): boolean => {
        const operation = proposalAcceptanceState.activeOperations[proposalId];
        return operation?.loading || false;
    }, [proposalAcceptanceState]);

    const hasError = useCallback((proposalId: string): boolean => {
        const operation = proposalAcceptanceState.activeOperations[proposalId];
        return !!operation?.error;
    }, [proposalAcceptanceState]);

    const getError = useCallback((proposalId: string): string | undefined => {
        const operation = proposalAcceptanceState.activeOperations[proposalId];
        return operation?.error || undefined;
    }, [proposalAcceptanceState]);

    return {
        getProposalStatusData,
        isProcessing,
        hasError,
        getError,
    };
};

export default usePaymentBlockchainStatus;