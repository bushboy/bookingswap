import { configureStore } from '@reduxjs/toolkit';
import { proposalSlice } from '../slices/proposalSlice';
import { eligibleSwapsSlice } from '../slices/eligibleSwapsSlice';
import { compatibilitySlice } from '../slices/compatibilitySlice';
import {
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  EligibleSwap,
  CompatibilityAnalysis,
  ProposalSummary,
} from '@booking-swap/shared';

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      proposals: proposalSlice.reducer,
      eligibleSwaps: eligibleSwapsSlice.reducer,
      compatibility: compatibilitySlice.reducer,
    },
  });
};

describe('Proposal Slices', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('proposalSlice', () => 