import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { tokens } from '../../design-system/tokens';
import { FEATURE_FLAGS } from '../../config/featureFlags';

interface CashOfferFormProps {
  targetSwap: any;
  onSubmit: (data: CashOfferFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  cashDetails?: {
    minimumAmount?: number;
    preferredAmount?: number;
    currency: string;
  };
}

interface CashOfferFormData {
  cashAmount: number;
  message?: string;
  conditions: string[];
  agreedToTerms: boolean;
  paymentMethodId?: string;
  escrowAgreement?: boolean;
}

export const CashOfferForm: React.FC<CashOfferFormProps> = ({
  targetSwap,
  onSubmit,
  onCancel,
  loading = false,
  cashDetails,
}) => {
  // Return null when cash proposals are disabled
  if (!FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
    return null;
  }

  const [formData, setFormData] = useState<CashOfferFormData>({
    cashAmount: cashDetails?.preferredAmount || cashDetails?.minimumAmount || 0,
    message: '',
    conditions: [],
    agreedToTerms: false,
    paymentMethodId: 'default-payment-method', // TODO: Get from user's payment methods
    escrowAgreement: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate cash amount
    if (!formData.cashAmount || formData.cashAmount <= 0) {
      newErrors.cashAmount = 'Please enter a valid cash amount';
    } else if (cashDetails?.minimumAmount && formData.cashAmount < cashDetails.minimumAmount) {
      newErrors.cashAmount = `Minimum amount is $${cashDetails.minimumAmount}`;
    }

    // Validate terms agreement
    if (!formData.agreedToTerms) {
      newErrors.agreedToTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      console.log('CashOfferForm - Submitting data:', formData);
      onSubmit(formData);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cashDetails?.currency || 'USD',
    }).format(amount);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Target Swap Info */}
      <Card variant="outlined" style={{ marginBottom: tokens.spacing[6] }}>
        <CardHeader>
          <h3 style={{
            fontSize: tokens.typography.fontSize.lg,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}>
            💰 Cash Offer Details
          </h3>
        </CardHeader>
        <CardContent>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: tokens.spacing[4],
          }}>
            <div>
              <h4 style={{
                fontSize: tokens.typography.fontSize.base,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: `0 0 ${tokens.spacing[1]} 0`,
              }}>
                Making offer for:
              </h4>
              <p style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                margin: 0,
              }}>
                {targetSwap?.sourceBooking?.title || 'Selected Swap'}
              </p>
            </div>
            <div style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.primary[600],
            }}>
              Value: {formatCurrency(targetSwap?.sourceBooking?.swapValue || 0)}
            </div>
          </div>

          {/* Cash Amount Guidelines */}
          {(cashDetails?.minimumAmount || cashDetails?.preferredAmount) && (
            <div style={{
              backgroundColor: tokens.colors.blue[50],
              border: `1px solid ${tokens.colors.blue[200]}`,
              borderRadius: tokens.borderRadius.md,
              padding: tokens.spacing[3],
              marginBottom: tokens.spacing[4],
            }}>
              <h5 style={{
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.blue[800],
                margin: `0 0 ${tokens.spacing[2]} 0`,
              }}>
                💡 Cash Offer Guidelines
              </h5>
              {cashDetails.minimumAmount && (
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.blue[700],
                  margin: `0 0 ${tokens.spacing[1]} 0`,
                }}>
                  Minimum amount: {formatCurrency(cashDetails.minimumAmount)}
                </p>
              )}
              {cashDetails.preferredAmount && (
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.blue[700],
                  margin: 0,
                }}>
                  Preferred amount: {formatCurrency(cashDetails.preferredAmount)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Offer Form */}
      <form onSubmit={handleSubmit}>
        <Card variant="outlined" style={{ marginBottom: tokens.spacing[6] }}>
          <CardContent>
            {/* Cash Amount Input */}
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                htmlFor="cashAmount"
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Cash Offer Amount *
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: tokens.spacing[3],
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: tokens.typography.fontSize.base,
                  color: tokens.colors.neutral[500],
                }}>
                  $
                </span>
                <input
                  id="cashAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cashAmount || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    cashAmount: parseFloat(e.target.value) || 0
                  }))}
                  style={{
                    width: '100%',
                    padding: `${tokens.spacing[3]} ${tokens.spacing[3]} ${tokens.spacing[3]} ${tokens.spacing[6]}`,
                    border: `1px solid ${errors.cashAmount ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.md,
                    fontSize: tokens.typography.fontSize.base,
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                  placeholder="Enter your cash offer amount"
                />
              </div>
              {errors.cashAmount && (
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.error[600],
                  margin: `${tokens.spacing[1]} 0 0 0`,
                }}>
                  {errors.cashAmount}
                </p>
              )}
            </div>

            {/* Message Input */}
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label
                htmlFor="message"
                style={{
                  display: 'block',
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[700],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Message (Optional)
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  message: e.target.value
                }))}
                rows={4}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  fontSize: tokens.typography.fontSize.base,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
                placeholder="Add a personal message to your cash offer..."
              />
            </div>

            {/* Conditions Section */}
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label style={{
                display: 'block',
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[2],
              }}>
                Special Conditions (Optional)
              </label>
              <div style={{
                border: `1px solid ${tokens.colors.neutral[300]}`,
                borderRadius: tokens.borderRadius.md,
                padding: tokens.spacing[3],
                backgroundColor: tokens.colors.neutral[50],
              }}>
                {[
                  'Payment via secure escrow service',
                  'Flexible payment timeline',
                  'Immediate payment upon acceptance',
                  'Partial payment upfront, remainder on completion',
                ].map((condition, index) => (
                  <label
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[2],
                      marginBottom: tokens.spacing[2],
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.conditions.includes(condition)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            conditions: [...prev.conditions, condition]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            conditions: prev.conditions.filter(c => c !== condition)
                          }));
                        }
                      }}
                      style={{
                        accentColor: tokens.colors.primary[600],
                      }}
                    />
                    <span style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[700],
                    }}>
                      {condition}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Terms Agreement */}
            <div style={{ marginBottom: tokens.spacing[4] }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: tokens.spacing[2],
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={formData.agreedToTerms}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    agreedToTerms: e.target.checked
                  }))}
                  style={{
                    marginTop: '2px',
                    accentColor: tokens.colors.primary[600],
                  }}
                />
                <span style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[700],
                  lineHeight: 1.5,
                }}>
                  I agree to the terms and conditions for cash offers and understand that this offer is binding once accepted *
                </span>
              </label>
              {errors.agreedToTerms && (
                <p style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.error[600],
                  margin: `${tokens.spacing[1]} 0 0 ${tokens.spacing[6]}`,
                }}>
                  {errors.agreedToTerms}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: tokens.spacing[3],
          justifyContent: 'flex-end',
        }}>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            style={{
              backgroundColor: tokens.colors.success[600],
              borderColor: tokens.colors.success[600],
            }}
          >
            {loading ? 'Submitting...' : `Submit Cash Offer`}
          </Button>
        </div>
      </form>
    </div>
  );
};