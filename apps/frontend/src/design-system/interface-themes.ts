import { tokens } from './tokens';

// Interface theme types
export interface InterfaceTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  spacing: typeof tokens.spacing;
  typography: {
    fontFamily: string;
    fontSize: typeof tokens.fontSize;
    fontWeight: typeof tokens.fontWeight;
  };
}

// Breadcrumb item type
export interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}

// Default theme
const defaultTheme: InterfaceTheme = {
  name: 'default',
  colors: {
    primary: tokens.colors.blue[600],
    secondary: tokens.colors.gray[600],
    accent: tokens.colors.purple[600],
    background: tokens.colors.white,
    surface: tokens.colors.gray[50],
    text: tokens.colors.gray[900],
    textSecondary: tokens.colors.gray[600],
    border: tokens.colors.gray[200],
  },
  spacing: tokens.spacing,
  typography: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: tokens.fontSize,
    fontWeight: tokens.fontWeight,
  },
};

// Booking theme
export const bookingTheme: InterfaceTheme = {
  ...defaultTheme,
  name: 'booking',
  colors: {
    ...defaultTheme.colors,
    primary: tokens.colors.green[600],
    accent: tokens.colors.green[500],
  },
};

// Swap theme
export const swapTheme: InterfaceTheme = {
  ...defaultTheme,
  name: 'swap',
  colors: {
    ...defaultTheme.colors,
    primary: tokens.colors.blue[600],
    accent: tokens.colors.blue[500],
  },
};

// Contextual help content
export const contextualHelp = {
  booking: {
    title: 'Booking Help',
    icon: '📋',
    content: [
      'Get help with managing your bookings and creating swap opportunities.',
      'View and edit your booking details',
      'Set up swap preferences for your bookings',
      'Track booking status and confirmations'
    ],
  },
  swap: {
    title: 'Swap Help',
    icon: '🔄',
    content: [
      'Learn how to create and manage swap proposals with other users.',
      'Browse available swaps and make proposals',
      'Review incoming swap requests',
      'Track swap status and communications',
      'View targeting relationships and manage targeting preferences'
    ],
  },
  targeting: {
    title: 'Targeting Help',
    icon: '🎯',
    content: [
      'Understand how to target specific swaps and manage targeting preferences.',
      'Target swaps that match your preferences',
      'View who is targeting your swaps',
      'Manage targeting restrictions and settings'
    ],
  },
};

// Breadcrumb helpers
export const getBreadcrumbs = (path: string): BreadcrumbItem[] => {
  const segments = path.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' },
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isActive = index === segments.length - 1;

    // Convert segment to readable label
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    breadcrumbs.push({
      label,
      href: isActive ? undefined : currentPath,
      isActive,
    });
  });

  return breadcrumbs;
};

// Theme style helpers
export const getThemeStyles = (theme: InterfaceTheme) => ({
  container: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily,
  },
  surface: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: tokens.borderRadius.md,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    color: tokens.colors.white,
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
    color: tokens.colors.white,
  },
  text: {
    color: theme.colors.text,
  },
  textSecondary: {
    color: theme.colors.textSecondary,
  },
});

export default defaultTheme;