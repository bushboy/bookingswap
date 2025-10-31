import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { connectWallet } from '@/store/thunks/walletThunks';
import { setModal } from '@/store/slices/uiSlice';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { tokens } from '@/design-system/tokens';

export const WalletModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(
    state => state.ui.modal.isOpen && state.ui.modal.type === 'walletConnect'
  );
  const { loading, error } = useAppSelector(state => state.auth);

  const handleConnect = async () => {
    try {
      await dispatch(connectWallet()).unwrap();
      dispatch(setModal({ isOpen: false }));
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleClose = () => {
    dispatch(setModal({ isOpen: false }));
  };

  if (!isOpen) return null;

  const overlayStyles = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: tokens.spacing[4],
  };

  const modalStyles = {
    width: '100%',
    maxWidth: '400px',
    maxHeight: '90vh',
    overflow: 'auto',
  };

  const walletOptionStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    marginBottom: tokens.spacing[3],
  };

  const walletIconStyles = {
    width: '40px',
    height: '40px',
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.primary[100],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.typography.fontSize.xl,
  };

  const walletInfoStyles = {
    flex: 1,
  };

  const walletNameStyles = {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  };

  const walletDescriptionStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
  };

  return (
    <div style={overlayStyles} onClick={handleClose}>
      <Card
        variant="elevated"
        style={modalStyles}
        onClick={e => e.stopPropagation()}
      >
        <CardHeader>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: tokens.typography.fontWeight.semibold,
                margin: 0,
              }}
            >
              Connect Wallet
            </h2>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: tokens.typography.fontSize.xl,
                cursor: 'pointer',
                color: tokens.colors.neutral[500],
                padding: tokens.spacing[1],
              }}
            >
              ×
            </button>
          </div>
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

          <div
            style={{
              ...walletOptionStyles,
              borderColor: tokens.colors.primary[300],
              backgroundColor: tokens.colors.primary[50],
            }}
            onClick={handleConnect}
          >
            <div style={walletIconStyles}>🔗</div>
            <div style={walletInfoStyles}>
              <div style={walletNameStyles}>Hedera Wallet</div>
              <div style={walletDescriptionStyles}>
                Connect using Hedera Wallet Connect
              </div>
            </div>
            {loading && (
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid transparent',
                  borderTop: `2px solid ${tokens.colors.primary[600]}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            )}
          </div>

          <div
            style={{
              padding: tokens.spacing[4],
              backgroundColor: tokens.colors.neutral[50],
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              textAlign: 'center',
            }}
          >
            <p style={{ marginTop: 0, marginRight: 0, marginBottom: tokens.spacing[2], marginLeft: 0 }}>
              By connecting a wallet, you agree to our Terms of Service and
              Privacy Policy.
            </p>
            <p style={{ margin: 0 }}>
              Make sure you trust this site with your wallet.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
