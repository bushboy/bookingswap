import React, { memo, useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { tokens } from '@/design-system/tokens';
import styles from './targeting-display.module.css';

export interface TargetingIndicator {
    type: 'incoming' | 'outgoing' | 'bidirectional';
    count: number;
    icon: string;
    color: string;
    tooltip: string;
    priority: number;
}

export interface TargetingIndicatorsProps {
    indicators: TargetingIndicator[];
    displayMode?: 'badge' | 'detailed';
    onClick?: () => void;
    className?: string;
}

/**
 * Optimized targeting indicators component with React.memo
 * Requirements: 7.4, 7.5
 */
export const TargetingIndicators: React.FC<TargetingIndicatorsProps> = memo(({
    indicators,
    displayMode = 'badge',
    onClick,
    className = ''
}) => {
    // Memoize sorted indicators to prevent unnecessary re-renders
    const sortedIndicators = useMemo(() => {
        return [...indicators].sort((a, b) => a.priority - b.priority);
    }, [indicators]);

    // Memoize display configuration
    const displayConfig = useMemo(() => {
        const hasMultipleTypes = indicators.length > 1;
        const totalCount = indicators.reduce((sum, indicator) => sum + indicator.count, 0);

        return {
            hasMultipleTypes,
            totalCount,
            showDetailed: displayMode === 'detailed' || hasMultipleTypes
        };
    }, [indicators, displayMode]);

    // Early return for empty indicators
    if (indicators.length === 0) {
        return null;
    }

    // Render compact badge mode
    if (displayMode === 'badge' && !displayConfig.hasMultipleTypes) {
        const indicator = sortedIndicators[0];
        return (
            <Tooltip content={indicator.tooltip}>
                <Badge
                    variant="secondary"
                    className={`${styles.targetingBadge} ${className}`}
                    onClick={onClick}
                    style={{
                        backgroundColor: `${indicator.color}20`,
                        borderColor: indicator.color,
                        color: indicator.color,
                        cursor: onClick ? 'pointer' : 'default'
                    }}
                >
                    <span className={styles.indicatorIcon}>{indicator.icon}</span>
                    <span className={styles.indicatorCount}>{indicator.count}</span>
                </Badge>
            </Tooltip>
        );
    }

    // Render detailed mode with multiple indicators
    return (
        <div className={`${styles.targetingIndicators} ${className}`}>
            {sortedIndicators.map((indicator) => (
                <TargetingIndicatorItem
                    key={indicator.type}
                    indicator={indicator}
                    onClick={onClick}
                />
            ))}

            {displayConfig.hasMultipleTypes && (
                <div className={styles.totalIndicator}>
                    <span className={styles.totalLabel}>Total:</span>
                    <span className={styles.totalCount}>{displayConfig.totalCount}</span>
                </div>
            )}
        </div>
    );
});

/**
 * Individual targeting indicator item component
 * Memoized to prevent unnecessary re-renders
 */
const TargetingIndicatorItem: React.FC<{
    indicator: TargetingIndicator;
    onClick?: () => void;
}> = memo(({ indicator, onClick }) => {
    return (
        <Tooltip content={indicator.tooltip}>
            <div
                className={styles.indicatorItem}
                onClick={onClick}
                style={{
                    backgroundColor: `${indicator.color}15`,
                    borderColor: `${indicator.color}40`,
                    cursor: onClick ? 'pointer' : 'default'
                }}
            >
                <span
                    className={styles.indicatorIcon}
                    style={{ color: indicator.color }}
                >
                    {indicator.icon}
                </span>
                <span
                    className={styles.indicatorCount}
                    style={{ color: indicator.color }}
                >
                    {indicator.count}
                </span>
                <span className={styles.indicatorType}>
                    {indicator.type}
                </span>
            </div>
        </Tooltip>
    );
});

// Display name for debugging
TargetingIndicators.displayName = 'TargetingIndicators';
TargetingIndicatorItem.displayName = 'TargetingIndicatorItem';

export default TargetingIndicators;