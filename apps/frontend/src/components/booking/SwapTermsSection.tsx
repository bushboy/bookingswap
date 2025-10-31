import React from 'react';
import { tokens } from '@/design-system/tokens';
import { SwapInfo } from '@booking-swap/shared';
import { FinancialDataHandler } from '../../utils/financialDataHandler';

export interface SwapTermsSectionProps {
  swapInfo: SwapInfo;
  showFullDetails?: boolean;
}

export const SwapTermsSection: React.FC<SwapTermsSectionProps> = ({
  swapInfo,
  showFullDetails = true
}) => {
  const getPaymentTypeIcon = (type: 'booking' | 'cash'): string => {
    return type === 'booking' ? '🔄' : '💰';
  };

  const getPaymentTypeLabel = (type: 'booking' | 'cash'): string => {
    return type === 'booking' ? 'Booking Exchange' : 'Cash Offers';
  };

  const formatCurrency = (amount: any): string => {
    return FinancialDataHandler.formatCurrency(amount, 'USD');
  };

  const formatAuctionEndDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  // Styles
  const termsSectionStyles = {
    marginBottom: tokens.spacing[2],
    padding: tokens.spacing[3],
    backgroundColor: 'white',
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.neutral[200]}`,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  };

  const termsHeaderStyles = {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.neutral[800],
    marginBottom: tokens.spacing[2],
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
  };

  const termRowStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[2],
    marginBottom: tokens.spacing[2],
  };

  const termLabelStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    minWidth: '80px',
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const paymentBadgesStyles = {
    display: 'flex',
    gap: tokens.spacing[1],
    flexWrap: 'wrap' as const,
  };

  const getPaymentBadgeStyles = (type: 'booking' | 'cash') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.full,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: type === 'booking' ? tokens.colors.primary[100] : tokens.colors.success[100],
    color: type === 'booking' ? tokens.colors.primary[800] : tokens.colors.success[800],
    border: `1px solid ${type === 'booking' ? tokens.colors.primary[200] : tokens.colors.success[200]}`,
  });

  const cashAmountStyles = {
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.success[700],
    fontSize: tokens.typography.fontSize.base,
  };

  const cashRangeStyles = {
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.success[600],
    fontSize: tokens.typography.fontSize.base,
  };

  const conditionsListStyles = {
    margin: 0,
    paddingLeft: tokens.spacing[4],
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    lineHeight: 1.5,
  };

  const conditionItemStyles = {
    marginBottom: tokens.spacing[1],
  };

  const auctionEndStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[700],
    fontWeight: tokens.typography.fontWeight.medium,
    backgroundColor: tokens.colors.warning[50],
    padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
    borderRadius: tokens.borderRadius.sm,
    border: `1px solid ${tokens.colors.warning[200]}`,
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacing[1],
  };

  return (
    <div style={termsSectionStyles}>
      <h4 style={termsHeaderStyles}>
        <span>📋</span>
        <span>Swap Terms</span>
      </h4>

      {/* Payment Types */}
      {swapInfo.paymentTypes && swapInfo.paymentTypes.length > 0 && (
        <div style={termRowStyles}>
          <span style={termLabelStyles}>Accepts:</span>
          <div style={paymentBadgesStyles}>
            {swapInfo.paymentTypes.map(type => (
              <span key={type} style={getPaymentBadgeStyles(type)}>
                <span>{getPaymentTypeIcon(type)}</span>
                <span>{getPaymentTypeLabel(type)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cash Requirements */}
      {(swapInfo.minCashAmount || swapInfo.maxCashAmount) && (
        <div style={termRowStyles}>
          <span style={termLabelStyles}>Cash Range:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
            {swapInfo.minCashAmount && (
              <span style={cashAmountStyles}>
                {formatCurrency(swapInfo.minCashAmount)}
              </span>
            )}
            {swapInfo.minCashAmount && swapInfo.maxCashAmount && (
              <span style={cashRangeStyles}>-</span>
            )}
            {swapInfo.maxCashAmount && (
              <span style={cashAmountStyles}>
                {formatCurrency(swapInfo.maxCashAmount)}
              </span>
            )}
            {!swapInfo.maxCashAmount && swapInfo.minCashAmount && (
              <span style={cashRangeStyles}>minimum</span>
            )}
          </div>
        </div>
      )}

      {/* Swap Conditions */}
      {showFullDetails && swapInfo.swapConditions && swapInfo.swapConditions.length > 0 && (
        <div style={{ marginBottom: tokens.spacing[2] }}>
          <div style={termRowStyles}>
            <span style={{
              ...termLabelStyles,
              alignSelf: 'flex-start',
              marginTop: '2px',
            }}>Conditions:</span>
            <ul style={conditionsListStyles}>
              {swapInfo.swapConditions.map((condition, index) => (
                <li key={index} style={conditionItemStyles}>
                  {condition}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Auction End Date */}
      {swapInfo.acceptanceStrategy === 'auction' && swapInfo.auctionEndDate && (
        <div style={termRowStyles}>
          <span style={termLabelStyles}>Auction End:</span>
          <div style={auctionEndStyles}>
            <span>🔨</span>
            <span>{formatAuctionEndDate(new Date(swapInfo.auctionEndDate))}</span>
          </div>
        </div>
      )}

      {/* Strategy Display */}
      <div style={termRowStyles}>
        <span style={termLabelStyles}>Strategy:</span>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: tokens.spacing[1],
          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          borderRadius: tokens.borderRadius.sm,
          fontSize: tokens.typography.fontSize.xs,
          fontWeight: tokens.typography.fontWeight.medium,
          backgroundColor: swapInfo.acceptanceStrategy === 'auction' ? tokens.colors.warning[100] : tokens.colors.primary[100],
          color: swapInfo.acceptanceStrategy === 'auction' ? tokens.colors.warning[800] : tokens.colors.primary[800],
          border: `1px solid ${swapInfo.acceptanceStrategy === 'auction' ? tokens.colors.warning[200] : tokens.colors.primary[200]}`,
        }}>
          <span>{swapInfo.acceptanceStrategy === 'auction' ? '🔨' : '🔄'}</span>
          <span>
            {swapInfo.acceptanceStrategy === 'auction' ? 'Auction Mode' : 'First Match'}
          </span>
        </div>
      </div>
    </div>
  );
};