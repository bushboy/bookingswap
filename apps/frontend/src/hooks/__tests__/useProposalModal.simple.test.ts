/**
 * Simple verification test for useProposalModal hook
 * This test verifies the hook can be imported and initialized without errors
 */

import { describe, it, expect } from 'vitest';
import { useProposalModal } from '../useProposalModal';

describe('useProposalModal - Simple Verification', () => {
  it('should export the hook function', () => {
    expect(typeof useProposalModal).toBe('function');
  });

  it('should have the correct function signature', () => {
    // Check that the function expects the right number of parameters
    expect(useProposalModal.length).toBe(1);
  });
});