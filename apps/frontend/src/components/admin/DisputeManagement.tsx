import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';

interface DisputeCase {
  id: string;
  swapId: string;
  reporterId: string;
  reportedUserId: string;
  type: 'fraud' | 'booking_invalid' | 'payment_issue' | 'other';
  description: string;
  evidence: string[];
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolution?: {
    action: string;
    notes: string;
    resolvedBy: string;
    resolvedAt: string;
  };
}

export const DisputeManagement: React.FC = () => {
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<DisputeCase | null>(
    null
  );
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [resolutionForm, setResolutionForm] = useState({
    action: '',
    notes: '',
  });

  useEffect(() => {
    loadDisputes();
  }, [filterStatus]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const response = await adminService.getDisputes(
        filterStatus === 'all' ? undefined : filterStatus
      );
      setDisputes(response.data);
    } catch (err) {
      setError('Failed to load disputes');
      console.error('Disputes error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (disputeId: string) => {
    if (!resolutionForm.action || !resolutionForm.notes) {
      alert('Please provide both action and notes');
      return;
    }

    try {
      await adminService.resolveDispute(disputeId, resolutionForm);
      setSelectedDispute(null);
      setResolutionForm({ action: '', notes: '' });
      loadDisputes();
    } catch (err) {
      console.error('Error resolving dispute:', err);
      alert('Failed to resolve dispute');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Dispute Management
            </h2>
            <div className="flex items-center space-x-4">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Disputes</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {disputes.map(dispute => (
                <tr key={dispute.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {dispute.id.slice(-8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {dispute.type.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(dispute.priority)}`}
                    >
                      {dispute.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(dispute.status)}`}
                    >
                      {dispute.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedDispute(dispute)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View
                    </button>
                    {dispute.status !== 'resolved' &&
                      dispute.status !== 'closed' && (
                        <button
                          onClick={() => setSelectedDispute(dispute)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Resolve
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {disputes.length === 0 && !loading && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No disputes found</p>
          </div>
        )}
      </div>

      {/* Dispute Detail Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Dispute Details - {selectedDispute.id.slice(-8)}
                </h3>
                <button
                  onClick={() => setSelectedDispute(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Type
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedDispute.type.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Priority
                    </label>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(selectedDispute.priority)}`}
                    >
                      {selectedDispute.priority}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedDispute.description}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Swap ID
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedDispute.swapId}
                  </p>
                </div>

                {selectedDispute.evidence.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Evidence
                    </label>
                    <ul className="mt-1 text-sm text-gray-900">
                      {selectedDispute.evidence.map((evidence, index) => (
                        <li
                          key={index}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <a
                            href={evidence}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Evidence {index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedDispute.resolution && (
                  <div className="bg-green-50 p-4 rounded-md">
                    <h4 className="font-medium text-green-800">Resolution</h4>
                    <p className="text-sm text-green-700 mt-1">
                      <strong>Action:</strong>{' '}
                      {selectedDispute.resolution.action}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      <strong>Notes:</strong> {selectedDispute.resolution.notes}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Resolved by {selectedDispute.resolution.resolvedBy} on{' '}
                      {new Date(
                        selectedDispute.resolution.resolvedAt
                      ).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {selectedDispute.status !== 'resolved' &&
                  selectedDispute.status !== 'closed' && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">
                        Resolve Dispute
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Action Taken
                          </label>
                          <input
                            type="text"
                            value={resolutionForm.action}
                            onChange={e =>
                              setResolutionForm({
                                ...resolutionForm,
                                action: e.target.value,
                              })
                            }
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="e.g., User suspended, Refund issued"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Resolution Notes
                          </label>
                          <textarea
                            value={resolutionForm.notes}
                            onChange={e =>
                              setResolutionForm({
                                ...resolutionForm,
                                notes: e.target.value,
                              })
                            }
                            rows={3}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Detailed explanation of the resolution"
                          />
                        </div>
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => setSelectedDispute(null)}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              handleResolveDispute(selectedDispute.id)
                            }
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                          >
                            Resolve Dispute
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
