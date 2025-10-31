/**
 * Swap Data Validator for Swap Card Display Accuracy
 * Requirements: 4.1, 4.2, 4.3, 6.4 - Sanitize and validate complete swap data
 */

import { FinancialDataHandler, ValidatedPricing } from './financialDataHandler';
import { logger } from './logger';

export interface ProposalDetail {
    id: string;
    proposerId: string;
    proposerName: string;
    proposerSwapId: string;
    proposerSwapTitle: string;
    proposerSwapDescription: string;
    // Proposer booking location and dates
    proposerBookingCity?: string;
    proposerBookingCountry?: string;
    proposerBookingCheckIn?: Date;
    proposerBookingCheckOut?: Date;
    proposedTerms: {
        pricing: ValidatedPricing;
        message?: string;
    };
    // Proposal type and cash offer details
    proposalType: 'booking' | 'cash';
    cashOfferAmount?: number;
    cashOfferCurrency?: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface TargetDetail {
    id: string;
    targetSwapId: string;
    targetOwnerName: string;
    targetSwapTitle: string;
    // Target booking location and dates
    targetBookingCity?: string;
    targetBookingCountry?: string;
    targetBookingCheckIn?: Date;
    targetBookingCheckOut?: Date;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
}

export interface ValidatedTargeting {
    incomingProposals: ProposalDetail[];
    outgoingTarget: TargetDetail | null;
    totalIncomingCount: number;
}

export interface CompleteSwapData {
    // Basic swap information
    id: string;
    title: string;
    description: string;
    ownerId: string;
    ownerName: string;
    status: string;

    // Financial information (validated)
    pricing: ValidatedPricing;

    // Targeting information
    targeting: ValidatedTargeting;

    // Location information
    location?: {
        city: string;
        country: string;
    };

    // Date range information
    dateRange?: {
        checkIn: Date;
        checkOut: Date;
    };

    // Metadata
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedData: CompleteSwapData | null;
}

export class SwapDataValidator {
    /**
     * Main validation and sanitization method
     * Requirements: 4.1, 4.2, 4.3 - Comprehensive data validation
     */
    static validateAndSanitize(rawSwapData: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Validate required fields
            if (!rawSwapData) {
                errors.push('Swap data is null or undefined');
                return { isValid: false, errors, warnings, sanitizedData: null };
            }

            if (!rawSwapData.id) {
                errors.push('Missing swap ID');
            }

            if (!rawSwapData.title) {
                errors.push('Missing swap title');
            }

            // Sanitize basic fields
            const sanitizedData: CompleteSwapData = {
                id: this.sanitizeString(rawSwapData.id),
                title: this.sanitizeString(rawSwapData.title) || 'Untitled Swap',
                description: this.sanitizeString(rawSwapData.description) || '',
                ownerId: this.sanitizeString(rawSwapData.ownerId || rawSwapData.owner_id),
                ownerName: this.sanitizeString(rawSwapData.ownerName || rawSwapData.owner_name) || 'Unknown User',
                status: this.sanitizeStatus(rawSwapData.status),
                pricing: this.sanitizePricing(rawSwapData.pricing || rawSwapData),
                targeting: this.sanitizeTargeting(rawSwapData.targeting || rawSwapData),
                location: rawSwapData.location ? {
                    city: this.sanitizeString(rawSwapData.location.city) || 'Unknown City',
                    country: this.sanitizeString(rawSwapData.location.country) || 'Unknown Country'
                } : undefined,
                dateRange: rawSwapData.dateRange ? {
                    checkIn: this.sanitizeDate(rawSwapData.dateRange.checkIn) || new Date(),
                    checkOut: this.sanitizeDate(rawSwapData.dateRange.checkOut) || new Date()
                } : undefined,
                createdAt: this.sanitizeDate(rawSwapData.createdAt || rawSwapData.created_at) || new Date(),
                updatedAt: this.sanitizeDate(rawSwapData.updatedAt || rawSwapData.updated_at) || new Date(),
                expiresAt: this.sanitizeDate(rawSwapData.expiresAt || rawSwapData.expires_at) ?? undefined
            };

            // Add warnings for missing optional data
            if (!rawSwapData.ownerName && !rawSwapData.owner_name) {
                warnings.push('Owner name not provided, using fallback');
            }

            if (!rawSwapData.description) {
                warnings.push('Description not provided');
            }

            // Validate targeting data consistency
            const targetingValidation = this.validateTargetingConsistency(sanitizedData.targeting);
            if (targetingValidation.errors.length > 0) {
                errors.push(...targetingValidation.errors);
            }
            warnings.push(...targetingValidation.warnings);

            const isValid = errors.length === 0;

            if (isValid) {
                logger.debug('Swap data validation successful', {
                    swapId: sanitizedData.id,
                    warningCount: warnings.length
                });
            } else {
                logger.warn('Swap data validation failed', {
                    swapId: rawSwapData.id,
                    errors,
                    warnings
                });
            }

            return {
                isValid,
                errors,
                warnings,
                sanitizedData: isValid ? sanitizedData : null
            };

        } catch (error) {
            logger.error('Error during swap data validation', { error, rawSwapData });
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);

            return {
                isValid: false,
                errors,
                warnings,
                sanitizedData: null
            };
        }
    }

    /**
     * Sanitize pricing data using FinancialDataHandler
     * Requirements: 4.1, 4.2, 4.3 - Financial data validation
     */
    private static sanitizePricing(pricingData: any): ValidatedPricing {
        // Handle different possible data structures
        const pricing = {
            amount: pricingData?.amount || pricingData?.price_amount || pricingData?.pricing?.amount,
            currency: pricingData?.currency || pricingData?.price_currency || pricingData?.pricing?.currency
        };

        return FinancialDataHandler.validatePricing(pricing);
    }

    /**
     * Sanitize targeting data
     * Requirements: 6.4 - Data consistency validation
     */
    private static sanitizeTargeting(targetingData: any): ValidatedTargeting {
        const incomingProposals = this.sanitizeProposals(
            targetingData?.incomingProposals ||
            targetingData?.incoming_proposals ||
            targetingData?.proposals ||
            []
        );

        const outgoingTarget = this.sanitizeTarget(
            targetingData?.outgoingTarget ||
            targetingData?.outgoing_target ||
            targetingData?.target
        );

        return {
            incomingProposals,
            outgoingTarget,
            totalIncomingCount: incomingProposals.length
        };
    }

    /**
     * Sanitize proposal array
     */
    private static sanitizeProposals(proposalsData: any[]): ProposalDetail[] {
        if (!Array.isArray(proposalsData)) {
            return [];
        }

        return proposalsData
            .filter(proposal => proposal && proposal.id)
            .map(proposal => this.sanitizeProposal(proposal))
            .filter(proposal => proposal !== null) as ProposalDetail[];
    }

    /**
     * Sanitize individual proposal
     */
    private static sanitizeProposal(proposalData: any): ProposalDetail | null {
        if (!proposalData || !proposalData.id) {
            return null;
        }

        try {
            return {
                id: this.sanitizeString(proposalData.id),
                proposerId: this.sanitizeString(proposalData.proposerId || proposalData.proposer_id) || 'unknown',
                proposerName: this.sanitizeString(proposalData.proposerName || proposalData.proposer_name) || 'Unknown User',
                proposerSwapId: this.sanitizeString(proposalData.proposerSwapId || proposalData.proposer_swap_id) || '',
                proposerSwapTitle: this.sanitizeString(proposalData.proposerSwapTitle || proposalData.proposer_swap_title) || 'Untitled Swap',
                proposerSwapDescription: this.sanitizeString(proposalData.proposerSwapDescription || proposalData.proposer_swap_description) || '',
                // Extract proposer booking location and dates
                proposerBookingCity: this.sanitizeString(proposalData.proposerBookingCity || proposalData.proposer_booking_city) || undefined,
                proposerBookingCountry: this.sanitizeString(proposalData.proposerBookingCountry || proposalData.proposer_booking_country) || undefined,
                proposerBookingCheckIn: this.sanitizeDate(proposalData.proposerBookingCheckIn || proposalData.proposer_booking_check_in) ?? undefined,
                proposerBookingCheckOut: this.sanitizeDate(proposalData.proposerBookingCheckOut || proposalData.proposer_booking_check_out) ?? undefined,
                proposedTerms: {
                    pricing: this.sanitizePricing(proposalData.proposedTerms || proposalData.proposed_terms || proposalData),
                    message: this.sanitizeString(proposalData.proposedTerms?.message || proposalData.message)
                },
                // Proposal type and cash offer details
                proposalType: (proposalData.proposalType || proposalData.proposal_type || 'booking') as 'booking' | 'cash',
                cashOfferAmount: proposalData.cashOfferAmount || proposalData.cash_offer_amount || undefined,
                cashOfferCurrency: this.sanitizeString(proposalData.cashOfferCurrency || proposalData.cash_offer_currency) || undefined,
                status: this.sanitizeProposalStatus(proposalData.status),
                createdAt: this.sanitizeDate(proposalData.createdAt || proposalData.created_at) || new Date()
            };
        } catch (error) {
            logger.warn('Failed to sanitize proposal', { error, proposalData });
            return null;
        }
    }

    /**
     * Sanitize target data
     */
    private static sanitizeTarget(targetData: any): TargetDetail | null {
        if (!targetData || !targetData.id) {
            return null;
        }

        try {
            return {
                id: this.sanitizeString(targetData.id),
                targetSwapId: this.sanitizeString(targetData.targetSwapId || targetData.target_swap_id) || '',
                targetOwnerName: this.sanitizeString(targetData.targetOwnerName || targetData.target_owner_name) || 'Unknown User',
                targetSwapTitle: this.sanitizeString(targetData.targetSwapTitle || targetData.target_swap_title) || 'Untitled Swap',
                // Extract target booking location and dates
                targetBookingCity: this.sanitizeString(targetData.targetBookingCity || targetData.target_booking_city) || undefined,
                targetBookingCountry: this.sanitizeString(targetData.targetBookingCountry || targetData.target_booking_country) || undefined,
                targetBookingCheckIn: this.sanitizeDate(targetData.targetBookingCheckIn || targetData.target_booking_check_in) ?? undefined,
                targetBookingCheckOut: this.sanitizeDate(targetData.targetBookingCheckOut || targetData.target_booking_check_out) ?? undefined,
                status: this.sanitizeProposalStatus(targetData.status),
                createdAt: this.sanitizeDate(targetData.createdAt || targetData.created_at) || new Date()
            };
        } catch (error) {
            logger.warn('Failed to sanitize target', { error, targetData });
            return null;
        }
    }

    /**
     * Validate targeting data consistency
     * Requirements: 6.4 - Data integrity validation
     */
    private static validateTargetingConsistency(targeting: ValidatedTargeting): { errors: string[], warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if proposal count matches array length
        if (targeting.totalIncomingCount !== targeting.incomingProposals.length) {
            errors.push(`Inconsistent proposal count: expected ${targeting.totalIncomingCount}, got ${targeting.incomingProposals.length}`);
        }

        // Check for duplicate proposals
        const proposalIds = targeting.incomingProposals.map(p => p.id);
        const uniqueIds = new Set(proposalIds);
        if (proposalIds.length !== uniqueIds.size) {
            warnings.push('Duplicate proposals detected and removed');
        }

        // Check for proposals with missing critical data
        targeting.incomingProposals.forEach((proposal, index) => {
            if (!proposal.proposerId || proposal.proposerId === 'unknown') {
                warnings.push(`Proposal ${index + 1} has missing or invalid proposer ID`);
            }
            if (!proposal.proposerName || proposal.proposerName === 'Unknown User') {
                warnings.push(`Proposal ${index + 1} has missing proposer name`);
            }
        });

        return { errors, warnings };
    }

    /**
     * Utility methods for sanitization
     */
    private static sanitizeString(value: any): string {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value).trim();
    }

    private static sanitizeStatus(status: any): string {
        const validStatuses = ['active', 'inactive', 'pending', 'completed', 'cancelled'];
        const sanitized = this.sanitizeString(status).toLowerCase();
        return validStatuses.includes(sanitized) ? sanitized : 'unknown';
    }

    private static sanitizeProposalStatus(status: any): 'pending' | 'accepted' | 'rejected' {
        const sanitized = this.sanitizeString(status).toLowerCase();
        if (['accepted', 'rejected'].includes(sanitized)) {
            return sanitized as 'accepted' | 'rejected';
        }
        return 'pending';
    }

    private static sanitizeDate(dateValue: any): Date | null {
        if (!dateValue) {
            return null;
        }

        if (dateValue instanceof Date) {
            return isNaN(dateValue.getTime()) ? null : dateValue;
        }

        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * Batch validation for multiple swaps
     * Requirements: 6.4 - Efficient data validation
     */
    static validateBatch(rawSwapDataArray: any[]): {
        validSwaps: CompleteSwapData[];
        invalidSwaps: { data: any; errors: string[] }[];
        summary: {
            total: number;
            valid: number;
            invalid: number;
            warnings: number;
        };
    } {
        if (!Array.isArray(rawSwapDataArray)) {
            return {
                validSwaps: [],
                invalidSwaps: [{ data: rawSwapDataArray, errors: ['Input is not an array'] }],
                summary: { total: 0, valid: 0, invalid: 1, warnings: 0 }
            };
        }

        const validSwaps: CompleteSwapData[] = [];
        const invalidSwaps: { data: any; errors: string[] }[] = [];
        let totalWarnings = 0;

        rawSwapDataArray.forEach(rawData => {
            const result = this.validateAndSanitize(rawData);

            if (result.isValid && result.sanitizedData) {
                validSwaps.push(result.sanitizedData);
            } else {
                invalidSwaps.push({ data: rawData, errors: result.errors });
            }

            totalWarnings += result.warnings.length;
        });

        return {
            validSwaps,
            invalidSwaps,
            summary: {
                total: rawSwapDataArray.length,
                valid: validSwaps.length,
                invalid: invalidSwaps.length,
                warnings: totalWarnings
            }
        };
    }
}