import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Mail, ArrowLeft } from 'lucide-react';
import { AuthErrorDisplay, AuthSuccessDisplay, AuthError } from './AuthErrorDisplay';
import { AuthButtonLoading, AuthLoadingState } from './AuthLoadingState';
import { tokens } from '@/design-system/tokens';

interface PasswordResetRequestProps {
  onBack?: () => void;
  onSuccess?: (email: string) => void;
}

export const PasswordResetRequest: React.FC<PasswordResetRequestProps> = ({
  onBack,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Email validation
  const validateEmail = (email: string): string | null => {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return null;
  };

  const handleFieldTouch = (fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Mark email field as touched
    setTouchedFields(new Set(['email']));

    // Validate email
    const emailError = validateEmail(email);
    if (emailError) {
      setError({
        type: 'validation',
        message: emailError,
        retryable: false,
      });
      setIsLoading(false);
      return;
    }

    try {
      const resetBaseUrl = `${window.location.origin}/auth/reset-password`;
      
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          resetBaseUrl,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
        setError(null);
        onSuccess?.(email);
      } else {
        // Handle different types of server errors
        let errorType: AuthError['type'] = 'server';
        if (response.status === 429) {
          errorType = 'rate_limit';
        } else if (response.status === 400) {
          errorType = 'validation';
        }

        setError({
          type: errorType,
          message: data.error?.message || 'Failed to send password reset email.',
          code: data.error?.code,
          retryable: errorType === 'server' || errorType === 'network',
        });
      }
    } catch (networkError) {
      setError({
        type: 'network',
        message: 'Network error. Please check your connection and try again.',
        retryable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleSubmit(new Event('submit') as any);
  };

  const emailError = touchedFields.has('email') ? validateEmail(email) : null;
  const canSubmit = email && !emailError && !isLoading;

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Check Your Email</CardTitle>
          <CardDescription className="text-center">
            We've sent a password reset link to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthSuccessDisplay
            message={`Password reset link sent to ${email}`}
            details="Please check your email and click the link to reset your password. The link will expire in 1 hour."
          />
          
          <div className="mt-6 space-y-3">
            <Button
              onClick={() => {
                setIsSuccess(false);
                setEmail('');
                setTouchedFields(new Set());
              }}
              variant="outline"
              style={{ width: '100%' }}
            >
              Send Another Link
            </Button>
            
            {onBack && (
              <Button
                onClick={onBack}
                variant="ghost"
                style={{ width: '100%' }}
              >
                Back to Login
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-1"
              aria-label="Go back to login"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <CardTitle className="text-2xl">Reset Password</CardTitle>
        </div>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label 
              htmlFor="email" 
              className="text-sm font-medium"
              style={{ color: tokens.colors.neutral[700] }}
            >
              Email Address <span style={{ color: tokens.colors.error[500] }}>*</span>
            </label>
            <div className="relative">
              <Mail 
                className="absolute left-3 top-3 h-4 w-4" 
                style={{ color: tokens.colors.neutral[400] }}
                aria-hidden="true"
              />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleFieldTouch('email')}
                className="pl-10"
                required
                disabled={isLoading}
                aria-describedby="email-error"
                aria-invalid={!!emailError}
                autoComplete="email"
                style={{
                  borderColor: emailError 
                    ? tokens.colors.error[400] 
                    : undefined
                }}
              />
            </div>
            
            {/* Email Validation Error */}
            {emailError && (
              <div 
                id="email-error"
                role="alert"
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.error[600],
                  display: 'flex',
                  alignItems: 'center',
                  gap: tokens.spacing[2],
                  marginTop: tokens.spacing[1],
                }}
              >
                <span aria-hidden="true">❌</span>
                {emailError}
              </div>
            )}
          </div>

          {/* Error Display */}
          <AuthErrorDisplay
            error={error}
            onRetry={error?.retryable ? handleRetry : undefined}
            onDismiss={() => setError(null)}
          />

          {/* Submit Button */}
          <AuthButtonLoading
            type="submit"
            isLoading={isLoading}
            disabled={!canSubmit}
            loadingText="Sending Reset Link..."
            variant="primary"
            style={{ marginTop: tokens.spacing[6] }}
          >
            Send Reset Link
          </AuthButtonLoading>

          {/* Accessibility Info */}
          <div className="sr-only" aria-live="polite">
            {isLoading && "Sending password reset email, please wait."}
            {error && `Error: ${error.message}`}
            {emailError && `Validation error: ${emailError}`}
          </div>
        </form>

        <div className="mt-6 text-center">
          <p style={{ 
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
          }}>
            Remember your password?{' '}
            <button
              onClick={onBack}
              style={{
                color: tokens.colors.primary[600],
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: tokens.typography.fontWeight.medium,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = tokens.colors.primary[700];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = tokens.colors.primary[600];
              }}
            >
              Back to Login
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};