import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { PasswordStrengthValidator } from './PasswordStrengthValidator';
import { AuthErrorDisplay, AuthSuccessDisplay, AuthError } from './AuthErrorDisplay';
import { AuthLoadingState, AuthButtonLoading, AuthStepIndicator } from './AuthLoadingState';
import { tokens } from '@/design-system/tokens';

interface PasswordResetProps {
  token?: string;
  onSuccess?: () => void;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({
  token: propToken,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = propToken || searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError({
          type: 'authentication',
          message: 'Invalid reset link. Please request a new password reset.',
          retryable: false,
        });
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/validate-reset-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok && data.valid) {
          setIsValidToken(true);
          setError(null);
        } else {
          setError({
            type: 'authentication',
            message: 'This reset link is invalid or has expired.',
            details: ['The link may have been used already', 'The link may have expired (links are valid for 1 hour)'],
            retryable: false,
          });
        }
      } catch (networkError) {
        setError({
          type: 'network',
          message: 'Failed to validate reset link.',
          retryable: true,
        });
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Handle field touch events for better UX
  const handleFieldTouch = (fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName));
  };

  // Handle password strength changes
  const handlePasswordStrengthChange = (strength: number, isValid: boolean) => {
    setPasswordStrength(strength);
    setIsPasswordValid(isValid);
  };

  // Validate passwords match
  const getPasswordMatchError = (): string | null => {
    if (!touchedFields.has('confirmPassword') || !confirmPassword) return null;
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Mark all fields as touched for validation display
    setTouchedFields(new Set(['password', 'confirmPassword']));

    // Validate passwords match
    if (password !== confirmPassword) {
      setError({
        type: 'validation',
        message: 'Passwords do not match.',
        retryable: false,
      });
      setIsLoading(false);
      return;
    }

    // Validate password strength
    if (!isPasswordValid) {
      setError({
        type: 'validation',
        message: 'Password does not meet security requirements.',
        details: ['Please ensure your password meets all the requirements listed below'],
        retryable: false,
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
        setError(null);
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          onSuccess?.();
          navigate('/auth/login');
        }, 3000);
      } else {
        // Handle different types of server errors
        let errorType: AuthError['type'] = 'server';
        if (response.status === 429) {
          errorType = 'rate_limit';
        } else if (response.status === 400) {
          errorType = 'validation';
        } else if (response.status === 401 || response.status === 403) {
          errorType = 'authentication';
        }

        setError({
          type: errorType,
          message: data.error?.message || 'Failed to reset password.',
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
    if (error?.type === 'network' && !isValidToken) {
      // Retry token validation
      setIsValidating(true);
      window.location.reload();
    }
  };

  if (isValidating) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <AuthStepIndicator
            steps={[
              { id: 'validate', label: 'Validating Link', status: 'current' },
              { id: 'reset', label: 'Reset Password', status: 'pending' },
              { id: 'complete', label: 'Complete', status: 'pending' },
            ]}
          />
          <AuthLoadingState
            isLoading={true}
            loadingMessage="Validating reset link..."
            size="md"
          />
        </CardContent>
      </Card>
    );
  }

  if (!isValidToken) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Invalid Reset Link</CardTitle>
        </CardHeader>
        <CardContent>
          <AuthStepIndicator
            steps={[
              { id: 'validate', label: 'Validating Link', status: 'error' },
              { id: 'reset', label: 'Reset Password', status: 'pending' },
              { id: 'complete', label: 'Complete', status: 'pending' },
            ]}
          />
          
          <AuthErrorDisplay
            error={error}
            onRetry={error?.retryable ? handleRetry : undefined}
          />
          
          <div className="mt-4 text-center">
            <Button
              onClick={() => navigate('/auth/forgot-password')}
              variant="outline"
              style={{ width: '100%' }}
            >
              Request New Reset Link
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <AuthStepIndicator
            steps={[
              { id: 'validate', label: 'Validating Link', status: 'completed' },
              { id: 'reset', label: 'Reset Password', status: 'completed' },
              { id: 'complete', label: 'Complete', status: 'completed' },
            ]}
          />
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <CardTitle className="text-2xl">Password Reset Successful</CardTitle>
          <CardDescription>
            Your password has been reset successfully. You will be redirected to the login page shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthSuccessDisplay
            message="Your password has been reset successfully!"
            details="You will be redirected to the login page in a few seconds."
            onAction={() => navigate('/auth/login')}
            actionLabel="Go to Login Now"
          />
        </CardContent>
      </Card>
    );
  }

  const passwordMatchError = getPasswordMatchError();
  const canSubmit = password && confirmPassword && isPasswordValid && !passwordMatchError && !isLoading;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <AuthStepIndicator
          steps={[
            { id: 'validate', label: 'Validating Link', status: 'completed' },
            { id: 'reset', label: 'Reset Password', status: 'current' },
            { id: 'complete', label: 'Complete', status: 'pending' },
          ]}
        />
        <CardTitle className="text-2xl">Set New Password</CardTitle>
        <CardDescription>
          Enter your new password below. Make sure it's strong and secure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Password Field */}
          <div className="space-y-2">
            <label 
              htmlFor="password" 
              className="text-sm font-medium"
              style={{ color: tokens.colors.neutral[700] }}
            >
              New Password <span style={{ color: tokens.colors.error[500] }}>*</span>
            </label>
            <div className="relative">
              <Lock 
                className="absolute left-3 top-3 h-4 w-4" 
                style={{ color: tokens.colors.neutral[400] }}
                aria-hidden="true"
              />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleFieldTouch('password')}
                className="pl-10 pr-10"
                required
                disabled={isLoading}
                aria-describedby="password-requirements password-error"
                aria-invalid={touchedFields.has('password') && !isPasswordValid}
                autoComplete="new-password"
                style={{
                  borderColor: touchedFields.has('password') && !isPasswordValid 
                    ? tokens.colors.error[400] 
                    : undefined
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3"
                style={{ 
                  color: tokens.colors.neutral[400],
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Password Strength Validator */}
          {password && (
            <PasswordStrengthValidator
              password={password}
              onStrengthChange={handlePasswordStrengthChange}
              showProgress={true}
            />
          )}

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <label 
              htmlFor="confirmPassword" 
              className="text-sm font-medium"
              style={{ color: tokens.colors.neutral[700] }}
            >
              Confirm New Password <span style={{ color: tokens.colors.error[500] }}>*</span>
            </label>
            <div className="relative">
              <Lock 
                className="absolute left-3 top-3 h-4 w-4" 
                style={{ color: tokens.colors.neutral[400] }}
                aria-hidden="true"
              />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleFieldTouch('confirmPassword')}
                className="pl-10 pr-10"
                required
                disabled={isLoading}
                aria-describedby="confirm-password-error"
                aria-invalid={!!passwordMatchError}
                autoComplete="new-password"
                style={{
                  borderColor: passwordMatchError 
                    ? tokens.colors.error[400] 
                    : undefined
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3"
                style={{ 
                  color: tokens.colors.neutral[400],
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                tabIndex={0}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Password Match Error */}
            {passwordMatchError && (
              <div 
                id="confirm-password-error"
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
                {passwordMatchError}
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
            loadingText="Resetting Password..."
            variant="primary"
            style={{ marginTop: tokens.spacing[6] }}
          >
            Reset Password
          </AuthButtonLoading>

          {/* Accessibility Info */}
          <div className="sr-only" aria-live="polite">
            {isLoading && "Password reset in progress, please wait."}
            {error && `Error: ${error.message}`}
            {passwordMatchError && `Validation error: ${passwordMatchError}`}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};