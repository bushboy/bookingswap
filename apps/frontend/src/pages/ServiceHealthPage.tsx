import React from 'react';
import { ServiceHealthDashboard } from '../components/monitoring/ServiceHealthDashboard';

/**
 * Service Health Monitoring Page
 * 
 * Main page component for the service health dashboard.
 * Provides access to real-time service monitoring interface.
 * Requirements: 3.1, 3.2
 */
export const ServiceHealthPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
                <ServiceHealthDashboard />
            </div>
        </div>
    );
};