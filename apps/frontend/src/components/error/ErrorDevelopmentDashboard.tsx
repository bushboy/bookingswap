import React, { useState, useEffect } from 'react';
import ErrorMonitoringDashboard from './ErrorMonitoringDashboard';
import ErrorSimulator from './ErrorSimulator';
import { errorDebugger, DebugSession } from '@/utils/errorDebugger';
import { errorAnalyticsService } from '@/services/errorAnalyticsService';
import { errorLoggingService } from '@/services/errorLoggingService';
import './ErrorDevelopmentDashboard.css';

/**
 * Comprehensive development dashboard for error debugging and testing
 * Only available in development mode
 */
export const ErrorDevelopmentDashboard: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'monitoring' | 'simulator' | 'debugger' | 'analytics'>('monitoring');
    const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
    const [currentSession, setCurrentSession] = useState<DebugSession | null>(null);
    const [isSessionActive, setIsSessionActive] = useState(false);

    // Only render in development mode
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    useEffect(() => {
        // Update debug sessions
        const sessions = errorDebugger.getDebugSessions();
        setDebugSessions(sessions);
    }, [isVisible]);

    const handleStartDebugSession = () => {
        const sessionId = errorDebugger.startDebugSession();
        setIsSessionActive(true);

        // Refresh sessions list
        const sessions = errorDebugger.getDebugSessions();
        setDebugSessions(sessions);
        setCurrentSession(sessions.find(s => s.sessionId === sessionId) || null);
    };

    const handleEndDebugSession = () => {
        const endedSession = errorDebugger.endDebugSession();
        setIsSessionActive(false);
        setCurrentSession(endedSession);

        // Refresh sessions list
        const sessions = errorDebugger.getDebugSessions();
        setDebugSessions(sessions);
    };

    const handleExportDebugReport = () => {
        const report = errorDebugger.exportDebugReport();
        const blob = new Blob([report], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-debug-report-${new Date().toISOString().slice(0, 19)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClearDebugData = () => {
        if (confirm('Are you sure you want to clear all debug data? This cannot be undone.')) {
            errorDebugger.clearDebugData();
            errorLoggingService.clearSessionErrors();
            setDebugSessions([]);
            setCurrentSession(null);
            setIsSessionActive(false);
        }
    };

    const handleAddDebugNote = () => {
        const note = prompt('Enter debug note:');
        if (note) {
            errorDebugger.addDebugNote(note);
        }
    };

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="error-dev-dashboard-toggle"
                title="Open Error Development Dashboard"
                type="button"
            >
                🛠️ Error Dev Tools
            </button>
        );
    }

    return (
        <div className="error-dev-dashboard">
            <div className="dashboard-header">
                <h2>🛠️ Error Development Dashboard</h2>
                <div className="dashboard-controls">
                    <div className="session-controls">
                        {!isSessionActive ? (
                            <button
                                onClick={handleStartDebugSession}
                                className="start-session-button"
                                type="button"
                            >
                                🎬 Start Debug Session
                            </button>
                        ) : (
                            <button
                                onClick={handleEndDebugSession}
                                className="end-session-button"
                                type="button"
                            >
                                ⏹️ End Debug Session
                            </button>
                        )}

                        {isSessionActive && (
                            <button
                                onClick={handleAddDebugNote}
                                className="add-note-button"
                                type="button"
                            >
                                📝 Add Note
                            </button>
                        )}
                    </div>

                    <div className="export-controls">
                        <button
                            onClick={handleExportDebugReport}
                            className="export-button"
                            type="button"
                        >
                            📤 Export Report
                        </button>

                        <button
                            onClick={handleClearDebugData}
                            className="clear-button"
                            type="button"
                        >
                            🗑️ Clear Data
                        </button>
                    </div>

                    <button
                        onClick={() => setIsVisible(false)}
                        className="close-button"
                        type="button"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="dashboard-tabs">
                <button
                    onClick={() => setActiveTab('monitoring')}
                    className={`tab-button ${activeTab === 'monitoring' ? 'active' : ''}`}
                    type="button"
                >
                    📊 Monitoring
                </button>
                <button
                    onClick={() => setActiveTab('simulator')}
                    className={`tab-button ${activeTab === 'simulator' ? 'active' : ''}`}
                    type="button"
                >
                    🧪 Simulator
                </button>
                <button
                    onClick={() => setActiveTab('debugger')}
                    className={`tab-button ${activeTab === 'debugger' ? 'active' : ''}`}
                    type="button"
                >
                    🐛 Debugger
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                    type="button"
                >
                    📈 Analytics
                </button>
            </div>

            <div className="dashboard-content">
                {activeTab === 'monitoring' && (
                    <div className="tab-content">
                        <ErrorMonitoringDashboard
                            showDetails={true}
                            refreshInterval={2000}
                            maxRecentErrors={15}
                        />
                    </div>
                )}

                {activeTab === 'simulator' && (
                    <div className="tab-content">
                        <ErrorSimulator isVisible={true} />
                    </div>
                )}

                {activeTab === 'debugger' && (
                    <div className="tab-content">
                        <div className="debugger-panel">
                            <div className="session-status">
                                <h3>Debug Session Status</h3>
                                {isSessionActive ? (
                                    <div className="status-active">
                                        <span className="status-indicator active">🟢</span>
                                        <span>Session Active</span>
                                        {currentSession && (
                                            <span className="session-info">
                                                ID: {currentSession.sessionId.slice(-8)}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="status-inactive">
                                        <span className="status-indicator inactive">🔴</span>
                                        <span>No Active Session</span>
                                    </div>
                                )}
                            </div>

                            <div className="debug-sessions">
                                <h3>Debug Sessions ({debugSessions.length})</h3>
                                {debugSessions.length === 0 ? (
                                    <p className="no-sessions">No debug sessions recorded</p>
                                ) : (
                                    <div className="sessions-list">
                                        {debugSessions.slice(-5).reverse().map((session) => (
                                            <div key={session.sessionId} className="session-item">
                                                <div className="session-header">
                                                    <span className="session-id">
                                                        {session.sessionId.slice(-8)}
                                                    </span>
                                                    <span className="session-time">
                                                        {session.startTime.toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div className="session-stats">
                                                    <span>Errors: {session.errors.length}</span>
                                                    <span>Actions: {session.actions.length}</span>
                                                    <span>Notes: {session.notes.length}</span>
                                                </div>
                                                {session.notes.length > 0 && (
                                                    <div className="session-notes">
                                                        <strong>Latest Note:</strong>
                                                        <span>{session.notes[session.notes.length - 1]}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="debug-tools">
                                <h3>Debug Tools</h3>
                                <div className="tools-grid">
                                    <button
                                        onClick={() => {
                                            const report = errorDebugger.generateDebugReport();
                                            console.log('Debug Report:', report);
                                        }}
                                        className="tool-button"
                                        type="button"
                                    >
                                        🖨️ Log Report to Console
                                    </button>

                                    <button
                                        onClick={() => {
                                            const patterns = errorAnalyticsService.detectPatterns();
                                            console.log('Error Patterns:', patterns);
                                        }}
                                        className="tool-button"
                                        type="button"
                                    >
                                        🔍 Detect Patterns
                                    </button>

                                    <button
                                        onClick={() => {
                                            const analytics = errorAnalyticsService.exportAnalytics('json');
                                            console.log('Analytics Export:', JSON.parse(analytics));
                                        }}
                                        className="tool-button"
                                        type="button"
                                    >
                                        📊 Export Analytics
                                    </button>

                                    <button
                                        onClick={() => {
                                            // Trigger a test error for debugging
                                            errorDebugger.trackDebugAction('manual_test', {
                                                message: 'Manual test action triggered',
                                                timestamp: new Date(),
                                            });
                                        }}
                                        className="tool-button"
                                        type="button"
                                    >
                                        🧪 Test Debug Action
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="tab-content">
                        <div className="analytics-panel">
                            <h3>Error Analytics</h3>
                            <AnalyticsView />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * Analytics view component
 */
const AnalyticsView: React.FC = () => {
    const [analyticsReport, setAnalyticsReport] = useState<any>(null);
    const [timeframe, setTimeframe] = useState(24);

    useEffect(() => {
        const report = errorAnalyticsService.generateReport(timeframe);
        setAnalyticsReport(report);
    }, [timeframe]);

    if (!analyticsReport) {
        return <div>Loading analytics...</div>;
    }

    return (
        <div className="analytics-view">
            <div className="analytics-controls">
                <label>
                    Timeframe:
                    <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(Number(e.target.value))}
                    >
                        <option value={1}>Last Hour</option>
                        <option value={6}>Last 6 Hours</option>
                        <option value={24}>Last 24 Hours</option>
                        <option value={168}>Last Week</option>
                    </select>
                </label>
            </div>

            <div className="analytics-summary">
                <div className="summary-card">
                    <h4>Total Errors</h4>
                    <span className="summary-value">{analyticsReport.summary.totalErrors}</span>
                </div>
                <div className="summary-card">
                    <h4>Unique Errors</h4>
                    <span className="summary-value">{analyticsReport.summary.uniqueErrors}</span>
                </div>
                <div className="summary-card">
                    <h4>Affected Components</h4>
                    <span className="summary-value">{analyticsReport.summary.affectedComponents}</span>
                </div>
                <div className="summary-card">
                    <h4>Recovery Rate</h4>
                    <span className="summary-value">
                        {(analyticsReport.summary.recoveryRate * 100).toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="analytics-insights">
                <h4>Key Insights</h4>
                <ul>
                    <li>Most problematic component: <strong>{analyticsReport.insights.mostProblematicComponent}</strong></li>
                    <li>Most common error type: <strong>{analyticsReport.insights.mostCommonErrorType}</strong></li>
                    <li>Peak error hour: <strong>{analyticsReport.insights.peakErrorHour}</strong></li>
                </ul>
            </div>

            {analyticsReport.insights.recommendations.length > 0 && (
                <div className="analytics-recommendations">
                    <h4>Recommendations</h4>
                    <ul>
                        {analyticsReport.insights.recommendations.map((rec: string, index: number) => (
                            <li key={index}>{rec}</li>
                        ))}
                    </ul>
                </div>
            )}

            {analyticsReport.alerts.length > 0 && (
                <div className="analytics-alerts">
                    <h4>Active Alerts</h4>
                    {analyticsReport.alerts.map((alert: any, index: number) => (
                        <div key={index} className={`alert alert-${alert.severity}`}>
                            <strong>{alert.type}:</strong> {alert.message}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ErrorDevelopmentDashboard;