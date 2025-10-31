import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';

export const NotFoundPage: React.FC = () => {
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center' as const,
    padding: tokens.spacing[6],
  };

  const errorCodeStyles = {
    fontSize: '8rem',
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary[600],
    lineHeight: '1',
    marginBottom: tokens.spacing[4],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize['3xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[4],
  };

  const descriptionStyles = {
    fontSize: tokens.typography.fontSize.lg,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[8],
    maxWidth: '500px',
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[4],
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  };

  return (
    <div style={containerStyles}>
      <div style={errorCodeStyles}>404</div>
      <h1 style={titleStyles}>Page Not Found</h1>
      <p style={descriptionStyles}>
        Sorry, we couldn't find the page you're looking for. It might have been
        moved, deleted, or you entered the wrong URL.
      </p>
      <div style={actionsStyles}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="lg">
            Go Home
          </Button>
        </Link>
        <Link to="/bookings" style={{ textDecoration: 'none' }}>
          <Button variant="outline" size="lg">
            Browse Swaps
          </Button>
        </Link>
      </div>
    </div>
  );
};
