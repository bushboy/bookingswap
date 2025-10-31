import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { DisputeManagement } from '../components/admin/DisputeManagement';
import { UserManagement } from '../components/admin/UserManagement';
import { SystemMaintenance } from '../components/admin/SystemMaintenance';
import { useAppSelector } from '../store/hooks';

type AdminTab = 'dashboard' | 'disputes' | 'users' | 'maintenance';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const navigate = useNavigate();
  const user = useAppSelector(state => state.auth.user);

  useEffect(() => {
    // Check if user has admin privileges
    // In a real implementation, this would check the user's role
    if (!user) {
      console.log('🔒 LOGIN REDIRECT TRIGGERED by AdminPage:', {
        component: 'AdminPage',
        reason: 'User not authenticated for admin access',
        conditions: {
          hasUser: !!user,
          userRole: user?.role || 'none'
        },
        redirectTo: '/login',
        timestamp: new Date().toISOString()
      });
      navigate('/login');
      return;
    }

    // Mock admin check - in production, verify with backend
    const isAdmin =
      user.walletAddress === '0.0.123456' ||
      user.walletAddress === '0.0.789012';
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);

  const tabs = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: '📊' },
    { id: 'disputes' as AdminTab, label: 'Disputes', icon: '⚖️' },
    { id: 'users' as AdminTab, label: 'Users', icon: '👥' },
    { id: 'maintenance' as AdminTab, label: 'Maintenance', icon: '🔧' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'disputes':
        return <DisputeManagement />;
      case 'users':
        return <UserManagement />;
      case 'maintenance':
        return <SystemMaintenance />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Admin: {user?.profile.displayName || user?.walletAddress}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow p-4">
              <ul className="space-y-2">
                {tabs.map(tab => (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-2 text-left rounded-md transition-colors ${activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <span className="mr-3">{tab.icon}</span>
                      {tab.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">{renderTabContent()}</div>
        </div>
      </div>
    </div>
  );
};
