import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { useDebounce } from '@/hooks/useDebounce';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import { Card, CardContent } from '@/components/ui/Card';
import { TargetingValidationFeedback } from './TargetingValidationFeedback';
import {
    SwapWithTargeting,
    TargetingValidation,
} from '@booking-swap/shared';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import {
    selectTargetingOperation,
    selectTargetingLoading,
    selectTargetingError,
    selectCachedValidation,
    closeTargetingModal,
    updateTargetingMessage,
    updateTargetingConditions,
    setTargetingStep,
    selectTargetSwap,
} from '@/store/slices/targetingSlice';
import {
    targetSwap,
    retargetSwap,
    validateTargeting,
} from '@/store/thunks/targetingThunks';

interface TargetingModalProps {
    userSwap: SwapWithTargeting;
    availableSwaps?: SwapWithTargeting[];
    onSwapSelect?: (swapId: string) => void;
}

interface SwapSelectorProps {
    availableSwaps: SwapWithTargeting[];
    selectedSwapId: string | null;
    onSwapSelect: (swapId: string) => void;
    userSwapId: string;
}

interface TargetingConfirmationProps {
    sourceSwap: SwapWithTargeting;
    targetSwapId: string;
    validation: TargetingValidation | null;
    isValidating: boolean;
    message: string;
    conditions: string[];
    onMessageChange: (message: string) => void;
    onConditionsChange: (conditions: string[]) => void;
    onConfirm: () => void;
    onBack: () => void;
    isSubmitting: boolean;
}

// Swap Selector Component
const SwapSelector: React.FC<SwapSelectorProps> = ({
    availableSwaps,
    selectedSwapId,
    onSwapSelect,
    userSwapId,
}) => {
    const { isMobile } = useResponsive();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSwaps = availableSwaps.filter(swap =>
        swap.id !== userSwapId &&
        (searchTerm === '' ||
            swap.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            // Add more search criteria as needed
            false
        )
    );

    return (
        <div>
            <div style={{ marginBottom: tokens.spacing[4] }}>
                <Input
                    type="text"
                    placeholder="Search swaps by ID or details..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%' }}
                />
            </div>

            <div
                style={{
                    maxHeight: isMobile ? '300px' : '400px',
                    overflowY: 'auto',
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    borderRadius: tokens.borderRadius.md,
                }}
            >
                {filteredSwaps.length === 0 ? (
                    <div
                        style={{
                            padding: tokens.spacing[6],
                            textAlign: 'center',
                            color: tokens.colors.neutral[600],
                        }}
                    >
                        {searchTerm ? 'No swaps match your search.' : 'No available swaps to target.'}
                    </div>
                ) : (
                    filteredSwaps.map((swap) => (
                        <div
                            key={swap.id}
                            style={{
                                padding: tokens.spacing[4],
                                borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
                                cursor: 'pointer',
                                backgroundColor: selectedSwapId === swap.id
                                    ? tokens.colors.primary[50]
                                    : 'transparent',
                                // Hover styling would be handled by CSS
                            }}
                            onClick={() => onSwapSelect(swap.id)}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: tokens.spacing[2],
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.base,
                                            fontWeight: tokens.typography.fontWeight.medium,
                                            color: tokens.colors.neutral[900],
                                        }}
                                    >
                                        Swap #{swap.id.slice(-8)}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: tokens.typography.fontSize.sm,
                                            color: tokens.colors.neutral[600],
                                        }}
                                    >
                                        {/* Add swap details here */}
                                        Available for targeting
                                    </div>
                                </div>

                                {selectedSwapId === swap.id && (
                                    <div
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            backgroundColor: tokens.colors.primary[500],
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '12px',
                                        }}
                                    >
                                        ✓
                                    </div>
                                )}
                            </div>

                            {/* Show auction info if applicable and feature is enabled */}
                            {FEATURE_FLAGS.ENABLE_AUCTION_MODE && swap.auctionInfo?.isAuction && (
                                <div
                                    style={{
                                        fontSize: tokens.typography.fontSize.xs,
                                        color: tokens.colors.primary[600],
                                        backgroundColor: tokens.colors.primary[50],
                                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                        borderRadius: tokens.borderRadius.sm,
                                        display: 'inline-block',
                                    }}
                                >
                                    Auction Mode • {swap.auctionInfo.proposalCount} proposals
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Targeting Confirmation Component
const TargetingConfirmation: React.FC<TargetingConfirmationProps> = ({
    sourceSwap,
    targetSwapId,
    validation,
    isValidating,
    message,
    conditions,
    onMessageChange,
    onConditionsChange,
    onConfirm,
    onBack,
    isSubmitting,
}) => {
    const { isMobile } = useResponsive();
    const [newCondition, setNewCondition] = useState('');

    const handleAddCondition = () => {
        if (newCondition.trim() && !conditions.includes(newCondition.trim())) {
            onConditionsChange([...conditions, newCondition.trim()]);
            setNewCondition('');
        }
    };

    const handleRemoveCondition = (index: number) => {
        onConditionsChange(conditions.filter((_, i) => i !== index));
    };

    const canProceed = validation?.canTarget && !isValidating && !isSubmitting;

    return (
        <div>
            <Card variant="outlined" style={{ marginBottom: tokens.spacing[4] }}>
                <CardContent>
                    <div style={{ marginBottom: tokens.spacing[4] }}>
                        <h4 style={{
                            margin: 0,
                            marginBottom: tokens.spacing[2],
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.medium,
                        }}>
                            Targeting Summary
                        </h4>
                        <div style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[600] }}>
                            <div>Your swap: #{sourceSwap.id.slice(-8)}</div>
                            <div>Target swap: #{targetSwapId.slice(-8)}</div>
                        </div>
                    </div>

                    <TargetingValidationFeedback
                        validation={validation}
                        isValidating={isValidating}
                        targetSwapId={targetSwapId}
                    />
                </CardContent>
            </Card>

            {canProceed && (
                <div style={{ marginBottom: tokens.spacing[4] }}>
                    <div style={{ marginBottom: tokens.spacing[3] }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            Message (Optional)
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => onMessageChange(e.target.value)}
                            placeholder="Add a message to your targeting proposal..."
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                padding: tokens.spacing[3],
                                border: `1px solid ${tokens.colors.neutral[300]}`,
                                borderRadius: tokens.borderRadius.md,
                                fontSize: tokens.typography.fontSize.sm,
                                resize: 'vertical',
                            }}
                            maxLength={500}
                        />
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[500],
                                textAlign: 'right',
                                marginTop: tokens.spacing[1],
                            }}
                        >
                            {message.length}/500
                        </div>
                    </div>

                    <div style={{ marginBottom: tokens.spacing[4] }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            Conditions (Optional)
                        </label>

                        <div style={{ display: 'flex', gap: tokens.spacing[2], marginBottom: tokens.spacing[2] }}>
                            <Input
                                type="text"
                                value={newCondition}
                                onChange={(e) => setNewCondition(e.target.value)}
                                placeholder="Add a condition..."
                                style={{ flex: 1 }}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddCondition()}
                            />
                            <Button
                                variant="outline"
                                onClick={handleAddCondition}
                                disabled={!newCondition.trim()}
                            >
                                Add
                            </Button>
                        </div>

                        {conditions.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing[2] }}>
                                {conditions.map((condition, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                                            backgroundColor: tokens.colors.neutral[100],
                                            borderRadius: tokens.borderRadius.md,
                                            fontSize: tokens.typography.fontSize.sm,
                                        }}
                                    >
                                        <span>{condition}</span>
                                        <button
                                            onClick={() => handleRemoveCondition(index)}
                                            style={{
                                                marginLeft: tokens.spacing[2],
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: tokens.colors.neutral[500],
                                                fontSize: '14px',
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div
                style={{
                    display: 'flex',
                    gap: tokens.spacing[3],
                    justifyContent: 'flex-end',
                    flexDirection: isMobile ? 'column' : 'row',
                }}
            >
                <Button
                    variant="outline"
                    onClick={onBack}
                    disabled={isSubmitting}
                    style={{ minWidth: isMobile ? '100%' : '120px' }}
                >
                    Back
                </Button>
                <Button
                    variant="primary"
                    onClick={onConfirm}
                    disabled={!canProceed}
                    loading={isSubmitting}
                    style={{ minWidth: isMobile ? '100%' : '120px' }}
                >
                    Confirm Targeting
                </Button>
            </div>
        </div>
    );
};

// Main Targeting Modal Component
export const TargetingModal: React.FC<TargetingModalProps> = ({
    userSwap,
    availableSwaps = [],
    onSwapSelect,
}) => {
    const { isMobile } = useResponsive();
    const dispatch = useDispatch();

    // Redux state
    const operation = useSelector(selectTargetingOperation);
    const isLoading = useSelector(selectTargetingLoading);
    const error = useSelector(selectTargetingError);

    // Local state
    const [selectedSwapId, setSelectedSwapId] = useState<string | null>(
        operation.targetSwapId || null
    );
    const [validation, setValidation] = useState<TargetingValidation | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    // Debounced validation
    const debouncedTargetSwapId = useDebounce(selectedSwapId, 500);

    // Get cached validation
    const cachedValidation = useSelector((state: any) =>
        selectCachedValidation(state, userSwap.id, selectedSwapId || '')
    );

    // Validate targeting when target swap changes
    useEffect(() => {
        if (debouncedTargetSwapId && operation.step === 'confirm') {
            if (cachedValidation) {
                setValidation(cachedValidation);
            } else {
                setIsValidating(true);
                dispatch(validateTargeting({
                    sourceSwapId: userSwap.id,
                    targetSwapId: debouncedTargetSwapId,
                }) as any)
                    .unwrap()
                    .then((result: any) => {
                        setValidation(result);
                    })
                    .catch((error: any) => {
                        console.error('Validation failed:', error);
                    })
                    .finally(() => {
                        setIsValidating(false);
                    });
            }
        }
    }, [debouncedTargetSwapId, operation.step, cachedValidation, dispatch, userSwap.id]);

    // Event handlers
    const handleClose = () => {
        dispatch(closeTargetingModal());
        setSelectedSwapId(null);
        setValidation(null);
    };

    const handleSwapSelect = (swapId: string) => {
        setSelectedSwapId(swapId);
        onSwapSelect?.(swapId);
        dispatch(selectTargetSwap(swapId));
        dispatch(setTargetingStep('confirm'));
    };

    const handleBack = () => {
        dispatch(setTargetingStep('select_target'));
        setValidation(null);
    };

    const handleConfirm = async () => {
        if (!selectedSwapId || !validation?.canTarget) return;

        try {
            const isRetargeting = !!operation.sourceSwapId && userSwap.targeting?.isTargeting;

            if (isRetargeting) {
                await dispatch(retargetSwap({
                    sourceSwapId: userSwap.id,
                    newTargetSwapId: selectedSwapId,
                    message: operation.message,
                    conditions: operation.conditions,
                }) as any).unwrap();
            } else {
                await dispatch(targetSwap({
                    sourceSwapId: userSwap.id,
                    targetSwapId: selectedSwapId,
                    message: operation.message,
                    conditions: operation.conditions,
                }) as any).unwrap();
            }
        } catch (error) {
            // Error is handled by Redux
            console.error('Targeting failed:', error);
        }
    };

    const handleMessageChange = (message: string) => {
        dispatch(updateTargetingMessage(message));
    };

    const handleConditionsChange = (conditions: string[]) => {
        dispatch(updateTargetingConditions(conditions));
    };

    // Render different steps
    const renderContent = () => {
        switch (operation.step) {
            case 'select_target':
                return (
                    <SwapSelector
                        availableSwaps={availableSwaps}
                        selectedSwapId={selectedSwapId}
                        onSwapSelect={handleSwapSelect}
                        userSwapId={userSwap.id}
                    />
                );

            case 'confirm':
                if (!selectedSwapId) {
                    return <div>No swap selected</div>;
                }
                return (
                    <TargetingConfirmation
                        sourceSwap={userSwap}
                        targetSwapId={selectedSwapId}
                        validation={validation}
                        isValidating={isValidating}
                        message={operation.message || ''}
                        conditions={operation.conditions || []}
                        onMessageChange={handleMessageChange}
                        onConditionsChange={handleConditionsChange}
                        onConfirm={handleConfirm}
                        onBack={handleBack}
                        isSubmitting={isLoading}
                    />
                );

            case 'submitting':
                return (
                    <div style={{ textAlign: 'center', padding: tokens.spacing[6] }}>
                        <LoadingSpinner size="lg" />
                        <div style={{ marginTop: tokens.spacing[4], color: tokens.colors.neutral[600] }}>
                            Processing your targeting request...
                        </div>
                    </div>
                );

            case 'success':
                return (
                    <div style={{ textAlign: 'center', padding: tokens.spacing[6] }}>
                        <div
                            style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                backgroundColor: tokens.colors.success[500],
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto',
                                marginBottom: tokens.spacing[4],
                                color: 'white',
                                fontSize: '24px',
                            }}
                        >
                            ✓
                        </div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[900],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            Targeting Successful!
                        </div>
                        <div style={{ color: tokens.colors.neutral[600] }}>
                            Your swap is now targeting the selected swap.
                        </div>
                    </div>
                );

            case 'error':
                return (
                    <div style={{ textAlign: 'center', padding: tokens.spacing[6] }}>
                        <Alert variant="error">
                            <AlertDescription>
                                {error || 'An error occurred while processing your targeting request.'}
                            </AlertDescription>
                        </Alert>
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            style={{ marginTop: tokens.spacing[4] }}
                        >
                            Try Again
                        </Button>
                    </div>
                );

            default:
                return null;
        }
    };

    const getModalTitle = () => {
        switch (operation.step) {
            case 'select_target':
                return 'Select Target Swap';
            case 'confirm':
                return 'Confirm Targeting';
            case 'submitting':
                return 'Processing...';
            case 'success':
                return 'Success';
            case 'error':
                return 'Error';
            default:
                return 'Target Swap';
        }
    };

    return (
        <Modal
            isOpen={operation.isModalOpen}
            onClose={handleClose}
            title={getModalTitle()}
            size={operation.step === 'select_target' ? 'lg' : 'md'}
            closeOnOverlayClick={operation.step !== 'submitting'}
            closeOnEscape={operation.step !== 'submitting'}
        >
            {renderContent()}
        </Modal>
    );
};

export default TargetingModal;