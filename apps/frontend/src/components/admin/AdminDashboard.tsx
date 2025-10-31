import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';

interface PlatformStatistics {
  users: {
    total: number;
    active: number;
    verified: number;
    flagged: number;
  };
  bookings: {
    total: number;
    available: number;
    swapped: number;
    cancelled: number;
  };
  swaps: {
    total: number;
    pending: number;
    completed: number;
    rejected: number;
  };
  blockchain: {
    totalTransactions: number;
    failedTransactions: number;
    averageTransactionTime: number;
  };
  revenue: {
    totalVolume: number;
    platformFees: number;
    monthlyGrowth: number;
  };
}

interface RecentActivity {
  id: string;
  type: string;
  status: string;
  sourceBooking?: {
    id: string;
    title: string;
  };
  targetBooking?: {
    id: string;
    title: string;
  };
  proposer?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    name: string;
  };
  updatedAt: string;
}

export const AdminDashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<PlatformStatistics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, activityResponse] = await Promise.all([
        adminService.getStatistics(),
        adminService.getRecentActivity(20),
      ]);

      setStatistics(statsResponse.data);
      setRecentActivity(activityResponse.data);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-600">
          <p>{error}</p>
          <button
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const StatCard: React.FC<{
    title: string;
    value: number;
    subtitle?: string;
    color?: string;
  }> = ({ title, value, subtitle, color = 'blue' }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold text-${color}-600`}>
            {value.toLocaleString()}
          </p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Platform Statistics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Platform Overview
        </h2>

        {/* User Statistics */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-700 mb-3">Users</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={statistics?.users.total || 0}
              color="blue"
            />
            <StatCard
              title="Active Users"
              value={statistics?.users.active || 0}
              color="green"
            />
            <StatCard
              title="Verified Users"
              value={statistics?.users.verified || 0}
              color="purple"
            />
            <StatCard
              title="Flagged Users"
              value={statistics?.users.flagged || 0}
              color="red"
            />
          </div>
        </div>

        {/* Booking Statistics */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-700 mb-3">Bookings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Bookings"
              value={statistics?.bookings.total || 0}
              color="blue"
            />
            <StatCard
              title="Available"
              value={statistics?.bookings.available || 0}
              color="green"
            />
            <StatCard
              title="Swapped"
              value={statistics?.bookings.swapped || 0}
              color="purple"
            />
            <StatCard
              title="Cancelled"
              value={statistics?.bookings.cancelled || 0}
              color="red"
            />
          </div>
        </div>

        {/* Swap Statistics */}
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-700 mb-3">Swaps</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Swaps"
              value={statistics?.swaps.total || 0}
              color="blue"
            />
            <StatCard
              title="Pending"
              value={statistics?.swaps.pending || 0}
              color="yellow"
            />
            <StatCard
              title="Completed"
              value={statistics?.swaps.completed || 0}
              color="green"
            />
            <StatCard
              title="Rejected"
              value={statistics?.swaps.rejected || 0}
              color="red"
            />
          </div>
        </div>

        {/* Blockchain & Revenue Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-3">
              Blockchain
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <StatCard
                title="Total Transactions"
                value={statistics?.blockchain.totalTransactions || 0}
                color="blue"
              />
              <StatCard
                title="Failed Transactions"
                value={statistics?.blockchain.failedTransactions || 0}
                color="red"
              />
              <StatCard
                title="Avg Transaction Time"
                value={statistics?.blockchain.averageTransactionTime || 0}
                subtitle="seconds"
                color="green"
              />
            </div>
          </div>

          <div>
            <h3 className="text-md font-medium text-gray-700 mb-3">Revenue</h3>
            <div className="grid grid-cols-1 gap-4">
              <StatCard
                title="Total Volume"
                value={statistics?.revenue.totalVolume || 0}
                subtitle="USD"
                color="green"
              />
              <StatCard
                title="Platform Fees"
                value={statistics?.revenue.platformFees || 0}
                subtitle="USD"
                color="blue"
              />
              <StatCard
                title="Monthly Growth"
                value={statistics?.revenue.monthlyGrowth || 0}
                subtitle="%"
                color="purple"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentActivity.map(activity => (
                  <tr key={activity.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {activity.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          activity.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : activity.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : activity.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {activity.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {activity.sourceBooking && activity.targetBooking && (
                        <div>
                          <div className="font-medium">
                            {activity.proposer?.name || 'Unknown'}
                          </div>
                          <div className="text-gray-500">
                            {activity.sourceBooking.title} ↔{' '}
                            {activity.targetBooking.title}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(activity.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
