# CSS Property Usage Guidelines

## Overview

This document establishes best practices for consistent CSS property usage in React components to prevent property conflicts and ensure maintainable, warning-free code.

## The Problem

CSS property conflicts occur when shorthand and non-shorthand properties are mixed for the same CSS category on a single element. This causes React to issue warnings during re-renders and can lead to unpredictable styling behavior.

**Example of Problematic Code:**
```typescript
const styles = {
  border: '1px solid #ccc',     // shorthand property
  borderColor: '#ff0000',       // non-shorthand property - CONFLICT!
};
```

**React Warning:**
```
Warning: Received `borderColor` for a non-boolean attribute `borderColor`. 
If you meant to write it to the DOM, pass a string instead: borderColor="..."
```

## Core Principles

### 1. Consistency Rule
**Use either shorthand OR individual properties consistently within the same CSS category.**

### 2. Property Categories
Common CSS categories where conflicts occur:
- **Border**: `border` vs `borderWidth`, `borderStyle`, `borderColor`
- **Margin**: `margin` vs `marginTop`, `marginRight`, `marginBottom`, `marginLeft`
- **Padding**: `padding` vs `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`
- **Font**: `font` vs `fontSize`, `fontWeight`, `fontFamily`
- **Background**: `background` vs `backgroundColor`, `backgroundImage`, etc.

### 3. Design System Integration
Always use design system tokens from `@/design-system/tokens` for consistent values.

## Best Practices

### Border Properties

#### ✅ Correct: Use Shorthand Consistently
```typescript
import { tokens } from '@/design-system/tokens';

const baseStyles = {
  border: `1px solid ${tokens.colors.neutral[300]}`,
};

const selectedStyles = {
  ...baseStyles,
  border: `1px solid ${tokens.colors.primary[500]}`, // Override entire border
};
```

#### ✅ Correct: Use Individual Properties Consistently
```typescript
import { tokens } from '@/design-system/tokens';

const baseStyles = {
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: tokens.colors.neutral[300],
};

const selectedStyles = {
  ...baseStyles,
  borderColor: tokens.colors.primary[500], // Only override color
};
```

#### ❌ Incorrect: Mixed Properties
```typescript
const styles = {
  border: '1px solid #ccc',     // shorthand
  borderColor: '#ff0000',       // individual - CONFLICT!
};
```

### Margin and Padding Properties

#### ✅ Correct: Shorthand for Uniform Spacing
```typescript
import { tokens } from '@/design-system/tokens';

const styles = {
  margin: tokens.spacing[4],
  padding: tokens.spacing[3],
};
```

#### ✅ Correct: Individual Properties for Different Sides
```typescript
import { tokens } from '@/design-system/tokens';

const styles = {
  marginTop: tokens.spacing[2],
  marginBottom: tokens.spacing[4],
  paddingLeft: tokens.spacing[3],
  paddingRight: tokens.spacing[3],
};
```

#### ❌ Incorrect: Mixed Margin/Padding
```typescript
const styles = {
  margin: '16px',           // shorthand
  marginTop: '8px',         // individual - CONFLICT!
};
```

### Font Properties

#### ✅ Correct: Individual Properties (Recommended)
```typescript
import { tokens } from '@/design-system/tokens';

const styles = {
  fontSize: tokens.typography.fontSize.lg,
  fontWeight: tokens.typography.fontWeight.semibold,
  fontFamily: tokens.typography.fontFamily.sans.join(', '),
};
```

#### ✅ Correct: Font Shorthand (When Appropriate)
```typescript
const styles = {
  font: '16px/1.5 Inter, system-ui, sans-serif',
};
```

## Component Implementation Patterns

### Pattern 1: Base + Variant Styles
```typescript
import { tokens } from '@/design-system/tokens';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md' }) => {
  const baseStyles = {
    border: `1px solid ${tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const variantStyles = {
    primary: {
      border: `1px solid ${tokens.colors.primary[500]}`,
      backgroundColor: tokens.colors.primary[500],
      color: tokens.colors.white,
    },
    secondary: {
      border: `1px solid ${tokens.colors.neutral[300]}`,
      backgroundColor: tokens.colors.white,
      color: tokens.colors.neutral[700],
    },
  };

  const sizeStyles = {
    sm: {
      padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
      fontSize: tokens.typography.fontSize.sm,
    },
    md: {
      padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
      fontSize: tokens.typography.fontSize.base,
    },
    lg: {
      padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`,
      fontSize: tokens.typography.fontSize.lg,
    },
  };

  const combinedStyles = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
  };

  return <button style={combinedStyles}>Button</button>;
};
```

### Pattern 2: Conditional Styling
```typescript
import { tokens } from '@/design-system/tokens';

interface InputProps {
  hasError?: boolean;
  disabled?: boolean;
}

const Input: React.FC<InputProps> = ({ hasError, disabled }) => {
  const getInputStyles = () => {
    const baseStyles = {
      border: `1px solid ${tokens.colors.neutral[300]}`,
      borderRadius: tokens.borderRadius.md,
      padding: tokens.spacing[3],
      fontSize: tokens.typography.fontSize.base,
    };

    if (hasError) {
      return {
        ...baseStyles,
        border: `1px solid ${tokens.colors.error[500]}`, // Override entire border
      };
    }

    if (disabled) {
      return {
        ...baseStyles,
        border: `1px solid ${tokens.colors.neutral[200]}`,
        backgroundColor: tokens.colors.neutral[50],
      };
    }

    return baseStyles;
  };

  return <input style={getInputStyles()} />;
};
```

## Testing Guidelines

### Unit Tests for Style Conflicts
```typescript
import { render } from '@testing-library/react';
import { Component } from './Component';

describe('Component Styling', () => {
  it('should not have CSS property conflicts', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    render(<Component />);
    
    // Check that no React warnings about CSS properties were logged
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Received')
    );
    
    consoleSpy.mockRestore();
  });

  it('should apply styles without conflicts', () => {
    const { container } = render(<Component />);
    const element = container.firstChild as HTMLElement;
    
    // Verify computed styles are applied correctly
    const computedStyle = window.getComputedStyle(element);
    expect(computedStyle.border).toBeDefined();
    expect(computedStyle.borderColor).toBeDefined();
  });
});
```

## Migration Strategy

### Step 1: Identify Conflicts
Use the following search patterns to find potential conflicts:

```bash
# Search for border conflicts
grep -r "border:" src/ | grep -v "border-"
grep -r "borderColor\|borderWidth\|borderStyle" src/

# Search for margin conflicts  
grep -r "margin:" src/ | grep -v "margin-"
grep -r "marginTop\|marginRight\|marginBottom\|marginLeft" src/

# Search for padding conflicts
grep -r "padding:" src/ | grep -v "padding-"
grep -r "paddingTop\|paddingRight\|paddingBottom\|paddingLeft" src/
```

### Step 2: Choose Resolution Strategy
For each conflict, decide:
1. **Use shorthand**: When all sides need the same value
2. **Use individual properties**: When different sides need different values
3. **Consider design system tokens**: Always prefer tokens over hardcoded values

### Step 3: Apply Fixes Systematically
1. Fix one component at a time
2. Test visual appearance before and after
3. Run unit tests to ensure no warnings
4. Update related tests if needed

### Step 4: Prevent Future Conflicts
1. Add linting rules (see Linting section)
2. Update code review checklist
3. Document patterns in component library

## Common Pitfalls

### 1. Spread Operator Conflicts
```typescript
// ❌ Problematic
const baseStyles = { border: '1px solid #ccc' };
const extendedStyles = { 
  ...baseStyles, 
  borderColor: '#ff0000' // Conflict!
};

// ✅ Correct
const baseStyles = { border: '1px solid #ccc' };
const extendedStyles = { 
  ...baseStyles, 
  border: '1px solid #ff0000' // Override entire property
};
```

### 2. Dynamic Style Generation
```typescript
// ❌ Problematic
const getDynamicStyles = (color: string) => ({
  border: '1px solid #ccc',
  ...(color && { borderColor: color }) // Potential conflict
});

// ✅ Correct
const getDynamicStyles = (color: string) => ({
  border: `1px solid ${color || '#ccc'}` // Single property
});
```

### 3. CSS-in-JS Library Conflicts
```typescript
// ❌ Problematic with styled-components
const StyledDiv = styled.div`
  border: 1px solid #ccc;
  border-color: ${props => props.color}; // Conflict in CSS
`;

// ✅ Correct
const StyledDiv = styled.div<{ color?: string }>`
  border: 1px solid ${props => props.color || '#ccc'};
`;
```

## Design System Integration

### Using Tokens Effectively
```typescript
import { tokens } from '@/design-system/tokens';

// ✅ Good: Semantic token usage
const cardStyles = {
  border: `1px solid ${tokens.colors.neutral[200]}`,
  borderRadius: tokens.borderRadius.lg,
  padding: tokens.spacing[4],
  boxShadow: tokens.shadows.md,
};

// ✅ Good: Responsive considerations
const responsiveStyles = {
  padding: tokens.spacing[3],
  '@media (min-width: 768px)': {
    padding: tokens.spacing[6],
  },
};
```

### Creating Reusable Style Functions
```typescript
import { tokens } from '@/design-system/tokens';

export const createBorderStyles = (
  color: keyof typeof tokens.colors,
  width: string = '1px',
  style: string = 'solid'
) => ({
  border: `${width} ${style} ${tokens.colors[color][500]}`,
});

export const createSpacingStyles = (
  padding?: keyof typeof tokens.spacing,
  margin?: keyof typeof tokens.spacing
) => ({
  ...(padding && { padding: tokens.spacing[padding] }),
  ...(margin && { margin: tokens.spacing[margin] }),
});

// Usage
const buttonStyles = {
  ...createBorderStyles('primary'),
  ...createSpacingStyles(3, 2),
};
```

## Next Steps

1. **Immediate Actions:**
   - Review existing components for conflicts
   - Apply fixes using patterns in this guide
   - Add unit tests for critical components

2. **Long-term Improvements:**
   - Implement linting rules (see separate linting configuration)
   - Create component library with built-in conflict prevention
   - Add visual regression testing for style changes

3. **Team Adoption:**
   - Share this guide with the development team
   - Include in code review checklist
   - Add to onboarding documentation

## Resources

- [React Documentation: DOM Elements](https://react.dev/reference/react-dom/components)
- [MDN: CSS Shorthand Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties)
- [Design System Tokens Documentation](../apps/frontend/src/design-system/tokens.ts)

---

*Last updated: [Current Date]*
*Version: 1.0*