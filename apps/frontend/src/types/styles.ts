/**
 * Type-safe CSS style definitions to prevent property conflicts
 * 
 * These types ensure that shorthand and individual CSS properties
 * are not mixed in the same style object, preventing React warnings
 * and ensuring consistent styling behavior.
 */

// Border style types
export type BorderShorthand = {
  border: string;
  borderTop?: never;
  borderRight?: never;
  borderBottom?: never;
  borderLeft?: never;
  borderWidth?: never;
  borderStyle?: never;
  borderColor?: never;
  borderTopWidth?: never;
  borderRightWidth?: never;
  borderBottomWidth?: never;
  borderLeftWidth?: never;
  borderTopStyle?: never;
  borderRightStyle?: never;
  borderBottomStyle?: never;
  borderLeftStyle?: never;
  borderTopColor?: never;
  borderRightColor?: never;
  borderBottomColor?: never;
  borderLeftColor?: never;
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
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  borderTopStyle?: string;
  borderRightStyle?: string;
  borderBottomStyle?: string;
  borderLeftStyle?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
};

export type BorderStyles = BorderShorthand | BorderIndividual;

// Margin style types
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

// Padding style types
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

// Font style types
export type FontShorthand = {
  font: string;
  fontSize?: never;
  fontWeight?: never;
  fontFamily?: never;
  fontStyle?: never;
  fontVariant?: never;
  lineHeight?: never;
};

export type FontIndividual = {
  font?: never;
  fontSize?: string;
  fontWeight?: string | number;
  fontFamily?: string;
  fontStyle?: string;
  fontVariant?: string;
  lineHeight?: string | number;
};

export type FontStyles = FontShorthand | FontIndividual;

// Background style types
export type BackgroundShorthand = {
  background: string;
  backgroundColor?: never;
  backgroundImage?: never;
  backgroundRepeat?: never;
  backgroundPosition?: never;
  backgroundSize?: never;
  backgroundAttachment?: never;
  backgroundClip?: never;
  backgroundOrigin?: never;
};

export type BackgroundIndividual = {
  background?: never;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
  backgroundSize?: string;
  backgroundAttachment?: string;
  backgroundClip?: string;
  backgroundOrigin?: string;
};

export type BackgroundStyles = BackgroundShorthand | BackgroundIndividual;

// Combined safe styles type
export type SafeStyles = BorderStyles &
  MarginStyles &
  PaddingStyles &
  FontStyles &
  BackgroundStyles & {
    // Other safe CSS properties that don't have shorthand conflicts
    color?: string;
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
    overflowX?: string;
    overflowY?: string;
    textAlign?: string;
    textDecoration?: string;
    textTransform?: string;
    verticalAlign?: string;
    whiteSpace?: string;
    wordBreak?: string;
    wordWrap?: string;
    zIndex?: number;
    opacity?: number;
    visibility?: string;
    cursor?: string;
    pointerEvents?: string;
    userSelect?: string;
    transition?: string;
    transform?: string;
    transformOrigin?: string;
    filter?: string;
    backdropFilter?: string;
    outline?: string;
    outlineOffset?: string;
    resize?: string;
    boxSizing?: string;
    float?: string;
    clear?: string;
    content?: string;
    listStyle?: string;
    listStyleType?: string;
    listStylePosition?: string;
    listStyleImage?: string;
    tableLayout?: string;
    borderCollapse?: string;
    borderSpacing?: string;
    captionSide?: string;
    emptyCells?: string;
    quotes?: string;
    counterReset?: string;
    counterIncrement?: string;
    direction?: string;
    unicodeBidi?: string;
    writingMode?: string;
    textOrientation?: string;
    mixBlendMode?: string;
    isolation?: string;
    objectFit?: string;
    objectPosition?: string;
    imageRendering?: string;
    clipPath?: string;
    mask?: string;
    maskImage?: string;
    maskSize?: string;
    maskRepeat?: string;
    maskPosition?: string;
    maskClip?: string;
    maskOrigin?: string;
    maskComposite?: string;
    maskMode?: string;
    willChange?: string;
    contain?: string;
    touchAction?: string;
    scrollBehavior?: string;
    scrollSnapType?: string;
    scrollSnapAlign?: string;
    scrollSnapStop?: string;
    overscrollBehavior?: string;
    overscrollBehaviorX?: string;
    overscrollBehaviorY?: string;
  };

// Utility type for React style props
export type ReactStyleProps = {
  style?: SafeStyles;
  className?: string;
};

// Helper function to validate styles at runtime (development only)
export const validateStyles = (styles: Record<string, any>, componentName?: string): SafeStyles => {
  if (import.meta.env.DEV) {
    const conflicts = detectConflicts(styles);
    if (conflicts.length > 0) {
      const component = componentName ? ` in ${componentName}` : '';
      console.warn(`CSS property conflicts detected${component}:`, conflicts);
      console.warn('Style object:', styles);
    }
  }
  return styles as SafeStyles;
};

// Runtime conflict detection for development
function detectConflicts(styles: Record<string, any>): string[] {
  const conflicts: string[] = [];
  const keys = Object.keys(styles);

  // Check border conflicts
  if (keys.includes('border')) {
    const borderConflicts = keys.filter(k =>
      k.startsWith('border') && k !== 'border' && k !== 'borderRadius'
    );
    if (borderConflicts.length > 0) {
      conflicts.push(`border shorthand conflicts with: ${borderConflicts.join(', ')}`);
    }
  }

  // Check margin conflicts
  if (keys.includes('margin')) {
    const marginConflicts = keys.filter(k =>
      k.startsWith('margin') && k !== 'margin'
    );
    if (marginConflicts.length > 0) {
      conflicts.push(`margin shorthand conflicts with: ${marginConflicts.join(', ')}`);
    }
  }

  // Check padding conflicts
  if (keys.includes('padding')) {
    const paddingConflicts = keys.filter(k =>
      k.startsWith('padding') && k !== 'padding'
    );
    if (paddingConflicts.length > 0) {
      conflicts.push(`padding shorthand conflicts with: ${paddingConflicts.join(', ')}`);
    }
  }

  // Check font conflicts
  if (keys.includes('font')) {
    const fontConflicts = keys.filter(k =>
      k.startsWith('font') && k !== 'font'
    );
    if (fontConflicts.length > 0) {
      conflicts.push(`font shorthand conflicts with: ${fontConflicts.join(', ')}`);
    }
  }

  // Check background conflicts
  if (keys.includes('background')) {
    const backgroundConflicts = keys.filter(k =>
      k.startsWith('background') && k !== 'background'
    );
    if (backgroundConflicts.length > 0) {
      conflicts.push(`background shorthand conflicts with: ${backgroundConflicts.join(', ')}`);
    }
  }

  return conflicts;
}

// Style composition helpers
export const createBorderStyles = (
  color: string,
  width: string = '1px',
  style: string = 'solid'
): BorderShorthand => ({
  border: `${width} ${style} ${color}`,
});

export const createSpacingStyles = (
  padding?: string,
  margin?: string
): Partial<SafeStyles> => ({
  ...(padding && { padding }),
  ...(margin && { margin }),
});

export const createTypographyStyles = (
  fontSize?: string,
  fontWeight?: string | number,
  fontFamily?: string
): FontIndividual => ({
  ...(fontSize && { fontSize }),
  ...(fontWeight && { fontWeight }),
  ...(fontFamily && { fontFamily }),
});

// Common style patterns
export const commonStyles = {
  // Card styles
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    padding: '16px',
  } as SafeStyles,

  // Button base styles
  buttonBase: {
    border: '1px solid transparent',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  } as SafeStyles,

  // Input base styles
  inputBase: {
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    transition: 'border-color 0.2s ease-in-out',
  } as SafeStyles,
} as const;