import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProposalErrorBoundary from '../ProposalErrorBoundary';

// Mock error logging service
vi.mock('../../../services/errorLoggingService', () => ({
    errorLoggingService: {
        logError: vi.fn(() => 'mock-error-id'),
        recordRecoveryAttempt: vi.fn(),
        trackUserAction: vi.fn(),
    },
}));

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
};

describe('ProposalErrorBoundary', () => {
    it('renders children when there is no error', () => {
        render(
            <ProposalErrorBoundary proposalId="test-proposal">
                <ThrowError shouldThrow={false} />
            </ProposalErrorBoundary>
        );

        expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('renders error fallback when child component throws', () => {
        // Suppress console.error for this test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ProposalErrorBoundary proposalId="test-proposal">
                <ThrowError shouldThrow={true} />
            </ProposalErrorBoundary>
        );

        expect(screen.getByText('Proposal Component Error')).toBeInTheDocument();
        expect(screen.getByText(/encountered an error and couldn't render properly/)).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('shows retry button when recovery attempts are available', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ProposalErrorBoundary proposalId="test-proposal" maxRecoveryAttempts={3}>
                <ThrowError shouldThrow={true} />
            </ProposalErrorBoundary>
        );

        const retryButton = screen.getByText(/Try Again/);
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveTextContent('3 attempts left');

        consoleSpy.mockRestore();
    });

    it('shows refresh page button', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ProposalErrorBoundary proposalId="test-proposal">
                <ThrowError shouldThrow={true} />
            </ProposalErrorBoundary>
        );

        expect(screen.getByText('🔧 Refresh Page')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('calls onError callback when error occurs', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const onError = vi.fn();

        render(
            <ProposalErrorBoundary proposalId="test-proposal" onError={onError}>
                <ThrowError shouldThrow={true} />
            </ProposalErrorBoundary>
        );

        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                componentStack: expect.any(String),
            })
        );

        consoleSpy.mockRestore();
    });

    it('shows debug information in development mode', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ProposalErrorBoundary
                proposalId="test-proposal"
                showDebugInfo={true}
            >
                <ThrowError shouldThrow={true} />
            </ProposalErrorBoundary>
        );

        expect(screen.getByText('Debug Information (Development)')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it('uses custom fallback component when provided', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const CustomFallback: React.FC<any> = () => (
            <div>Custom error fallback</div>
        );

        render(
            <ProposalErrorBoundary
                proposalId="test-proposal"
                fallback={CustomFallback}
            >
                <ThrowError shouldThrow={true} />
            </ProposalErrorBoundary>
        );

        expect(screen.getByText('Custom error fallback')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});