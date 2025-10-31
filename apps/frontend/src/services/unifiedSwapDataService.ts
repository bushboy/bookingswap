import { SwapCardData, EnhancedSwapCardData } from '@booking-swap/shared';
import { swapService } from './swapService';
import { swapTargetingService } from './swapTargetingService';
import { proposalService } from './proposalService';
import { FinancialDataHandler } from '../utils/financialDataHandler';

/**
 * Unified Swap Data Service
 * 
 * This service provides a single source of truth for all swap card data,
 * ensuring consistency across all display elements by:
 * 1. Fetching all related data in a coordinated manner
 * 2. Validating and sanitizing data before returning
 * 3. Providing real-time synchronization capabilities
 * 4. Detecting and logging data discrepancies
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

interface DataConsistencyReport {
    isConsistent: boolean;
    discrepancies: string[];
    timestamp: Date;
    swapId: string;
}

interface UnifiedSwapDataOptions {
    includeTargeting?: boolean;
    includeProposals?: boolean;
    validateConsistency?: boolean;
    forceRefresh?: boolean;
}

class UnifiedSwapDataService {
    private dataCache: Map<string, { data: SwapCardData; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 30 * 1000; // 30 seconds for real-time consistency
    private consistencyReports: Map<string, DataConsistencyReport> = new Map();
    private syncCallbacks: Map<string, ((data: SwapCardData) => void)[]> = new Map();

    /**
     * Get unified swap card data with all related information
     * This is the primary method for fetching consistent swap data
     */
    async getUnifiedSwapData(
        swapId: string,
        options: UnifiedSwapDataOptions = {}
    ): Promise<SwapCardData> {
        const {
            includeTargeting = true,
            includeProposals = true,
            validateConsistency = true,
            forceRefresh = false
        } = options;

        try {
            // Check cache first unless force refresh is requested
            if (!forceRefresh) {
                const cached = this.getCachedData(swapId);
                if (cached) {
                    return cached;
                }
            }

            // Fetch all data concurrently for better performance
            const [swapData, targetingData, proposalData] = await Promise.allSettled([
                this.fetchSwapData(swapId),
                includeTargeting ? this.fetchTargetingData(swapId) : Promise.resolve(null),
                includeProposals ? this.fetchProposalData(swapId) : Promise.resolve(null)
            ]);

            // Extract successful results and handle failures gracefully
            const swap = swapData.status === 'fulfilled' ? swapData.value : null;
            const targeting = targetingData.status === 'fulfilled' ? targetingData.value : null;
            const proposals = proposalData.status === 'fulfilled' ? proposalData.value : null;

            if (!swap) {
                throw new Error(`Failed to fetch swap data for ${swapId}`);
            }

            // Build unified data structure
            const unifiedData = this.buildUnifiedData(swap, targeting, proposals);

            // Validate data consistency if requested
            if (validateConsistency) {
                const consistencyReport = this.validateDataConsistency(unifiedData);
                this.consistencyReports.set(swapId, consistencyReport);

                if (!consistencyReport.isConsistent) {
                    console.warn(`Data consistency issues detected for swap ${swapId}:`, consistencyReport.discrepancies);
                }
            }

            // Cache the unified data
            this.setCachedData(swapId, unifiedData);

            // Notify sync callbacks
            this.notifySyncCallbacks(swapId, unifiedData);

            return unifiedData;
        } catch (error) {
            console.error(`Failed to get unified swap data for ${swapId}:`, error);

            // Return fallback data to prevent UI crashes
            return this.getFallbackSwapData(swapId);
        }
    }

    /**
     * Get multiple unified swap data entries efficiently
     */
    async getMultipleUnifiedSwapData(
        swapIds: string[],
        options: UnifiedSwapDataOptions = {}
    ): Promise<SwapCardData[]> {
        try {
            // Process swaps in parallel for better performance
            const results = await Promise.allSettled(
                swapIds.map(id => this.getUnifiedSwapData(id, options))
            );

            return results
                .filter(result => result.status === 'fulfilled')
                .map(result => (result as PromiseFulfilledResult<SwapCardData>).value);
        } catch (error) {
            console.error('Failed to get multiple unified swap data:', error);
            return [];
        }
    }

    /**
     * Synchronize data across all display elements
     * This ensures all UI components show the same underlying data
     */
    async synchronizeSwapData(swapId: string): Promise<void> {
        try {
            // Force refresh to get latest data
            const freshData = await this.getUnifiedSwapData(swapId, { forceRefresh: true });

            // Update cache
            this.setCachedData(swapId, freshData);

            // Notify all registered callbacks
            this.notifySyncCallbacks(swapId, freshData);

            console.log(`Synchronized data for swap ${swapId}`);
        } catch (error) {
            console.error(`Failed to synchronize data for swap ${swapId}:`, error);
        }
    }

    /**
     * Register a callback for data synchronization updates
     */
    registerSyncCallback(swapId: string, callback: (data: SwapCardData) => void): () => void {
        if (!this.syncCallbacks.has(swapId)) {
            this.syncCallbacks.set(swapId, []);
        }

        this.syncCallbacks.get(swapId)!.push(callback);

        // Return unregister function
        return () => {
            const callbacks = this.syncCallbacks.get(swapId);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Get consistency report for a swap
     */
    getConsistencyReport(swapId: string): DataConsistencyReport | null {
        return this.consistencyReports.get(swapId) || null;
    }

    /**
     * Clear cache and force refresh for a swap
     */
    invalidateSwapData(swapId: string): void {
        this.dataCache.delete(swapId);
        this.consistencyReports.delete(swapId);
    }

    /**
     * Clear all cached data
     */
    clearAllCache(): void {
        this.dataCache.clear();
        this.consistencyReports.clear();
    }

    // Private helper methods

    private async fetchSwapData(swapId: string) {
        return await swapService.getSwap(swapId);
    }

    private async fetchTargetingData(swapId: string) {
        try {
            const [incomingTargets, outgoingTarget] = await Promise.allSettled([
                swapTargetingService.getSwapsTargetedBy(swapId),
                swapTargetingService.getSwapTarget(swapId)
            ]);

            return {
                incoming: incomingTargets.status === 'fulfilled' ? incomingTargets.value : [],
                outgoing: outgoingTarget.status === 'fulfilled' ? outgoingTarget.value : null
            };
        } catch (error) {
            console.warn(`Failed to fetch targeting data for ${swapId}:`, error);
            return null;
        }
    }

    private async fetchProposalData(swapId: string) {
        try {
            return await proposalService.getProposalsForSwap(swapId);
        } catch (error) {
            console.warn(`Failed to fetch proposal data for ${swapId}:`, error);
            return [];
        }
    }

    private buildUnifiedData(
        swap: any,
        targeting: any,
        proposals: any[]
    ): SwapCardData {
        // Sanitize financial data
        const sanitizedPricing = FinancialDataHandler.sanitizePricing(swap.sourceBooking?.swapValue);

        // Build the unified data structure
        const unifiedData: SwapCardData = {
            userSwap: {
                id: swap.id,
                status: swap.status,
                bookingDetails: {
                    id: swap.sourceBooking?.id || '',
                    title: swap.sourceBooking?.title || 'Untitled Booking',
                    type: swap.sourceBooking?.type || 'hotel',
                    location: {
                        city: swap.sourceBooking?.location?.city || 'Unknown',
                        country: swap.sourceBooking?.location?.country || 'Unknown'
                    },
                    dateRange: swap.sourceBooking?.dateRange || {
                        checkIn: new Date(),
                        checkOut: new Date()
                    },
                    swapValue: sanitizedPricing.amount,
                    currency: sanitizedPricing.currency
                },
                createdAt: new Date(swap.createdAt),
                expiresAt: swap.terms?.expiresAt ? new Date(swap.terms.expiresAt) : undefined
            }
        };

        // Add targeting information if available
        if (targeting) {
            const enhancedData = unifiedData as EnhancedSwapCardData;
            enhancedData.targeting = {
                incomingTargets: (targeting.incoming || []).map((target: any) => ({
                    id: target.id,
                    sourceSwapId: target.sourceSwapId,
                    proposerName: target.proposerName || 'Unknown User',
                    proposerSwapTitle: target.proposerSwapTitle || 'Untitled Swap',
                    status: target.status || 'pending',
                    createdAt: new Date(target.createdAt || Date.now())
                })),
                outgoingTarget: targeting.outgoing ? {
                    id: targeting.outgoing.id,
                    targetSwapId: targeting.outgoing.targetSwapId,
                    targetOwnerName: targeting.outgoing.targetOwnerName || 'Unknown User',
                    targetSwapTitle: targeting.outgoing.targetSwapTitle || 'Untitled Swap',
                    status: targeting.outgoing.status || 'pending',
                    createdAt: new Date(targeting.outgoing.createdAt || Date.now())
                } : null,
                canTarget: true // This should be determined by business logic
            };
        }

        return unifiedData;
    }

    private validateDataConsistency(data: SwapCardData): DataConsistencyReport {
        const discrepancies: string[] = [];
        const swapId = data.userSwap.id;

        // Validate basic swap data
        if (!data.userSwap.bookingDetails.title || data.userSwap.bookingDetails.title === 'Untitled Booking') {
            discrepancies.push('Missing or default booking title');
        }

        if (!data.userSwap.bookingDetails.location.city || data.userSwap.bookingDetails.location.city === 'Unknown') {
            discrepancies.push('Missing or unknown location information');
        }

        // Validate financial data consistency
        if (data.userSwap.bookingDetails.swapValue === null) {
            discrepancies.push('Swap value is null - should show "Price not set"');
        }

        // Validate targeting data consistency if present
        if ('targeting' in data) {
            const enhancedData = data as EnhancedSwapCardData;
            const targeting = enhancedData.targeting;

            if (targeting) {
                // Check for missing proposer names
                const missingNames = targeting.incomingTargets.filter(
                    target => !target.proposerName || target.proposerName === 'Unknown User'
                );
                if (missingNames.length > 0) {
                    discrepancies.push(`${missingNames.length} incoming targets missing proposer names`);
                }

                // Check for missing swap titles
                const missingTitles = targeting.incomingTargets.filter(
                    target => !target.proposerSwapTitle || target.proposerSwapTitle === 'Untitled Swap'
                );
                if (missingTitles.length > 0) {
                    discrepancies.push(`${missingTitles.length} incoming targets missing swap titles`);
                }
            }
        }

        return {
            isConsistent: discrepancies.length === 0,
            discrepancies,
            timestamp: new Date(),
            swapId
        };
    }

    private getCachedData(swapId: string): SwapCardData | null {
        const cached = this.dataCache.get(swapId);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_TTL) {
            this.dataCache.delete(swapId);
            return null;
        }

        return cached.data;
    }

    private setCachedData(swapId: string, data: SwapCardData): void {
        this.dataCache.set(swapId, {
            data,
            timestamp: Date.now()
        });
    }

    private notifySyncCallbacks(swapId: string, data: SwapCardData): void {
        const callbacks = this.syncCallbacks.get(swapId);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in sync callback for swap ${swapId}:`, error);
                }
            });
        }
    }

    private getFallbackSwapData(swapId: string): SwapCardData {
        return {
            userSwap: {
                id: swapId,
                status: 'pending',
                bookingDetails: {
                    id: '',
                    title: 'Data unavailable',
                    type: 'hotel',
                    location: {
                        city: 'Unknown',
                        country: 'Unknown'
                    },
                    dateRange: {
                        checkIn: new Date(),
                        checkOut: new Date()
                    },
                    swapValue: null,
                    currency: 'USD'
                },
                createdAt: new Date(),
                expiresAt: undefined
            }
        };
    }
}

// Export singleton instance
export const unifiedSwapDataService = new UnifiedSwapDataService();
export default unifiedSwapDataService;