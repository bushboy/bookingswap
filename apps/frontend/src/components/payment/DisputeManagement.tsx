import React, { useState, useEffect } from 'react';
import { tokens } from '../../design-system/tokens';
import { paymentService } from '../../services/paymentService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingIndicator';
import { ErrorDisplay } from '../ui/ErrorDisplay';
import { Modal } from '../ui/Modal';
import { FileUpload } from '../ui/FileUpload';

interface Dispute {
  id: string;
  transactionId: string;
  reason: string;
  description: string;
  status: 'pending' | 'under_review' | 'resolved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  resolution?: string;
  evidenceFiles: string[];
}

interface DisputeManagementProps {
  userId: string;
  onRefresh: () => void;
}

export const DisputeManagement: React.FC<DisputeManagementProps> = ({
  userId,
  onRefresh,
}) => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Create dispute form state
  const [transactionId, setTransactionId] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchDisputes();
  }, [userId]);

  const fetchDisputes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Mock data for now - in real implementation, this would call an API
      const mockDisputes: Dispute[] = [
        {
          id: '1',
          transactionId: 'txn_123456789',
          reason: 'Service not provided',
          description: 'The booking was cancelled by the provider without notice',
          status: 'under_review',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-16'),
          evidenceFiles: ['screenshot1.png', 'email_confirmation.pdf'],
        },
        {
          id: '2',
          transactionId: 'txn_987654321',
          reason: 'Unauthorized charge',
          description: 'I was charged twice for the same booking',
          status: 'resolved',
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-12'),
          resolution: 'Duplicate charge refunded to original payment method',
          evidenceFiles: ['bank_statement.pdf'],
        },
      ];
      
      setDisputes(mockDisputes);
    } catch (error: any) {
      setError(error.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDispute = async () => {
    if (!transactionId.trim() || !reason.trim() || !description.trim()) {
      setActionError('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    
    try {
      await paymentService.createDispute({
        transactionId,
        reason,
        description,
        evidence: evidenceFiles,
      });
      
      // Reset form
      setTransactionId('');
      setReason('');
      setDescription('');
      setEvidenceFiles([]);
      setShowCreateModal(false);
      
      // Refresh disputes list
      await fetchDisputes();
      onRefresh();
    } catch (error: any) {
      setActionError(error.message || 'Failed to create dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: Dispute['status']) => {
    switch (status) {
      case 'pending':
        return tokens.colors.warning[600];
      case 'under_review':
        return tokens.colors.primary[600];
      case 'resolved':
        return tokens.colors.success[600];
      case 'rejected':
        return tokens.colors.error[600];
      default:
        return tokens.colors.neutral[500];
    }
  };

  const getStatusIcon = (status: Dispute['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'under_review':
        return '🔍';
      case 'resolved':
        return '✅';
      case 'rejected':
        return '❌';
      default:
        return '❓';
    }
  };

  const getDisputeStats = () => {
    const pending = disputes.filter(d => d.status === 'pending').length;
    const underReview = disputes.filter(d => d.status === 'under_review').length;
    const resolved = disputes.filter(d => d.status === 'resolved').length;
    const rejected = disputes.filter(d => d.status === 'rejected').length;
    
    return { pending, underReview, resolved, rejected, total: disputes.length };
  };

  const stats = getDisputeStats();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: tokens.spacing[8] }}>
        <LoadingSpinner size="lg" />
        <p style={{ 
          marginTop: tokens.spacing[4], 
          color: tokens.colors.neutral[600] 
        }}>
          Loading disputes...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={new Error(error)}
        onRetry={fetchDisputes}
        title="Failed to load disputes"
      />
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                color: tokens.colors.warning[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.pending}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Pending Disputes
            </div>
          </div>
        </Card>

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
              {stats.underReview}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Under Review
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
              {stats.resolved}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Resolved Disputes
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ textAlign: 'center', padding: tokens.spacing[4] }}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                fontWeight: tokens.typography.fontWeight.bold,
                color: tokens.colors.error[600],
                marginBottom: tokens.spacing[2],
              }}
            >
              {stats.rejected}
            </div>
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
              }}
            >
              Rejected Disputes
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

      {/* Header with Create Button */}
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
          Payment Disputes
        </h2>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          disabled={actionLoading}
        >
          + Create Dispute
        </Button>
      </div>

      {/* Disputes List */}
      {disputes.length === 0 ? (
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
              ⚖️
            </div>
            <h3
              style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.medium,
                color: tokens.colors.neutral[700],
                marginBottom: tokens.spacing[2],
              }}
            >
              No Disputes Found
            </h3>
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
                marginBottom: tokens.spacing[4],
              }}
            >
              You haven't created any payment disputes yet
            </p>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              disabled={actionLoading}
            >
              Create Your First Dispute
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
          {disputes.map(dispute => (
            <Card key={dispute.id}>
              <div
                style={{
                  padding: tokens.spacing[4],
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: tokens.spacing[3],
                      marginBottom: tokens.spacing[2],
                    }}
                  >
                    <span style={{ fontSize: tokens.typography.fontSize.lg }}>
                      {getStatusIcon(dispute.status)}
                    </span>
                    <div>
                      <h4
                        style={{
                          fontSize: tokens.typography.fontSize.sm,
                          fontWeight: tokens.typography.fontWeight.medium,
                          color: tokens.colors.neutral[900],
                          margin: 0,
                        }}
                      >
                        Dispute #{dispute.id}
                      </h4>
                      <p
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.colors.neutral[600],
                          margin: 0,
                        }}
                      >
                        Created: {dispute.createdAt.toLocaleDateString()} • 
                        Updated: {dispute.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: tokens.spacing[4],
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[600],
                    }}
                  >
                    <div>
                      <strong>Transaction:</strong> #{dispute.transactionId.slice(-8)}
                    </div>
                    <div>
                      <strong>Reason:</strong> {dispute.reason}
                    </div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span style={{ color: getStatusColor(dispute.status) }}>
                        {dispute.status.replace('_', ' ').charAt(0).toUpperCase() + 
                         dispute.status.replace('_', ' ').slice(1)}
                      </span>
                    </div>
                    <div>
                      <strong>Evidence:</strong> {dispute.evidenceFiles.length} file(s)
                    </div>
                  </div>
                  
                  <div
                    style={{
                      marginTop: tokens.spacing[2],
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.neutral[700],
                    }}
                  >
                    <strong>Description:</strong> {dispute.description}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: tokens.spacing[2],
                    alignItems: 'center',
                  }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setShowDetailsModal(true);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dispute Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create Payment Dispute"
        >
          <div style={{ padding: tokens.spacing[6] }}>
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
                Transaction ID *
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                placeholder="Enter the transaction ID you want to dispute"
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
                Reason for Dispute *
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: tokens.spacing[3],
                  fontSize: tokens.typography.fontSize.sm,
                  border: `1px solid ${tokens.colors.neutral[300]}`,
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor: tokens.colors.white,
                }}
              >
                <option value="">Select a reason</option>
                <option value="Service not provided">Service not provided</option>
                <option value="Unauthorized charge">Unauthorized charge</option>
                <option value="Duplicate charge">Duplicate charge</option>
                <option value="Incorrect amount">Incorrect amount</option>
                <option value="Booking cancelled">Booking cancelled</option>
                <option value="Quality issues">Quality issues</option>
                <option value="Other">Other</option>
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
                Detailed Description *
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Please provide a detailed description of the issue..."
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
                Supporting Evidence (Optional)
              </label>
              <FileUpload
                onFilesChange={setEvidenceFiles}
                accept="image/*,.pdf,.doc,.docx"
                multiple={true}
                maxFiles={5}
                maxSize={10} // 10MB
              />
              <p
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.neutral[500],
                  marginTop: tokens.spacing[1],
                }}
              >
                Upload screenshots, emails, receipts, or other relevant documents
              </p>
            </div>
            
            <div
              style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateDispute}
                loading={actionLoading}
                disabled={!transactionId.trim() || !reason.trim() || !description.trim()}
              >
                Create Dispute
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Dispute Details Modal */}
      {showDetailsModal && selectedDispute && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title={`Dispute #${selectedDispute.id}`}
        >
          <div style={{ padding: tokens.spacing[6] }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: tokens.spacing[4],
                marginBottom: tokens.spacing[6],
                fontSize: tokens.typography.fontSize.sm,
              }}
            >
              <div>
                <strong>Transaction ID:</strong><br />
                #{selectedDispute.transactionId}
              </div>
              <div>
                <strong>Status:</strong><br />
                <span style={{ color: getStatusColor(selectedDispute.status) }}>
                  {selectedDispute.status.replace('_', ' ').charAt(0).toUpperCase() + 
                   selectedDispute.status.replace('_', ' ').slice(1)}
                </span>
              </div>
              <div>
                <strong>Created:</strong><br />
                {selectedDispute.createdAt.toLocaleDateString()}
              </div>
              <div>
                <strong>Last Updated:</strong><br />
                {selectedDispute.updatedAt.toLocaleDateString()}
              </div>
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <h4
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[900],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Reason
              </h4>
              <p
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[700],
                  margin: 0,
                }}
              >
                {selectedDispute.reason}
              </p>
            </div>

            <div style={{ marginBottom: tokens.spacing[4] }}>
              <h4
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  color: tokens.colors.neutral[900],
                  marginBottom: tokens.spacing[2],
                }}
              >
                Description
              </h4>
              <p
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.colors.neutral[700],
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {selectedDispute.description}
              </p>
            </div>

            {selectedDispute.evidenceFiles.length > 0 && (
              <div style={{ marginBottom: tokens.spacing[4] }}>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[900],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Evidence Files
                </h4>
                <ul
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[700],
                    margin: 0,
                    paddingLeft: tokens.spacing[4],
                  }}
                >
                  {selectedDispute.evidenceFiles.map((file, index) => (
                    <li key={index}>{file}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedDispute.resolution && (
              <div style={{ marginBottom: tokens.spacing[4] }}>
                <h4
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: tokens.colors.neutral[900],
                    marginBottom: tokens.spacing[2],
                  }}
                >
                  Resolution
                </h4>
                <p
                  style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.success[700],
                    margin: 0,
                    lineHeight: 1.5,
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.success[50],
                    border: `1px solid ${tokens.colors.success[200]}`,
                    borderRadius: tokens.borderRadius.md,
                  }}
                >
                  {selectedDispute.resolution}
                </p>
              </div>
            )}
            
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};