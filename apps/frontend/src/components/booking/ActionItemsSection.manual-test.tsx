import React, { useState } from 'react';
import { ActionItemsSection } from './ActionItemsSection';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

/**
 * Manual test component for ActionItemsSection
 * This component allows visual testing of different scenarios and user interactions
 */
export const ActionItemsSectionManualTest: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<string>('owner-with-proposals');
  const [selectedRole, setSelectedRole] = useState<BookingUserRole>('owner');

  // Test scenarios
  const scenarios: Record<string, SwapInfo> = {
    'owner-with-proposals': {
      swapId: 'swap-123',
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'first-match',
      minCashAmount: 100,
      maxCashAmount: 500,
      hasActiveProposals: true,
      activeProposalCount: 3,
      swapConditions: ['Must be similar location', 'Same dates preferred'],
    },
    'owner-no-proposals': {
      swapId: 'swap-124',
      paymentTypes: ['booking'],
      acceptanceStrategy: 'auction',
      auctionEndDate: new Date(Date.now() + 7200000), // 2 hours
      timeRemaining: 7200000,
      hasActiveProposals: false,
      activeProposalCount: 0,
      swapConditions: [],
    },
    'browser-active-auction': {
      swapId: 'swap-125',
      paymentTypes: ['cash'],
      acceptanceStrategy: 'auction',
      minCashAmount: 200,
      maxCashAmount: 800,
      auctionEndDate: new Date(Date.now() + 1800000), // 30 minutes
      timeRemaining: 1800000,
      hasActiveProposals: true,
      activeProposalCount: 5,
      swapConditions: ['Cash only', 'Quick response required'],
    },
    'browser-expired-auction': {
      swapId: 'swap-126',
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'auction',
      auctionEndDate: new Date(Date.now() - 3600000), // 1 hour ago
      timeRemaining: 0,
      hasActiveProposals: false,
      activeProposalCount: 0,
      swapConditions: [],
    },
    'proposer-pending': {
      swapId: 'swap-127',
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'first-match',
      hasActiveProposals: true,
      activeProposalCount: 2,
      userProposalStatus: 'pending',
      swapConditions: ['Flexible dates'],
    },
    'proposer-accepted': {
      swapId: 'swap-128',
      paymentTypes: ['cash'],
      acceptanceStrategy: 'auction',
      minCashAmount: 300,
      hasActiveProposals: false,
      activeProposalCount: 0,
      userProposalStatus: 'accepted',
      swapConditions: [],
    },
    'proposer-rejected-retry': {
      swapId: 'swap-129',
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'auction',
      auctionEndDate: new Date(Date.now() + 3600000), // 1 hour
      timeRemaining: 3600000,
      hasActiveProposals: true,
      activeProposalCount: 4,
      userProposalStatus: 'rejected',
      swapConditions: ['Multiple options available'],
    },
    'proposer-rejected-expired': {
      swapId: 'swap-130',
      paymentTypes: ['booking'],
      acceptanceStrategy: 'auction',
      auctionEndDate: new Date(Date.now() - 1800000), // 30 minutes ago
      timeRemaining: 0,
      hasActiveProposals: false,
      activeProposalCount: 0,
      userProposalStatus: 'rejected',
      swapConditions: [],
    },
  };

  const scenarioDescriptions: Record<string, string> = {
    'owner-with-proposals': 'Owner with 3 active proposals (first-match)',
    'owner-no-proposals': 'Owner with no proposals (auction mode)',
    'browser-active-auction': 'Browser viewing active auction (30 min left)',
    'browser-expired-auction': 'Browser viewing expired auction',
    'proposer-pending': 'Proposer with pending proposal',
    'proposer-accepted': 'Proposer with accepted proposal',
    'proposer-rejected-retry': 'Proposer with rejected proposal (can retry)',
    'proposer-rejected-expired': 'Proposer with rejected proposal (expired)',
  };

  const currentSwapInfo = scenarios[selectedScenario];

  const containerStyle: React.CSSProperties = {
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '800px',
    margin: '0 auto',
  };

  const controlsStyle: React.CSSProperties = {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    marginRight: '15px',
    marginBottom: '10px',
  };

  const testAreaStyle: React.CSSProperties = {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  };

  const infoStyle: React.CSSProperties = {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#f0f9ff',
    borderRadius: '6px',
    border: '1px solid #bae6fd',
    fontSize: '14px',
  };

  return (
    <div style={containerStyle}>
      <h1>ActionItemsSection Manual Test</h1>
      
      <div style={controlsStyle}>
        <h3>Test Controls</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            User Role:
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as BookingUserRole)}
            style={selectStyle}
          >
            <option value="owner">Owner</option>
            <option value="browser">Browser</option>
            <option value="proposer">Proposer</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Test Scenario:
          </label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            style={selectStyle}
          >
            {Object.entries(scenarioDescriptions).map(([key, description]) => (
              <option key={key} value={key}>
                {description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={infoStyle}>
        <strong>Current Scenario:</strong> {scenarioDescriptions[selectedScenario]}
        <br />
        <strong>User Role:</strong> {selectedRole}
        <br />
        <strong>Swap Strategy:</strong> {currentSwapInfo.acceptanceStrategy}
        <br />
        <strong>Active Proposals:</strong> {currentSwapInfo.activeProposalCount}
        {currentSwapInfo.userProposalStatus && (
          <>
            <br />
            <strong>User Proposal Status:</strong> {currentSwapInfo.userProposalStatus}
          </>
        )}
        {currentSwapInfo.timeRemaining !== undefined && (
          <>
            <br />
            <strong>Time Remaining:</strong> {
              currentSwapInfo.timeRemaining > 0 
                ? `${Math.floor(currentSwapInfo.timeRemaining / 60000)} minutes`
                : 'Expired'
            }
          </>
        )}
      </div>

      <div style={testAreaStyle}>
        <h3>ActionItemsSection Component</h3>
        <ActionItemsSection 
          swapInfo={currentSwapInfo}
          userRole={selectedRole}
        />
        
        {/* Show when no actions are available */}
        {!document.querySelector('[data-testid="action-items-section"]') && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#6b7280',
            fontStyle: 'italic',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px dashed #d1d5db',
          }}>
            No actions available for this scenario
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#6b7280' }}>
        <h4>Testing Instructions:</h4>
        <ul>
          <li>Try different combinations of user roles and scenarios</li>
          <li>Click buttons to see console output (check browser dev tools)</li>
          <li>Hover over buttons to test hover states</li>
          <li>Verify button styling matches the design (primary, secondary, danger)</li>
          <li>Check that appropriate actions are shown for each role and scenario</li>
          <li>Test edge cases like expired auctions and rejected proposals</li>
        </ul>
      </div>
    </div>
  );
};

export default ActionItemsSectionManualTest;