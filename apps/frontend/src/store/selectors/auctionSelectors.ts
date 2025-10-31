import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import {
  SwapAuction,
  AuctionProposal,
  AuctionStatus,
  ProposalStatus,
  ProposalType,
  ProposalComparison,
} from '@booking-swap/shared';

// Base selectors
const selectAuctionState = (state: RootState) => state.auctions;
const selectAuctions = (state: RootState) => state.auctions.auctions;
const selectProposals = (state: RootState) => state.auctions.proposals;
const selectUserAuctions = (state: RootState) => state.auctions.userAuctions;
const selectUserProposals = (state: RootState) => state.auctions.userProposals;
const selectFilters = (state: RootState) => state.auctions.filters;

// Filtered auction selectors
export const selectFilteredAuctions = createSelector(
  [selectAuctions, selectFilters],
  (auctions, filters) => {
    let filtered = auctions;

    // Filter by status
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(auction =>
        filters.status!.includes(auction.status)
      );
    }

    // Filter by ending soon
    if (filters.endingSoon) {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      );
      filtered = filtered.filter(
        auction =>
          auction.status === 'active' &&
          new Date(auction.settings.endDate) <= twentyFourHoursFromNow
      );
    }

    // Filter by has proposals
    if (filters.hasProposals !== undefined) {
      filtered = filtered.filter(auction => {
        const hasProposals = auction.proposals && auction.proposals.length > 0;
        return filters.hasProposals ? hasProposals : !hasProposals;
      });
    }

    // Filter by price range (for cash offers)
    if (filters.priceRange) {
      filtered = filtered.filter(auction => {
        if (!auction.settings.allowCashProposals) return true;

        const { min, max } = filters.priceRange!;
        const minCash = auction.settings.minimumCashOffer || 0;

        if (min !== undefined && minCash < min) return false;
        if (max !== undefined && minCash > max) return false;

        return true;
      });
    }

    return filtered;
  }
);

// Sorted auction selectors
export const selectAuctionsSortedByEndDate = createSelector(
  [selectFilteredAuctions],
  auctions => {
    return [...auctions].sort(
      (a, b) =>
        new Date(a.settings.endDate).getTime() -
        new Date(b.settings.endDate).getTime()
    );
  }
);

export const selectAuctionsSortedByProposalCount = createSelector(
  [selectFilteredAuctions],
  auctions => {
    return [...auctions].sort(
      (a, b) => (b.proposals?.length || 0) - (a.proposals?.length || 0)
    );
  }
);

export const selectAuctionsSortedByCreatedDate = createSelector(
  [selectFilteredAuctions],
  auctions => {
    return [...auctions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
);

// Proposal filtering selectors
export const selectProposalsForAuctionFiltered = createSelector(
  [
    (state: RootState, auctionId: string) =>
      state.auctions.proposals[auctionId] || [],
    (
      state: RootState,
      auctionId: string,
      filters?: {
        type?: ProposalType;
        status?: ProposalStatus;
        sortBy?: 'date' | 'amount';
      }
    ) => filters,
  ],
  (proposals, filters) => {
    if (!filters) return proposals;

    let filtered = proposals;

    // Filter by proposal type
    if (filters.type) {
      filtered = filtered.filter(
        proposal => proposal.proposalType === filters.type
      );
    }

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(
        proposal => proposal.status === filters.status
      );
    }

    // Sort proposals
    if (filters.sortBy === 'date') {
      filtered = [...filtered].sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
    } else if (filters.sortBy === 'amount') {
      filtered = [...filtered].sort((a, b) => {
        const amountA = a.cashOffer?.amount || 0;
        const amountB = b.cashOffer?.amount || 0;
        return amountB - amountA;
      });
    }

    return filtered;
  }
);

// Proposal comparison selectors
export const selectProposalComparison = createSelector(
  [
    (state: RootState, auctionId: string) =>
      state.auctions.proposals[auctionId] || [],
  ],
  (proposals): ProposalComparison => {
    const bookingProposals = proposals.filter(
      p => p.proposalType === 'booking'
    );
    const cashProposals = proposals.filter(p => p.proposalType === 'cash');

    const highestCashOffer = cashProposals.reduce((highest, proposal) => {
      if (!proposal.cashOffer) return highest;
      if (!highest || proposal.cashOffer.amount > highest.amount) {
        return proposal.cashOffer;
      }
      return highest;
    }, null as any);

    // Recommendation logic
    let recommendedProposal: string | undefined;
    if (highestCashOffer) {
      const highestCashProposal = cashProposals.find(
        p => p.cashOffer?.amount === highestCashOffer.amount
      );
      recommendedProposal = highestCashProposal?.id;
    } else if (bookingProposals.length > 0) {
      // Sort booking proposals by submission date (first come, first served)
      const sortedBookingProposals = [...bookingProposals].sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );
      recommendedProposal = sortedBookingProposals[0].id;
    }

    return {
      bookingProposals,
      cashProposals,
      highestCashOffer,
      recommendedProposal,
    };
  }
);

// Cash proposal analysis selectors
export const selectCashProposalAnalysis = createSelector(
  [
    (state: RootState, auctionId: string) =>
      state.auctions.proposals[auctionId] || [],
  ],
  proposals => {
    const cashProposals = proposals.filter(
      p => p.proposalType === 'cash' && p.cashOffer
    );

    if (cashProposals.length === 0) {
      return {
        count: 0,
        averageAmount: 0,
        highestAmount: 0,
        lowestAmount: 0,
        totalValue: 0,
      };
    }

    const amounts = cashProposals.map(p => p.cashOffer!.amount);
    const totalValue = amounts.reduce((sum, amount) => sum + amount, 0);
    const averageAmount = totalValue / amounts.length;
    const highestAmount = Math.max(...amounts);
    const lowestAmount = Math.min(...amounts);

    return {
      count: cashProposals.length,
      averageAmount,
      highestAmount,
      lowestAmount,
      totalValue,
    };
  }
);

// Booking proposal analysis selectors
export const selectBookingProposalAnalysis = createSelector(
  [
    (state: RootState, auctionId: string) =>
      state.auctions.proposals[auctionId] || [],
  ],
  proposals => {
    const bookingProposals = proposals.filter(
      p => p.proposalType === 'booking'
    );

    return {
      count: bookingProposals.length,
      proposals: bookingProposals,
      // Could add more analysis like location distribution, date preferences, etc.
    };
  }
);

// User-specific selectors
export const selectUserAuctionsByStatus = createSelector(
  [selectUserAuctions, (state: RootState, status: AuctionStatus) => status],
  (userAuctions, status) => {
    return userAuctions.filter(auction => auction.status === status);
  }
);

export const selectUserProposalsByStatus = createSelector(
  [selectUserProposals, (state: RootState, status: ProposalStatus) => status],
  (userProposals, status) => {
    return userProposals.filter(proposal => proposal.status === status);
  }
);

export const selectUserProposalsByType = createSelector(
  [selectUserProposals, (state: RootState, type: ProposalType) => type],
  (userProposals, type) => {
    return userProposals.filter(proposal => proposal.proposalType === type);
  }
);

// Time-based selectors
export const selectEndingSoonAuctions = createSelector(
  [selectAuctions],
  auctions => {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(
      now.getTime() + 24 * 60 * 60 * 1000
    );

    return auctions
      .filter(
        auction =>
          auction.status === 'active' &&
          new Date(auction.settings.endDate) <= twentyFourHoursFromNow
      )
      .sort(
        (a, b) =>
          new Date(a.settings.endDate).getTime() -
          new Date(b.settings.endDate).getTime()
      );
  }
);

export const selectExpiredAuctions = createSelector(
  [selectAuctions],
  auctions => {
    const now = new Date();

    return auctions.filter(
      auction =>
        auction.status === 'active' && new Date(auction.settings.endDate) < now
    );
  }
);

// Action required selectors
export const selectAuctionsRequiringAction = createSelector(
  [selectUserAuctions],
  userAuctions => {
    return userAuctions.filter(
      auction =>
        auction.status === 'ended' &&
        !auction.winningProposalId &&
        auction.proposals &&
        auction.proposals.length > 0
    );
  }
);

export const selectProposalsAwaitingResponse = createSelector(
  [selectUserProposals],
  userProposals => {
    return userProposals.filter(proposal => proposal.status === 'pending');
  }
);

// Statistics selectors
export const selectAuctionStatistics = createSelector(
  [selectAuctions, selectProposals],
  (auctions, proposalsMap) => {
    const activeAuctions = auctions.filter(a => a.status === 'active');
    const endedAuctions = auctions.filter(a => a.status === 'ended');
    const successfulAuctions = endedAuctions.filter(a => a.winningProposalId);

    const totalProposals = Object.values(proposalsMap).reduce(
      (total, proposals) => total + proposals.length,
      0
    );

    const averageProposalsPerAuction =
      auctions.length > 0 ? totalProposals / auctions.length : 0;

    const successRate =
      endedAuctions.length > 0
        ? (successfulAuctions.length / endedAuctions.length) * 100
        : 0;

    return {
      totalAuctions: auctions.length,
      activeAuctions: activeAuctions.length,
      endedAuctions: endedAuctions.length,
      successfulAuctions: successfulAuctions.length,
      totalProposals,
      averageProposalsPerAuction,
      successRate,
    };
  }
);

// Performance selectors
export const selectAuctionPerformanceMetrics = createSelector(
  [selectAuctions, selectProposals],
  (auctions, proposalsMap) => {
    const endedAuctions = auctions.filter(a => a.status === 'ended');

    if (endedAuctions.length === 0) {
      return {
        averageDuration: 0,
        averageProposalsPerAuction: 0,
        conversionRate: 0,
        averageTimeToFirstProposal: 0,
      };
    }

    const durations = endedAuctions.map(auction => {
      const start = new Date(auction.createdAt).getTime();
      const end = auction.endedAt
        ? new Date(auction.endedAt).getTime()
        : Date.now();
      return end - start;
    });

    const averageDuration =
      durations.reduce((sum, duration) => sum + duration, 0) / durations.length;

    const proposalCounts = endedAuctions.map(
      auction => proposalsMap[auction.id]?.length || 0
    );

    const averageProposalsPerAuction =
      proposalCounts.reduce((sum, count) => sum + count, 0) /
      proposalCounts.length;

    const auctionsWithProposals = endedAuctions.filter(
      auction => proposalsMap[auction.id] && proposalsMap[auction.id].length > 0
    );

    const conversionRate =
      (auctionsWithProposals.length / endedAuctions.length) * 100;

    // Calculate average time to first proposal
    const timesToFirstProposal = endedAuctions
      .map(auction => {
        const proposals = proposalsMap[auction.id];
        if (!proposals || proposals.length === 0) return null;

        const firstProposal = proposals.reduce((earliest, proposal) =>
          new Date(proposal.submittedAt) < new Date(earliest.submittedAt)
            ? proposal
            : earliest
        );

        const auctionStart = new Date(auction.createdAt).getTime();
        const firstProposalTime = new Date(firstProposal.submittedAt).getTime();

        return firstProposalTime - auctionStart;
      })
      .filter(time => time !== null) as number[];

    const averageTimeToFirstProposal =
      timesToFirstProposal.length > 0
        ? timesToFirstProposal.reduce((sum, time) => sum + time, 0) /
          timesToFirstProposal.length
        : 0;

    return {
      averageDuration: averageDuration / (1000 * 60 * 60), // Convert to hours
      averageProposalsPerAuction,
      conversionRate,
      averageTimeToFirstProposal: averageTimeToFirstProposal / (1000 * 60), // Convert to minutes
    };
  }
);

// Search and discovery selectors
export const selectAuctionSearchResults = createSelector(
  [
    selectAuctions,
    (state: RootState, searchQuery: string) => searchQuery.toLowerCase(),
    (state: RootState, searchQuery: string, filters?: any) => filters,
  ],
  (auctions, searchQuery, filters) => {
    let results = auctions;

    // Text search
    if (searchQuery.trim()) {
      results = results.filter(auction => {
        // Search in auction properties that might be available
        // This would depend on the actual auction data structure
        return (
          auction.id.toLowerCase().includes(searchQuery) ||
          auction.swapId.toLowerCase().includes(searchQuery)
        );
      });
    }

    // Apply additional filters if provided
    if (filters) {
      // Apply the same filtering logic as selectFilteredAuctions
      if (filters.status && filters.status.length > 0) {
        results = results.filter(auction =>
          filters.status.includes(auction.status)
        );
      }

      if (filters.priceRange) {
        const { min, max } = filters.priceRange;
        results = results.filter(auction => {
          if (!auction.settings.allowCashProposals) return true;

          const minCash = auction.settings.minimumCashOffer || 0;
          if (min !== undefined && minCash < min) return false;
          if (max !== undefined && minCash > max) return false;

          return true;
        });
      }
    }

    return results;
  }
);

// Real-time update selectors
export const selectAuctionsNeedingTimeUpdate = createSelector(
  [selectAuctions],
  auctions => {
    return auctions.filter(auction => auction.status === 'active');
  }
);

export const selectAuctionTimeRemaining = createSelector(
  [
    (state: RootState, auctionId: string) => {
      const auction = state.auctions.auctions.find(a => a.id === auctionId);
      return auction;
    },
  ],
  auction => {
    if (!auction || auction.status !== 'active') return 0;

    const endTime = new Date(auction.settings.endDate).getTime();
    const now = Date.now();
    return Math.max(0, endTime - now);
  }
);

// Validation selectors
export const selectCanCreateProposal = createSelector(
  [
    (state: RootState, auctionId: string) => {
      const auction = state.auctions.auctions.find(a => a.id === auctionId);
      return auction;
    },
    (state: RootState, auctionId: string, userId: string) => userId,
  ],
  (auction, userId) => {
    if (!auction) return { canCreate: false, reason: 'Auction not found' };
    if (auction.status !== 'active')
      return { canCreate: false, reason: 'Auction is not active' };
    if (auction.ownerId === userId)
      return { canCreate: false, reason: 'Cannot propose on own auction' };

    const now = new Date();
    const endDate = new Date(auction.settings.endDate);
    if (endDate <= now)
      return { canCreate: false, reason: 'Auction has ended' };

    return { canCreate: true, reason: null };
  }
);

export const selectCanSelectWinner = createSelector(
  [
    (state: RootState, auctionId: string) => {
      const auction = state.auctions.auctions.find(a => a.id === auctionId);
      return auction;
    },
    (state: RootState, auctionId: string) =>
      state.auctions.proposals[auctionId] || [],
    (state: RootState, auctionId: string, userId: string) => userId,
  ],
  (auction, proposals, userId) => {
    if (!auction) return { canSelect: false, reason: 'Auction not found' };
    if (auction.ownerId !== userId)
      return { canSelect: false, reason: 'Not auction owner' };
    if (auction.status !== 'ended')
      return { canSelect: false, reason: 'Auction not ended' };
    if (auction.winningProposalId)
      return { canSelect: false, reason: 'Winner already selected' };
    if (proposals.length === 0)
      return { canSelect: false, reason: 'No proposals to select from' };

    return { canSelect: true, reason: null };
  }
);
