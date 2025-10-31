import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { WalletConnectButton } from '@/components/wallet';
import { tokens } from '@/design-system/tokens';

interface HeaderProps {
  isAuthenticated: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isAuthenticated }) => {
  const { user } = useAuth();
  const { logout: logoutAll } = useWalletAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logoutAll();
    navigate('/login');
  };

  const headerStyles = {
    backgroundColor: 'white',
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    padding: `${tokens.spacing[4]} 0`,
    position: 'sticky' as const,
    top: 0,
    zIndex: 1101, // Above modal overlay (z-index: 1000)
  };

  const containerStyles = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: `0 ${tokens.spacing[4]}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const logoStyles = {
    textDecoration: 'none',
  };

  const navStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[6],
  };

  const navLinkStyles = {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[700],
    textDecoration: 'none',
    fontWeight: tokens.typography.fontWeight.medium,
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    borderRadius: tokens.borderRadius.md,
    transition: 'background-color 0.2s ease',
  };

  const userMenuStyles = {
    position: 'relative' as const,
  };

  const userButtonStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    backgroundColor: tokens.colors.neutral[100],
    border: 'none',
    borderRadius: tokens.borderRadius.md,
    cursor: 'pointer',
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[700],
  };

  const dropdownStyles = {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: tokens.spacing[1],
    backgroundColor: 'white',
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.md,
    boxShadow: tokens.shadows.lg,
    minWidth: '200px',
    zIndex: 10,
  };

  const dropdownItemStyles = {
    display: 'block',
    width: '100%',
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[700],
    textAlign: 'left' as const,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textDecoration: 'none',
  };

  // Close any open user menu when the route changes to avoid overlay blocking new page
  useEffect(() => {
    if (showUserMenu) {
      setShowUserMenu(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Render header for unauthenticated users with login/register buttons
  if (!isAuthenticated) {
    return (
      <header style={headerStyles}>
        <div style={containerStyles}>
          <Link to="/" style={logoStyles}>
            <Logo variant="light" size="md" />
          </Link>
          <div style={navStyles}>
            <Link to="/login">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" size="sm">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // Render header for authenticated users with user menu and logout option
  return (
    <header style={headerStyles}>
      <div style={containerStyles}>
        <Link to="/browse" style={logoStyles}>
          <Logo variant="light" size="md" />
        </Link>

        <nav style={navStyles}>
          <Link
            to="/browse"
            style={navLinkStyles}
            onClick={() => setShowUserMenu(false)}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor =
                tokens.colors.neutral[100];
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Browse Swaps
          </Link>
          <Link
            to="/bookings"
            style={navLinkStyles}
            onClick={() => setShowUserMenu(false)}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor =
                tokens.colors.neutral[100];
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            My Bookings
          </Link>
          <Link
            to="/swaps"
            style={navLinkStyles}
            onClick={() => setShowUserMenu(false)}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor =
                tokens.colors.neutral[100];
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            My Swaps
          </Link>

          {/* Wallet Connect Button */}
          <WalletConnectButton
            variant="outline"
            size="sm"
            showBalance={true}
            style={{ marginLeft: tokens.spacing[4] }}
          />
        </nav>

        <div style={userMenuStyles}>
          <button
            style={userButtonStyles}
            onClick={() => setShowUserMenu(!showUserMenu)}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor =
                tokens.colors.neutral[200];
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor =
                tokens.colors.neutral[100];
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: tokens.colors.primary[600],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.bold,
              }}
            >
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <span>{user?.username}</span>
            <span style={{ fontSize: '12px' }}>▼</span>
          </button>

          {showUserMenu && (
            <div style={dropdownStyles}>
              <div
                style={{
                  ...dropdownItemStyles,
                  borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
                  color: tokens.colors.neutral[500],
                  cursor: 'default',
                }}
              >
                <div
                  style={{ fontWeight: tokens.typography.fontWeight.medium }}
                >
                  {user?.username}
                </div>
                <div style={{ fontSize: tokens.typography.fontSize.xs }}>
                  {user?.email}
                </div>
              </div>

              <Link
                to="/profile"
                style={dropdownItemStyles}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor =
                    tokens.colors.neutral[50];
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => setShowUserMenu(false)}
              >
                Profile Settings
              </Link>

              <button
                style={dropdownItemStyles}
                onClick={handleLogout}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor =
                    tokens.colors.neutral[50];
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5,
          }}
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};
