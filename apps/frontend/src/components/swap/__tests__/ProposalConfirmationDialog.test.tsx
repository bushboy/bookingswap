import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ProposalConfirmationDialog from '../ProposalConfirmationDialog';

// Mock localStorage
const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
});

describe('ProposalConfirmationDialog', () => {
    const mockOnConfirm = vi.fn();
    const mockOnCancel = vi.fn();

    const defaultProps = {
        isOpen: true,
        actionType: 'accept' as const,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        proposalDetails: {
            proposalId: 'test-proposal-1',
            proposalType: 'booking' as const,
            targetTitle: 'Test Booking',
            proposerName: 'John Doe',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue(null);
    });

    describe('Accept Dialog', () => {
        it('should render accept confirmation dialog', () => {
            render(<ProposalConfirmationDialog {...defaultProps} />);

            expect(screen.getByText('Accept Proposal')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to accept this proposal/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /yes, accept/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });

        it('should show proposal details when enabled', () => {
            render(
                <ProposalConfirmationDialog
                    {...defaultProps}
                    options={{ showProposalDetails: true }}
                />
            );

            expect(screen.getByText('Proposal Details')).toBeInTheDocument();
            expect(screen.getByText('Test Booking')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('should call onConfirm when accept button is clicked', async () => {
            render(<ProposalConfirmationDialog {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /yes, accept/i }));

            await waitFor(() => {
                expect(mockOnConfirm).toHaveBeenCalledWith(undefined);
            });
        });

        it('should call onCancel when cancel button is clicked', () => {
            render(<ProposalConfirmationDialog {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

            expect(mockOnCancel).toHaveBeenCalled();
        });
    });

    describe('Reject Dialog', () => {
        const rejectProps = {
            ...defaultProps,
            actionType: 'reject' as const,
            showReasonField: true,
        };

        it('should render reject confirmation dialog with reason field', () => {
            render(<ProposalConfirmationDialog {...rejectProps} />);

            expect(screen.getByText('Reject Proposal')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to reject this proposal/)).toBeInTheDocument();
            expect(screen.getByLabelText(/reason for rejecting/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /yes, reject/i })).toBeInTheDocument();
        });

        it('should show helpful suggestions when reason field is empty', () => {
            render(<ProposalConfirmationDialog {...rejectProps} />);

            expect(screen.getByText('💡 Helpful rejection reasons:')).toBeInTheDocument();
            expect(screen.getByText('Dates don\'t work for me')).toBeInTheDocument();
            expect(screen.getByText('Looking for a different location')).toBeInTheDocument();
        });

        it('should validate reason field character limit', async () => {
            render(<ProposalConfirmationDialog {...rejectProps} />);

            const textarea = screen.getByLabelText(/reason for rejecting/i);
            const longText = 'a'.repeat(501); // Exceeds 500 character limit

            fireEvent.change(textarea, { target: { value: longText } });

            await waitFor(() => {
                expect(screen.getByText(/Reason must be 500 characters or less/)).toBeInTheDocument();
            });
        });

        it('should show character count', () => {
            render(<ProposalConfirmationDialog {...rejectProps} />);

            const textarea = screen.getByLabelText(/reason for rejecting/i);
            fireEvent.change(textarea, { target: { value: 'Test reason' } });

            expect(screen.getByText('11/500 characters')).toBeInTheDocument();
        });

        it('should validate inappropriate content', async () => {
            render(<ProposalConfirmationDialog {...rejectProps} />);

            const textarea = screen.getByLabelText(/reason for rejecting/i);
            fireEvent.change(textarea, { target: { value: 'This is stupid' } });

            await waitFor(() => {
                expect(screen.getByText(/Please keep your feedback professional and constructive/)).toBeInTheDocument();
            });
        });

        it('should persist reason to localStorage', async () => {
            render(<ProposalConfirmationDialog {...rejectProps} />);

            const textarea = screen.getByLabelText(/reason for rejecting/i);
            fireEvent.change(textarea, { target: { value: 'Test reason' } });

            await waitFor(() => {
                expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                    'proposal-rejection-reason-test-proposal-1',
                    'Test reason'
                );
            });
        });

        it('should load persisted reason from localStorage', () => {
            mockLocalStorage.getItem.mockReturnValue('Persisted reason');

            render(<ProposalConfirmationDialog {...rejectProps} />);

            const textarea = screen.getByLabelText(/reason for rejecting/i) as HTMLTextAreaElement;
            expect(textarea.value).toBe('Persisted reason');
        });

        it('should call onConfirm with reason when reject button is clicked', async () => {
            render(<ProposalConfirmationDialog {...rejectProps} />);

            const textarea = screen.getByLabelText(/reason for rejecting/i);
            fireEvent.change(textarea, { target: { value: 'Not suitable for my needs' } });

            fireEvent.click(screen.getByRole('button', { name: /yes, reject/i }));

            await waitFor(() => {
                expect(mockOnConfirm).toHaveBeenCalledWith('Not suitable for my needs');
            });
        });
    });

    describe('Keyboard Navigation', () => {
        it('should close dialog on Escape key', () => {
            render(<ProposalConfirmationDialog {...defaultProps} />);

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(mockOnCancel).toHaveBeenCalled();
        });

        it('should confirm on Enter key', async () => {
            render(<ProposalConfirmationDialog {...defaultProps} />);

            fireEvent.keyDown(document, { key: 'Enter' });

            await waitFor(() => {
                expect(mockOnConfirm).toHaveBeenCalled();
            });
        });

        it('should show keyboard shortcuts help when enabled', () => {
            render(
                <ProposalConfirmationDialog
                    {...defaultProps}
                    options={{ showKeyboardShortcuts: true }}
                />
            );

            expect(screen.getByText(/Keyboard shortcuts:/)).toBeInTheDocument();
            expect(screen.getByText(/to cancel/)).toBeInTheDocument();
            expect(screen.getByText(/to confirm/)).toBeInTheDocument();
        });
    });

    describe('Loading States', () => {
        it('should disable buttons when loading', () => {
            render(<ProposalConfirmationDialog {...defaultProps} loading={true} />);

            expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
            expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
        });

        it('should show processing text when loading', () => {
            render(<ProposalConfirmationDialog {...defaultProps} loading={true} />);

            expect(screen.getByText('Processing...')).toBeInTheDocument();
        });
    });

    describe('Customization Options', () => {
        it('should use custom button text', () => {
            render(
                <ProposalConfirmationDialog
                    {...defaultProps}
                    options={{
                        confirmButtonText: 'Custom Accept',
                        cancelButtonText: 'Custom Cancel',
                    }}
                />
            );

            expect(screen.getByRole('button', { name: /custom accept/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /custom cancel/i })).toBeInTheDocument();
        });

        it('should use custom message', () => {
            render(
                <ProposalConfirmationDialog
                    {...defaultProps}
                    customMessage="Custom confirmation message"
                />
            );

            expect(screen.getByText('Custom confirmation message')).toBeInTheDocument();
        });
    });
});