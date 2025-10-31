import React, { useEffect, useRef } from 'react';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const getSizeStyles = (size: 'sm' | 'md' | 'lg' | 'xl', isMobile: boolean) => {
  if (isMobile) {
    return {
      sm: { maxWidth: '95vw', maxHeight: '90vh' },
      md: { maxWidth: '95vw', maxHeight: '90vh' },
      lg: { maxWidth: '95vw', maxHeight: '90vh' },
      xl: { maxWidth: '95vw', maxHeight: '90vh' },
    };
  }

  return {
    sm: { maxWidth: '400px', maxHeight: '90vh' },
    md: { maxWidth: '600px', maxHeight: '90vh' },
    lg: { maxWidth: '800px', maxHeight: '90vh' },
    xl: { maxWidth: '1200px', maxHeight: '90vh' },
  };
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const { isMobile } = useResponsive();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const sizeStyles = getSizeStyles(size, isMobile);

  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the modal
      modalRef.current?.focus();

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scroll
      document.body.style.overflow = '';

      // Restore focus to previously focused element
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeOnEscape, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      // Trap focus within modal
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: isMobile ? 0 : tokens.spacing[4],
      }}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: 'white',
          borderRadius: isMobile
            ? `${tokens.borderRadius.lg} ${tokens.borderRadius.lg} 0 0`
            : tokens.borderRadius.lg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          ...sizeStyles[size],
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // Mobile: slide up from bottom
          ...(isMobile && {
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            marginTop: 'auto',
          }),
        }}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {title && (
          <div
            style={{
              padding: isMobile
                ? `${tokens.spacing[4]} ${tokens.spacing[4]} ${tokens.spacing[3]}`
                : `${tokens.spacing[6]} ${tokens.spacing[6]} ${tokens.spacing[4]}`,
              borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <h2
              id="modal-title"
              style={{
                fontSize: isMobile
                  ? tokens.typography.fontSize.lg
                  : tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: 0,
                paddingRight: tokens.spacing[4], // Space for close button
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: tokens.typography.fontSize.xl,
                color: tokens.colors.neutral[500],
                cursor: 'pointer',
                padding: tokens.spacing[2],
                borderRadius: tokens.borderRadius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px', // Touch target
                minHeight: '44px',
                flexShrink: 0,
              }}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: isMobile ? tokens.spacing[4] : tokens.spacing[6],
            // Enable momentum scrolling on iOS
            WebkitOverflowScrolling: 'touch',
            // Ensure proper scrolling behavior
            minHeight: 0, // Allow flex item to shrink below content size
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
