import React from 'react';
import { WalletError } from '../../types/wallet';
import { formatWalletErrorForUser } from '../../utils/walletErrorHandling';

interface WalletErrorDisplayProps {
  error: WalletError | Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  onAction?: (action: string) => void;
  className?: string;
}

/**
 * Component for displaying wallet errors with user-friendly messages and actions
 */
export const WalletErrorDisplay: React.FC<WalletErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  onAction,
  className = '',
}) => {
  if (!error) return null;

  const errorInfo = formatWalletErrorForUser(error);

  const handleAction = (action: string) => {
    switch (action) {
      case 'retry_connection':
        onRetry?.();
        break;
      case 'dismiss':
        onDismiss?.();
        break;
      case 'refresh_page':
        window.location.reload();
        break;
      case 'install_wallet':
        // This will be handled by the parent component or onAction callback
        onAction?.(action);
        break;
      default:
        onAction?.(action);
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  const getIconForSeverity = (severity: string) => {
    switch (severity) {
      case 'error':
        return (
          <svg
            className="w-5 h-5 text-red-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            className="w-5 h-5 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'info':
        return (
          <svg
            className="w-5 h-5 text-blue-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getButtonStyles = (variant: string, isPrimary?: boolean) => {
    const baseStyles =
      'px-3 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors';

    switch (variant) {
      case 'primary':
        return `${baseStyles} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`;
      case 'secondary':
        return `${baseStyles} bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500`;
      case 'outline':
        return `${baseStyles} border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500`;
      case 'ghost':
        return `${baseStyles} text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:ring-gray-500`;
      default:
        return `${baseStyles} bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-500`;
    }
  };

  return (
    <div
      className={`rounded-md border p-4 ${getSeverityStyles(errorInfo.severity)} ${className}`}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {getIconForSeverity(errorInfo.severity)}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">{errorInfo.title}</h3>
          <div className="mt-2 text-sm">
            <p>{errorInfo.message}</p>
            {errorInfo.details && (
              <p className="mt-1 font-medium">{errorInfo.details}</p>
            )}
            {errorInfo.explanation && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs opacity-75 hover:opacity-100">
                  Why did this happen?
                </summary>
                <p className="mt-1 text-xs opacity-75">
                  {errorInfo.explanation}
                </p>
              </details>
            )}
          </div>
          {errorInfo.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {errorInfo.actions.map((action, index) => (
                <button
                  key={action.action}
                  onClick={() => handleAction(action.action)}
                  className={getButtonStyles(
                    action.variant || 'outline',
                    action.primary
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className="inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:bg-black hover:bg-opacity-10 focus:ring-gray-500"
                aria-label="Dismiss error"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Compact error display for inline use
 */
export const WalletErrorInline: React.FC<WalletErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  onAction,
  className = '',
}) => {
  if (!error) return null;

  const errorInfo = formatWalletErrorForUser(error);

  const handleAction = (action: string) => {
    switch (action) {
      case 'retry_connection':
        onRetry?.();
        break;
      case 'dismiss':
        onDismiss?.();
        break;
      default:
        onAction?.(action);
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-2 text-sm rounded border-l-4 ${
        errorInfo.severity === 'error'
          ? 'border-red-400 bg-red-50 text-red-700'
          : errorInfo.severity === 'warning'
            ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
            : 'border-blue-400 bg-blue-50 text-blue-700'
      } ${className}`}
    >
      <div className="flex-1">
        <span className="font-medium">{errorInfo.title}:</span>{' '}
        {errorInfo.message}
      </div>
      <div className="flex items-center gap-2 ml-3">
        {errorInfo.actions.slice(0, 2).map(action => (
          <button
            key={action.action}
            onClick={() => handleAction(action.action)}
            className="text-xs underline hover:no-underline focus:outline-none"
          >
            {action.label}
          </button>
        ))}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs opacity-50 hover:opacity-75 focus:outline-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Toast-style error notification
 */
export const WalletErrorToast: React.FC<
  WalletErrorDisplayProps & {
    isVisible: boolean;
    onClose: () => void;
  }
> = ({ error, isVisible, onRetry, onClose, onAction, className = '' }) => {
  if (!error || !isVisible) return null;

  const errorInfo = formatWalletErrorForUser(error);

  const handleAction = (action: string) => {
    switch (action) {
      case 'retry_connection':
        onRetry?.();
        break;
      case 'dismiss':
        onClose();
        break;
      default:
        onAction?.(action);
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 max-w-sm w-full bg-white rounded-lg shadow-lg border z-50 transform transition-transform duration-300 ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      } ${className}`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {errorInfo.severity === 'error' && (
              <svg
                className="w-5 h-5 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {errorInfo.severity === 'warning' && (
              <svg
                className="w-5 h-5 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">
              {errorInfo.title}
            </p>
            <p className="mt-1 text-sm text-gray-500">{errorInfo.message}</p>
            {errorInfo.actions.length > 0 && (
              <div className="mt-3 flex gap-2">
                {errorInfo.actions.slice(0, 2).map(action => (
                  <button
                    key={action.action}
                    onClick={() => handleAction(action.action)}
                    className={`text-sm font-medium ${
                      action.primary
                        ? 'text-blue-600 hover:text-blue-500'
                        : 'text-gray-600 hover:text-gray-500'
                    } focus:outline-none`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={onClose}
              className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
