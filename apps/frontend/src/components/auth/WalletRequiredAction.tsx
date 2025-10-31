import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { WalletConnectButton } from '@/components/wallet';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { tokens } from '@/design-system/tokens';

interface WalletRequiredActionProps {
  children: React.ReactNode;
  action: string;
  description?: string;
  onAction?: () => void | Promise<void>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component that wraps actions requiring wallet connection.
 * Shows wallet connection prompt when wallet is not connected,
 * otherwise executes the action directly.
 */
export const WalletRequiredAction: React.FC<WalletRequiredActionProps> = ({
  children,
  action,
  description = `Connect your Hedera wallet to ${action.toLowerCase()}.`,
  onAction,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className,
  style,
}) => {
  const { isAuthenticated } = useAuth();
  const { isConnected, isConnecting } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleClick = async () => {
    if (!isAuthenticated) {
      // This shouldn't happen if the component is used within protected routes
      console.warn('WalletRequiredAction used without authentication');
      return;
    }

    if (!isConnected) {
      // Show wallet connection modal
      setShowWalletModal(true);
      return;
    }

    // Wallet is connected, execute the action
    if (onAction) {
      try {
        await onAction();
      } catch (error) {
        console.error(`Failed to execute ${action}:`, error);
        // Error handling is left to the parent component
      }
    }
  };

  const handleWalletConnected = () => {
    setShowWalletModal(false);
    // After wallet connection, execute the action
    if (onAction) {
      setTimeout(() => {
        onAction();
      }, 100); // Small delay to ensure wallet state is updated
    }
  };

  // If this is being used as a wrapper around a button
  if (React.isValidElement(children) && children.type === Button) {
    return (
      <>
        {React.cloneElement(children as React.ReactElement<any>, {
          onClick: handleClick,
          disabled: disabled || isConnecting,
          title: !isConnected 
            ? `Connect wallet to ${action.toLowerCase()}`
            : children.props.title,
        })}
        
        <WalletConnectionModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onConnected={handleWalletConnected}
          action={action}
          description={description}
        />
      </>
    );
  }

  // Default button implementation
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={disabled || isConnecting}
        className={className}
        style={style}
        title={!isConnected 
          ? `Connect wallet to ${action.toLowerCase()}`
          : undefined}
      >
        {isConnecting ? 'Connecting...' : children}
      </Button>
      
      <WalletConnectionModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnected={handleWalletConnected}
        action={action}
        description={description}
      />
    </>
  );
};

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
  action: string;
  description: string;
}

const WalletConnectionModal: React.FC<WalletConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  action,
  description,
}) => {
  const { isConnected } = useWallet();

  // Auto-close and trigger action when wallet gets connected
  React.useEffect(() => {
    if (isConnected && isOpen) {
      onConnected();
    }
  }, [isConnected, isOpen, onConnected]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Wallet Connection Required"
      size="sm"
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: tokens.spacing[4],
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: tokens.spacing[4],
        }}>
          🔗
        </div>
        
        <h3 style={{
          fontSize: tokens.typography.fontSize.xl,
          fontWeight: tokens.typography.fontWeight.bold,
          color: tokens.colors.neutral[900],
          marginBottom: tokens.spacing[4],
        }}>
          Connect Your Wallet
        </h3>
        
        <p style={{
          fontSize: tokens.typography.fontSize.base,
          color: tokens.colors.neutral[600],
          lineHeight: tokens.typography.lineHeight.relaxed,
          marginBottom: tokens.spacing[6],
        }}>
          {description}
        </p>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[3],
          width: '100%',
          maxWidth: '300px',
        }}>
          <WalletConnectButton 
            variant="primary" 
            size="lg"
            showBalance={false}
            style={{ width: '100%' }}
          />
          
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            style={{ width: '100%' }}
          >
            Cancel
          </Button>
        </div>
        
        <div style={{
          marginTop: tokens.spacing[6],
          padding: tokens.spacing[4],
          backgroundColor: tokens.colors.neutral[50],
          borderRadius: tokens.borderRadius.md,
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.neutral[600],
        }}>
          <p style={{ marginTop: 0, marginRight: 0, marginBottom: tokens.spacing[2], marginLeft: 0 }}>
            💡 <strong>Why do I need a wallet?</strong>
          </p>
          <p style={{ margin: 0 }}>
            Blockchain transactions like {action.toLowerCase()} require a wallet to sign and execute securely on the Hedera network.
          </p>
        </div>
      </div>
    </Modal>
  );
};