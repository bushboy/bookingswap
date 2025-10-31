import React from 'react';
import { NavLink } from 'react-router-dom';
import { Logo } from '@/components/common';
import { useAppSelector } from '@/store/hooks';
import { tokens } from '@/design-system/tokens';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  public?: boolean; // Whether the item is accessible to unauthenticated users
}

// All navigation items with their access levels
const allNavItems: NavItem[] = [
  {
    to: '/browse',
    label: 'Browse Swaps',
    public: true, // Available to all users
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: '/bookings',
    label: 'My Bookings',
    public: false, // Protected route - authenticated users only
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: '/swaps',
    label: 'My Swaps',
    public: false, // Protected route - authenticated users only
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

// Function to get navigation items based on authentication status
const getNavigationItems = (isAuthenticated: boolean): NavItem[] => {
  if (!isAuthenticated) {
    // For unauthenticated users, only show public items (Browse Swaps)
    // Hide protected route links (/bookings, /swaps) from unauthenticated users
    return allNavItems.filter(item => item.public === true);
  }

  // For authenticated users, show all items including protected routes
  return allNavItems;
};

interface SidebarProps {
  isAuthenticated: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isAuthenticated }) => {
  const sidebarOpen = useAppSelector(state => state.ui.sidebarOpen);
  const navigationItems = getNavigationItems(isAuthenticated);

  const sidebarStyles = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    height: '100vh',
    width: '256px',
    backgroundColor: 'white',
    borderRight: `1px solid ${tokens.colors.neutral[200]}`,
    transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.3s ease-in-out',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column' as const,
  };

  const headerStyles = {
    padding: tokens.spacing[6],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const logoStyles = {
    display: 'flex',
    justifyContent: 'center',
  };

  const navStyles = {
    flex: 1,
    padding: tokens.spacing[4],
  };

  const navItemStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    borderRadius: tokens.borderRadius.md,
    textDecoration: 'none',
    color: tokens.colors.neutral[700],
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    transition: 'all 0.2s ease-in-out',
    marginBottom: tokens.spacing[1],
  };

  const activeNavItemStyles = {
    backgroundColor: tokens.colors.primary[100],
    color: tokens.colors.primary[700],
  };

  const hoverNavItemStyles = {
    backgroundColor: tokens.colors.neutral[100],
  };

  return (
    <aside style={sidebarStyles}>
      <div style={headerStyles}>
        <div style={logoStyles}>
          <Logo variant="light" size="lg" />
        </div>
      </div>

      <nav style={navStyles}>
        {navigationItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              ...navItemStyles,
              ...(isActive ? activeNavItemStyles : {}),
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('active')) {
                Object.assign(e.currentTarget.style, hoverNavItemStyles);
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
