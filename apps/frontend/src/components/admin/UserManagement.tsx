import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { WALLET_CONFIG } from '../../../tests/fixtures/wallet-config';

interface User {
  id: string;
  walletAddress: string;
  profile: {
    displayName?: string;
    email?: string;
  };
  verification: {
    level: 'basic' | 'verified' | 'premium';
  };
  reputation: {
    score: number;
    completedSwaps: number;
    cancelledSwaps: number;
  };
  isActive: boolean;
  isFlagged: boolean;
  flagDetails?: {
    reason: string;
    severity: 'warning' | 'suspension' | 'ban';
    flaggedAt: string;
    expiresAt?: string;
  };
  createdAt: string;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [flagForm, setFlagForm] = useState({
    reason: '',
    severity: 'warning' as 'warning' | 'suspension' | 'ban',
    expiresAt: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      // Mock user data since we don't have a real endpoint
      const mockUsers: User[] = [
        {
          id: '1',
          walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
          profile: {
            displayName: 'John Doe',
            email: 'john@example.com',
          },
          verification: { level: 'verified' },
          reputation: {
            score: 4.8,
            completedSwaps: 15,
            cancelledSwaps: 1,
          },
          isActive: true,
          isFlagged: false,
          createdAt: '2024-01-15T10:00:00Z',
        },
        {
          id: '2',
          walletAddress: '0.0.789012',
          profile: {
            displayName: 'Jane Smith',
            email: 'jane@example.com',
          },
          verification: { level: 'premium' },
          reputation: {
            score: 4.9,
            completedSwaps: 32,
            cancelledSwaps: 0,
          },
          isActive: true,
          isFlagged: true,
          flagDetails: {
            reason: 'Suspicious activity reported',
            severity: 'warning',
            flaggedAt: '2024-02-01T14:30:00Z',
          },
          createdAt: '2023-12-01T08:00:00Z',
        },
      ];
      setUsers(mockUsers);
    } catch (err) {
      setError('Failed to load users');
      console.error('Users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFlagUser = async (userId: string) => {
    if (!flagForm.reason) {
      alert('Please provide a reason for flagging');
      return;
    }

    try {
      await adminService.flagUser(userId, {
        reason: flagForm.reason,
        severity: flagForm.severity,
        expiresAt: flagForm.expiresAt || undefined,
      });
      setSelectedUser(null);
      setFlagForm({ reason: '', severity: 'warning', expiresAt: '' });
      loadUsers();
    } catch (err) {
      console.error('Error flagging user:', err);
      alert('Failed to flag user');
    }
  };

  const handleUnflagUser = async (userId: string) => {
    try {
      await adminService.unflagUser(userId);
      loadUsers();
    } catch (err) {
      console.error('Error unflagging user:', err);
      alert('Failed to unflag user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.profile.displayName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      user.walletAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.profile.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && user.isActive) ||
      (filterStatus === 'flagged' && user.isFlagged) ||
      (filterStatus === 'verified' && user.verification.level !== 'basic');

    return matchesSearch && matchesFilter;
  });

  const getVerificationColor = (level: string) => {
    switch (level) {
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'basic':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ban':
        return 'bg-red-100 text-red-800';
      case 'suspension':
        return 'bg-orange-100 text-orange-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
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
              User Management
            </h2>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Users</option>
                <option value="active">Active</option>
                <option value="flagged">Flagged</option>
                <option value="verified">Verified</option>
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
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reputation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {user.profile.displayName?.charAt(0) ||
                              user.walletAddress.slice(-2)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.profile.displayName || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.walletAddress}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVerificationColor(user.verification.level)}`}
                    >
                      {user.verification.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">
                        ⭐ {user.reputation.score.toFixed(1)}
                      </div>
                      <div className="text-gray-500">
                        {user.reputation.completedSwaps} completed,{' '}
                        {user.reputation.cancelledSwaps} cancelled
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col space-y-1">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {user.isFlagged && user.flagDetails && (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(user.flagDetails.severity)}`}
                        >
                          {user.flagDetails.severity}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      View
                    </button>
                    {user.isFlagged ? (
                      <button
                        onClick={() => handleUnflagUser(user.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Unflag
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Flag
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && !loading && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  User Details -{' '}
                  {selectedUser.profile.displayName ||
                    selectedUser.walletAddress}
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Display Name
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedUser.profile.displayName || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedUser.profile.email || 'Not set'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Wallet Address
                  </label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">
                    {selectedUser.walletAddress}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Verification Level
                    </label>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVerificationColor(selectedUser.verification.level)}`}
                    >
                      {selectedUser.verification.level}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Reputation Score
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      ⭐ {selectedUser.reputation.score.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Swap History
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedUser.reputation.completedSwaps} completed,{' '}
                      {selectedUser.reputation.cancelledSwaps} cancelled
                    </p>
                  </div>
                </div>

                {selectedUser.isFlagged && selectedUser.flagDetails && (
                  <div className="bg-red-50 p-4 rounded-md">
                    <h4 className="font-medium text-red-800">
                      User is Flagged
                    </h4>
                    <p className="text-sm text-red-700 mt-1">
                      <strong>Reason:</strong> {selectedUser.flagDetails.reason}
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      <strong>Severity:</strong>{' '}
                      {selectedUser.flagDetails.severity}
                    </p>
                    <p className="text-sm text-red-600 mt-1">
                      Flagged on{' '}
                      {new Date(
                        selectedUser.flagDetails.flaggedAt
                      ).toLocaleDateString()}
                      {selectedUser.flagDetails.expiresAt && (
                        <span>
                          {' '}
                          - Expires on{' '}
                          {new Date(
                            selectedUser.flagDetails.expiresAt
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {!selectedUser.isFlagged && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">
                      Flag User
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Reason
                        </label>
                        <input
                          type="text"
                          value={flagForm.reason}
                          onChange={e =>
                            setFlagForm({ ...flagForm, reason: e.target.value })
                          }
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="Reason for flagging this user"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Severity
                        </label>
                        <select
                          value={flagForm.severity}
                          onChange={e =>
                            setFlagForm({
                              ...flagForm,
                              severity: e.target.value as any,
                            })
                          }
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          <option value="warning">Warning</option>
                          <option value="suspension">Suspension</option>
                          <option value="ban">Ban</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Expires At (Optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={flagForm.expiresAt}
                          onChange={e =>
                            setFlagForm({
                              ...flagForm,
                              expiresAt: e.target.value,
                            })
                          }
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={() => setSelectedUser(null)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleFlagUser(selectedUser.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                        >
                          Flag User
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
