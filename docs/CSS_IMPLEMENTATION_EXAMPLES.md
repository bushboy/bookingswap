# CSS Property Implementation Examples

## Overview

This document provides practical, copy-paste examples for implementing CSS properties without conflicts in React components.

## Quick Reference Patterns

### Border Patterns

#### Pattern 1: Simple Border with State Changes
```typescript
import { tokens } from '@/design-system/tokens';

interface CardProps {
  isSelected?: boolean;
  hasError?: boolean;
}

const Card: React.FC<CardProps> = ({ isSelected, hasError }) => {
  const getBorderStyle = () => {
    if (hasError) {
      return `2px solid ${tokens.colors.error[500]}`;
    }
    if (isSelected) {
      return `2px solid ${tokens.colors.primary[500]}`;
    }
    return `1px solid ${tokens.colors.neutral[300]}`;
  };

  const cardStyles = {
    border: getBorderStyle(),
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.white,
  };

  return <div style={cardStyles}>Card Content</div>;
};
```

#### Pattern 2: Complex Border with Different Sides
```typescript
import { tokens } from '@/design-system/tokens';

interface SidebarProps {
  position: 'left' | 'right';
}

const Sidebar: React.FC<SidebarProps> = ({ position }) => {
  const sidebarStyles = {
    // Use individual properties when sides differ
    borderTopWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: position === 'right' ? '1px' : '0',
    borderRightWidth: position === 'left' ? '1px' : '0',
    borderStyle: 'solid',
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[50],
  };

  return <aside style={sidebarStyles}>Sidebar Content</aside>;
};
```

### Spacing Patterns

#### Pattern 1: Uniform Spacing
```typescript
import { tokens } from '@/design-system/tokens';

const UniformSpacingComponent: React.FC = () => {
  const styles = {
    // Use shorthand for uniform spacing
    margin: tokens.spacing[4],
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.borderRadius.md,
  };

  return <div style={styles}>Uniform spacing content</div>;
};
```

#### Pattern 2: Asymmetric Spacing
```typescript
import { tokens } from '@/design-system/t