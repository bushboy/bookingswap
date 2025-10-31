import React from 'react';
import { ProposalActivitySection } from './ProposalActivitySection';
import { SwapInfo, BookingUserRole } from '@booking-swap/shared';

// Manual test component to verify ProposalActivitySection works correctly
export const ProposalActivitySectionManualTest: React.FC = () => {
  // Test data for different scenarios
  const ownerWithNoProposals: SwapInfo = {
    swapId: 'test-swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: false,
    activeProposalCount: 0,
    swapConditions: []
  };

  const ownerWithProposals: SwapInfo = {
    swapId: 'test-swap-2',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: true,
    activeProposalCount: 3,
    swapConditions: []
  };

  const ownerWithHighUrgency: SwapInfo = {
    swapId: 'test-swap-3',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'auction',
    hasActiveProposals: true,
    activeProposalCount: 5,
    swapConditions: [],
    timeRemaining: 3600000 // 1 hour
  };

  const proposerPending: SwapInfo = {
    swapId: 'test-swap-4',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: true,
    activeProposalCount: 2,
    userProposalStatus: 'pending',
    swapConditions: []
  };

  const proposerAccepted: SwapInfo = {
    swapId: 'test-swap-5',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: true,
    activeProposalCount: 1,
    userProposalStatus: 'accepted',
    swapConditions: []
  };

  const browserWithProposals: SwapInfo = {
    swapId: 'test-swap-6',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    hasActiveProposals: true,
    activeProposalCount: 2,
    swapConditions: []
  };

  const testCases = [
    { title: 'Owner - No Proposals', swapInfo: ownerWithNoProposals, userRole: 'owner' as BookingUserRole },
    { title: 'Owner - With Proposals', swapInfo: ownerWithProposals, userRole: 'owner' as BookingUserRole },
    { title: 'Owner - High Urgency (5+ proposals)', swapInfo: ownerWithHighUrgency, userRole: 'owner' as BookingUserRole },
    { title: 'Owner - Compact Mode', swapInfo: ownerWithProposals, userRole: 'owner' as BookingUserRole, compact: true },
    { title: 'Proposer - Pending Status', swapInfo: proposerPending, userRole: 'proposer' as BookingUserRole },
    { title: 'Proposer - Accepted Status', swapInfo: proposerAccepted, userRole: 'proposer' as BookingUserRole },
    { title: 'Browser - With Proposals', swapInfo: browserWithProposals, userRole: 'browser' as BookingUserRole },
  ];

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>ProposalActivitySection Manual Test</h1>
      <p>This component tests different scenarios for the ProposalActivitySection component.</p>
      
      {testCases.map((testCase, index) => (
        <div key={index} style={{ 
          marginBottom: '30px', 
          padding: '20px', 
          border: '1px solid #ccc', 
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>{testCase.title}</h3>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '16px', 
            borderRadius: '6px',
            border: '1px solid #e0e0e0'
          }}>
            <ProposalActivitySection 
              swapInfo={testCase.swapInfo}
              userRole={testCase.userRole}
              compact={testCase.compact}
            />
          </div>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', color: '#666' }}>View Test Data</summary>
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {JSON.stringify({ 
                swapInfo: testCase.swapInfo, 
                userRole: testCase.userRole,
                compact: testCase.compact 
              }, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
};

export default ProposalActivitySectionManualTest;