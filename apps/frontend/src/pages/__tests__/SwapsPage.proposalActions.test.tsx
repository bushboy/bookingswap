import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SwapsPage } from '../SwapsPage';
import { useAuth } from '../../contexts/AuthContext';
import { useProposalActions } from '../../hooks/useProposalActions';

// Mock dependencies
vi.mock('../../contexts/AuthContext');
vi.mock('../../hooks/useProposalActions');
vi.mock('../../services/swapService');
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams()],
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseProposalActions = vi.mocked(useProposalActions);

describe('SwapsPage - Proposal Actions Integration', () => {
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
    });

    it('should initialize proposal actions hook with user ID', () => {
        render(<SwapsPage />);

        expect(mockUseProposalActions).toHaveBeenCalledWith(mockUser.id);
    });

    it('should display global error when present', () => {
        mockUseProposalActions.mockReturnValue({
            ...mockProposalActions,
            globalError: 'Failed to process proposal',
        });

        render(<SwapsPage />);

        expect(screen.getByText('Proposal Action Failed')).toBeInTheDocument();
        expect(screen.getByText('Failed to process proposal')).toBeInTheDocument();
    });

    it('should not display error when globalError is null', () => {
        render(<SwapsPage />);

        expect(screen.queryByText('Proposal Action Failed')).not.toBeInTheDocument();
    });

    it('should handle authentication requirement', () => {
        mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            isAuthenticated: false,
            login: vi.fn(),
            logout: vi.fn(),
            loading: false,
        });

        mockUseProposalActions.mockReturnValue({
            ...mockProposalActions,
            globalError: 'Authentication required. Please log in to view your proposals.',
        });

        render(<SwapsPage />);

        expect(screen.getByText('Authentication required. Please log in to view your proposals.')).toBeInTheDocument();
    });
});