import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyBookingsFilterBar, MyBookingsStatus } from '../MyBookingsFilterBar';
import { BookingCounts } from '@/types/myBookings';

// Mock the responsive hooks
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
  useTouch: jest.fn(),
}));

import { useResponsive, useTouch } from '@/hooks/useResponsive';

const mockUseResponsive = useResponsive as jest.MockedFunction<typeof useResponsive>;
const mockUseTouch = useTouch as jest.MockedFunction<typeof useTouch>;

describe('MyBookingsFilterBar Mobile Experience', () => {
  const mockBookingCounts: BookingCounts = {
    all: 10,
    active: 5,
    with_swaps: 2,
    completed: 2,
    expired: 1,
  };

  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        breakpoint: 'xs',
        width: 375,
        height: 667,
      });
      mockUseTouch.mockReturnValue(true);
    });

    it('should render with mobile-optimized layout', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      // Check mobile-optimized title
      expect(screen.getByText('Filter Bookings')).toBeInTheDocument();
      
      // Check that all filter tabs are present
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('With Swaps')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('should have touch-friendly tab sizes', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const allTab = screen.getByRole('button', { name: /all bookings/i });
      const styles = window.getComputedStyle(allTab);
      
      // Should have minimum touch target size (44px)
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
    });

    it('should handle touch interactions properly', async () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const activeTab = screen.getByRole('button', { name: /active bookings/i });
      
      // Simulate touch start
      fireEvent.touchStart(activeTab);
      
      // Simulate touch end and click
      fireEvent.touchEnd(activeTab);
      fireEvent.click(activeTab);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('active');
      });
    });

    it('should not show tooltips on mobile', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const allTab = screen.getByRole('button', { name: /all bookings/i });
      
      // Mobile tabs should not have title attribute (tooltips)
      expect(allTab).not.toHaveAttribute('title');
    });

    it('should have proper font sizes for mobile', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const allTab = screen.getByRole('button', { name: /all bookings/i });
      const styles = window.getComputedStyle(allTab);
      
      // Should use 16px font size to prevent zoom on iOS
      expect(styles.fontSize).toBe('16px');
    });

    it('should handle horizontal scrolling on mobile', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      // Find the tab container (parent of the tabs)
      const allTab = screen.getByRole('button', { name: /all bookings/i });
      const tabContainer = allTab.parentElement;
      
      expect(tabContainer).toHaveStyle({
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      });
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        breakpoint: 'lg',
        width: 1024,
        height: 768,
      });
      mockUseTouch.mockReturnValue(false);
    });

    it('should render with desktop layout', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      // Check desktop title
      expect(screen.getByText('Filter My Bookings')).toBeInTheDocument();
    });

    it('should show tooltips on desktop', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const allTab = screen.getByRole('button', { name: /all bookings/i });
      
      // Desktop tabs should have title attribute (tooltips)
      expect(allTab).toHaveAttribute('title', 'All your bookings');
    });

    it('should handle hover effects on desktop', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const activeTab = screen.getByRole('button', { name: /active bookings/i });
      
      // Simulate hover
      fireEvent.mouseEnter(activeTab);
      fireEvent.mouseLeave(activeTab);
      
      // Should not throw errors and handle hover properly
      expect(activeTab).toBeInTheDocument();
    });
  });

  describe('Tablet Layout', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        breakpoint: 'md',
        width: 768,
        height: 1024,
      });
      mockUseTouch.mockReturnValue(true);
    });

    it('should render with tablet-optimized layout', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      // Should use desktop title on tablet
      expect(screen.getByText('Filter My Bookings')).toBeInTheDocument();
      
      // But should still handle touch interactions
      const activeTab = screen.getByRole('button', { name: /active bookings/i });
      fireEvent.touchStart(activeTab);
      fireEvent.touchEnd(activeTab);
      fireEvent.click(activeTab);

      expect(mockOnChange).toHaveBeenCalledWith('active');
    });
  });

  describe('Accessibility on Mobile', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        breakpoint: 'xs',
        width: 375,
        height: 667,
      });
      mockUseTouch.mockReturnValue(true);
    });

    it('should maintain keyboard navigation on mobile', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const activeTab = screen.getByRole('button', { name: /active bookings/i });
      
      // Should handle keyboard navigation
      fireEvent.keyDown(activeTab, { key: 'Enter' });
      expect(mockOnChange).toHaveBeenCalledWith('active');

      fireEvent.keyDown(activeTab, { key: ' ' });
      expect(mockOnChange).toHaveBeenCalledTimes(2);
    });

    it('should have proper ARIA labels on mobile', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="active"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const activeTab = screen.getByRole('button', { name: /active bookings: 5 items/i });
      
      expect(activeTab).toHaveAttribute('aria-pressed', 'true');
      expect(activeTab).toHaveAttribute('role', 'button');
      expect(activeTab).toHaveAttribute('tabIndex', '0');
    });

    it('should prevent text selection on touch devices', () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const allTab = screen.getByRole('button', { name: /all bookings/i });
      const styles = window.getComputedStyle(allTab);
      
      expect(styles.userSelect).toBe('none');
      expect(styles.WebkitUserSelect).toBe('none');
    });
  });

  describe('Performance on Mobile', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        breakpoint: 'xs',
        width: 375,
        height: 667,
      });
      mockUseTouch.mockReturnValue(true);
    });

    it('should handle rapid touch interactions without issues', async () => {
      render(
        <MyBookingsFilterBar
          currentFilter="all"
          bookingCounts={mockBookingCounts}
          onChange={mockOnChange}
        />
      );

      const tabs = [
        screen.getByRole('button', { name: /all bookings/i }),
        screen.getByRole('button', { name: /active bookings/i }),
        screen.getByRole('button', { name: /with swaps/i }),
      ];

      // Simulate rapid tapping
      for (let i = 0; i < 3; i++) {
        fireEvent.touchStart(tabs[i]);
        fireEvent.touchEnd(tabs[i]);
        fireEvent.click(tabs[i]);
      }

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledTimes(3);
      });
    });
  });
});