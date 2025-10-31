import React from 'react';
import { EnhancedSwapCard } from './SwapCard.enhanced';
import { EnhancedSwapCardData } from '@booking-swap/shared';

/**
 * Debug component to test targeting display with real API data structure
 */
export const SwapCardDebugTest: React.FC = () => {
  // Use the exact API response structure from our test
  const realApiData: EnhancedSwapCardData = {
    userSwap: {
      id: "e01afbcd-44c3-44a8-b3b2-8783d36d1c92",
      bookingDetails: {
        id: "d3db6fe8-a23c-4d66-bc62-1b2a110e197d",
        title: "Waterfront Luxury Hotel",
        location: {
          city: "Cape Town",
          country: "South Africa"
        },
        dateRange: {
          checkIn: new Date("2025-10-20T00:00:00.000Z"),
          checkOut: new Date("2025-10-25T00:00:00.000Z")
        },
        originalPrice: 1000,
        swapValue: 1000
      },
      status: "pending",
      createdAt: new Date("2025-10-12T18:49:11.291Z"),
      expiresAt: new Date("2025-10-20T00:00:00.000Z")
    },
    proposalsFromOthers: [],
    proposalCount: 0,
    targeting: {
      incomingTargets: [],
      incomingTargetCount: 0,
      outgoingTarget: {
        targetId: "808ad4bb-feaa-4b0c-9347-ca28a254d790",
        targetSwapId: "f63db0b1-8151-4cde-a623-4398c984958f",
        targetSwap: {
          id: "f63db0b1-8151-4cde-a623-4398c984958f",
          bookingDetails: {
            id: "f63db0b1-8151-4cde-a623-4398c984958f",
            title: "Luxurious Mecure Hotel",
            location: {
              city: "Unknown",
              country: "Unknown"
            },
            dateRange: {
              checkIn: new Date("2025-10-13T18:42:42.754Z"),
              checkOut: new Date("2025-10-13T18:42:42.754Z")
            },
            originalPrice: 0,
            swapValue: 0
          },
          ownerId: "",
          ownerName: "Unknown User"
        },
        proposalId: "",
        status: "active",
        createdAt: new Date("2025-10-13T18:42:42.754Z"),
        updatedAt: new Date("2025-10-13T18:42:42.754Z"),
        targetSwapInfo: {
          acceptanceStrategy: {
            type: "first_match" as any
          }
        }
      },
      canReceiveTargets: true,
      canTarget: true,
      targetingRestrictions: []
    }
  };

  // Debug logging
  console.log('🐛 SwapCard Debug Test');
  console.log('targeting exists:', !!realApiData.targeting);
  console.log('incomingTargets.length:', realApiData.targeting?.incomingTargets?.length || 0);
  console.log('outgoingTarget exists:', !!realApiData.targeting?.outgoingTarget);
  console.log('hasTargeting should be:', (realApiData.targeting?.incomingTargets?.length || 0) > 0 || !!realApiData.targeting?.outgoingTarget);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🐛 SwapCard Targeting Debug Test</h1>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Expected Behavior:</h3>
        <ul>
          <li>✅ Should show 📤 outgoing target indicator</li>
          <li>❌ Should NOT show 📥 incoming target indicator (count is 0)</li>
          <li>✅ Should show "details" link</li>
        </ul>

        <h3>Debug Info:</h3>
        <ul>
          <li>targeting exists: {String(!!realApiData.targeting)}</li>
          <li>incomingTargets.length: {realApiData.targeting?.incomingTargets?.length || 0}</li>
          <li>outgoingTarget exists: {String(!!realApiData.targeting?.outgoingTarget)}</li>
          <li>hasTargeting calculation: {String((realApiData.targeting?.incomingTargets?.length || 0) > 0 || !!realApiData.targeting?.outgoingTarget)}</li>
        </ul>
      </div>

      <div style={{ border: '2px solid red', padding: '10px', borderRadius: '8px' }}>
        <h3>SwapCard Component (look for 📤 indicator):</h3>
        <EnhancedSwapCard
          swapData={realApiData}
          onCancelTargeting={async (swapId, targetId) => {
            console.log('Cancel targeting:', swapId, targetId);
            alert(`Cancel targeting: ${targetId}`);
          }}
        />
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
        <h3>🎯 If you don't see the 📤 indicator above:</h3>
        <ol>
          <li>Check the browser console for errors</li>
          <li>Inspect the DOM to see if the element exists but is hidden</li>
          <li>Check if there's a CSS issue hiding the indicators</li>
          <li>Verify the component is receiving the correct props</li>
        </ol>
      </div>
    </div>
  );
};

export default SwapCardDebugTest;