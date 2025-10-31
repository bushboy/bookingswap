import React, { useState } from 'react';
import { PaymentMethod } from '@booking-swap/shared';
import { tokens } from '../../design-system/tokens';
import { paymentService } from '../../services/paymentService';
import { PaymentMethodCard } from './PaymentMethodCard';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { PaymentVerificationModal } from './PaymentVerificationModal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingIndicator';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { Modal } from '../ui/Modal';

interface PaymentMethodManagementProps {
  userId: string;
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const PaymentMethodManagement: React.FC<PaymentMethodManagementProps> = ({
  userId,
  paymentMethods,
  loading,
  error,
  onRefresh,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedMethodForVerification, setSelectedMethodForVerification] = useState<PaymentMethod | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAddPaymentMethod = async (methodData: any) => {
    setActionLoading(true);
    setActionError(null);
    
    try {
      await paymentService.addPaymentMethod(methodData);
      setShowAddModal(false);
      onRefresh();
    } catch (error: any) {
      setActionError(error.message || 'Failed to add payment method');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPaymentMethod = (method: PaymentMethod) => {
    setSelectedMethodForVerification(method);
    setShowVerificationModal(true);
  };

  const handleVerificationComplete = async (verificationData: any) => {
    if (!selectedMethodForVerification) return;

    setActionLoading(true);
    setActionError(null);
    
    try {
      await paymentService.verifyPaymentMethod(
        selectedMethodForVerification.id,
        verificationData
      );
      setShowVerificationModal(false);
      setSelectedMethodForVerification(null);
      onRefresh();
    } catch (error: any) {
      setActionError(error.message || 'Failed to verify payment method');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePaymentMethod = (method: PaymentMethod) => {
    setMethodToDelete(method);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePaymentMethod = async () => {
    if (!methodToDelete) return;

    setActionLoading(true);
    setActionError(null);
    
    try {
      await paymentService.removePaymentMethod(methodToDelete.id);
      setShowDeleteConfirm(false);
      setMethodToDelete(null);
      onRefresh();
    } catch (error: any) {
      setActionError(error.message || 'Failed to delete payment method');
    } finally {
      setActionLoading(false);
    }
  };

  const getPaymentMethodStats = () => {
    const verified = paymentMethods.filter(method => method.isVerified).length;
    const unverified = paymentMethods.filter(method => !method.isVerified).length;
    
    return { verified, unverified, total: paymentMethods.length };
  };

  const stats = getPaymentMethodStats();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: tokens.spacing[8] }}>
        <LoadingSpinner size="lg" />
        <p style={{ 
          marginTop: tokens.spacing[4], 
          color: tokens.colors.neutral[600] 
        }}>
          Loading payment methods...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={new Error(error)}
        onRetry={onRefresh}
        title="Failed to load payment methods"
      />
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: tokens.spacing[4],
          marginBottom: tokens.spacing[6],
        }}
      >
        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.primary[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.total}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Total Payment Methods
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.success[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.verified}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Verified Methods
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.warning[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.unverified}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Pending Verification
            </div>
          </div>
        </Card>
      </div>

      {/* Action Error */}
      {actionError && (
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
          {actionError}
        </div>
      )}

      {/* Header with Add Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: tokens.spacing[4],
        }}
      >
        <h2
          style={{
            fontSize: tokens.typography.fontSize.xl,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
            margin: 0,
          }}
        >
          Your Payment Methods
        </h2>
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          disabled={actionLoading}
        >
          + Add Payment Method
        </Button>
      </div>

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <Card>
          <div
            style={{
              textAlign: 'center',
              padding: tokens.spacing[8],
            }}
          >
            <div
              style={{
                fontSize: tokens.typography.fontSize['4xl'],
                marginBottom: tokens.spacing[4],
              }}
            >
              💳
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[2],
              }}
            >
              No Payment Methods Found
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                marginBottom: tokens.spacing[4],
              }}
            >
              Add a payment method to start making secure transactions
            </p>
            <Button
              variant="primary"
              onClick={() => setShowAddModal(true)}
              disabled={actionLoading}
            >
              Add Your First Payment Method
            </Button>
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: tokens.spacing[4],
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          }}
        >
          {paymentMethods.map(method => (
            <div key={method.id} style={{ position: 'relative' }}>
              <PaymentMethodCard
                method={method}
                isSelected={false}
                onSelect={() => {}}
                amount={0}
                currency="USD"
                showActions
                onVerify={() => handleVerifyPaymentMethod(method)}
                onDelete={() => handleDeletePaymentMethod(method)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddModal && (
        <AddPaymentMethodModal
          onSubmit={handleAddPaymentMethod}
          onCancel={() => setShowAddModal(false)}
          loading={actionLoading}
        />
      )}

      {/* Payment Verification Modal */}
      {showVerificationModal && selectedMethodForVerification && (
        <PaymentVerificationModal
          paymentMethod={selectedMethodForVerification}
          onCancel={() => {
            setShowVerificationModal(false);
            setSelectedMethodForVerification(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && methodToDelete && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Payment Method"
        >
          <div style={{ padding: tokens.spacing[6] }}>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[4],
              }}
            >
              Are you sure you want to delete the payment method "{methodToDelete.displayName}"? 
              This action cannot be undone.
            </p>
            
            <div
              style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDeletePaymentMethod}
                loading={actionLoading}
              >
                Delete Payment Method
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};