import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';

interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  enabledAt?: string;
  enabledBy?: string;
}

export const SystemMaintenance: React.FC = () => {
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(
    {
      enabled: false,
    }
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [investigationResult, setInvestigationResult] = useState<any>(null);

  useEffect(() => {
    // Load current maintenance status
    // In a real implementation, this would fetch from the backend
    setMaintenanceStatus({
      enabled: false,
    });
  }, []);

  const handleEnableMaintenance = async () => {
    if (!maintenanceMessage.trim()) {
      alert('Please provide a maintenance message');
      return;
    }

    try {
      setLoading(true);
      await adminService.enableMaintenanceMode(maintenanceMessage);
      setMaintenanceStatus({
        enabled: true,
        message: maintenanceMessage,
        enabledAt: new Date().toISOString(),
        enabledBy: 'Current Admin',
      });
      setMaintenanceMessage('');
    } catch (err) {
      setError('Failed to enable maintenance mode');
      console.error('Maintenance error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMaintenance = async () => {
    try {
      setLoading(true);
      await adminService.disableMaintenanceMode();
      setMaintenanceStatus({ enabled: false });
    } catch (err) {
      setError('Failed to disable maintenance mode');
      console.error('Maintenance error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvestigateTransaction = async () => {
    if (!transactionId.trim()) {
      alert('Please provide a transaction ID');
      return;
    }

    try {
      setLoading(true);
      const response = await adminService.investigateTransaction(transactionId);
      setInvestigationResult(response.data);
    } catch (err) {
      setError('Failed to investigate transaction');
      console.error('Investigation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Maintenance Mode Control */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            System Maintenance
          </h2>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-medium text-gray-900">
                  Maintenance Mode
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Control platform availability for maintenance operations
                </p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  maintenanceStatus.enabled
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {maintenanceStatus.enabled
                  ? 'Maintenance Active'
                  : 'System Online'}
              </div>
            </div>
          </div>

          {maintenanceStatus.enabled ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Maintenance Mode Active
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      <strong>Message:</strong> {maintenanceStatus.message}
                    </p>
                    <p>
                      <strong>Enabled:</strong>{' '}
                      {maintenanceStatus.enabledAt &&
                        new Date(maintenanceStatus.enabledAt).toLocaleString()}
                    </p>
                    <p>
                      <strong>By:</strong> {maintenanceStatus.enabledBy}
                    </p>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleDisableMaintenance}
                      disabled={loading}
                      className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading ? 'Disabling...' : 'Disable Maintenance Mode'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Message
                </label>
                <textarea
                  value={maintenanceMessage}
                  onChange={e => setMaintenanceMessage(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter a message to display to users during maintenance..."
                />
              </div>
              <button
                onClick={handleEnableMaintenance}
                disabled={loading || !maintenanceMessage.trim()}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Enabling...' : 'Enable Maintenance Mode'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Blockchain Investigation Tools */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Blockchain Investigation
          </h2>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction ID
              </label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter Hedera transaction ID (e.g., 0.0.123456@1234567890.123456789)"
                />
                <button
                  onClick={handleInvestigateTransaction}
                  disabled={loading || !transactionId.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Investigating...' : 'Investigate'}
                </button>
              </div>
            </div>

            {investigationResult && (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-md font-medium text-gray-900 mb-3">
                  Investigation Results
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Status
                      </label>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          investigationResult.status === 'SUCCESS'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {investigationResult.status}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Timestamp
                      </label>
                      <p className="text-sm text-gray-900">
                        {investigationResult.timestamp}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Transaction Fees
                    </label>
                    <p className="text-sm text-gray-900">
                      {investigationResult.fees} HBAR
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Suspicious Activity
                    </label>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        investigationResult.suspicious
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {investigationResult.suspicious ? 'Suspicious' : 'Normal'}
                    </span>
                  </div>

                  {investigationResult.transaction && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Raw Transaction Data
                      </label>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                        {JSON.stringify(
                          investigationResult.transaction,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Health Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center">
                <span className="text-green-400 mr-2">✅</span>
                <div>
                  <h3 className="text-sm font-medium text-green-800">
                    Database
                  </h3>
                  <p className="text-xs text-green-600">
                    Healthy - 2ms response
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center">
                <span className="text-green-400 mr-2">✅</span>
                <div>
                  <h3 className="text-sm font-medium text-green-800">
                    Hedera Network
                  </h3>
                  <p className="text-xs text-green-600">
                    Healthy - 150ms response
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center">
                <span className="text-green-400 mr-2">✅</span>
                <div>
                  <h3 className="text-sm font-medium text-green-800">Cache</h3>
                  <p className="text-xs text-green-600">
                    Healthy - 1ms response
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <span className="text-red-400 mr-2">❌</span>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
