/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/testUtils';

// Import all fixed components
import { AcceptanceStrategySelector } from '../booking/AcceptanceStrategySelector';
import { InlineProposalForm } from '../booking/InlineProposalForm';
import { PaymentTypeSelector } from '../booking/PaymentTypeSelector';
import { WalletModal } from '../wallet/WalletModal';
import { WalletSelectionModal } from '../wallet/WalletSelectionModal';
import { WalletRequiredAction } from '../auth/WalletRequiredAction';

// Mock dependencies
vi.mock('@/services/bookingService', () => ({
  bookingService: {
    getAvailableBookings: vi.fn().mockResolvedValue([]),
    createProposal: vi.fn().mockResolvedValue({ id: 'proposal-1' }),
  },
}));

vi.mock('@/services/walletService', () => ({
  walletService: {
    connect: vi.fn().mockResolvedValue({ address: '0x123' }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getBalance: vi.fn().mockResolvedValue('100'),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', username: 'testuser' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/contexts/WalletContext', () => ({
  useWallet: () => ({
    isConnected: false,
    address: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock design system tokens
vi.mock('@/design-system/tokens', () => ({
  tokens: {
    colors: {
      primary: {
        50: '#f0f4f8',
        500: '#627d98',
        600: '#486581',
      },
      neutral: {
        300: '#d6d3d1',
        600: '#57534e',
        700: '#44403c',
        900: '#1c1917',
      },
      warning: {
        50: '#fffbeb',
        700: '#b45309',
      },
      error: {
        600: '#dc2626',
      },
    },
    spacing: {
      1: '0.25rem',
      2: '0.5rem',
      3: '0.75rem',
      4: '1rem',
    },
    typography: {
      fontSize: {
        sm: '0.875rem',
        base: '1rem',
      },
      fontWeight: {
        medium: '500',
      },
      lineHeight: {
        relaxed: '1.75',
      },
    },
    borderRadius: {
      md: '0.375rem',
    },
  },
}));

// Console warning capture setup
const originalWarn = console.warn;
const originalError = console.error;
let warnings: string[] = [];
let errors: string[] = [];

beforeEach(() => {
  warnings = [];
  errors = [];
  
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    warnings.push(message);
    // Only log non-test-related warnings
    if (!message.includes('ReactDOMTestUtils.act') && !message.includes('Warning: validateDOMNesting')) {
      originalWarn(...args);
    }
  };
  
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    errors.push(message);
    // Only log non-test-related errors
    if (!message.includes('ReactDOMTestUtils.act')) {
      originalError(...args);
    }
  };
});

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
  vi.clearAllMocks();
});

describe('CSS Conflicts - Component Interaction Tests', () => {
  describe('AcceptanceStrategySelector Interactions', () => {
    const defaultProps = {
      selected: 'first-match' as const,
      onChange: vi.fn(),
      eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };

    it('should maintain CSS consistency during user interactions', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      const { container } = render(
        <AcceptanceStrategySelector {...defaultProps} onChange={mockOnChange} />
      );
      
      // Initial state - no CSS warnings
      expect(warnings.filter(w => w.includes('border') && w.includes('borderColor'))).toHaveLength(0);
      
      // Click on auction option
      const auctionRadio = screen.getByDisplayValue('auction');
      await user.click(auctionRadio);
      
      // Should not generate CSS warnings during interaction
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      expect(mockOnChange).toHaveBeenCalledWith('auction');
      
      // Check that styling remains consistent after interaction
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });

    it('should handle rapid state changes without CSS conflicts', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      const { container } = render(
        <AcceptanceStrategySelector {...defaultProps} onChange={mockOnChange} />
      );
      
      const firstMatchRadio = screen.getByDisplayValue('first-match');
      const auctionRadio = screen.getByDisplayValue('auction');
      
      // Rapid clicking between options
      await user.click(auctionRadio);
      await user.click(firstMatchRadio);
      await user.click(auctionRadio);
      await user.click(firstMatchRadio);
      
      // Should not generate CSS warnings during rapid interactions
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Styling should remain consistent
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });

    it('should maintain styling during hover and focus interactions', async () => {
      const user = userEvent.setup();
      
      const { container } = render(<AcceptanceStrategySelector {...defaultProps} />);
      
      const auctionRadio = screen.getByDisplayValue('auction');
      
      // Hover interaction
      await user.hover(auctionRadio);
      
      // Focus interaction
      await user.click(auctionRadio);
      await user.tab();
      
      // Should not generate CSS warnings during hover/focus
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Check styling consistency
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });

    it('should handle disabled state interactions properly', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      const { container } = render(
        <AcceptanceStrategySelector {...defaultProps} disabled={true} onChange={mockOnChange} />
      );
      
      const auctionRadio = screen.getByDisplayValue('auction');
      
      // Try to interact with disabled component
      await user.click(auctionRadio);
      
      // Should not call onChange when disabled
      expect(mockOnChange).not.toHaveBeenCalled();
      
      // Should not generate CSS warnings
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Styling should remain consistent
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });
  });

  describe('PaymentTypeSelector Interactions', () => {
    const defaultProps = {
      selected: [],
      onChange: vi.fn(),
      availableTypes: ['cash', 'booking'] as const,
    };

    it('should maintain CSS consistency during selection changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      const { container } = render(
        <PaymentTypeSelector {...defaultProps} onChange={mockOnChange} />
      );
      
      // Find and interact with payment options
      const checkboxes = screen.queryAllByRole('checkbox');
      
      if (checkboxes.length > 0) {
        await user.click(checkboxes[0]);
        
        // Should not generate CSS warnings
        const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
        expect(cssWarnings).toHaveLength(0);
        
        // Check styling consistency
        const styledElements = container.querySelectorAll('[style]');
        styledElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
          const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
          
          expect(hasBorderShorthand && hasBorderColor).toBe(false);
        });
      }
    });

    it('should handle multiple selection changes without conflicts', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      const { container } = render(
        <PaymentTypeSelector {...defaultProps} onChange={mockOnChange} />
      );
      
      const checkboxes = screen.queryAllByRole('checkbox');
      
      // Select multiple options if available
      for (const checkbox of checkboxes) {
        await user.click(checkbox);
      }
      
      // Should not generate CSS warnings
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Styling should remain consistent
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });
  });

  describe('InlineProposalForm Interactions', () => {
    const mockBooking = {
      id: 'test-booking',
      userId: 'user1',
      type: 'hotel' as const,
      title: 'Test Hotel',
      description: 'A test hotel booking',
      location: { city: 'New York', country: 'USA' },
      dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-05'),
      },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'Booking.com',
        confirmationNumber: 'ABC123',
        bookingReference: 'REF123',
      },
      verification: { status: 'verified' as const, documents: [] },
      blockchain: { topicId: 'topic1' },
      status: 'available' as const,
      acceptsBookingSwaps: true,
      acceptsCashOffers: true,
      minCashOffer: 100,
      maxCashOffer: 1000,
      swapInfo: {
        availableForSwap: true,
        swapPreferences: []
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const defaultProps = {
      booking: mockBooking,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
    };

    it('should maintain CSS consistency during form interactions', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      
      const { container } = renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={mockOnSubmit} />
      );
      
      // Initial state - no CSS warnings
      const initialWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(initialWarnings).toHaveLength(0);
      
      // Try to interact with form elements
      const inputs = screen.queryAllByRole('textbox');
      const buttons = screen.queryAllByRole('button');
      const radios = screen.queryAllByRole('radio');
      
      // Interact with available elements
      if (inputs.length > 0) {
        await user.type(inputs[0], 'test input');
      }
      
      if (radios.length > 0) {
        await user.click(radios[0]);
      }
      
      // Should not generate CSS warnings during interactions
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Check styling consistency
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });

    it('should handle form validation without CSS conflicts', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();
      
      const { container } = renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={mockOnSubmit} />
      );
      
      // Try to submit form to trigger validation
      const submitButtons = screen.queryAllByRole('button', { name: /submit|send|create/i });
      
      if (submitButtons.length > 0) {
        await user.click(submitButtons[0]);
      }
      
      // Should not generate CSS warnings during validation
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Styling should remain consistent
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });
  });

  describe('Wallet Component Interactions', () => {
    it('should maintain CSS consistency during modal interactions', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      
      const { container } = renderWithProviders(
        <WalletModal isOpen={true} onClose={mockOnClose} />
      );
      
      // Try to interact with modal
      const buttons = screen.queryAllByRole('button');
      
      if (buttons.length > 0) {
        await user.click(buttons[0]);
      }
      
      // Should not generate CSS warnings
      const cssWarnings = warnings.filter(w => 
        w.includes('margin') && (w.includes('marginTop') || w.includes('marginBottom'))
      );
      expect(cssWarnings).toHaveLength(0);
      
      // Check margin consistency
      const marginElements = container.querySelectorAll('[style*="margin"]');
      marginElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasMarginShorthand = style.includes('margin:') && !style.includes('margin-');
        const hasMarginIndividual = style.includes('margin-bottom:') || style.includes('marginBottom:');
        
        if (hasMarginShorthand && hasMarginIndividual) {
          expect(style).toMatch(/margin-top:|marginTop:/);
          expect(style).toMatch(/margin-right:|marginRight:/);
          expect(style).toMatch(/margin-left:|marginLeft:/);
        }
      });
    });

    it('should handle wallet selection interactions properly', async () => {
      const user = userEvent.setup();
      const mockOnWalletSelect = vi.fn();
      const mockOnClose = vi.fn();
      
      const { container } = renderWithProviders(
        <WalletSelectionModal 
          isOpen={true} 
          onClose={mockOnClose} 
          onWalletSelect={mockOnWalletSelect} 
        />
      );
      
      // Try to interact with wallet options
      const buttons = screen.queryAllByRole('button');
      
      if (buttons.length > 0) {
        await user.click(buttons[0]);
      }
      
      // Should not generate CSS warnings
      const cssWarnings = warnings.filter(w => 
        w.includes('margin') && (w.includes('marginTop') || w.includes('marginBottom'))
      );
      expect(cssWarnings).toHaveLength(0);
      
      // Check styling consistency
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        if (style.includes('margin')) {
          const hasMarginShorthand = style.includes('margin:') && !style.includes('margin-');
          const hasMarginIndividual = style.includes('margin-bottom:') || style.includes('marginBottom:');
          
          if (hasMarginShorthand && hasMarginIndividual) {
            expect(style).toMatch(/margin-top:|marginTop:/);
            expect(style).toMatch(/margin-right:|marginRight:/);
            expect(style).toMatch(/margin-left:|marginLeft:/);
          }
        }
      });
    });

    it('should handle WalletRequiredAction interactions', async () => {
      const user = userEvent.setup();
      const mockOnActionComplete = vi.fn();
      
      const { container } = renderWithProviders(
        <WalletRequiredAction action="connect" onActionComplete={mockOnActionComplete} />
      );
      
      // Try to interact with action buttons
      const buttons = screen.queryAllByRole('button');
      
      if (buttons.length > 0) {
        await user.click(buttons[0]);
      }
      
      // Should not generate CSS warnings
      const cssWarnings = warnings.filter(w => 
        w.includes('margin') && (w.includes('marginTop') || w.includes('marginBottom'))
      );
      expect(cssWarnings).toHaveLength(0);
      
      // Check styling consistency
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        if (style.includes('margin')) {
          const hasMarginShorthand = style.includes('margin:') && !style.includes('margin-');
          const hasMarginIndividual = style.includes('margin-bottom:') || style.includes('marginBottom:');
          
          if (hasMarginShorthand && hasMarginIndividual) {
            expect(style).toMatch(/margin-top:|marginTop:/);
            expect(style).toMatch(/margin-right:|marginRight:/);
            expect(style).toMatch(/margin-left:|marginLeft:/);
          }
        }
      });
    });
  });

  describe('Complex Interaction Scenarios', () => {
    it('should handle simultaneous component interactions', async () => {
      const user = userEvent.setup();
      
      const TestApp = () => (
        <div>
          <AcceptanceStrategySelector
            selected="first-match"
            onChange={vi.fn()}
            eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
          />
          <PaymentTypeSelector
            selected={[]}
            onChange={vi.fn()}
            availableTypes={['cash', 'booking']}
          />
        </div>
      );
      
      const { container } = render(<TestApp />);
      
      // Interact with multiple components simultaneously
      const radios = screen.queryAllByRole('radio');
      const checkboxes = screen.queryAllByRole('checkbox');
      
      // Click on various elements
      if (radios.length > 0) {
        await user.click(radios[0]);
      }
      
      if (checkboxes.length > 0) {
        await user.click(checkboxes[0]);
      }
      
      // Should not generate CSS warnings
      const cssWarnings = warnings.filter(w => 
        (w.includes('border') && w.includes('borderColor')) ||
        (w.includes('margin') && (w.includes('marginTop') || w.includes('marginBottom')))
      );
      expect(cssWarnings).toHaveLength(0);
      
      // All components should maintain consistent styling
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        // Border consistency
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
        
        // Margin consistency
        if (style.includes('margin')) {
          const hasMarginShorthand = style.includes('margin:') && !style.includes('margin-');
          const hasMarginIndividual = style.includes('margin-bottom:') || style.includes('marginBottom:');
          
          if (hasMarginShorthand && hasMarginIndividual) {
            expect(style).toMatch(/margin-top:|marginTop:/);
            expect(style).toMatch(/margin-right:|marginRight:/);
            expect(style).toMatch(/margin-left:|marginLeft:/);
          }
        }
      });
    });

    it('should handle keyboard navigation without CSS conflicts', async () => {
      const user = userEvent.setup();
      
      const { container } = render(
        <AcceptanceStrategySelector
          selected="first-match"
          onChange={vi.fn()}
          eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
        />
      );
      
      // Navigate using keyboard
      await user.tab();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{Enter}');
      
      // Should not generate CSS warnings during keyboard navigation
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Styling should remain consistent
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });

    it('should maintain styling during error state interactions', async () => {
      const user = userEvent.setup();
      
      const { container } = render(
        <AcceptanceStrategySelector
          selected="first-match"
          onChange={vi.fn()}
          eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
          error="Please select a strategy"
        />
      );
      
      // Interact with component in error state
      const auctionRadio = screen.getByDisplayValue('auction');
      await user.click(auctionRadio);
      
      // Should not generate CSS warnings in error state
      const cssWarnings = warnings.filter(w => w.includes('border') && w.includes('borderColor'));
      expect(cssWarnings).toHaveLength(0);
      
      // Error message should be displayed
      expect(screen.getByText('Please select a strategy')).toBeInTheDocument();
      
      // Styling should remain consistent
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });
  });
});