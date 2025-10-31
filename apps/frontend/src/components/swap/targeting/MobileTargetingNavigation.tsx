import React, { useState } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { IncomingTargetInfo, OutgoingTargetInfo } from '@booking-swap/shared';
import styles from './mobile-targeting.module.css';

export interface MobileTargetingNavigationProps {
    swapId: string;
    incomingTargets: IncomingTargetInfo[];
    outgoingTarget?: OutgoingTargetInfo;
    onShowIncoming?: () => void;
    onShowOutgoing?: () => void;
    onShowHistory?: () => void;
    onBrowseTargets?: () => void;
    activeTab?: 'incoming' | 'outgoing' | 'history';
}

/**
 * Mobile navigation component for targeting features
 * Provides tab-based navigation for different targeting views
 */
export const MobileTargetingNavigation: React.FC<MobileTargetingNavigationProps> = ({
    swapId,
    incomingTargets,
    outgoingTarget,
    onShowIncoming,
    onShowOutgoing,
    onShowHistory,
    onBrowseTargets,
    activeTab = 'incoming',
}) => {
    const { isMobile } = useResponsive();
    const [isExpanded, setIsExpanded] = useState(false);

    // Don't render on desktop
    if (!isMobile) {
        return null;
    }

    const hasIncomingTargets = incomingTargets.length > 0;
    const hasOutgoingTarget = !!outgoingTarget;
    const hasAnyTargeting = hasIncomingTargets || hasOutgoingTarget;

    // Don't render if no targeting activity
    if (!hasAnyTargeting) {
        return null;
    }

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    const handleTabClick = (tab: 'incoming' | 'outgoing' | 'history', callback?: () => void) => {
        if (callback) {
            callback();
        }
        setIsExpanded(false);
    };

    const getTabBadgeCount = (tab: 'incoming' | 'outgoing') => {
        switch (tab) {
            case 'incoming':
                return incomingTargets.length;
            case 'outgoing':
                return hasOutgoingTarget ? 1 : 0;
            default:
                return 0;
        }
    };

    const getTabIcon = (tab: 'incoming' | 'outgoing' | 'history') => {
        switch (tab) {
            case 'incoming':
                return '📥';
            case 'outgoing':
                return '📤';
            case 'history':
                return '📋';
            default:
                return '📋';
        }
    };

    const getTabLabel = (tab: 'incoming' | 'outgoing' | 'history') => {
        switch (tab) {
            case 'incoming':
                return 'Incoming';
            case 'outgoing':
                return 'Outgoing';
            case 'history':
                return 'History';
            default:
                return '';
        }
    };

    const getActiveTabInfo = () => {
        switch (activeTab) {
            case 'incoming':
                return {
                    icon: getTabIcon('incoming'),
                    label: getTabLabel('incoming'),
                    count: getTabBadgeCount('incoming'),
                };
            case 'outgoing':
                return {
                    icon: getTabIcon('outgoing'),
                    label: getTabLabel('outgoing'),
                    count: getTabBadgeCount('outgoing'),
                };
            case 'history':
                return {
                    icon: getTabIcon('history'),
                    label: getTabLabel('history'),
                    count: 0,
                };
            default:
                return {
                    icon: '📋',
                    label: 'Targeting',
                    count: 0,
                };
        }
    };

    const activeTabInfo = getActiveTabInfo();

    return (
        <div className={styles['mobile-targeting-container']}>
            <div className={styles['mobile-targeting-section']}>
                <div
                    className={styles['mobile-targeting-header']}
                    onClick={toggleExpanded}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleExpanded();
                        }
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`targeting-nav-${swapId}`}
                >
                    <div className={styles['mobile-targeting-header-content']}>
                        <div className={styles['mobile-targeting-badge']}>
                            <span>{activeTabInfo.icon}</span>
                        </div>
                        <h3 className={styles['mobile-targeting-title']}>
                            {activeTabInfo.label}
                        </h3>
                        {activeTabInfo.count > 0 && (
                            <div className={styles['mobile-targeting-count']}>
                                {activeTabInfo.count}
                            </div>
                        )}
                    </div>
                    <div className={`${styles['mobile-targeting-chevron']} ${isExpanded ? styles.expanded : ''}`}>
                        ▼
                    </div>
                </div>

                <div
                    id={`targeting-nav-${swapId}`}
                    className={`${styles['mobile-targeting-content']} ${!isExpanded ? styles.collapsed : ''}`}
                >
                    <div className={styles['mobile-targeting-actions']}>
                        {hasIncomingTargets && (
                            <button
                                className={`${styles['mobile-targeting-action']} ${activeTab === 'incoming' ? styles.primary : styles.secondary
                                    }`}
                                onClick={() => handleTabClick('incoming', onShowIncoming)}
                                aria-label={`View ${incomingTargets.length} incoming proposals`}
                            >
                                <span>{getTabIcon('incoming')}</span>
                                <span>{getTabLabel('incoming')}</span>
                                <div className={styles['mobile-targeting-count']}>
                                    {getTabBadgeCount('incoming')}
                                </div>
                            </button>
                        )}

                        {hasOutgoingTarget && (
                            <button
                                className={`${styles['mobile-targeting-action']} ${activeTab === 'outgoing' ? styles.primary : styles.secondary
                                    }`}
                                onClick={() => handleTabClick('outgoing', onShowOutgoing)}
                                aria-label="View outgoing targeting"
                            >
                                <span>{getTabIcon('outgoing')}</span>
                                <span>{getTabLabel('outgoing')}</span>
                            </button>
                        )}

                        <button
                            className={`${styles['mobile-targeting-action']} ${activeTab === 'history' ? styles.primary : styles.secondary
                                }`}
                            onClick={() => handleTabClick('history', onShowHistory)}
                            aria-label="View targeting history"
                        >
                            <span>{getTabIcon('history')}</span>
                            <span>{getTabLabel('history')}</span>
                        </button>

                        <button
                            className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                            onClick={onBrowseTargets}
                            aria-label="Browse available targets"
                        >
                            <span>🔍</span>
                            <span>Browse</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileTargetingNavigation;