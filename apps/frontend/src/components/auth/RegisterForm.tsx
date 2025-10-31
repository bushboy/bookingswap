import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/design-system/tokens';

interface LoginRedirectState {
  from?: {
    pathname: string;
    search?: string;
    hash?: string;
  };
  action?: string;
  context?: any;
}

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract redirect information from location state
  const redirectState = location.state as LoginRedirectState | null;

  // Determine where to redirect after successful registration
  const getRedirectPath = (): string => {
    // If there's a specific return path from ProtectedRoute or Browse page
    if (redirectState?.from?.pathname) {
      const { pathname, search = '', hash = '' } = redirectState.from;

      // Handle special cases for proposal creation from browse page
      if (redirectState.action === 'make-proposal' && redirectState.context?.swapId) {
        // Redirect to browse page with proposal modal state
        return `/browse?openProposal=${redirectState.context.swapId}${search}${hash}`;
      }

      // For other protected routes, redirect to the original destination
      return `${pathname}${search}${hash}`;
    }

    // Default to /browse for users without a specific return path
    return '/browse';
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.displayName && formData.displayName.length > 100) {
      newErrors.displayName = 'Display name must be less than 100 characters';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 50) {
      newErrors.username = 'Username must be less than 50 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username =
        'Username can only contain letters, numbers, hyphens, and underscores';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (formData.password.length > 100) {
      newErrors.password = 'Password must be less than 100 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await register(
        formData.username,
        formData.email,
        formData.password,
        formData.displayName || undefined
      );

      // Redirect to the intended destination or default to /browse
      const redirectPath = getRedirectPath();
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setErrors({
        submit:
          error instanceof Error
            ? error.message
            : 'Registration failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Clear confirm password error if passwords now match
    if (
      field === 'password' &&
      formData.confirmPassword &&
      value === formData.confirmPassword
    ) {
      setErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
    if (
      field === 'confirmPassword' &&
      formData.password &&
      value === formData.password
    ) {
      setErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  const containerStyles = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.neutral[50],
    padding: tokens.spacing[4],
  };

  const cardStyles = {
    width: '100%',
    maxWidth: '400px',
  };

  const headerStyles = {
    textAlign: 'center' as const,
    marginBottom: tokens.spacing[6],
  };

  const titleStyles = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[2],
  };

  const subtitleStyles = {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[600],
  };

  const formStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacing[4],
  };

  const linkStyles = {
    textAlign: 'center' as const,
    marginTop: tokens.spacing[4],
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  const linkButtonStyles = {
    color: tokens.colors.primary[600],
    textDecoration: 'none',
    fontWeight: tokens.typography.fontWeight.medium,
  };

  return (
    <div style={containerStyles}>
      <Card variant="elevated" style={cardStyles}>
        <CardContent>
          <div style={headerStyles}>
            <h1 style={titleStyles}>Create Account</h1>
            <p style={subtitleStyles}>
              Sign up to start swapping your bookings
            </p>
          </div>

          {errors.submit && (
            <div
              style={{
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.error[50],
                border: `1px solid ${tokens.colors.error[200]}`,
                borderRadius: tokens.borderRadius.md,
                marginBottom: tokens.spacing[4],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[700],
              }}
            >
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} style={formStyles}>
            <Input
              label="Display Name"
              type="text"
              value={formData.displayName}
              onChange={e => handleInputChange('displayName', e.target.value)}
              error={errors.displayName}
              placeholder="Enter your display name (optional)"
              autoComplete="name"
              helperText="This is how other users will see you. If not provided, your username will be used."
            />

            <Input
              label="Username"
              type="text"
              value={formData.username}
              onChange={e => handleInputChange('username', e.target.value)}
              error={errors.username}
              placeholder="Choose a username"
              required
              autoComplete="username"
            />

            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              error={errors.email}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={e => handleInputChange('password', e.target.value)}
              error={errors.password}
              placeholder="Create a password"
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={e =>
                handleInputChange('confirmPassword', e.target.value)
              }
              error={errors.confirmPassword}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting || isLoading}
              disabled={isSubmitting || isLoading}
              style={{ marginTop: tokens.spacing[2] }}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div style={linkStyles}>
            Already have an account?{' '}
            <Link
              to="/login"
              state={redirectState}
              style={linkButtonStyles}
            >
              Sign in here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
