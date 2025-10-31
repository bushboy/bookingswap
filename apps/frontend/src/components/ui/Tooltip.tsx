import React, { useState, useRef, useEffect } from 'react';
import { tokens } from '../../design-system/tokens';

interface TooltipProps {
    content: string;
    children: React.ReactElement;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    delay = 500,
    disabled = false,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const timeoutRef = useRef<NodeJS.Timeout>();
    const triggerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const showTooltip = () => {
        if (disabled) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    const calculatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top = 0;
        let left = 0;

        switch (position) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - 8;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = triggerRect.bottom + 8;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.left - tooltipRect.width - 8;
                break;
            case 'right':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.right + 8;
                break;
        }

        // Adjust for viewport boundaries
        if (left < 8) left = 8;
        if (left + tooltipRect.width > viewportWidth - 8) {
            left = viewportWidth - tooltipRect.width - 8;
        }
        if (top < 8) top = 8;
        if (top + tooltipRect.height > viewportHeight - 8) {
            top = viewportHeight - tooltipRect.height - 8;
        }

        setTooltipPosition({ top, left });
    };

    useEffect(() => {
        if (isVisible) {
            calculatePosition();
        }
    }, [isVisible, position]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const clonedChild = React.cloneElement(children, {
        ref: triggerRef,
        onMouseEnter: (e: React.MouseEvent) => {
            showTooltip();
            children.props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
            hideTooltip();
            children.props.onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
            showTooltip();
            children.props.onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
            hideTooltip();
            children.props.onBlur?.(e);
        },
    });

    return (
        <>
            {clonedChild}
            {isVisible && !disabled && (
                <div
                    ref={tooltipRef}
                    style={{
                        position: 'fixed',
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                        backgroundColor: tokens.colors.neutral[900],
                        color: 'white',
                        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        zIndex: 9999,
                        maxWidth: '300px',
                        wordWrap: 'break-word',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        pointerEvents: 'none',
                    }}
                    role="tooltip"
                    aria-hidden={!isVisible}
                >
                    {content}
                </div>
            )}
        </>
    );
};