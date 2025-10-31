import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { signTransaction, signMessage } from '@/store/thunks/walletThunks';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';

interface TransactionSignerProps {
  transactionData?: Uint8Array;
  message?: string;
  onSuccess?: (signature: Uint8Array | string) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export const TransactionSigner: React.FC<TransactionSignerProps> = ({
  transactionData,
  message,
  onSuccess,
  onError,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const { loading, error, walletConnected } = useAppSelector(
    state => state.auth
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSign = async () => {
    if (!walletConnected) {
      onError?.(new Error('Wallet not connected'));
      return;
    }

    try {
      setIsProcessing(true);

      let result: Uint8Array | string;

      if (transactionData) {
        result = await dispatch(signTransaction(transactionData)).unwrap();
      } else if (message) {
        result = await dispatch(signMessage(message)).unwrap();
      } else {
        throw new Error('No transaction data or message provided');
      }

      onSuccess?.(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to sign');
      onError?.(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const cardStyles = {
    maxWidth: '500px',
    margin: '0 auto',
  };

  const detailsStyles = {
    backgroundColor: tokens.colors.neutral[50],
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing[4],
  };

  const labelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing[2],
    display: 'block',
  };

  const valueStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[900],
    fontFamily: 'monospace',
    wordBreak: 'break-all' as const,
    backgroundColor: 'white',
    padding: tokens.spacing[2],
    borderRadius: tokens.borderRadius.sm,
    border: `1px solid ${tokens.colors.neutral[200]}`,
  };

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[3],
    justifyContent: 'flex-end',
  };

  const warningStyles = {
    padding: tokens.spacing[3],
    backgroundColor: tokens.colors.warning[100],
    color: tokens.colors.warning[800],
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing[4],
    fontSize: tokens.typography.fontSize.sm,
  };

  if (!walletConnected) {
    return (
      <Card variant="outlined" style={cardStyles}>
        <CardContent>
          <div style={warningStyles}>
            Please connect your wallet to sign transactions.
          </div>
          <div style={actionsStyles}>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" style={cardStyles}>
      <CardHeader>
        <h3
          style={{
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            margin: 0,
          }}
        >
          {transactionData ? 'Sign Transaction' : 'Sign Message'}
        </h3>
      </CardHeader>
      <CardContent>
        {error && (
          <div
            style={{
              padding: tokens.spacing[3],
              backgroundColor: tokens.colors.error[100],
              color: tokens.colors.error[800],
              borderRadius: tokens.borderRadius.md,
              marginBottom: tokens.spacing[4],
              fontSize: tokens.typography.fontSize.sm,
            }}
          >
            {error}
          </div>
        )}

        <div style={detailsStyles}>
          {transactionData && (
            <div style={{ marginBottom: tokens.spacing[3] }}>
              <label style={labelStyles}>Transaction Data:</label>
              <div style={valueStyles}>
                {Array.from(transactionData.slice(0, 50))
                  .map(byte => byte.toString(16).padStart(2, '0'))
                  .join(' ')}
                {transactionData.length > 50 && '...'}
              </div>
            </div>
          )}

          {message && (
            <div style={{ marginBottom: tokens.spacing[3] }}>
              <label style={labelStyles}>Message:</label>
              <div style={valueStyles}>{message}</div>
            </div>
          )}

          <div>
            <label style={labelStyles}>Size:</label>
            <div style={valueStyles}>
              {transactionData
                ? `${transactionData.length} bytes`
                : `${message?.length || 0} characters`}
            </div>
          </div>
        </div>

        <div style={warningStyles}>
          ⚠️ Only sign transactions you understand and trust. Signing malicious
          transactions can result in loss of funds.
        </div>

        <div style={actionsStyles}>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing || loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSign}
            loading={isProcessing || loading}
          >
            Sign {transactionData ? 'Transaction' : 'Message'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
