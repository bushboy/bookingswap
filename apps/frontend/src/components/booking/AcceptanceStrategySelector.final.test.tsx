/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a simplified version of the component that demonstrates the CSS conflict
const AcceptanceStrategySelectorWithConflict: React.FC<{
  selected: 'first-match' | 'auction';
  onChange: (strategy: 'first-match' | 'auction') => void;
}> = ({ selected, onChange }) => {
  // This demonstrates the CSS property conflict issue
  const optionStyles = {
    display: 'flex',
    padding: '1rem',
    border: '1px solid #d6d3d1', // shorthand property
    borderRadius: '0.375rem',
    backgroundColor: 'white',
    cursor: 'pointer',
  };

  // This creates the conflict - mixing shorthand 'border' with non-shorthand 'borderColor'
  const selectedOptionStyles = {
    ...optionStyles,
    borderColor: '#627d98', // non-shorthand property - CONFLICT!
    backgroundColor: '#f0f4f8',
  };

  return (
    <div data-testid="acceptance-strategy-selector">
      <div
        style={selected === 'first-match' ? selectedOptionStyles : optionStyles}
        onClick={() => onChange('first-match')}
        data-testid="first-match-option"
      >
        <input
          type="radio"
          value="first-match"
          checked={selected === 'first-match'}
          onChange={() => onChange('first-match')}
        />
        First Match
      </div>

      <div
        style={selected === 'auction' ? selectedOptionStyles : optionStyles}
        onClick={() => onChange('auction')}
        data-testid="auction-option"
      >
        <input
          type="radio"
          value="auction"
          checked={selected === 'auction'}
          onChange={() => onChange('auction')}
        />
        Auction Mode
      </div>
    </div>
  );
};

describe('AcceptanceStrategySelector CSS Property Conflict Tests', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to capture warnings
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('CSS Property Conflict Detection', () => {
    it('should successfully detect CSS property conflicts in rendered HTML', () => {
      const { container } = render(
        <AcceptanceStrategySelectorWithConflict 
          selected="auction" 
          onChange={mockOnChange} 
        />
      );
      
      // Get the auction option which should have the conflict
      const auctionOption = container.querySelector('[data-testid="auction-option"]');
      expect(auctionOption).toBeTruthy();
      
      const style = auctionOption?.getAttribute('style') || '';
      
      // Verify both properties are present in the style attribute
      const hasBorderShorthand = style.includes('border: 1px solid #d6d3d1');
      const hasBorderColor = style.includes('border-color: #627d98');
      
      // This confirms the CSS property conflict exists
      expect(hasBorderShorthand).toBe(true);
      expect(hasBorderColor).toBe(true);
      
      // Log the actual style for verification
      console.log('Detected CSS conflict in style:', style);
    });

    it('should demonstrate the solution using consistent border properties', () => {
      // Create a fixed version that uses consistent border shorthand
      const FixedComponent: React.FC<{
        selected: 'first-match' | 'auction';
        onChange: (strategy: 'first-match' | 'auction') => void;
      }> = ({ selected, onChange }) => {
        const optionStyles = {
          border: '1px solid #d6d3d1',
          padding: '1rem',
        };

        const selectedOptionStyles = {
          ...optionStyles,
          border: '1px solid #627d98', // Use consistent shorthand - NO CONFLICT
          backgroundColor: '#f0f4f8',
        };

        return (
          <div>
            <div
              style={selected === 'auction' ? selectedOptionStyles : optionStyles}
              data-testid="auction-fixed"
            >
              Auction Mode (Fixed)
            </div>
          </div>
        );
      };

      const { container } = render(
        <FixedComponent selected="auction" onChange={mockOnChange} />
      );
      
      const auctionOption = container.querySelector('[data-testid="auction-fixed"]');
      const style = auctionOption?.getAttribute('style') || '';
      
      // Check that the fixed version doesn't have conflicts
      const hasBorderShorthand = style.includes('border: 1px solid #627d98');
      const hasBorderColor = style.includes('border-color:');
      
      // The fixed version should use consistent shorthand
      expect(hasBorderShorthand).toBe(true);
      expect(hasBorderColor).toBe(false); // No separate border-color property
      
      console.log('Fixed CSS (no conflict):', style);
    });

    it('should render component functionality correctly', () => {
      render(
        <AcceptanceStrategySelectorWithConflict 
          selected="first-match" 
          onChange={mockOnChange} 
        />
      );
      
      // Verify component renders
      expect(screen.getByTestId('acceptance-strategy-selector')).toBeTruthy();
      expect(screen.getByText('First Match')).toBeTruthy();
      expect(screen.getByText('Auction Mode')).toBeTruthy();
      
      // Verify radio buttons
      const firstMatchRadio = screen.getByDisplayValue('first-match');
      const auctionRadio = screen.getByDisplayValue('auction');
      
      expect(firstMatchRadio).toBeTruthy();
      expect(auctionRadio).toBeTruthy();
      
      // Check which is selected
      expect(firstMatchRadio.checked).toBe(true);
      expect(auctionRadio.checked).toBe(false);
    });

    it('should demonstrate different selection states', () => {
      const { rerender, container } = render(
        <AcceptanceStrategySelectorWithConflict 
          selected="first-match" 
          onChange={mockOnChange} 
        />
      );
      
      // Check first-match selected state
      let firstMatchOption = container.querySelector('[data-testid="first-match-option"]');
      let firstMatchStyle = firstMatchOption?.getAttribute('style') || '';
      
      // Should have the conflict when selected
      expect(firstMatchStyle).toContain('border-color: #627d98');
      expect(firstMatchStyle).toContain('background-color: rgb(240, 244, 248)');
      
      // Change to auction selected
      rerender(
        <AcceptanceStrategySelectorWithConflict 
          selected="auction" 
          onChange={mockOnChange} 
        />
      );
      
      // Check auction selected state
      let auctionOption = container.querySelector('[data-testid="auction-option"]');
      let auctionStyle = auctionOption?.getAttribute('style') || '';
      
      // Should have the conflict when selected
      expect(auctionStyle).toContain('border-color: #627d98');
      expect(auctionStyle).toContain('background-color: rgb(240, 244, 248)');
      
      // First match should now be unselected (no conflict)
      firstMatchOption = container.querySelector('[data-testid="first-match-option"]');
      firstMatchStyle = firstMatchOption?.getAttribute('style') || '';
      expect(firstMatchStyle).not.toContain('border-color: #627d98');
    });
  });

  describe('Test Implementation Validation', () => {
    it('should validate that our test setup correctly identifies the issue', () => {
      // This test validates that our testing approach is working correctly
      const { container } = render(
        <AcceptanceStrategySelectorWithConflict 
          selected="auction" 
          onChange={mockOnChange} 
        />
      );
      
      // Get all elements with inline styles
      const styledElements = container.querySelectorAll('[style]');
      
      let conflictFound = false;
      let conflictDetails = '';
      
      styledElements.forEach(element => {
        const style = element.getAttribute('style') || '';
        
        // Look for the specific pattern: border shorthand + border-color
        if (style.includes('border: 1px solid') && style.includes('border-color:')) {
          conflictFound = true;
          conflictDetails = style;
        }
      });
      
      // Verify we found the conflict
      expect(conflictFound).toBe(true);
      expect(conflictDetails).toContain('border: 1px solid #d6d3d1');
      expect(conflictDetails).toContain('border-color: #627d98');
      
      console.log('✅ Successfully detected CSS property conflict:', conflictDetails);
    });
  });
});