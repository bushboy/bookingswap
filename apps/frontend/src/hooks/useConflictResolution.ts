import { useCallback, useRef } from 'react';

interface ConflictData {
    id: string;
    localVersion: any;
    remoteVersion: any;
    timestamp: number;
    type: 'proposal_status' | 'swap_status' | 'user_action';
}

interface ConflictResolutionStrategy {
    strategy: 'local_wins' | 'remote_wins' | 'merge' | 'user_choice';
    resolver?: (local: any, remote: any) => any;
}

interface UseConflictResolutionOptions {
    defaultStrategy?: ConflictResolutionStrategy['strategy'];
    onConflictDetected?: (conflict: ConflictData) => void;
    onConflictResolved?: (conflict: ConflictData, resolution: any) => void;
}

export const useConflictResolution = (options: UseConflictResolutionOptions = {}) => {
    const { defaultStrategy = 'remote_wins', onConflictDetected, onConflictResolved } = options;

    const activeConflicts = useRef<Map<string, ConflictData>>(new Map());

    const detectConflict = useCallback(
        (id: string, localData: any, remoteData: any, type: ConflictData['type']) => {
            // Simple conflict detection based on timestamps or version numbers
            const hasConflict =
                localData.lastModified &&
                remoteData.lastModified &&
                Math.abs(localData.lastModified - remoteData.lastModified) > 1000; // 1 second tolerance

            if (hasConflict) {
                const conflict: ConflictData = {
                    id,
                    localVersion: localData,
                    remoteVersion: remoteData,
                    timestamp: Date.now(),
                    type,
                };

                activeConflicts.current.set(id, conflict);
                onConflictDetected?.(conflict);
                return conflict;
            }

            return null;
        },
        [onConflictDetected]
    );

    const resolveConflict = useCallback(
        (
            conflictId: string,
            strategy: ConflictResolutionStrategy = { strategy: defaultStrategy }
        ) => {
            const conflict = activeConflicts.current.get(conflictId);
            if (!conflict) return null;

            let resolution: any;

            switch (strategy.strategy) {
                case 'local_wins':
                    resolution = conflict.localVersion;
                    break;
                case 'remote_wins':
                    resolution = conflict.remoteVersion;
                    break;
                case 'merge':
                    if (strategy.resolver) {
                        resolution = strategy.resolver(conflict.localVersion, conflict.remoteVersion);
                    } else {
                        // Default merge strategy - prefer remote for status, local for user actions
                        resolution = {
                            ...conflict.localVersion,
                            ...conflict.remoteVersion,
                            // Keep local user actions but remote status updates
                            status: conflict.remoteVersion.status,
                            lastModified: Math.max(
                                conflict.localVersion.lastModified || 0,
                                conflict.remoteVersion.lastModified || 0
                            ),
                        };
                    }
                    break;
                case 'user_choice':
                    // This would typically show a UI for user to choose
                    // For now, default to remote wins
                    resolution = conflict.remoteVersion;
                    break;
                default:
                    resolution = conflict.remoteVersion;
            }

            activeConflicts.current.delete(conflictId);
            onConflictResolved?.(conflict, resolution);
            return resolution;
        },
        [defaultStrategy, onConflictResolved]
    );

    const hasActiveConflicts = useCallback(() => {
        return activeConflicts.current.size > 0;
    }, []);

    const getActiveConflicts = useCallback(() => {
        return Array.from(activeConflicts.current.values());
    }, []);

    const clearConflict = useCallback((conflictId: string) => {
        activeConflicts.current.delete(conflictId);
    }, []);

    const clearAllConflicts = useCallback(() => {
        activeConflicts.current.clear();
    }, []);

    // Proposal-specific conflict resolution
    const resolveProposalConflict = useCallback(
        (proposalId: string, localProposal: any, remoteProposal: any) => {
            const conflict = detectConflict(proposalId, localProposal, remoteProposal, 'proposal_status');

            if (conflict) {
                // For proposals, prioritize status changes from server
                // but preserve local user interaction states
                return resolveConflict(proposalId, {
                    strategy: 'merge',
                    resolver: (local, remote) => ({
                        ...local,
                        status: remote.status, // Server status wins
                        lastUpdated: remote.lastUpdated,
                        // Preserve local loading states
                        isProcessing: local.isProcessing,
                        lastUserAction: local.lastUserAction,
                    }),
                });
            }

            return remoteProposal;
        },
        [detectConflict, resolveConflict]
    );

    return {
        detectConflict,
        resolveConflict,
        resolveProposalConflict,
        hasActiveConflicts,
        getActiveConflicts,
        clearConflict,
        clearAllConflicts,
        activeConflictCount: activeConflicts.current.size,
    };
};