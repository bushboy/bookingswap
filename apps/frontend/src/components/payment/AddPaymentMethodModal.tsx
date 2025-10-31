import React, { useState } from 'react';
import { tokens } from '../../design-system/tokens';
import { AddPaymentMethodRequest } from '../../services/paymentService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FileUpload } from '../ui/FileUpload';

interface AddPaymentMethodModalProps {
  onSubmit: (methodData: AddPaymentMethodRequest) => Promise<void>;
  onCancel: () => void;
}

export const AddPaymentMethodModal: React.FC<AddPaymentMethodModalProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddPaymentMethodRequest>({
    type: 'credit_card',
    displayName: '',
    metadata: {},
  });
  const [verificationFiles, setVerificationFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.displayName.trim()) {
      setError('Display name is required');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const methodData = {
        ...formData,
        metadata: {
          ...formData.metadata,
          verificationFiles: verificationFiles.length > 0 ? verificationFiles : undefined,
        },
      };
      
      await onSubmit(methodData);
    } catch (error: any) {
      setError(error.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: AddPaymentMethodRequest['type']) => {
    setFormData(prev => ({
      ...prev,
      type,
      metadata: {}, // Reset metadata when type changes
    }));
  };

  const updateMetadata = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [key]: value,
      },
    }));
  };

  const renderTypeSpecificFields = () => {
    switch (formData.type) {
      case 'credit_card':
        return (
          <>
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Card Number *
              </label>
              <input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={formData.metadata.cardNumber || ''}
                onChange={e => updateMetadata('cardNumber', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: tokens.spacing[4],
                marginBottom: tokens.spacing[4],
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Expiry Date *
                </label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={formData.metadata.expiryDate || ''}
                  onChange={e => updateMetadata('expiryDate', e.target.value)}
                  style={{
                    width: '100%',
                    padding: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.sm,
                    border: `1px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.md,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[700],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  CVV *
                </label>
                <input
                  type="text"
                  placeholder="123"
                  value={formData.metadata.cvv || ''}
                  onChange={e => updateMetadata('cvv', e.target.value)}
                  style={{
                    width: '100%',
                    padding: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.sm,
                    border: `1px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.md,
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Cardholder Name *
              </label>
              <input
                type="text"
                placeholder="John Doe"
                value={formData.metadata.cardholderName || ''}
                onChange={e => updateMetadata('cardholderName', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>
          </>
        );

      case 'bank_transfer':
        return (
          <>
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Account Number *
              </label>
              <input
                type="text"
                placeholder="123456789"
                value={formData.metadata.accountNumber || ''}
                onChange={e => updateMetadata('accountNumber', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Routing Number *
              </label>
              <input
                type="text"
                placeholder="021000021"
                value={formData.metadata.routingNumber || ''}
                onChange={e => updateMetadata('routingNumber', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Account Holder Name *
              </label>
              <input
                type="text"
                placeholder="John Doe"
                value={formData.metadata.accountHolderName || ''}
                onChange={e => updateMetadata('accountHolderName', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Bank Name *
              </label>
              <input
                type="text"
                placeholder="Chase Bank"
                value={formData.metadata.bankName || ''}
                onChange={e => updateMetadata('bankName', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>
          </>
        );

      case 'digital_wallet':
        return (
          <>
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Wallet Provider *
              </label>
              <select
                value={formData.metadata.walletProvider || ''}
                onChange={e => updateMetadata('walletProvider', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor: tokens.colors.white,
                }}
              >
                <option value="">Select wallet provider</option>
                <option value="paypal">PayPal</option>
                <option value="apple_pay">Apple Pay</option>
                <option value="google_pay">Google Pay</option>
                <option value="venmo">Venmo</option>
                <option value="cashapp">Cash App</option>
              </select>
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Wallet Email/Phone *
              </label>
              <input
                type="text"
                placeholder="john@example.com or +1234567890"
                value={formData.metadata.walletIdentifier || ''}
                onChange={e => updateMetadata('walletIdentifier', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>
          </>
        );

      case 'cryptocurrency':
        return (
          <>
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Cryptocurrency *
              </label>
              <select
                value={formData.metadata.cryptoCurrency || ''}
                onChange={e => updateMetadata('cryptoCurrency', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor: tokens.colors.white,
                }}
              >
                <option value="">Select cryptocurrency</option>
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="ETH">Ethereum (ETH)</option>
                <option value="HBAR">Hedera (HBAR)</option>
              </select>
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Wallet Address *
              </label>
              <input
                type="text"
                placeholder="0x1234567890abcdef..."
                value={formData.metadata.walletAddress || ''}
                onChange={e => updateMetadata('walletAddress', e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                }}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Add Payment Method"
    >
      <form onSubmit={handleSubmit} style={{ padding: tokens.spacing[6] }}>
        {/* Error Display */}
        {error && (
          <div
            style={{
              marginBottom: tokens.spacing[4],
              padding: tokens.spacing[3],
              backgroundColor: tokens.colors.error[50],
              border: `1px solid ${tokens.colors.error[200]}`,
              borderRadius: tokens.borderRadius.md,
              color: tokens.colors.error[700],
            }}
          >
            {error}
          </div>
        )}

        {/* Payment Method Type */}
        <div style={{ marginBottom: tokens.spacing[4] }}>
          <label
            style={{
              display: 'block',
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[2],
            }}
          >
            Payment Method Type *
          </label>
          <select
            value={formData.type}
            onChange={e => handleTypeChange(e.target.value as AddPaymentMethodRequest['type'])}
            style={{
              width: '100%',
              padding: tokens.spacing[3],
              fontSize: tokens.typography.fontSize.sm,
              border: `1px solid ${tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              backgroundColor: tokens.colors.white,
            }}
          >
            <option value="credit_card">Credit Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="digital_wallet">Digital Wallet</option>
            <option value="cryptocurrency">Cryptocurrency</option>
          </select>
        </div>

        {/* Display Name */}
        <div style={{ marginBottom: tokens.spacing[4] }}>
          <label
            style={{
              display: 'block',
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[700],
              marginBottom: tokens.spacing[2],
            }}
          >
            Display Name *
          </label>
          <input
            type="text"
            placeholder="My Primary Card"
            value={formData.displayName}
            onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            style={{
              width: '100%',
              padding: tokens.spacing[3],
              fontSize: tokens.typography.fontSize.sm,
              border: `1px solid ${tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
            }}
          />
        </div>

        {/* Type-specific fields */}
        {renderTypeSpecificFields()}

        {/* Verification Documents */}
        <div style={{ marginBottom: tokens.spacing[6] }}>
          <FileUpload
            label="Verification Documents (Optional)"
            accept="image/*,.pdf"
            multiple={true}
            maxFiles={3}
            maxSize={5}
            onFilesChange={setVerificationFiles}
            helperText="Upload ID, bank statements, or other verification documents"
          />
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: tokens.spacing[3],
            justifyContent: 'flex-end',
          }}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!formData.displayName.trim()}
          >
            Add Payment Method
          </Button>
        </div>
      </form>
    </Modal>
  );
};