import React from 'react';
import { SwapTermsSection } from './SwapTermsSection';
import { SwapInfo } from '@booking-swap/shared';

// Manual test scenarios for SwapTermsSection component
export const SwapTermsSectionManualTest: React.FC = () => {
  // Test scenario 1: Comprehensive auction swap
  const auctionSwapInfo: SwapInfo = {
    swapId: 'auction-swap-123',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'auction',
    auctionEndDate: new Date('2024-12-25T15:30:00Z'),
    minCashAmount: 2000,
    maxCashAmount: 8000,
    hasActiveProposals: true,
    activeProposalCount: 5,
    swapConditions: [
      'Must be available for same dates (Dec 20-27, 2024)',
      'Similar accommodation quality required (4+ stars)',
      'Non-refundable booking - no cancellation allowed',
      'Must provide proof of booking within 24 hours',
    ],
    timeRemaining: 86400000, // 24 hours
  };

  // Test scenario 2: Simple first-match booking-only swap
  const simpleSwapInfo: SwapInfo = {
    swapId: 'simple-swap-456',
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: false,
    activeProposalCount: 0,
    swapConditions: [],
  };

  // Test scenario 3: Cash-only swap with minimum amount
  const cashOnlySwapInfo: SwapInfo = {
    swapId: 'cash-swap-789',
    paymentTypes: ['cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 1500,
    hasActiveProposals: true,
    activeProposalCount: 2,
    swapConditions: [
      'Payment via PayPal or Venmo only',
      'Must confirm within 24 hours of acceptance',
    ],
  };

  // Test scenario 4: High-value auction with extensive conditions
  const highValueSwapInfo: SwapInfo = {
    swapId: 'high-value-swap-101',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'auction',
    auctionEndDate: new Date('2024-12-31T23:59:59Z'),
    minCashAmount: 5000,
    maxCashAmount: 15000,
    hasActiveProposals: true,
    activeProposalCount: 12,
    swapConditions: [
      'Luxury accommodation only (5-star hotels or premium vacation rentals)',
      'Must be in major metropolitan area or popular tourist destination',
      'Booking must be fully transferable with no restrictions',
      'Proof of accommodation quality required (photos, reviews, etc.)',
      'Travel insurance recommended but not required',
      'Communication must be maintained throughout the swap process',
    ],
    timeRemaining: 172800000, // 48 hours
  };

  // Test scenario 5: Edge case - no payment types
  const edgeCaseSwapInfo: SwapInfo = {
    swapId: 'edge-case-swap-202',
    paymentTypes: [],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: false,
    activeProposalCount: 0,
    swapConditions: [],
  };

  const containerStyle = {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const scenarioStyle = {
    marginBottom: '40px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
  };

  const titleStyle = {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#1a202c',
  };

  const descriptionStyle = {
    fontSize: '14px',
    color: '#4a5568',
    marginBottom: '15px',
    fontStyle: 'italic',
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>
        SwapTermsSection Manual Test Scenarios
      </h1>

      <div style={scenarioStyle}>
        <h2 style={titleStyle}>Scenario 1: Comprehensive Auction Swap</h2>
        <p style={descriptionStyle}>
          Full-featured auction swap with both payment types, cash range, multiple conditions, and auction end date.
        </p>
        <SwapTermsSection swapInfo={auctionSwapInfo} showFullDetails={true} />
      </div>

      <div style={scenarioStyle}>
        <h2 style={titleStyle}>Scenario 2: Simple Booking-Only Swap</h2>
        <p style={descriptionStyle}>
          Minimal first-match swap accepting only booking exchanges with no additional conditions.
        </p>
        <SwapTermsSection swapInfo={simpleSwapInfo} showFullDetails={true} />
      </div>

      <div style={scenarioStyle}>
        <h2 style={titleStyle}>Scenario 3: Cash-Only Swap with Conditions</h2>
        <p style={descriptionStyle}>
          Cash-only swap with minimum amount and specific payment conditions.
        </p>
        <SwapTermsSection swapInfo={cashOnlySwapInfo} showFullDetails={true} />
      </div>

      <div style={scenarioStyle}>
        <h2 style={titleStyle}>Scenario 4: High-Value Auction (Full Details)</h2>
        <p style={descriptionStyle}>
          High-value auction swap with extensive conditions and large cash range.
        </p>
        <SwapTermsSection swapInfo={highValueSwapInfo} showFullDetails={true} />
      </div>

      <div style={scenarioStyle}>
        <h2 style={titleStyle}>Scenario 4b: High-Value Auction (Compact)</h2>
        <p style={descriptionStyle}>
          Same high-value swap but with showFullDetails=false to test compact display.
        </p>
        <SwapTermsSection swapInfo={highValueSwapInfo} showFullDetails={false} />
      </div>

      <div style={scenarioStyle}>
        <h2 style={titleStyle}>Scenario 5: Edge Case - No Payment Types</h2>
        <p style={descriptionStyle}>
          Edge case testing with empty payment types array to ensure graceful handling.
        </p>
        <SwapTermsSection swapInfo={edgeCaseSwapInfo} showFullDetails={true} />
      </div>

      <div style={scenarioStyle}>
        <h2 style={titleStyle}>Visual Design Verification</h2>
        <p style={descriptionStyle}>
          Check the following visual elements:
        </p>
        <ul style={{ fontSize: '14px', color: '#4a5568', lineHeight: '1.6' }}>
          <li>✅ Payment type badges have proper icons and colors</li>
          <li>✅ Cash amounts are formatted with currency symbols and commas</li>
          <li>✅ Auction end dates are properly formatted with time</li>
          <li>✅ Strategy badges show correct icons (🔨 for auction, 🔄 for first-match)</li>
          <li>✅ Conditions list is properly indented and readable</li>
          <li>✅ Section header has clipboard icon and proper styling</li>
          <li>✅ All text is properly sized and colored for readability</li>
          <li>✅ Spacing between elements is consistent and visually appealing</li>
        </ul>
      </div>
    </div>
  );
};

export default SwapTermsSectionManualTest;