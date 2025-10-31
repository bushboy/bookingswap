# CSS Property Conflict Linting Rules

## Overview

This document provides ESLint rules and configurations to automatically detect and prevent CSS property conflicts in React components.

## ESLint Plugin Configuration

### Option 1: Custom ESLint Rule (Recommended)

Create a custom ESLint rule to detect CSS property conflicts:

```javascript
// .eslint/rules/no-css-property-conflicts.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow mixing CSS shorthand and individual properties',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      conflictingProperties: 'Avoid mixing shorthand property "{{shorthand}}" with individual property "{{individual}}"',
    },
  },

  create(context) {
    const conflictMap = {
      // Border conflicts
      border: ['borderWidth', 'borderStyle', 'borderColor', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft'],
      borderTop: ['border', 'borderTopWidth', 'borderTopStyle', 'borderTopColor'],
      borderRight: ['border', 'borderRightWidth', 'borderRightStyle', 'borderRightColor'],
      borderBottom: ['border', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor'],
      borderLeft: ['border', 'borderLeftWidth', 'borderLeftStyle', 'borderLeftColor'],
      
      // Margin conflicts
      margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
      
      // Padding conflicts
      padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
      
      // Font conflicts
      font: ['fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'fontVariant', 'lineHeight'],
      
      // Background conflicts
      background: ['backgroundColor', 'backgroundImage', 'backgroundRepeat', 'backgroundPosition', 'backgroundSize'],
    };

    function checkObjectExpression(node) {
      const properties = node.properties;
      const propertyNames = new Set();
      
      properties.forEach(prop => {
        if (prop.type === 'Property' && prop.key.type === 'Identifier') {
          propertyNames.add(prop.key.name);
        }
      });

      // Check for conflicts
      propertyNames.forEach(propName => {
        if (conflictMap[propName]) {
          conflictMap[propName].forEach(conflictingProp => {
            if (propertyNames.has(conflictingProp)) {
              const propNode = properties.find(p => 
                p.type === 'Property' && 
                p.key.type === 'Identifier' && 
                p.key.name === conflictingProp
              );
              
              if (propNode) {
                context.report({
                  node: propNode,
                  messageId: 'conflictingProperties',
                  data: {
                    shorthand: propName,
                    individual: conflictingProp,
                  },
                });
              }
            }
          });
        }
      });
    }

    return {
      ObjectExpression: checkObjectExpression,
    };
  },
};
```

### Option 2: Using Existing ESLint Plugins

Add these plugins to your ESLint configuration:

```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "plugins": [
    "@typescript-eslint",
    "react",
    "react-hooks"
  ],
  "rules": {
    "react/no-unknown-property": ["error", {
      "ignore": ["css"]
    }]
  }
}
```

## TypeScript Integration

### Type-Safe Style Objects

Create TypeScript types to prevent conflicts at compile time:

```typescript
// types/styles.ts
export type BorderShorthand = {
  border: string;
  borderTop?: never;
  borderRight?: never;
  borderBottom?: never;
  borderLeft?: never;
  borderWidth?: never;
  borderStyle?: never;
  borderColor?: never;
};

export type BorderIndividual = {
  border?: never;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
};

export type BorderStyles = BorderShorthand | BorderIndividual;

export type MarginShorthand = {
  margin: string;
  marginTop?: never;
  marginRight?: never;
  marginBottom?: never;
  marginLeft?: never;
};

export type MarginIndividual = {
  margin?: never;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
};

export type MarginStyles = MarginShorthand | MarginIndividual;

export type PaddingShorthand = {
  padding: string;
  paddingTop?: never;
  paddingRight?: never;
  paddingBottom?: never;
  paddingLeft?: never;
};

export type PaddingIndividual = {
  padding?: never;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
};

export type PaddingStyles = PaddingShorthand | PaddingIndividual;

export type SafeStyles = BorderStyles & MarginStyles & PaddingStyles & {
  // Other safe CSS properties
  backgroundColor?: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  borderRadius?: string;
  boxShadow?: string;
  display?: string;
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  overflow?: string;
  textAlign?: string;
  verticalAlign?: string;
  zIndex?: number;
  opacity?: number;
  cursor?: string;
  pointerEvents?: string;
  userSelect?: string;
  transition?: string;
  transform?: string;
  filter?: string;
  backdropFilter?: string;
};
```

### Usage with Type Safety

```typescript
import { SafeStyles } from '@/types/styles';
import { tokens } from '@/design-system/tokens';

// ✅ This will compile - using border shorthand
const validStyles1: SafeStyles = {
  border: `1px solid ${tokens.colors.primary[500]}`,
  padding: tokens.spacing[4],
};

// ✅ This will compile - using individual border properties
const validStyles2: SafeStyles = {
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: tokens.colors.primary[500],
  paddingTop: tokens.spacing[2],
  paddingBottom: tokens.spacing[4],
};

// ❌ This will NOT compile - mixing border shorthand and individual
const invalidStyles: SafeStyles = {
  border: `1px solid ${tokens.colors.primary[500]}`,
  borderColor: tokens.colors.error[500], // TypeScript error!
};
```

## Stylelint Configuration

For CSS-in-JS and styled-components, use Stylelint:

```json
// .stylelintrc.json
{
  "extends": [
    "stylelint-config-standard",
    "stylelint-config-styled-components"
  ],
  "processors": [
    "stylelint-processor-styled-components"
  ],
  "rules": {
    "declaration-block-no-shorthand-property-overrides": true,
    "shorthand-property-no-redundant-values": true,
    "declaration-block-no-redundant-longhand-properties": true
  }
}
```

## Pre-commit Hooks

Add linting to your pre-commit hooks:

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "stylelint --fix",
      "prettier --write"
    ]
  }
}
```

## VS Code Integration

### ESLint Extension Settings

```json
// .vscode/settings.json
{
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "eslint.workingDirectories": [
    "apps/frontend"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.fixAll.stylelint": true
  }
}
```

### Custom Snippets for Safe Styles

```json
// .vscode/snippets/react-styles.json
{
  "Safe Border Shorthand": {
    "prefix": "border-safe",
    "body": [
      "border: `1px solid \\${tokens.colors.${1:neutral}[${2:300}]}`,",
      "$0"
    ],
    "description": "Safe border shorthand using design tokens"
  },
  "Safe Border Individual": {
    "prefix": "border-individual",
    "body": [
      "borderWidth: '${1:1px}',",
      "borderStyle: '${2:solid}',",
      "borderColor: tokens.colors.${3:neutral}[${4:300}],",
      "$0"
    ],
    "description": "Safe individual border properties using design tokens"
  },
  "Safe Spacing Shorthand": {
    "prefix": "spacing-safe",
    "body": [
      "padding: tokens.spacing[${1:4}],",
      "margin: tokens.spacing[${2:2}],",
      "$0"
    ],
    "description": "Safe spacing shorthand using design tokens"
  }
}
```

## Testing Integration

### Jest Configuration for Style Testing

```javascript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/src/test/style-conflict-setup.ts'],
  // ... other config
};
```

```typescript
// src/test/style-conflict-setup.ts
import { beforeEach, afterEach } from '@jest/globals';

let consoleWarnSpy: jest.SpyInstance;

beforeEach(() => {
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
});

afterEach(() => {
  // Check for React warnings about CSS properties
  const cssWarnings = consoleWarnSpy.mock.calls.filter(call =>
    call[0]?.includes?.('Received') && 
    (call[0]?.includes?.('border') || 
     call[0]?.includes?.('margin') || 
     call[0]?.includes?.('padding'))
  );

  if (cssWarnings.length > 0) {
    console.error('CSS property conflicts detected:', cssWarnings);
    throw new Error(`CSS property conflicts found: ${cssWarnings.length} warnings`);
  }

  consoleWarnSpy.mockRestore();
});
```

## Automated Conflict Detection Script

Create a script to scan for potential conflicts:

```javascript
// scripts/check-css-conflicts.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const conflictPatterns = {
  border: /border\s*:/g,
  borderIndividual: /border(Top|Right|Bottom|Left|Width|Style|Color)\s*:/g,
  margin: /margin\s*:/g,
  marginIndividual: /margin(Top|Right|Bottom|Left)\s*:/g,
  padding: /padding\s*:/g,
  paddingIndividual: /padding(Top|Right|Bottom|Left)\s*:/g,
};

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const conflicts = [];

  // Check for border conflicts
  if (conflictPatterns.border.test(content) && conflictPatterns.borderIndividual.test(content)) {
    conflicts.push('border shorthand mixed with individual border properties');
  }

  // Check for margin conflicts
  if (conflictPatterns.margin.test(content) && conflictPatterns.marginIndividual.test(content)) {
    conflicts.push('margin shorthand mixed with individual margin properties');
  }

  // Check for padding conflicts
  if (conflictPatterns.padding.test(content) && conflictPatterns.paddingIndividual.test(content)) {
    conflicts.push('padding shorthand mixed with individual padding properties');
  }

  return conflicts;
}

function scanDirectory(directory) {
  const files = glob.sync(`${directory}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*']
  });

  const results = [];

  files.forEach(file => {
    const conflicts = checkFile(file);
    if (conflicts.length > 0) {
      results.push({
        file: path.relative(process.cwd(), file),
        conflicts
      });
    }
  });

  return results;
}

// Run the scan
const results = scanDirectory('apps/frontend/src');

if (results.length > 0) {
  console.log('🚨 CSS Property Conflicts Found:');
  results.forEach(({ file, conflicts }) => {
    console.log(`\n📁 ${file}`);
    conflicts.forEach(conflict => {
      console.log(`  ⚠️  ${conflict}`);
    });
  });
  process.exit(1);
} else {
  console.log('✅ No CSS property conflicts found!');
}
```

## Implementation Steps

### 1. Add Custom ESLint Rule
```bash
# Create the custom rule directory
mkdir -p .eslint/rules

# Copy the custom rule file (from above)
# Add to your ESLint config
```

### 2. Update ESLint Configuration
```json
// apps/frontend/.eslintrc.json
{
  "extends": ["eslint:recommended", "@typescript-eslint/recommended"],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "no-css-property-conflicts": "error"
  },
  "settings": {
    "import/resolver": {
      "typescript": {}
    }
  }
}
```

### 3. Add to Package Scripts
```json
// package.json
{
  "scripts": {
    "lint:css-conflicts": "node scripts/check-css-conflicts.js",
    "lint:styles": "stylelint 'apps/frontend/src/**/*.{ts,tsx}'",
    "lint:all": "npm run lint && npm run lint:css-conflicts && npm run lint:styles"
  }
}
```

### 4. CI/CD Integration
```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint:all
      - run: npm run lint:css-conflicts
```

## Troubleshooting

### Common Issues

1. **False Positives**: The linting rules might flag legitimate use cases
   - Solution: Add ESLint disable comments for specific cases
   - Example: `// eslint-disable-next-line no-css-property-conflicts`

2. **Performance Impact**: Complex regex patterns might slow down linting
   - Solution: Optimize patterns or run checks only on changed files

3. **TypeScript Conflicts**: Type definitions might be too restrictive
   - Solution: Use union types or optional properties where appropriate

### Debugging Tips

```typescript
// Add this helper to debug style objects
export const debugStyles = (styles: Record<string, any>, componentName: string) => {
  if (process.env.NODE_ENV === 'development') {
    const conflicts = detectConflicts(styles);
    if (conflicts.length > 0) {
      console.warn(`Style conflicts in ${componentName}:`, conflicts);
    }
  }
  return styles;
};

function detectConflicts(styles: Record<string, any>): string[] {
  const conflicts: string[] = [];
  const keys = Object.keys(styles);
  
  if (keys.includes('border') && keys.some(k => k.startsWith('border') && k !== 'border')) {
    conflicts.push('border shorthand conflicts with individual border properties');
  }
  
  // Add more conflict detection logic...
  
  return conflicts;
}
```

---

*This configuration should be implemented gradually, starting with the most critical components and expanding to the entire codebase.*