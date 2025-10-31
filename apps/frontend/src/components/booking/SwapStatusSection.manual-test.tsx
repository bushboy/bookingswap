import React from 'react';
import { SwapStatusSection } from './SwapStatusSection';
import { SwapInfo } from '@booking-swap/shared';

// Manual test component to verify SwapStatusSection works correctly
export const SwapStatusSectionManualTest: React.FC = () => {
  const testCases: { name: string; swapInfo: SwapInfo }[] = [
    {
      name: 'First Match - Available',
      swapInfo: {
        swapId: 'test-1',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'first-match',
        hasActiveProposals: false,
        activeProposalCount: 0,
        swapConditions: [],
      },
    },
    {
      name: 'First Match - Active',
      swapInfo: {
        swapId: 'test-2',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'first-match',
        hasActiveProposals: true,
        activeProposalCount: 3,
        swapConditions: [],
      },
    },
    {
      name: 'Auction - Active (2 hours left)',
      swapInfo: {
        swapId: 'test-3',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'auction',
        hasActiveProposals: true,
        activeProposalCount: 5,
        timeRemaining: 2 * 60 * 60 * 1000, // 2 hours
        auctionEndDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
        swapConditions: [],
      },
    },
    {
      name: 'Auction - Urgent (30 minutes left)',
      swapInfo: {
        swapId: 'test-4',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'auction',
        hasActiveProposals: true,
        activeProposalCount: 2,
        timeRemaining: 30 * 60 * 1000, // 30 minutes
        auctionEndDate: new Date(Date.now() + 30 * 60 * 1000),
        swapConditions: [],
      },
    },
    {
      name: 'Auction - Very Urgent (30 seconds left)',
      swapInfo: {
        swapId: 'test-5',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'auction',
        hasActiveProposals: true,
        activeProposalCount: 1,
        timeRemaining: 30 * 1000, // 30 seconds
        auctionEndDate: new Date(Date.now() + 30 * 1000),
        swapConditions: [],
      },
    },
    {
      name: 'Auction - Expired',
      swapInfo: {
        swapId: 'test-6',
        paymentTypes: ['booking', 'cash'],
        acceptanceStrategy: 'auction',
        hasActiveProposals: false,
        activeProposalCount: 0,
        timeRemaining: 0,
        auctionEndDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        swapConditions: [],
      },
    },
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SwapStatusSection Manual Test</h1>
      <p>This component demonstrates different states of the SwapStatusSection component.</p>
      
      {testCases.map((testCase, index) => (
        <div key={index} style={{ 
          marginBottom: '40px', 
          padding: '20px', 
          border: '1px solid #ccc', 
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#333' }}>
            {testCase.name}
          </h3>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '16px', 
            borderRadius: '6px',
            border: '1px solid #e0e0e0'
          }}>
            <SwapStatusSection swapInfo={testCase.swapInfo} />
          </div>
          <details style={{ marginTop: '12px' }}>
            <summary style={{ cursor: 'pointer', color: '#666' }}>View SwapInfo Data</summary>
            <pre style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              marginTop: '8px'
            }}>
              {JSON.stringify(testCase.swapInfo, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
};

export default SwapStatusSectionManualTest;