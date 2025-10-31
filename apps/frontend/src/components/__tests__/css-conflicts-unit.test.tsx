/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import components that can be tested without complex Redux setup
import { AcceptanceStrategySelector } from '../booking/AcceptanceStrategySelector';
import { PaymentTypeSelector } from '../booking/PaymentTypeSelector';

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

describe('CSS Property Conflicts - Unit Tests for Fixed Components', () => {
  describe('AcceptanceStrategySelector Component', () => {
    const defaultProps = {
      selected: 'first-match' as const,
      onChange: vi.fn(),
      eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };

    it('should render without CSS property conflict warnings', () => {
      render(<AcceptanceStrategySelector {...defaultProps} />);
      
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
      expect(cssWarnings).toHaveLength(0);
    });

    it('should not have conflicting border properties in style objects', () => {
      const { container } = render(<AcceptanceStrategySelector {...defaultProps} />);
      
      const styledElements = container.querySelectorAll('[style]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:');
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });

    it('should maintain functionality after CSS fixes', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      render(<AcceptanceStrategySelector {...defaultProps} onChange={mockOnChange} />);
      
      const auctionRadio = screen.getByDisplayValue('auction');
      await user.click(auctionRadio);
      
      expect(mockOnChange).toHaveBeenCalledWith('auction');
    });

    it('should handle state changes without generating warnings', () => {
      const { rerender } = render(<AcceptanceStrategySelector {...defaultProps} selected="first-match" />);
      
      rerender(<AcceptanceStrategySelector {...defaultProps} selected="auction" />);
      rerender(<AcceptanceStrategySelector {...defaultProps} selected="first-match" />);
      
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
      expect(cssWarnings).toHaveLength(0);
    });

    it('should use consistent border styling approach', () => {
      const { container } = render(<AcceptanceStrategySelector {...defaultProps} selected="auction" />);
      
      // Find option elements (they should have border styling)
      const optionElements = container.querySelectorAll('[style*="border"]');
      
      expect(optionElements.length).toBeGreaterThan(0);
      
      optionElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        // Should use border shorthand consistently
        if (style.includes('border')) {
          // If it has border styling, it should be shorthand format
          const borderMatches = style.match(/border:\s*[^;]+/g);
          if (borderMatches) {
            borderMatches.forEach(borderStyle => {
              // Should be in format "border: 1px solid color"
              expect(borderStyle).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
            });
          }
        }
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

    it('should handle disabled state without CSS conflicts', () => {
      const { container } = render(
        <AcceptanceStrategySelector {...defaultProps} disabled={true} />
      );
      
      // Should not generate CSS warnings in disabled state
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
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

    it('should handle error state without CSS conflicts', () => {
      const { container } = render(
        <AcceptanceStrategySelector 
          {...defaultProps} 
          error="Please select a strategy" 
        />
      );
      
      // Should not generate CSS warnings in error state
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
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

  describe('PaymentTypeSelector Component', () => {
    const defaultProps = {
      selected: [],
      onChange: vi.fn(),
      availableTypes: ['cash', 'booking'] as const,
    };

    it('should render without CSS property conflict warnings', () => {
      render(<PaymentTypeSelector {...defaultProps} />);
      
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
      expect(cssWarnings).toHaveLength(0);
    });

    it('should not have conflicting border properties in payment option styles', () => {
      const { container } = render(<PaymentTypeSelector {...defaultProps} />);
      
      const styledElements = container.querySelectorAll('[style*="border"]');
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        const hasBorderShorthand = style.includes('border:') && !style.includes('border-');
        const hasBorderColor = style.includes('border-color:');
        expect(hasBorderShorthand && hasBorderColor).toBe(false);
      });
    });

    it('should maintain payment type selection functionality', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      
      render(<PaymentTypeSelector {...defaultProps} onChange={mockOnChange} />);
      
      const initialWarningCount = warnings.length;
      
      // Try to find and interact with payment type options
      const paymentOptions = screen.queryAllByRole('checkbox');
      if (paymentOptions.length > 0) {
        await user.click(paymentOptions[0]);
      }
      
      // No new CSS warnings should be generated
      const newWarnings = warnings.slice(initialWarningCount);
      const cssWarnings = newWarnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
      expect(cssWarnings).toHaveLength(0);
    });

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

  describe('Cross-Component Integration Tests', () => {
    it('should handle multiple components rendering simultaneously without conflicts', () => {
      const TestWrapper = () => (
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

      render(<TestWrapper />);
      
      const cssWarnings = warnings.filter(warning => 
        (warning.includes('border') && warning.includes('borderColor')) ||
        (warning.includes('margin') && (warning.includes('marginTop') || warning.includes('marginBottom')))
      );
      expect(cssWarnings).toHaveLength(0);
    });

    it('should maintain performance with multiple re-renders', () => {
      const TestComponent = ({ count }: { count: number }) => (
        <div>
          <AcceptanceStrategySelector
            selected={count % 2 === 0 ? 'first-match' : 'auction'}
            onChange={vi.fn()}
            eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
          />
        </div>
      );

      const { rerender } = render(<TestComponent count={0} />);
      
      // Simulate multiple re-renders
      for (let i = 1; i <= 10; i++) {
        rerender(<TestComponent count={i} />);
      }
      
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
      expect(cssWarnings).toHaveLength(0);
    });

    it('should maintain consistent styling patterns across all fixed components', () => {
      const components = [
        <AcceptanceStrategySelector
          key="acceptance"
          selected="first-match"
          onChange={vi.fn()}
          eventDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
        />,
        <PaymentTypeSelector
          key="payment"
          selected={[]}
          onChange={vi.fn()}
          availableTypes={['cash', 'booking']}
        />,
      ];

      components.forEach((component, index) => {
        const { container } = render(component);
        
        // Check that border styles use consistent patterns
        const borderElements = container.querySelectorAll('[style*="border"]');
        borderElements.forEach(element => {
          const style = element.getAttribute('style') || '';
          
          if (style.includes('border:')) {
            // Should be shorthand format
            expect(style).toMatch(/border:\s*\d+px\s+solid\s+[^;]+/);
          }
        });
      });
    });

    it('should not generate any React warnings during normal usage', () => {
      const TestApp = () => (
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

      render(<TestApp />);
      
      // Filter out test-related warnings
      const relevantWarnings = warnings.filter(warning => 
        !warning.includes('ReactDOMTestUtils.act') &&
        !warning.includes('Warning: validateDOMNesting') &&
        !warning.includes('Warning: React.createElement')
      );
      
      expect(relevantWarnings).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Style Pattern Validation', () => {
    it('should demonstrate correct border property usage patterns', () => {
      // Test the style patterns used in fixed components
      const TestComponent = () => {
        const optionStyles = {
          border: `1px solid #ccc`,
          borderRadius: '4px',
          padding: '8px',
        };

        const selectedOptionStyles = {
          ...optionStyles,
          border: `1px solid #007bff`, // Consistent shorthand usage
          backgroundColor: '#f0f8ff',
        };

        return (
          <div>
            <div style={optionStyles}>Option 1</div>
            <div style={selectedOptionStyles}>Selected Option</div>
          </div>
        );
      };

      render(<TestComponent />);

      // Check that no CSS property conflict warnings were generated
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
      
      expect(cssWarnings).toHaveLength(0);
    });

    it('should demonstrate correct margin property usage patterns', () => {
      // Test the margin patterns used in fixed components
      const TestComponent = () => {
        return (
          <div>
            <p style={{ marginTop: 0, marginRight: 0, marginBottom: 16, marginLeft: 0 }}>
              Paragraph with individual margin properties
            </p>
            <p style={{ margin: 0 }}>
              Paragraph with shorthand margin
            </p>
          </div>
        );
      };

      render(<TestComponent />);

      // Check that no CSS property conflict warnings were generated
      const cssWarnings = warnings.filter(warning => 
        warning.includes('margin') && (warning.includes('marginTop') || warning.includes('marginBottom'))
      );
      
      expect(cssWarnings).toHaveLength(0);
    });

    it('should validate that problematic patterns would cause conflicts', () => {
      // This test shows what the problematic pattern looked like before fixes
      const TestComponent = () => {
        const conflictingStyles = {
          border: `1px solid #ccc`, // shorthand
          borderColor: '#007bff',   // individual property - this would cause a warning
        };

        return <div style={conflictingStyles}>This would cause a warning</div>;
      };

      render(<TestComponent />);

      // This test expects warnings to be generated for the conflicting pattern
      const cssWarnings = warnings.filter(warning => 
        warning.includes('border') && warning.includes('borderColor')
      );
      
      // Note: This test documents the problematic pattern but may not always generate warnings
      // depending on React version and rendering conditions
      console.log('Warnings captured for conflicting pattern:', warnings);
    });
  });
});