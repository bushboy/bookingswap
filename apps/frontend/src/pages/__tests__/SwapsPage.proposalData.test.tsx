import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SwapsPage } from '../SwapsPage';
import { useAuth } from '../../contexts/AuthContext';
import { useProposalActions } from '../../hooks/useProposalActions';
import { proposalDataService } from '../../services/proposalDataService';

// Mock dependencies
vi.mock('../../contexts/AuthContext');
vi.mock('../../hooks/useProposalActions');
vi.mock('../../services/proposalDataService');
vi.mock('../../services/swapService');
vi.mock('../../components/swap/SwapCreationModal', () => ({
    SwapCreationModal: () => <div data-testid="swap-creation-modal">Swap Creation Modal</div>
}));
vi.mock('../../components/swap/SwapDetailsModal', () => ({
    SwapDetailsModal: () => <div data-testid="swap-details-modal">Swap Details Modal</div>
}));
vi.mock('../../components/swap/ReceivedProposalsSection', () => ({
    ReceivedProposalsSection: ({ proposals }: { proposals: any[] }) => (
        <div data-testid="received-proposals-section">
            Received Proposals: {proposals.length}
        </div>
    )
}));
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams()],
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseProposalActions = vi.mocked(useProposalActions);
const mockProposalDataService = vi.mocked(proposalDataService);

describe('SwapsPage - Proposal Data Integration', () => {
    const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
    };

    const mockProposalActions = {
        getProposalLoadingState: vi.fn(),
        getProposalError: vi.fn(),
        isAnyProposalProcessing: vi.fn(),
        handleAcceptProposal: vi.fn(),
        handleRejectProposal: vi.fn(),
        globalError: null,
    };

    const mockProposals = [
        {
            id: 'proposal-1',
            proposerId: 'user-456',
            targetUserId: 'user-123',
            proposalType: 'booking' as const,
            status: 'pending' as const,
            sourceSwapId: 'swap-1',
            targetSwapId: 'swap-2',
            blockchain: {},
            createdAt: new Date(),
            updatedAt: new Date(),
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAuth.mockReturnValue({
            user: mockUser,
            token: 'mock-token',
            isAuthenticated: true,
            login: vi.fn(),
            logout: vi.fn(),
            loading: false,
        });

        mockUseProposalActions.mockReturnValue(mockProposalActions);

        // Mock proposal data service methods
        mockProposalDataService.getUserProposals = vi.fn().mockResolvedValue(mockProposals);
        mockProposalDataService.subscribeToProposalUpdates = vi.fn();
        mockProposalDataService.unsubscribeFromProposalUpdates = vi.fn();
    });

    it('should load user proposals on mount', async () => {
        render(<SwapsPage />);

        await waitFor(() => {
            expect(mockProposalDataService.getUserProposals).toHaveBeenCalledWith(mockUser.id);
        });
    });

    it('should display received proposals section when proposals exist', async () => {
        render(<SwapsPage />);

        await waitFor(() => {
            expect(screen.getByTestId('received-proposals-section')).toBeInTheDocument();
            expect(screen.getByText('Received Proposals: 1')).toBeInTheDocument();
        });
    });

    it('should subscribe to proposal updates', async () => {
        render(<SwapsPage />);

        await waitFor(() => {
            expect(mockProposalDataService.subscribeToProposalUpdates).toHaveBeenCalledWith(
                mockUser.id,
                expect.any(Function)
            );
        });
    });

    it('should handle proposal loading error', async () => {
        const errorMessage = 'Failed to load proposals';
        mockProposalDataService.getUserProposals = vi.fn().mockRejectedValue(new Error(errorMessage));

        render(<SwapsPage />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load proposals')).toBeInTheDocument();
        });
    });

    it('should display proposals loading state', () => {
        // Mock loading state by not resolving the promise immediately
        mockProposalDataService.getUserProposals = vi.fn().mockImplementation(() => new Promise(() => { }));

        render(<SwapsPage />);

        expect(screen.getByText('Loading proposals...')).toBeInTheDocument();
    });
});