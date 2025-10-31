import React, { useState } from 'react';
import { PaymentMethod } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FileUpload } from '../ui/FileUpload';

interface PaymentVerificationModalProps {
  paymentMethod: PaymentMethod;
  onCancel: () => void;
}

export const PaymentVerificationModal: React.FC<PaymentVerificationModalProps> = ({
  paymentMethod,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [microDepositAmount1, setMicroDepositAmount1] = useState('');
  const [microDepositAmount2, setMicroDepositAmount2] = useState('');
  const [verificationFiles, setVerificationFiles] = useState<File[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);
    
    try {
      // This would normally call the verification API
      // For now, we'll just simulate success
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In real implementation, this would be handled by the parent component
      console.log('Verification submitted for payment method:', paymentMethod.id);
      onCancel(); // Close modal on success
    } catch (error: any) {
      setError(error.message || 'Failed to verify payment method');
    } finally {
      setLoading(false);
    }
  };

  const getVerificationInstructions = () => {
    switch (paymentMethod.type) {
      case 'credit_card':
        return {
          title: 'Credit Card Verification',
          instructions: [
            'We\'ve sent a verification code to your phone number ending in ***-**-1234',
            'Enter the 6-digit code below to verify your credit card',
            'The code will expire in 10 minutes',
          ],
          fields: ['verificationCode'],
        };
      
      case 'bank_transfer':
        return {
          title: 'Bank Account Verification',
          instructions: [
            'We\'ve made two small deposits to your bank account',
            'Check your bank statement and enter the exact amounts below',
            'Deposits may take 1-2 business days to appear',
          ],
          fields: ['microDeposits'],
        };
      
      case 'digital_wallet':
        return {
          title: 'Digital Wallet Verification',
          instructions: [
            'We\'ve sent a verification request to your wallet',
            'Check your wallet app and enter the verification code below',
            'You may also need to upload a screenshot of your wallet balance',
          ],
          fields: ['verificationCode', 'documents'],
        };
      
      case 'cryptocurrency':
        return {
          title: 'Cryptocurrency Wallet Verification',
          instructions: [
            'To verify your wallet ownership, you\'ll need to sign a message',
            'Upload a screenshot of the signed message from your wallet',
            'Include any additional verification documents if required',
          ],
          fields: ['documents', 'additionalInfo'],
        };
      
      default:
        return {
          title: 'Payment Method Verification',
          instructions: ['Please provide the required verification information'],
          fields: ['verificationCode'],
        };
    }
  };

  const verification = getVerificationInstructions();

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={verification.title}
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

        {/* Payment Method Info */}
        <div
          style={{
            marginBottom: tokens.spacing[4],
            padding: tokens.spacing[4],
            backgroundColor: tokens.colors.neutral[50],
            border: `1px solid ${tokens.colors.neutral[200]}`,
            borderRadius: tokens.borderRadius.md,
          }}
        >
          <h4
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[2],
            }}
          >
            Verifying: {paymentMethod.displayName}
          </h4>
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              margin: 0,
            }}
          >
            Type: {paymentMethod.type.replace('_', ' ').charAt(0).toUpperCase() + 
                   paymentMethod.type.replace('_', ' ').slice(1)}
          </p>
        </div>

        {/* Instructions */}
        <div style={{ marginBottom: tokens.spacing[6] }}>
          <h4
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.colors.neutral[900],
              marginBottom: tokens.spacing[3],
            }}
          >
            Verification Instructions
          </h4>
          <ul
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[700],
              lineHeight: 1.5,
              paddingLeft: tokens.spacing[4],
              margin: 0,
            }}
          >
            {verification.instructions.map((instruction, index) => (
              <li key={index} style={{ marginBottom: tokens.spacing[2] }}>
                {instruction}
              </li>
            ))}
          </ul>
        </div>

        {/* Verification Code Field */}
        {verification.fields.includes('verificationCode') && (
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
              Verification Code *
            </label>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value)}
              maxLength={6}
              style={{
                width: '100%',
                padding: tokens.spacing[3],
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                textAlign: 'center',
                letterSpacing: '0.5em',
                border: `1px solid ${tokens.colors.neutral[300]}`,
                borderRadius: tokens.borderRadius.md,
              }}
            />
          </div>
        )}

        {/* Micro Deposit Fields */}
        {verification.fields.includes('microDeposits') && (
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
              Micro Deposit Amounts *
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: tokens.spacing[3],
              }}
            >
              <div>
                <input
                  type="text"
                  placeholder="$0.12"
                  value={microDepositAmount1}
                  onChange={e => setMicroDepositAmount1(e.target.value)}
                  style={{
                    width: '100%',
                    padding: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.sm,
                    border: `1px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.md,
                  }}
                />
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.neutral[500],
                    marginTop: tokens.spacing[1],
                    margin: 0,
                  }}
                >
                  First deposit amount
                </p>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="$0.34"
                  value={microDepositAmount2}
                  onChange={e => setMicroDepositAmount2(e.target.value)}
                  style={{
                    width: '100%',
                    padding: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.sm,
                    border: `1px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.md,
                  }}
                />
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.neutral[500],
                    marginTop: tokens.spacing[1],
                    margin: 0,
                  }}
                >
                  Second deposit amount
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Document Upload */}
        {verification.fields.includes('documents') && (
          <div style={{ marginBottom: tokens.spacing[4] }}>
            <FileUpload
              label="Verification Documents"
              accept="image/*,.pdf"
              multiple={true}
              maxFiles={3}
              maxSize={5}
              onFilesChange={setVerificationFiles}
              helperText="Upload screenshots, signed messages, or other verification documents"
            />
          </div>
        )}

        {/* Additional Information */}
        {verification.fields.includes('additionalInfo') && (
          <div style={{ marginBottom: tokens.spacing[6] }}>
            <label
              style={{
                display: 'block',
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[2],
              }}
            >
              Additional Information
            </label>
            <textarea
              value={additionalInfo}
              onChange={e => setAdditionalInfo(e.target.value)}
              placeholder="Provide any additional information that might help with verification..."
              rows={4}
              style={{
                width: '100%',
                padding: tokens.spacing[3],
                fontSize: tokens.typography.fontSize.sm,
                border: `1px solid ${tokens.colors.neutral[300]}`,
                borderRadius: tokens.borderRadius.md,
                resize: 'vertical',
              }}
            />
          </div>
        )}

        {/* Help Text */}
        <div
          style={{
            marginBottom: tokens.spacing[6],
            padding: tokens.spacing[3],
            backgroundColor: tokens.colors.primary[50],
            border: `1px solid ${tokens.colors.primary[200]}`,
            borderRadius: tokens.borderRadius.md,
          }}
        >
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.primary[700],
              margin: 0,
            }}
          >
            💡 <strong>Need help?</strong> If you're having trouble with verification, 
            contact our support team at support@bookingswap.com or call 1-800-SWAP-HELP.
          </p>
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
            disabled={
              (verification.fields.includes('verificationCode') && !verificationCode.trim()) ||
              (verification.fields.includes('microDeposits') && (!microDepositAmount1.trim() || !microDepositAmount2.trim()))
            }
          >
            Verify Payment Method
          </Button>
        </div>
      </form>
    </Modal>
  );
};