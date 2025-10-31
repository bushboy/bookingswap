/**
 * Tests for AuctionSettingsValidator utility
 */

import { AuctionSettingsValidator } from '../AuctionSettingsValidator';
import { ValidationError } from '../AuctionErrors';

describe('AuctionSettingsValidator', () => {
    const validFutureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now

    describe('validateAuctionSettings', () => {
        it('should validate correct auction settings', () => {
            const settings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: false,
                minimumCashOffer: 150,
                autoSelectAfterHours: 24
            };

            const result = AuctionSettingsValidator.validateAuctionSettings(settings);

            expect(result.endDate).toBeInstanceOf(Date);
            expect(result.allowBookingProposals).toBe(true);
            expect(result.allowCashProposals).toBe(false);
            expect(result.minimumCashOffer).toBe(150);
            expect(result.autoSelectAfterHours).toBe(24);
        });

        it('should handle string dates', () => {
            const settings = {
                endDate: validFutureDate.toISOString(),
                allowBookingProposals: true,
                allowCashProposals: false
            };

            const result = AuctionSettingsValidator.validateAuctionSettings(settings);
            expect(result.endDate).toBeInstanceOf(Date);
        });

        it('should reject null settings', () => {
            expect(() => AuctionSettingsValidator.validateAuctionSettings(null))
                .toThrow('Auction settings must be provided as an object');
        });

        it('should reject settings where both proposal types are false', () => {
            const settings = {
                endDate: validFutureDate,
                allowBookingProposals: false,
                allowCashProposals: false
            };

            expect(() => AuctionSettingsValidator.validateAuctionSettings(settings))
                .toThrow('At least one proposal type (booking or cash) must be allowed');
        });

        it('should reject past dates', () => {
            const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const settings = {
                endDate: pastDate,
                allowBookingProposals: true,
                allowCashProposals: false
            };

            expect(() => AuctionSettingsValidator.validateAuctionSettings(settings))
                .toThrow('endDate must be in the future');
        });

        it('should reject minimum cash offer below platform minimum', () => {
            const settings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: false,
                minimumCashOffer: 50 // Below platform minimum of 100
            };

            expect(() => AuctionSettingsValidator.validateAuctionSettings(settings))
                .toThrow('minimumCashOffer must be at least 100');
        });

        it('should reject minimum cash offer above platform maximum', () => {
            const settings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: false,
                minimumCashOffer: 15000 // Above platform maximum of 10000
            };

            expect(() => AuctionSettingsValidator.validateAuctionSettings(settings))
                .toThrow('minimumCashOffer cannot exceed 10000');
        });

        it('should reject invalid autoSelectAfterHours', () => {
            const settings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: false,
                autoSelectAfterHours: 0 // Below minimum of 1
            };

            expect(() => AuctionSettingsValidator.validateAuctionSettings(settings))
                .toThrow('autoSelectAfterHours must be at least 1 hour(s)');
        });

        it('should handle optional fields as undefined', () => {
            const settings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: false,
                minimumCashOffer: undefined,
                autoSelectAfterHours: undefined
            };

            const result = AuctionSettingsValidator.validateAuctionSettings(settings);
            expect(result.minimumCashOffer).toBeUndefined();
            expect(result.autoSelectAfterHours).toBeUndefined();
        });
    });

    describe('validateAuctionTiming', () => {
        const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        it('should accept valid auction timing', () => {
            expect(() => AuctionSettingsValidator.validateAuctionTiming(oneWeekFromNow, twoWeeksFromNow))
                .not.toThrow();
        });

        it('should reject events less than one week away', () => {
            const soonEvent = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
            expect(() => AuctionSettingsValidator.validateAuctionTiming(oneWeekFromNow, soonEvent))
                .toThrow('Auctions are not allowed for events less than one week away');
        });

        it('should reject auction ending too close to event', () => {
            const closeAuctionEnd = new Date(twoWeeksFromNow.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before event
            expect(() => AuctionSettingsValidator.validateAuctionTiming(closeAuctionEnd, twoWeeksFromNow))
                .toThrow('Auction must end at least one week before the event');
        });
    });

    describe('validateSettingsConsistency', () => {
        it('should accept consistent settings', () => {
            const auctionSettings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: true,
                minimumCashOffer: 200
            };

            const paymentPreferences = {
                bookingExchange: true,
                cashPayment: true,
                minimumCashAmount: 150
            };

            expect(() => AuctionSettingsValidator.validateSettingsConsistency(auctionSettings, paymentPreferences))
                .not.toThrow();
        });

        it('should reject booking proposals when booking exchange is disabled', () => {
            const auctionSettings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: false
            };

            const paymentPreferences = {
                bookingExchange: false,
                cashPayment: true
            };

            expect(() => AuctionSettingsValidator.validateSettingsConsistency(auctionSettings, paymentPreferences))
                .toThrow('Cannot allow booking proposals when booking exchange is disabled');
        });

        it('should reject cash proposals when cash payment is disabled', () => {
            const auctionSettings = {
                endDate: validFutureDate,
                allowBookingProposals: false,
                allowCashProposals: true
            };

            const paymentPreferences = {
                bookingExchange: true,
                cashPayment: false
            };

            expect(() => AuctionSettingsValidator.validateSettingsConsistency(auctionSettings, paymentPreferences))
                .toThrow('Cannot allow cash proposals when cash payments are disabled');
        });

        it('should reject auction minimum below swap minimum', () => {
            const auctionSettings = {
                endDate: validFutureDate,
                allowBookingProposals: true,
                allowCashProposals: true,
                minimumCashOffer: 150
            };

            const paymentPreferences = {
                bookingExchange: true,
                cashPayment: true,
                minimumCashAmount: 200 // Higher than auction minimum
            };

            expect(() => AuctionSettingsValidator.validateSettingsConsistency(auctionSettings, paymentPreferences))
                .toThrow('Auction minimum cash offer (150) cannot be less than swap minimum cash amount (200)');
        });
    });

    describe('getValidationRules', () => {
        it('should return validation rules object', () => {
            const rules = AuctionSettingsValidator.getValidationRules();

            expect(rules).toHaveProperty('endDate');
            expect(rules).toHaveProperty('allowBookingProposals');
            expect(rules).toHaveProperty('allowCashProposals');
            expect(rules).toHaveProperty('minimumCashOffer');
            expect(rules).toHaveProperty('autoSelectAfterHours');

            expect(rules.endDate.required).toBe(true);
            expect(rules.minimumCashOffer.required).toBe(false);
        });
    });
});