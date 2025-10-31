import React, { useState } from 'react';
import { PaymentTransaction, PaymentReceipt } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { paymentService } from '../../services/paymentService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingIndicator';
import { Modal } from '../ui/Modal';

interface ReceiptGeneratorProps {
  transaction: PaymentTransaction;
  onClose: () => void;
}

export const ReceiptGenerator: React.FC<ReceiptGeneratorProps> = ({
  transaction,
  onClose,
}) => {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'json'>('pdf');

  const generateReceipt = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const generatedReceipt = await paymentService.generateReceipt(transaction.id);
      setReceipt(generatedReceipt);
    } catch (error: any) {
      setError(error.message || 'Failed to generate receipt');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = () => {
    if (!receipt) return;

    if (downloadFormat === 'pdf') {
      downloadPDFReceipt();
    } else {
      downloadJSONReceipt();
    }
  };

  const downloadPDFReceipt = () => {
    if (!receipt) return;

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .receipt-info { margin-bottom: 20px; }
            .amount { font-size: 24px; font-weight: bold; color: #059669; }
            .details { margin-top: 20px; }
            .row { display: flex; justify-content: space-between; margin: 10px 0; }
            .footer { margin-top: 40px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Receipt</h1>
            <p>Transaction ID: ${receipt.transactionId}</p>
          </div>
          
          <div class="receipt-info">
            <div class="amount">${receipt.currency} ${receipt.amount.toFixed(2)}</div>
            <p>Completed on ${new Date(receipt.completedAt).toLocaleDateString()}</p>
          </div>
          
          <div class="details">
            <div class="row">
              <span>Swap ID:</span>
              <span>${receipt.swapId}</span>
            </div>
            <div class="row">
              <span>Payment Method:</span>
              <span>${receipt.paymentMethod}</span>
            </div>
            <div class="row">
              <span>Platform Fee:</span>
              <span>${receipt.currency} ${receipt.fees.platformFee.toFixed(2)}</span>
            </div>
            <div class="row">
              <span>Processing Fee:</span>
              <span>${receipt.currency} ${receipt.fees.processingFee.toFixed(2)}</span>
            </div>
            <div class="row">
              <span><strong>Net Amount:</strong></span>
              <span><strong>${receipt.currency} ${receipt.fees.netAmount.toFixed(2)}</strong></span>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for using our platform!</p>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
        </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${receipt.transactionId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadJSONReceipt = () => {
    if (!receipt) return;

    const receiptData = {
      transactionId: receipt.transactionId,
      swapId: receipt.swapId,
      amount: receipt.amount,
      currency: receipt.currency,
      fees: receipt.fees,
      paymentMethod: receipt.paymentMethod,
      completedAt: receipt.completedAt,
      generatedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(receiptData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${receipt.transactionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const emailReceipt = async () => {
    if (!receipt) return;
    
    // In a real implementation, this would call an API to send the receipt via email
    alert('Receipt sent to your registered email address');
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Generate Receipt">
      <div style={{ padding: tokens.spacing[6], minWidth: '500px' }}>
        {!receipt ? (
          <div>
            <div
              style={{
                textAlign: 'center',
                marginBottom: tokens.spacing[6],
              }}
            >
              <div
                style={{
                  fontSize: tokens.typography.fontSize['4xl'],
                  marginBottom: tokens.spacing[4],
                }}
              >
                🧾
              </div>
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.lg,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[900],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Generate Payment Receipt
              </h3>
              <p
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[600],
                }}
              >
                Generate a detailed receipt for transaction #{transaction.id.slice(-8)}
              </p>
            </div>

            <Card style={{ marginBottom: tokens.spacing[4] }}>
              <div style={{ padding: tokens.spacing[4] }}>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[900],
                    marginBottom: tokens.spacing[3],
                  }}
                >
                  Transaction Details
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: tokens.spacing[3],
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[700],
                  }}
                >
                  <div>
                    <strong>Amount:</strong><br />
                    {transaction.currency} {transaction.amount.toFixed(2)}
                  </div>
                  <div>
                    <strong>Status:</strong><br />
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </div>
                  <div>
                    <strong>Platform Fee:</strong><br />
                    {transaction.currency} {transaction.platformFee.toFixed(2)}
                  </div>
                  <div>
                    <strong>Net Amount:</strong><br />
                    {transaction.currency} {transaction.netAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </Card>

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

            <div
              style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'flex-end',
              }}
            >
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={generateReceipt}
                loading={loading}
              >
                {loading ? 'Generating...' : 'Generate Receipt'}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                textAlign: 'center',
                marginBottom: tokens.spacing[6],
              }}
            >
              <div
                style={{
                  fontSize: tokens.typography.fontSize['4xl'],
                  marginBottom: tokens.spacing[4],
                }}
              >
                ✅
              </div>
              <h3
                style={{
                  fontSize: tokens.typography.fontSize.lg,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.success[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Receipt Generated Successfully
              </h3>
            </div>

            <Card style={{ marginBottom: tokens.spacing[6] }}>
              <div style={{ padding: tokens.spacing[4] }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: tokens.spacing[4],
                    fontSize: tokens.typography.fontSize.sm,
                  }}
                >
                  <div>
                    <strong>Transaction ID:</strong><br />
                    {receipt.transactionId}
                  </div>
                  <div>
                    <strong>Swap ID:</strong><br />
                    {receipt.swapId}
                  </div>
                  <div>
                    <strong>Amount:</strong><br />
                    {receipt.currency} {receipt.amount.toFixed(2)}
                  </div>
                  <div>
                    <strong>Payment Method:</strong><br />
                    {receipt.paymentMethod}
                  </div>
                  <div>
                    <strong>Platform Fee:</strong><br />
                    {receipt.currency} {receipt.fees.platformFee.toFixed(2)}
                  </div>
                  <div>
                    <strong>Processing Fee:</strong><br />
                    {receipt.currency} {receipt.fees.processingFee.toFixed(2)}
                  </div>
                  <div>
                    <strong>Net Amount:</strong><br />
                    <span style={{ color: tokens.colors.success[600], fontWeight: tokens.typography.fontWeight.semibold }}>
                      {receipt.currency} {receipt.fees.netAmount.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <strong>Completed:</strong><br />
                    {new Date(receipt.completedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Card>

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
                Download Format
              </label>
              <select
                value={downloadFormat}
                onChange={e => setDownloadFormat(e.target.value as 'pdf' | 'json')}
                style={{
                  width: '100%',
                  padding: tokens.spacing[2],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor: tokens.colors.white,
                }}
              >
                <option value="pdf">PDF (HTML)</option>
                <option value="json">JSON Data</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'space-between',
              }}
            >
              <Button variant="secondary" onClick={emailReceipt}>
                📧 Email Receipt
              </Button>
              
              <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                <Button variant="primary" onClick={downloadReceipt}>
                  📄 Download Receipt
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};