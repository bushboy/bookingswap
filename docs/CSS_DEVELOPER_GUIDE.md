# CSS Property Conflict Prevention - Developer Guide

## Quick Start

This guide helps you avoid CSS property conflicts in React components and maintain consistent styling patterns.

### 🚨 The Problem

Mixing CSS shorthand and individual properties causes React warnings and unpredictable styling:

```typescript
// ❌ BAD - Causes React warnings
const styles = {
  border: '1px solid #ccc',     // shorthand
  borderColor: '#ff0000',       // individual - CONFLICT!
};
```

### ✅ The Solution

Use **either** shorthand **OR** individual properties consistently:

```typescript
// ✅ GOOD - Shorthand approach
const styles = {
  border: '1px solid #ff0000',  // Override entire border
};

// ✅ GOOD - Individual approach  
const styles = {
  borderWidth: '1px',
  borderStyle: 'solid', 
  borderColor: '#ff0000',
};
```

## Development Workflow

### 1. Use Type-Safe Styles

Import and use the `SafeStyles` type to catch conflicts at compile time:

```typescript
import { SafeStyles, validateStyles } from '@/types/styles';
import { tokens } from '@/design-system/tokens';

const MyComponent: React.FC = () => {
  const styles: SafeStyles = {
    border: `1px solid ${tokens.colors.primary[500]}`,
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.md,
  };

  // Optional: Runtime validation in development
  const validatedStyles = validateStyles(styles, 'MyComponent');

  return <div style={validatedStyles}>Content</div>;
};
```

### 2. Run Automated Checks

Before committing, run the CSS conflict checker:

```bash
# Check for conflicts
npm run lint:css-conflicts

# Run all linting
npm run lint
```

### 3. Follow Established Patterns

Use the helper functions for common patterns:

```typescript
import { createBorderStyles, createSpacingStyles } from '@/types/styles';
import { tokens } from '@/design-system/tokens';

const buttonStyles = {
  ...createBorderStyles(tokens.colors.primary[500]),
  ...createSpacingStyles(tokens.spacing[3], tokens.spacing[2]),
  backgroundColor: tokens.colors.primary[500],
  color: tokens.colors.white,
};
```

## Common Patterns

### Pattern 1: State-Based Styling

```typescript
import { SafeStyles } from '@/types/styles';
import { tokens } from '@/design-system/tokens';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', disabled }) => {
  const getButtonStyles = (): SafeStyles => {
    const baseStyles: SafeStyles = {
      border: `1px solid ${tokens.colors.neutral[300]}`,
      borderRadius: tokens.borderRadius.md,
      padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.medium,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    };

    if (variant === 'primary') {
      return {
        ...baseStyles,
        border: `1px solid ${tokens.colors.primary[500]}`,
        backgroundColor: tokens.colors.primary[500],
        color: tokens.colors.white,
      };
    }

    return {
      ...baseStyles,
      backgroundColor: tokens.colors.white,
      color: tokens.colors.neutral[700],
    };
  };

  return <button style={getButtonStyles()}>Button</button>;
};
```

### Pattern 2: Responsive Styling

```typescript
import { SafeStyles } from '@/types/styles';
import { tokens } from '@/design-system/tokens';

const ResponsiveCard: React.FC = () => {
  const cardStyles: SafeStyles = {
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing[4], // Base padding
    backgroundColor: tokens.colors.white,
    boxShadow: tokens.shadows.md,
  };

  // For responsive behavior, use CSS classes or media queries
  // rather than inline styles for complex responsive logic
  
  return <div style={cardStyles} className="responsive-card">Content</div>;
};
```

### Pattern 3: Conditional Border Styling

```typescript
import { SafeStyles } from '@/types/styles';
import { tokens } from '@/design-system/tokens';

interface InputProps {
  hasError?: boolean;
  isFocused?: boolean;
}

const Input: React.FC<InputProps> = ({ hasError, isFocused }) => {
  const getBorderStyle = (): string => {
    if (hasError) {
      return `2px solid ${tokens.colors.error[500]}`;
    }
    if (isFocused) {
      return `2px solid ${tokens.colors.primary[500]}`;
    }
    return `1px solid ${tokens.colors.neutral[300]}`;
  };

  const inputStyles: SafeStyles = {
    border: getBorderStyle(), // Single source of truth for border
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing[3],
    fontSize: tokens.typography.fontSize.base,
    backgroundColor: tokens.colors.white,
    transition: 'border-color 0.2s ease-in-out',
  };

  return <input style={inputStyles} />;
};
```

## Property Categories & Rules

### Border Properties

| Shorthand | Individual Properties | Rule |
|-----------|----------------------|------|
| `border` | `borderWidth`, `borderStyle`, `borderColor`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft` | Use one approach consistently |

```typescript
// ✅ Shorthand approach
const styles1 = {
  border: '1px solid #ccc',
};

// ✅ Individual approach
const styles2 = {
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#ccc',
};

// ✅ Different sides approach
const styles3 = {
  borderTop: '1px solid #ccc',
  borderBottom: '2px solid #000',
};
```

### Spacing Properties

| Shorthand | Individual Properties | Rule |
|-----------|----------------------|------|
| `margin` | `marginTop`, `marginRight`, `marginBottom`, `marginLeft` | Use shorthand for uniform spacing |
| `padding` | `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` | Use individual for asymmetric spacing |

```typescript
// ✅ Uniform spacing - use shorthand
const uniformStyles = {
  margin: tokens.spacing[4],
  padding: tokens.spacing[3],
};

// ✅ Asymmetric spacing - use individual
const asymmetricStyles = {
  marginTop: tokens.spacing[2],
  marginBottom: tokens.spacing[6],
  paddingLeft: tokens.spacing[4],
  paddingRight: tokens.spacing[4],
};
```

## Testing Your Components

### Unit Test Template

```typescript
import { render } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent Styling', () => {
  it('should not have CSS property conflicts', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    render(<MyComponent />);
    
    // Check that no React warnings about CSS properties were logged
    const cssWarnings = consoleSpy.mock.calls.filter(call =>
      call[0]?.includes?.('Received') && 
      (call[0]?.includes?.('border') || 
       call[0]?.includes?.('margin') || 
       call[0]?.includes?.('padding'))
    );
    
    expect(cssWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it('should apply styles correctly', () => {
    const { container } = render(<MyComponent />);
    const element = container.firstChild as HTMLElement;
    
    // Verify computed styles
    const computedStyle = window.getComputedStyle(element);
    expect(computedStyle.border).toBeDefined();
    expect(computedStyle.padding).toBeDefined();
  });
});
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors with SafeStyles**
   ```typescript
   // ❌ Error: Type conflicts
   const styles: SafeStyles = {
     border: '1px solid #ccc',
     borderColor: '#ff0000', // TypeScript error!
   };
   
   // ✅ Fix: Use consistent approach
   const styles: SafeStyles = {
     border: '1px solid #ff0000',
   };
   ```

2. **ESLint Warnings**
   ```typescript
   // ❌ ESLint warning: no-css-property-conflicts
   const styles = {
     margin: '16px',
     marginTop: '8px', // Conflict detected
   };
   
   // ✅ Fix: Choose one approach
   const styles = {
     marginTop: '8px',
     marginRight: '16px',
     marginBottom: '16px',
     marginLeft: '16px',
   };
   ```

3. **Runtime Warnings in Development**
   ```typescript
   // Use validateStyles to catch issues early
   const styles = validateStyles({
     border: '1px solid #ccc',
     padding: '16px',
   }, 'MyComponent');
   ```

### Debugging Tips

1. **Enable Runtime Validation**
   ```typescript
   import { validateStyles } from '@/types/styles';
   
   const styles = validateStyles(myStyles, 'ComponentName');
   ```

2. **Check Console for Warnings**
   - Look for React warnings about CSS properties
   - Check browser dev tools for computed styles

3. **Use ESLint Extension**
   - Install ESLint VS Code extension
   - Enable auto-fix on save

## Migration Guide

### Step 1: Identify Conflicts

Run the automated checker:
```bash
npm run lint:css-conflicts
```

### Step 2: Fix Components One by One

For each component with conflicts:

1. Choose shorthand OR individual properties
2. Update the style object
3. Test visual appearance
4. Run unit tests

### Step 3: Add Type Safety

```typescript
// Before
const styles = {
  border: '1px solid #ccc',
  borderColor: '#ff0000', // Conflict
};

// After
import { SafeStyles } from '@/types/styles';

const styles: SafeStyles = {
  border: '1px solid #ff0000', // Fixed
};
```

### Step 4: Update Tests

Add CSS conflict tests to your component test suites.

## Best Practices Summary

1. **Always use design system tokens** instead of hardcoded values
2. **Choose one approach per CSS category** (shorthand OR individual)
3. **Use TypeScript types** to catch conflicts at compile time
4. **Run automated checks** before committing
5. **Test visual appearance** after making changes
6. **Add unit tests** to prevent regressions
7. **Use helper functions** for common patterns
8. **Enable runtime validation** in development

## Resources

- [CSS Property Guidelines](./CSS_PROPERTY_GUIDELINES.md) - Comprehensive reference
- [Implementation Examples](./CSS_IMPLEMENTATION_EXAMPLES.md) - Copy-paste examples
- [Linting Rules](./CSS_LINTING_RULES.md) - Automated enforcement
- [Design System Tokens](../apps/frontend/src/design-system/tokens.ts) - Token reference

---

**Need Help?** Check the existing documentation or run `npm run lint:css-conflicts` to identify issues automatically.