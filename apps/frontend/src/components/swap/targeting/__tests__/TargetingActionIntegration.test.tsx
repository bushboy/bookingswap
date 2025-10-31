import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TargetingActionButtons from '../TargetingActionButtons';
import TargetingConfirmationDialog from '../TargetingConfirmationDialog';
import { TargetingAction } from '../TargetingDetails';

// Mock the targeting action service
vi.mock('../../../services/targetingActionService', () => ({
    targetingActionService: {
        executeAction: vi.fn()
    }
}));

describe('TargetingActionIntegration', () => {
    const mockOnAction = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('TargetingActionButtons', () => {
        it('should render accept and reject buttons for incoming targets', () => {
            render(
                <TargetingActionButtons
                    targetId="target-1"
                    swapId="swap-1"
                    targetType="incoming"
                    status="active"
                    actionable={true}
                    onAction={mockOnAction}
                />
            );

            expect(screen.getByText('Accept')).toBeInTheDocument();
            expect(screen.getByText('Reject')).toBeInTheDocument();
        });

        it('should render retarget and cancel buttons for outgoing targets', () => {
            render(
                <TargetingActionButtons
                    targetId="target-1"
                    swapId="swap-1"
                    targetType="outgoing"
                    status="active"
                    actionable={true}
                    onAction={mockOnAction}
                />
            );

            expect(screen.getByText('Retarget')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });

        it('should call onAction with correct parameters when accept is clicked', async () => {
            render(
                <TargetingActionButtons
                    targetId="target-1"
                    swapId="swap-1"
                    targetType="incoming"
                    status="active"
                    actionable={true}
                    onAction={mockOnAction}
                />
            );

            const acceptButton = screen.getByText('Accept');
            fireEvent.click(acceptButton);

            await waitFor(() => {
                expect(mockOnAction).toHaveBeenCalledWith({
                    type: 'accept_target',
                    targetId: 'target-1',
                    swapId: 'swap-1',
                    metadata: expect.objectContaining({
                        timestamp: expect.any(String),
                        targetType: 'incoming',
                        status: 'active'
                    })
                });
            });
        });

        it('should not render buttons when not actionable', () => {
            render(
                <TargetingActionButtons
                    targetId="target-1"
                    swapId="swap-1"
                    targetType="incoming"
                    status="active"
                    actionable={false}
                    onAction={mockOnAction}
                />
            );

            expect(screen.queryByText('Accept')).not.toBeInTheDocument();
            expect(screen.queryByText('Reject')).not.toBeInTheDocument();
        });

        it('should disable buttons when disabled prop is true', () => {
            render(
                <TargetingActionButtons
                    targetId="target-1"
                    swapId="swap-1"
                    targetType="incoming"
                    status="active"
                    actionable={true}
                    onAction={mockOnAction}
                    disabled={true}
                />
            );

            const acceptButton = screen.getByRole('button', { name: /accept/i });
            const rejectButton = screen.getByRole('button', { name: /reject/i });

            expect(acceptButton).toBeDisabled();
            expect(rejectButton).toBeDisabled();
        });
    });

    describe('TargetingConfirmationDialog', () => {
        const mockAction: TargetingAction = {
            type: 'accept_target',
            targetId: 'target-1',
            swapId: 'swap-1'
        };

        const mockTargetDetails = {
            bookingTitle: 'Test Booking',
            ownerName: 'John Doe',
            location: 'New York, NY',
            price: 500
        };

        it('should render confirmation dialog when open', () => {
            render(
                <TargetingConfirmationDialog
                    isOpen={true}
                    action={mockAction}
                    targetDetails={mockTargetDetails}
                    onConfirm={vi.fn()}
                    onCancel={vi.fn()}
                />
            );

            expect(screen.getByText('Accept Targeting Proposal')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to accept this targeting proposal from John Doe/)).toBeInTheDocument();
            expect(screen.getByText('Accept Proposal')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });

        it('should not render when closed', () => {
            render(
                <TargetingConfirmationDialog
                    isOpen={false}
                    action={mockAction}
                    targetDetails={mockTargetDetails}
                    onConfirm={vi.fn()}
                    onCancel={vi.fn()}
                />
            );

            expect(screen.queryByText('Accept Targeting Proposal')).not.toBeInTheDocument();
        });

        it('should call onConfirm when confirm button is clicked', async () => {
            const mockOnConfirm = vi.fn();

            render(
                <TargetingConfirmationDialog
                    isOpen={true}
                    action={mockAction}
                    targetDetails={mockTargetDetails}
                    onConfirm={mockOnConfirm}
                    onCancel={vi.fn()}
                />
            );

            const confirmButton = screen.getByText('Accept Proposal');
            fireEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockOnConfirm).toHaveBeenCalled();
            });
        });

        it('should call onCancel when cancel button is clicked', () => {
            const mockOnCancel = vi.fn();

            render(
                <TargetingConfirmationDialog
                    isOpen={true}
                    action={mockAction}
                    targetDetails={mockTargetDetails}
                    onConfirm={vi.fn()}
                    onCancel={mockOnCancel}
                />
            );

            const cancelButton = screen.getByText('Cancel');
            fireEvent.click(cancelButton);

            expect(mockOnCancel).toHaveBeenCalled();
        });

        it('should show different content for reject action', () => {
            const rejectAction: TargetingAction = {
                type: 'reject_target',
                targetId: 'target-1',
                swapId: 'swap-1'
            };

            render(
                <TargetingConfirmationDialog
                    isOpen={true}
                    action={rejectAction}
                    targetDetails={mockTargetDetails}
                    onConfirm={vi.fn()}
                    onCancel={vi.fn()}
                />
            );

            expect(screen.getByText('Reject Targeting Proposal')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to reject this targeting proposal from John Doe/)).toBeInTheDocument();
            expect(screen.getByText('Reject Proposal')).toBeInTheDocument();
        });

        it('should show different content for retarget action', () => {
            const retargetAction: TargetingAction = {
                type: 'retarget',
                targetId: 'target-1',
                swapId: 'swap-1'
            };

            render(
                <TargetingConfirmationDialog
                    isOpen={true}
                    action={retargetAction}
                    onConfirm={vi.fn()}
                    onCancel={vi.fn()}
                />
            );

            expect(screen.getByText('Retarget Swap')).toBeInTheDocument();
            expect(screen.getByText(/This will cancel your current targeting and allow you to select a new target/)).toBeInTheDocument();
            expect(screen.getByText('Continue Retargeting')).toBeInTheDocument();
        });

        it('should show different content for cancel targeting action', () => {
            const cancelAction: TargetingAction = {
                type: 'cancel_targeting',
                targetId: 'target-1',
                swapId: 'swap-1'
            };

            render(
                <TargetingConfirmationDialog
                    isOpen={true}
                    action={cancelAction}
                    onConfirm={vi.fn()}
                    onCancel={vi.fn()}
                />
            );

            expect(screen.getByRole('heading', { name: 'Cancel Targeting' })).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to cancel your targeting proposal/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /cancel targeting/i })).toBeInTheDocument();
        });

        it('should disable buttons when loading', () => {
            render(
                <TargetingConfirmationDialog
                    isOpen={true}
                    action={mockAction}
                    targetDetails={mockTargetDetails}
                    onConfirm={vi.fn()}
                    onCancel={vi.fn()}
                    loading={true}
                />
            );

            const confirmButton = screen.getByRole('button', { name: /processing/i });
            const cancelButton = screen.getByRole('button', { name: /cancel/i });

            expect(confirmButton).toBeDisabled();
            expect(cancelButton).toBeDisabled();
        });
    });
});