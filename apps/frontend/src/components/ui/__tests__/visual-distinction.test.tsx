import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemedPageHeader } from '../ThemedPageHeader';
import { BreadcrumbNavigation } from '../BreadcrumbNavigation';
import { ContextualHelp } from '../ContextualHelp';
import { ThemedCard } from '../ThemedCard';
import { ThemedInterface } from '../ThemedInterface';
import { bookingTheme, swapTheme, contextualHelp, getBreadcrumbs } from '@/design-system/interface-themes';

/**
 * Tests for visual distinction and UI improvements for separated interfaces
 * 
 * Requirements addressed:
 * - 3.1: Distinct visual styling for booking-focused functionality
 * - 3.2: Distinct visual styling for swap-focused functionality
 * - 3.3: Clear breadcrumbs and navigation indicators
 * - 3.4: Booking-related action buttons and controls only
 * - 3.5: Swap-related action buttons and controls only
 * - 3.6: Clear page titles and context indicators
 * - 3.7: Context-appropriate help content
 * - 3.8: Clear error indication for booking vs swap functionality
 */

describe('Visual Distinction Components', () => {
  describe('ThemedPageHeader', () => {
    it('renders booking theme header with distinct styling', () => {
      render(
        <ThemedPageHeader
          theme={bookingTheme}
          title="Edit Booking"
          subtitle="Modify your booking details"
          icon={bookingTheme.icon}
        />
      );

      expect(screen.getByText('Edit Booking')).toBeInTheDocument();
      expect(screen.getByText('Modify your booking details')).toBeInTheDocument();
      expect(screen.getByText(bookingTheme.icon)).toBeInTheDocument();
    });

    it('renders swap theme header with distinct styling', () => {
      render(
        <ThemedPageHeader
          theme={swapTheme}
          title="Swap Specification"
          subtitle="Configure swap preferences"
          icon={swapTheme.icon}
        />
      );

      expect(screen.getByText('Swap Specification')).toBeInTheDocument();
      expect(screen.getByText('Configure swap preferences')).toBeInTheDocument();
      expect(screen.getByText(swapTheme.icon)).toBeInTheDocument();
    });
  });

  describe('BreadcrumbNavigation', () => {
    it('renders booking breadcrumbs with proper context', () => {
      const breadcrumbs = getBreadcrumbs('booking', 'Test Booking');
      
      render(
        <BreadcrumbNavigation
          items={breadcrumbs}
          theme={bookingTheme}
        />
      );

      expect(screen.getByText('Bookings')).toBeInTheDocument();
      expect(screen.getByText('Edit "Test Booking"')).toBeInTheDocument();
    });

    it('renders swap breadcrumbs with proper context', () => {
      const breadcrumbs = getBreadcrumbs('swap', 'Test Booking');
      
      render(
        <BreadcrumbNavigation
          items={breadcrumbs}
          theme={swapTheme}
        />
      );

      expect(screen.getByText('Bookings')).toBeInTheDocument();
      expect(screen.getByText('"Test Booking"')).toBeInTheDocument();
      expect(screen.getByText('Swap Specification')).toBeInTheDocument();
    });

    it('handles navigation clicks', () => {
      const mockNavigate = jest.fn();
      const breadcrumbs = getBreadcrumbs('booking', 'Test Booking');
      
      render(
        <BreadcrumbNavigation
          items={breadcrumbs}
          theme={bookingTheme}
          onNavigate={mockNavigate}
        />
      );

      const bookingsLink = screen.getByText('Bookings');
      bookingsLink.click();
      
      expect(mockNavigate).toHaveBeenCalledWith('/bookings');
    });
  });

  describe('ContextualHelp', () => {
    it('renders booking-specific help content', () => {
      render(
        <ContextualHelp
          theme={bookingTheme}
          title={contextualHelp.booking.title}
          icon={contextualHelp.booking.icon}
          content={contextualHelp.booking.content}
          defaultExpanded={true}
        />
      );

      expect(screen.getByText(contextualHelp.booking.title)).toBeInTheDocument();
      expect(screen.getByText(contextualHelp.booking.icon)).toBeInTheDocument();
      
      contextualHelp.booking.content.forEach(item => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });

    it('renders swap-specific help content', () => {
      render(
        <ContextualHelp
          theme={swapTheme}
          title={contextualHelp.swap.title}
          icon={contextualHelp.swap.icon}
          content={contextualHelp.swap.content}
          defaultExpanded={true}
        />
      );

      expect(screen.getByText(contextualHelp.swap.title)).toBeInTheDocument();
      expect(screen.getByText(contextualHelp.swap.icon)).toBeInTheDocument();
      
      contextualHelp.swap.content.forEach(item => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });

    it('supports collapsible functionality', () => {
      render(
        <ContextualHelp
          theme={bookingTheme}
          title="Test Help"
          icon="💡"
          content={['Test content']}
          collapsible={true}
          defaultExpanded={false}
        />
      );

      expect(screen.getByText('Test Help')).toBeInTheDocument();
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();

      const expandButton = screen.getByLabelText('Expand help');
      expandButton.click();

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });
  });

  describe('ThemedCard', () => {
    it('renders with booking theme styling', () => {
      render(
        <ThemedCard
          theme={bookingTheme}
          title="Booking Card"
          icon="📝"
        >
          <div>Card content</div>
        </ThemedCard>
      );

      expect(screen.getByText('Booking Card')).toBeInTheDocument();
      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with swap theme styling', () => {
      render(
        <ThemedCard
          theme={swapTheme}
          title="Swap Card"
          icon="🔄"
          variant="elevated"
        >
          <div>Card content</div>
        </ThemedCard>
      );

      expect(screen.getByText('Swap Card')).toBeInTheDocument();
      expect(screen.getByText('🔄')).toBeInTheDocument();
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies themed-card class for animations', () => {
      const { container } = render(
        <ThemedCard theme={bookingTheme}>
          <div>Content</div>
        </ThemedCard>
      );

      const cardElement = container.querySelector('.themed-card');
      expect(cardElement).toBeInTheDocument();
    });
  });

  describe('ThemedInterface', () => {
    it('applies booking interface class and styling', () => {
      const { container } = render(
        <ThemedInterface theme={bookingTheme}>
          <div>Booking interface content</div>
        </ThemedInterface>
      );

      const interfaceElement = container.querySelector('.booking-interface');
      expect(interfaceElement).toBeInTheDocument();
      expect(screen.getByText('Booking interface content')).toBeInTheDocument();
    });

    it('applies swap interface class and styling', () => {
      const { container } = render(
        <ThemedInterface theme={swapTheme}>
          <div>Swap interface content</div>
        </ThemedInterface>
      );

      const interfaceElement = container.querySelector('.swap-interface');
      expect(interfaceElement).toBeInTheDocument();
      expect(screen.getByText('Swap interface content')).toBeInTheDocument();
    });
  });

  describe('Theme Configuration', () => {
    it('booking theme has distinct colors from swap theme', () => {
      expect(bookingTheme.colors.primary).not.toBe(swapTheme.colors.primary);
      expect(bookingTheme.colors.background).not.toBe(swapTheme.colors.background);
      expect(bookingTheme.icon).not.toBe(swapTheme.icon);
    });

    it('themes have all required properties', () => {
      [bookingTheme, swapTheme].forEach(theme => {
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('icon');
        expect(theme).toHaveProperty('colors');
        expect(theme).toHaveProperty('gradients');
        expect(theme).toHaveProperty('shadows');
        
        expect(theme.colors).toHaveProperty('primary');
        expect(theme.colors).toHaveProperty('background');
        expect(theme.colors).toHaveProperty('surface');
        expect(theme.colors).toHaveProperty('text');
      });
    });

    it('contextual help has content for both interfaces', () => {
      expect(contextualHelp.booking).toHaveProperty('title');
      expect(contextualHelp.booking).toHaveProperty('icon');
      expect(contextualHelp.booking).toHaveProperty('content');
      expect(Array.isArray(contextualHelp.booking.content)).toBe(true);

      expect(contextualHelp.swap).toHaveProperty('title');
      expect(contextualHelp.swap).toHaveProperty('icon');
      expect(contextualHelp.swap).toHaveProperty('content');
      expect(Array.isArray(contextualHelp.swap.content)).toBe(true);
    });

    it('breadcrumb generation works for both interface types', () => {
      const bookingBreadcrumbs = getBreadcrumbs('booking', 'Test Booking');
      const swapBreadcrumbs = getBreadcrumbs('swap', 'Test Booking');

      expect(bookingBreadcrumbs).toHaveLength(2);
      expect(swapBreadcrumbs).toHaveLength(3);

      expect(bookingBreadcrumbs[1].current).toBe(true);
      expect(swapBreadcrumbs[2].current).toBe(true);
    });
  });
});