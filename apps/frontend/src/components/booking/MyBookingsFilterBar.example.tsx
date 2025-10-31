import React, { useState } from 'react';
import { MyBookingsFilterBar, MyBookingsStatus } from './MyBookingsFilterBar';

/**
 * Example usage of MyBookingsFilterBar component
 * This demonstrates how to integrate the simplified filter bar
 * into a personal booking management interface
 */
export const MyBookingsFilterBarExample: React.FC = () => {
  const [currentFilter, setCurrentFilter] = useState<MyBookingsStatus>('all');

  // Example booking counts that would come from your booking data
  const bookingCounts = {
    all: 12,
    active: 8,
    with_swaps: 3,
    completed: 3,
    expired: 1,
  };

  const handleFilterChange = (status: MyBookingsStatus) => {
    setCurrentFilter(status);
    console.log('Filter changed to:', status);
    // Here you would typically update your booking list based on the filter
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>My Bookings Filter Bar Example</h2>
      
      <MyBookingsFilterBar
        currentFilter={currentFilter}
        bookingCounts={bookingCounts}
        onChange={handleFilterChange}
      />
      
      <div style={{ 
        marginTop: '20px', 
        padding: '16px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px' 
      }}>
        <h3>Current Filter: {currentFilter}</h3>
        <p>
          This would show {bookingCounts[currentFilter]} booking
          {bookingCounts[currentFilter] !== 1 ? 's' : ''} for the "{currentFilter}" filter.
        </p>
        
        <h4>Filter Descriptions:</h4>
        <ul>
          <li><strong>All:</strong> Shows all your bookings regardless of status</li>
          <li><strong>Active:</strong> Current and upcoming bookings that are still valid</li>
          <li><strong>With Swaps:</strong> Bookings that have active swap proposals or are available for swapping</li>
          <li><strong>Completed:</strong> Past bookings and completed swaps</li>
          <li><strong>Expired:</strong> Expired or cancelled bookings</li>
        </ul>
      </div>
    </div>
  );
};

export default MyBookingsFilterBarExample;