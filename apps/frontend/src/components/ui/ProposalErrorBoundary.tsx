import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { tokens } from '../../design-system/tokens';
import { shouldShowErrorBoundary, getErrorBoundaryMessage } from '../../utils/errorHandling';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: 'proposal-modal' | 'form' | 'api' | 'general';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ProposalErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: shouldShowErrorBoundary(error),
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ProposalErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service
    // reportError(error, { context: this.props.context, ...errorInfo });
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = getErrorBoundaryMessage(this.state.error);
      const canRetry = this.state.retryCount < 3;
      const context = this.props.context || 'general';

      return (
        <div
          style={{
            padding: tokens.spacing[6],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
          }}
        >
          <Card
            variant="outlined"
            style={{
              maxWidth: '500px',
              width: '100%',
              backgroundColor: tokens.colors.error[50],
              borderColor: tokens.colors.error[200],
            }}
          >
            <CardContent style={{ 
              padding: tokens.spacing[6],
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '64px',
                marginBottom: tokens.spacing[4],
              }}>
                {context === 'proposal-modal' ? '📝' : '⚠️'}
              </div>

              <h2 style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.error[800],
                margin: `0 0 ${tokens.spacing[3]} 0`,
              }}>
                {context === 'proposal-modal' 
                  ? 'Proposal System Error' 
                  : 'Something Went Wrong'
                }
              </h2>

              <p style={{
                fontSize: tokens.typography.fontSize.base,
                color: tokens.colors.error[700],
                margin: `0 0 ${tokens.spacing[4]} 0`,
                lineHeight: 1.6,
              }}>
                {errorMessage}
              </p>

              {context === 'proposal-modal' && (
                <div style={{
                  backgroundColor: tokens.colors.primary[50],
                  border: `1px solid ${tokens.colors.primary[200]}`,
                  borderRadius: tokens.borderRadius.md,
                  padding: tokens.spacing[4],
                  marginBottom: tokens.spacing[4],
                }}>
                  <h4 style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.primary[800],
                    margin: `0 0 ${tokens.spacing[2]} 0`,
                  }}>
                    Don't worry - your progress is safe
                  </h4>
                  <p style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.primary[700],
                    margin: 0,
                  }}>
                    Any information you've entered should be preserved when you retry.
                  </p>
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: tokens.spacing[4],
              }}>
                {canRetry && (
                  <Button
                    variant="primary"
                    onClick={this.handleRetry}
                    aria-label={`Retry (attempt ${this.state.retryCount + 1} of 3)`}
                  >
                    Try Again {this.state.retryCount > 0 && `(${this.state.retryCount}/3)`}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={this.handleReload}
                  aria-label="Reload the page"
                >
                  Reload Page
                </Button>

                <Button
                  variant="ghost"
                  onClick={this.handleGoBack}
                  aria-label="Go back to previous page"
                >
                  Go Back
                </Button>
              </div>

              {!canRetry && (
                <div style={{
                  backgroundColor: tokens.colors.warning[50],
                  border: `1px solid ${tokens.colors.warning[200]}`,
                  borderRadius: tokens.borderRadius.md,
                  padding: tokens.spacing[4],
                  marginBottom: tokens.spacing[4],
                }}>
                  <p style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.warning[700],
                    margin: 0,
                  }}>
                    Maximum retry attempts reached. Please reload the page or contact support if the problem persists.
                  </p>
                </div>
              )}

              {/* Technical details for debugging */}
              <details style={{ marginTop: tokens.spacing[4] }}>
                <summary style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                  cursor: 'pointer',
                  marginBottom: tokens.spacing[2],
                }}>
                  Technical Details
                </summary>
                <div style={{
                  backgroundColor: tokens.colors.neutral[100],
                  border: `1px solid ${tokens.colors.neutral[200]}`,
                  borderRadius: tokens.borderRadius.md,
                  padding: tokens.spacing[3],
                  textAlign: 'left',
                }}>
                  <div style={{
                    fontSize: tokens.typography.fontSize.xs,
                    fontFamily: 'monospace',
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}>
                    <strong>Error:</strong> {this.state.error.name}
                  </div>
                  <div style={{
                    fontSize: tokens.typography.fontSize.xs,
                    fontFamily: 'monospace',
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                    wordBreak: 'break-word',
                  }}>
                    <strong>Message:</strong> {this.state.error.message}
                  </div>
                  {this.state.errorInfo && (
                    <div style={{
                      fontSize: tokens.typography.fontSize.xs,
                      fontFamily: 'monospace',
                      color: tokens.colors.neutral[700],
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      <strong>Stack:</strong>
                      <pre style={{
                        margin: `${tokens.spacing[1]} 0 0 0`,
                        padding: tokens.spacing[2],
                        backgroundColor: tokens.colors.neutral[50],
                        borderRadius: tokens.borderRadius.sm,
                        overflow: 'auto',
                        maxHeight: '200px',
                      }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>

              <div style={{
                marginTop: tokens.spacing[4],
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.colors.neutral[500],
              }}>
                Error ID: {Date.now().toString(36)}-{Math.random().toString(36).substr(2, 9)}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withProposalErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: Props['context']
) {
  const WrappedComponent = (props: P) => (
    <ProposalErrorBoundary context={context}>
      <Component {...props} />
    </ProposalErrorBoundary>
  );

  WrappedComponent.displayName = `withProposalErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for handling errors in functional components
export function useErrorHandler(context?: string) {
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    console.error(`Error in ${context}:`, error, errorInfo);
    
    // Report to error tracking service
    // reportError(error, { context, ...errorInfo });
  }, [context]);

  return handleError;
}