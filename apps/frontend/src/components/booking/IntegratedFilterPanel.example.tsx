import React, { useState } from 'react';
import { IntegratedFilterPanel, EnhancedBookingFilters } from './IntegratedFilterPanel';

/**
 * Example usage of the IntegratedFilterPanel component
 * This demonstrates how to use the enhanced filter panel with swap-specific filters
 */
export const IntegratedFilterPanelExample: React.FC = () => {
  const [filters, setFilters] = useState<EnhancedBookingFilters>({});

  const handleFiltersChange = (newFilters: EnhancedBookingFilters) => {
    setFilters(newFilters);
    console.log('Filters changed:', newFilters);
  };

  const handleReset = () => {
    setFilters({});
    console.log('Filters reset');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>Integrated Filter Panel Example</h2>
      <p>
        This example shows the IntegratedFilterPanel component with both traditional booking filters
        and new swap-specific filters integrated into a single interface.
      </p>
      
      <IntegratedFilterPanel
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleReset}
      />

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Current Filters:</h3>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
          {JSON.stringify(filters, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Key Features:</h3>
        <ul>
          <li><strong>Swap Availability Toggle:</strong> Filter for bookings available for swapping</li>
          <li><strong>Cash Acceptance Toggle:</strong> Filter for bookings that accept cash offers</li>
          <li><strong>Auction Mode Toggle:</strong> Filter for bookings with active auctions</li>
          <li><strong>Filter Summary:</strong> Shows active filters with visual indicators</li>
          <li><strong>Reset Functionality:</strong> Clear all filters with one click</li>
          <li><strong>Expandable Sections:</strong> Organize filters into collapsible sections</li>
        </ul>
      </div>
    </div>
  );
};

export default IntegratedFilterPanelExample;