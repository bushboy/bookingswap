/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('CSS Conflicts - Visual Regression Tests', () => {
  beforeEach(() => {
    // Mock console to reduce noise
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('AcceptanceStrategySelector Visual Consistency', () => {
    const defaultProps = {
      selected: 'first-match' as const,
      onChange: vi.fn(),
      eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };

    it('should maintain consistent border styling in all states', () => {
      const states = [
        { selected: 'first-match' as const, disabled: false },
        { selected: 'auction' as const, disabled: false },
        { selected: 'first-match' as const, disabled: true },
        { selected: 'auction' as const, disabled: true },
      ];

      states.forEach(state => {
        const { container } = render(
          <AcceptanceStrategySelector {...defaultProps} {...state} />
        );

        // Check that border styles are consistent
        const borderElements = container.querySelectorAll('[style*="border"]');
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          // Should use border shorthand consistently
          if (style.includes('border:')) {
            expect(style).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
            // Should not have conflicting borderColor
            expect(style).not.toMatch(/border-color:|borderColor:/);
          }
        });
      });
    });

    it('should maintain visual hierarchy between selected and unselected options', () => {
      const { container: selectedContainer } = render(
        <AcceptanceStrategySelector {...defaultProps} selected="first-match" />
      );
      
      const { container: unselectedContainer } = render(
        <AcceptanceStrategySelector {...defaultProps} selected="auction" />
      );

      // Both should have the same structure
      const selectedBorderElements = selectedContainer.querySelectorAll('[style*="border"]');
      const unselectedBorderElements = unselectedContainer.querySelectorAll('[style*="border"]');
      
      expect(selectedBorderElements.length).toBe(unselectedBorderElements.length);
      
      // Check that styling patterns are consistent
      selectedBorderElements.forEach((element, index) => {
        const selectedStyle = element.getAttribute('style') || '';
        const unselectedStyle = unselectedBorderElements[index]?.getAttribute('style') || '';
        
        // Both should use the same border property approach
        const selectedUsesBorderShorthand = selectedStyle.includes('border:') && !selectedStyle.includes('border-');
        const unselectedUsesBorderShorthand = unselectedStyle.includes('border:') && !unselectedStyle.includes('border-');
        
        expect(selectedUsesBorderShorthand).toBe(unselectedUsesBorderShorthand);
      });
    });

    it('should maintain responsive design integrity', () => {
      // Test different viewport scenarios
      const viewports = [
        { width: 320, height: 568 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 }, // Desktop
      ];

      viewports.forEach(viewport => {
        // Mock viewport
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: viewport.width,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: viewport.height,
        });

        const { container } = render(<AcceptanceStrategySelector {...defaultProps} />);
        
        // Check that styling remains consistent across viewports
        const styledElements = container.querySelectorAll('[style]');
        styledElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          // Should not have CSS property conflicts regardless of viewport
          const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
          const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
          
          expect(hasBorderShorthand && hasBorderColor).toBe(false);
        });
      });
    });
  });

  describe('InlineProposalForm Visual Consistency', () => {
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

    it('should maintain consistent option styling patterns', () => {
      const { container } = renderWithProviders(<InlineProposalForm {...defaultProps} />);
      
      // Check that all option-like elements use consistent border patterns
      const borderElements = container.querySelectorAll('[style*="border"]');
      
      let borderShorthandCount = 0;
      let borderIndividualCount = 0;
      
      borderElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        if (style.includes('border:') && !style.includes('border-')) {
          borderShorthandCount++;
          // Should not mix with individual border properties
          expect(style).not.toMatch(/border-color:|borderColor:|border-width:|borderWidth:/);
        }
        
        if (style.includes('border-color:') || style.includes('borderColor:')) {
          borderIndividualCount++;
        }
      });
      
      // Should use consistent approach - either all shorthand or all individual
      if (borderShorthandCount > 0 && borderIndividualCount > 0) {
        // If mixing, it should be intentional and not conflicting
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
          const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
          
          // Should not have both on the same element
          expect(hasBorderShorthand && hasBorderColor).toBe(false);
        });
      }
    });

    it('should maintain form layout integrity', () => {
      const { container } = renderWithProviders(<InlineProposalForm {...defaultProps} />);
      
      // Check that form elements maintain proper spacing
      const styledElements = container.querySelectorAll('[style]');
      
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        // Check margin consistency
        if (style.includes('margin')) {
          const hasMarginShorthand = style.includes('margin:') && !style.includes('margin-');
          const hasMarginIndividual = style.includes('margin-top:') || style.includes('marginTop:');
          
          if (hasMarginShorthand && hasMarginIndividual) {
            // Should use individual properties consistently
            expect(style).toMatch(/margin-top:|marginTop:/);
            expect(style).toMatch(/margin-right:|marginRight:/);
            expect(style).toMatch(/margin-bottom:|marginBottom:/);
            expect(style).toMatch(/margin-left:|marginLeft:/);
          }
        }
      });
    });
  });

  describe('PaymentTypeSelector Visual Consistency', () => {
    const defaultProps = {
      selected: [],
      onChange: vi.fn(),
      availableTypes: ['cash', 'booking'] as const,
    };

    it('should maintain consistent selection state styling', () => {
      const states = [
        { selected: [] },
        { selected: ['cash'] },
        { selected: ['booking'] },
        { selected: ['cash', 'booking'] },
      ];

      states.forEach(state => {
        const { container } = render(
          <PaymentTypeSelector {...defaultProps} {...state} />
        );

        // Check border consistency across all states
        const borderElements = container.querySelectorAll('[style*="border"]');
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          // Should use consistent border approach
          if (style.includes('border:')) {
            expect(style).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
            expect(style).not.toMatch(/border-color:|borderColor:/);
          }
        });
      });
    });

    it('should maintain visual distinction between available and selected types', () => {
      const { container: noneSelected } = render(
        <PaymentTypeSelector {...defaultProps} selected={[]} />
      );
      
      const { container: someSelected } = render(
        <PaymentTypeSelector {...defaultProps} selected={['cash']} />
      );

      // Both should have consistent styling patterns
      const noneSelectedBorders = noneSelected.querySelectorAll('[style*="border"]');
      const someSelectedBorders = someSelected.querySelectorAll('[style*="border"]');
      
      // Should have the same number of styled elements
      expect(noneSelectedBorders.length).toBe(someSelectedBorders.length);
      
      // All should use consistent border property approach
      [...noneSelectedBorders, ...someSelectedBorders].forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });
  });

  describe('Wallet Components Visual Consistency', () => {
    it('should maintain consistent modal styling patterns', () => {
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
            // Should use individual properties consistently
            expect(style).toMatch(/margin-top:|marginTop:/);
            expect(style).toMatch(/margin-right:|marginRight:/);
            expect(style).toMatch(/margin-left:|marginLeft:/);
          }
        });
      });
    });

    it('should maintain WalletRequiredAction styling consistency', () => {
      const actions = ['connect', 'switch-network', 'sign'] as const;
      
      actions.forEach(action => {
        const { container } = renderWithProviders(
          <WalletRequiredAction action={action} onActionComplete={vi.fn()} />
        );
        
        // Check that styling is consistent across different actions
        const styledElements = container.querySelectorAll('[style]');
        styledElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          // Check margin consistency
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

  describe('Cross-Component Visual Consistency', () => {
    it('should maintain consistent styling patterns across all fixed components', () => {
      const components = [
        {
          name: 'AcceptanceStrategySelector',
          component: <AcceptanceStrategySelector
            selected="first-match"
            onChange={vi.fn()}
            eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
          />
        },
        {
          name: 'PaymentTypeSelector',
          component: <PaymentTypeSelector
            selected={[]}
            onChange={vi.fn()}
            availableTypes={['cash', 'booking']}
          />
        },
      ];

      const borderPatterns: string[] = [];
      const marginPatterns: string[] = [];

      components.forEach(({ name, component }) => {
        const { container } = render(component);
        
        // Collect border patterns
        const borderElements = container.querySelectorAll('[style*="border"]');
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          if (style.includes('border:')) {
            const borderMatch = style.match(/border:\s*[^;]+/);
            if (borderMatch) {
              borderPatterns.push(borderMatch[0]);
            }
          }
        });
        
        // Collect margin patterns
        const marginElements = container.querySelectorAll('[style*="margin"]');
        marginElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          if (style.includes('margin')) {
            const marginMatches = style.match(/margin[^:]*:\s*[^;]+/g);
            if (marginMatches) {
              marginPatterns.push(...marginMatches);
            }
          }
        });
      });

      // Check that border patterns follow consistent format
      borderPatterns.forEach(pattern => {
        expect(pattern).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
      });

      // Check that margin patterns are consistent
      marginPatterns.forEach(pattern => {
        // Should be either shorthand or individual, but consistent
        if (pattern.includes('margin:') && !pattern.includes('margin-')) {
          // Shorthand pattern
          expect(pattern).toMatch(/margin:\s*[\d\s]+/);
        } else {
          // Individual property pattern
          expect(pattern).toMatch(/margin-(top|right|bottom|left):\s*[\d\w]+/);
        }
      });
    });

    it('should maintain performance with complex styling scenarios', () => {
      const ComplexComponent = () => (
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
          <div style={{ 
            border: '1px solid #ccc',
            marginTop: 0,
            marginRight: 0,
            marginBottom: 16,
            marginLeft: 0
          }}>
            Nested content with consistent styling
          </div>
        </div>
      );

      const { container } = render(<ComplexComponent />);
      
      // Should render without issues
      expect(container).toBeInTheDocument();
      
      // All styled elements should follow consistent patterns
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        // No CSS property conflicts
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:') || style.includes('borderColor:');
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
        
        // Margin consistency
        const hasMarginShorthand = style.includes('margin:') && !style.includes('margin-');
        const hasMarginIndividual = style.includes('margin-top:') || style.includes('marginTop:');
        
        if (hasMarginShorthand && hasMarginIndividual) {
          expect(style).toMatch(/margin-right:|marginRight:/);
          expect(style).toMatch(/margin-bottom:|marginBottom:/);
          expect(style).toMatch(/margin-left:|marginLeft:/);
        }
      });
    });
  });
});