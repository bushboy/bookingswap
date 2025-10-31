import React, { useEffect } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import styles from './mobile-targeting.module.css';

export interface MobileTargetingConfirmationProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    confirmVariant?: 'primary' | 'danger' | 'success';
    icon?: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

/**
 * Mobile-optimized confirmation dialog for targeting actions
 * Features touch-friendly buttons and appropriate visual feedback
 */
export const MobileTargetingConfirmation: React.FC<MobileTargetingConfirmationProps> = ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText = 'Cancel',
    confirmVariant = 'primary',
    icon = '❓',
    onConfirm,
    onCancel,
    loading = false,
}) => {
    const { isMobile } = useResponsive();

    // Don't render on desktop or if not open
    if (!isMobile || !isOpen) {
        return null;
    }

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                onCancel();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, loading, onCancel]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !loading) {
            onCancel();
        }
    };

    const getConfirmButtonClass = () => {
        switch (confirmVariant) {
            case 'danger':
                return `${styles['mobile-targeting-action']} ${styles.danger}`;
            case 'success':
                return `${styles['mobile-targeting-action']} ${styles.primary}`;
            case 'primary':
            default:
                return `${styles['mobile-targeting-action']} ${styles.primary}`;
        }
    };

    return (
        <div
            className={styles['mobile-targeting-confirmation-overlay']}
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-message"
        >
            <div className={styles['mobile-targeting-confirmation-dialog']}>
                <div className={styles['mobile-targeting-confirmation-icon']}>
                    {icon}
                </div>

                <h3
                    id="confirmation-title"
                    className={styles['mobile-targeting-confirmation-title']}
                >
                    {title}
                </h3>

                <p
                    id="confirmation-message"
                    className={styles['mobile-targeting-confirmation-message']}
                >
                    {message}
                </p>

                <div className={styles['mobile-targeting-confirmation-actions']}>
                    <button
                        className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                        onClick={onCancel}
                        disabled={loading}
                        type="button"
                    >
                        {cancelText}
                    </button>

                    <button
                        className={getConfirmButtonClass()}
                        onClick={onConfirm}
                        disabled={loading}
                        type="button"
                        autoFocus
                    >
                        {loading ? (
                            <div className={styles['mobile-targeting-spinner']} />
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileTargetingConfirmation;