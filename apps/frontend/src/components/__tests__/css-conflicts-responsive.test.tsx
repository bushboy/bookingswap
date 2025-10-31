/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
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

// Mock design system tokens with responsive values
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
      6: '1.5rem',
      8: '2rem',
    },
    typography: {
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
      },
      fontWeight: {
        medium: '500',
      },
      lineHeight: {
        relaxed: '1.75',
      },
    },
    borderRadius: {
      sm: '0.125rem',
      md: '0.375rem',
      lg: '0.5rem',
    },
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
  },
}));

// Viewport configurations for testing
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  wide: { width: 1920, height: 1080 },
};

// Helper to mock viewport
const mockViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });

  // Mock matchMedia for responsive queries
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

describe('CSS Conflicts - Responsive Behavior Tests', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // Store original values
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalMatchMedia = window.matchMedia;

    // Mock console to reduce noise
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    window.matchMedia = originalMatchMedia;
  });

  describe('AcceptanceStrategySelector Responsive Behavior', () => {
    const defaultProps = {
      selected: 'first-match' as const,
      onChange: vi.fn(),
      eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };

    Object.entries(VIEWPORTS).forEach(([viewportName, { width, height }]) => {
      it(`should maintain CSS consistency on ${viewportName} viewport (${width}x${height})`, () => {
        mockViewport(width, height);
        
        const { container } = render(<AcceptanceStrategySelector {...defaultProps} />);
        
        // Check that border styles remain consistent across viewports
        const borderElements = container.querySelectorAll('[style*="border"]');
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          // Should use consistent border approach regardless of viewport
          if (style.includes('border:')) {
            expect(style).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
            expect(style).not.toMatch(/border-color:|borderColor:/);
          }
        });
        
        // Component should render without errors
        expect(container).toBeInTheDocument();
      });
    });

    it('should handle viewport changes without generating CSS conflicts', () => {
      const { container, rerender } = render(<AcceptanceStrategySelector {...defaultProps} />);
      
      // Test viewport changes
      Object.values(VIEWPORTS).forEach(({ width, height }) => {
        mockViewport(width, height);
        rerender(<AcceptanceStrategySelector {...defaultProps} />);
        
        // Check that no CSS conflicts are introduced during viewport changes
        const styledElements = container.querySelectorAll('[style]');
        styledElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
          const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
          
          expect(hasBorderShorthand && hasBorderColor).toBe(false);
        });
      });
    });

    it('should maintain selection state styling across viewport changes', () => {
      const states = ['first-match', 'auction'] as const;
      
      states.forEach(selectedState => {
        const { container, rerender } = render(
          <AcceptanceStrategySelector {...defaultProps} selected={selectedState} />
        );
        
        Object.values(VIEWPORTS).forEach(({ width, height }) => {
          mockViewport(width, height);
          rerender(<AcceptanceStrategySelector {...defaultProps} selected={selectedState} />);
          
          // Check that selection styling remains consistent
          const borderElements = container.querySelectorAll('[style*="border"]');
          borderElements.forEach(element => {
            const style = element.getAttribute('style') || '';
            
            if (style.includes('border:')) {
              expect(style).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
            }
          });
        });
      });
    });
  });

  describe('InlineProposalForm Responsive Behavior', () => {
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

    Object.entries(VIEWPORTS).forEach(([viewportName, { width, height }]) => {
      it(`should maintain form layout integrity on ${viewportName} viewport`, () => {
        mockViewport(width, height);
        
        const { container } = renderWithProviders(<InlineProposalForm {...defaultProps} />);
        
        // Check that form elements maintain proper styling
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
            const hasMarginIndividual = style.includes('margin-top:') || style.includes('marginTop:');
            
            if (hasMarginShorthand && hasMarginIndividual) {
              expect(style).toMatch(/margin-right:|marginRight:/);
              expect(style).toMatch(/margin-bottom:|marginBottom:/);
              expect(style).toMatch(/margin-left:|marginLeft:/);
            }
          }
        });
      });
    });

    it('should adapt form layout without breaking CSS consistency', () => {
      const { container, rerender } = renderWithProviders(<InlineProposalForm {...defaultProps} />);
      
      // Test rapid viewport changes
      const viewportSequence = [VIEWPORTS.mobile, VIEWPORTS.desktop, VIEWPORTS.tablet, VIEWPORTS.wide];
      
      viewportSequence.forEach(({ width, height }) => {
        mockViewport(width, height);
        rerender(<InlineProposalForm {...defaultProps} />);
        
        // Ensure no CSS conflicts are introduced
        const borderElements = container.querySelectorAll('[style*="border"]');
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
          const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
          
          expect(hasBorderShorthand && hasBorderColor).toBe(false);
        });
      });
    });
  });

  describe('PaymentTypeSelector Responsive Behavior', () => {
    const defaultProps = {
      selected: [],
      onChange: vi.fn(),
      availableTypes: ['cash', 'booking'] as const,
    };

    Object.entries(VIEWPORTS).forEach(([viewportName, { width, height }]) => {
      it(`should maintain payment option styling on ${viewportName} viewport`, () => {
        mockViewport(width, height);
        
        const { container } = render(<PaymentTypeSelector {...defaultProps} />);
        
        // Check that payment options maintain consistent styling
        const borderElements = container.querySelectorAll('[style*="border"]');
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          if (style.includes('border:')) {
            expect(style).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
            expect(style).not.toMatch(/border-color:|borderColor:/);
          }
        });
      });
    });

    it('should handle selection state changes across viewports', () => {
      const selectionStates = [
        [],
        ['cash'],
        ['booking'],
        ['cash', 'booking'],
      ];

      selectionStates.forEach(selected => {
        const { container, rerender } = render(
          <PaymentTypeSelector {...defaultProps} selected={selected} />
        );
        
        Object.values(VIEWPORTS).forEach(({ width, height }) => {
          mockViewport(width, height);
          rerender(<PaymentTypeSelector {...defaultProps} selected={selected} />);
          
          // Check styling consistency
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
  });

  describe('Wallet Components Responsive Behavior', () => {
    Object.entries(VIEWPORTS).forEach(([viewportName, { width, height }]) => {
      it(`should maintain modal styling consistency on ${viewportName} viewport`, () => {
        mockViewport(width, height);
        
        const walletComponents = [
          <WalletModal key="wallet" isOpen={true} onClose={vi.fn()} />,
          <WalletSelectionModal key="selection" isOpen={true} onClose={vi.fn()} onWalletSelect={vi.fn()} />,
        ];

        walletComponents.forEach(component => {
          const { container } = renderWithProviders(component);
          
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
      });
    });

    it('should maintain WalletRequiredAction responsive behavior', () => {
      const actions = ['connect', 'switch-network', 'sign'] as const;
      
      actions.forEach(action => {
        const { container, rerender } = renderWithProviders(
          <WalletRequiredAction action={action} onActionComplete={vi.fn()} />
        );
        
        Object.values(VIEWPORTS).forEach(({ width, height }) => {
          mockViewport(width, height);
          rerender(<WalletRequiredAction action={action} onActionComplete={vi.fn()} />);
          
          // Check styling consistency across viewports
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
    });
  });

  describe('Cross-Component Responsive Integration', () => {
    it('should maintain styling consistency when multiple components are rendered together', () => {
      const TestLayout = () => (
        <div>
          <AcceptanceStrategySelector
            selected="first-match"
            onChange={vi.fn()}
            eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
          />
          <PaymentTypeSelector
            selected={['cash']}
            onChange={vi.fn()}
            availableTypes={['cash', 'booking']}
          />
        </div>
      );

      Object.values(VIEWPORTS).forEach(({ width, height }) => {
        mockViewport(width, height);
        
        const { container } = render(<TestLayout />);
        
        // Check that all components maintain consistent styling
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
            const hasMarginIndividual = style.includes('margin-top:') || style.includes('marginTop:');
            
            if (hasMarginShorthand && hasMarginIndividual) {
              expect(style).toMatch(/margin-right:|marginRight:/);
              expect(style).toMatch(/margin-bottom:|marginBottom:/);
              expect(style).toMatch(/margin-left:|marginLeft:/);
            }
          }
        });
      });
    });

    it('should handle complex responsive scenarios without CSS conflicts', () => {
      const ComplexResponsiveComponent = ({ viewport }: { viewport: string }) => (
        <div style={{ 
          display: 'flex',
          flexDirection: viewport === 'mobile' ? 'column' : 'row',
          gap: '1rem'
        }}>
          <AcceptanceStrategySelector
            selected="auction"
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

      Object.entries(VIEWPORTS).forEach(([viewportName, { width, height }]) => {
        mockViewport(width, height);
        
        const { container } = render(<ComplexResponsiveComponent viewport={viewportName} />);
        
        // Ensure no CSS conflicts in complex layouts
        const allStyledElements = container.querySelectorAll('[style]');
        allStyledElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          // No border conflicts
          const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
          const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
          expect(hasBorderShorthand && hasBorderColor).toBe(false);
          
          // No margin conflicts
          if (style.includes('margin')) {
            const hasMarginShorthand = style.includes('margin:') && !style.includes('margin-');
            const hasMarginIndividual = style.includes('margin-top:') || style.includes('marginTop:');
            
            if (hasMarginShorthand && hasMarginIndividual) {
              expect(style).toMatch(/margin-right:|marginRight:/);
              expect(style).toMatch(/margin-bottom:|marginBottom:/);
              expect(style).toMatch(/margin-left:|marginLeft:/);
            }
          }
        });
      });
    });
  });

  describe('Performance Under Responsive Changes', () => {
    it('should maintain performance during rapid viewport changes', () => {
      const TestComponent = () => (
        <AcceptanceStrategySelector
          selected="first-match"
          onChange={vi.fn()}
          eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
        />
      );

      const { container, rerender } = render(<TestComponent />);
      
      // Simulate rapid viewport changes
      const rapidChanges = Array.from({ length: 20 }, (_, i) => 
        VIEWPORTS[Object.keys(VIEWPORTS)[i % Object.keys(VIEWPORTS).length] as keyof typeof VIEWPORTS]
      );
      
      rapidChanges.forEach(({ width, height }) => {
        mockViewport(width, height);
        rerender(<TestComponent />);
      });
      
      // Should still maintain CSS consistency after rapid changes
      const finalStyledElements = container.querySelectorAll('[style]');
      finalStyledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });
  });
});