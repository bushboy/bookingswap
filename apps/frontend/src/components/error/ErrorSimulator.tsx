import React, { useState } from 'react';
import { ErrorType, ErrorSeverity } from '@/services/errorLoggingService';
import './ErrorSimulator.css';

/**
 * Props for the ErrorSimulator component
 */
interface ErrorSimulatorProps {
    /** Whether the simulator is visible */
    isVisible?: boolean;
    /** Callback to toggle visibility */
    onToggle?: () => void;
}

/**
 * Error types that can be simulated
 */
interface SimulatedError {
    name: string;
    message: string;
    type: ErrorType;
    severity: ErrorSeverity;
    component: string;
    stack?: string;
}

/**
 * Development tool for simulating various error conditions to test error boundaries
 */
export const ErrorSimulator: React.FC<ErrorSimulatorProps> = ({
    isVisible = false,
    onToggle,
}) => {
    const [selectedError, setSelectedError] = useState<SimulatedError | null>(null);
    const [customMessage, setCustomMessage] = useState('');
    const [targetComponent, setTargetComponent] = useState('TestComponent');
    const [shouldThrow, setShouldThrow] = useState(false);

    // Predefined error scenarios for testing
    const errorScenarios: SimulatedError[] = [
        {
            name: 'TypeError',
            message: 'Cannot read property \'variant\' of undefined',
            type: ErrorType.PROP_VALIDATION,
            severity: ErrorSeverity.MEDIUM,
            component: 'Badge',
            stack: 'TypeError: Cannot read property \'variant\' of undefined\n    at Badge.render (Badge.tsx:45:12)',
        },
        {
            name: 'ReferenceError',
            message: 'tokens.colors.secondary is not defined',
            type: ErrorType.DESIGN_TOKEN,
            severity: ErrorSeverity.HIGH,
            component: 'Badge',
            stack: 'ReferenceError: tokens.colors.secondary is not defined\n    at getVariantStyles (Badge.tsx:23:8)',
        },
        {
            name: 'Error',
            message: 'Component failed to render due to invalid state',
            type: ErrorType.COMPONENT_RENDER,
            severity: ErrorSeverity.HIGH,
            component: 'ConnectionStatusIndicator',
            stack: 'Error: Component failed to render due to invalid state\n    at ConnectionStatusIndicator.render (ConnectionStatusIndicator.tsx:67:15)',
        },
        {
            name: 'NetworkError',
            message: 'Failed to fetch user data',
            type: ErrorType.NETWORK,
            severity: ErrorSeverity.MEDIUM,
            component: 'Header',
            stack: 'NetworkError: Failed to fetch user data\n    at fetchUserData (userService.ts:34:12)',
        },
        {
            name: 'ChunkLoadError',
            message: 'Loading chunk 2 failed',
            type: ErrorType.UNKNOWN,
            severity: ErrorSeverity.CRITICAL,
            component: 'App',
            stack: 'ChunkLoadError: Loading chunk 2 failed\n    at importComponent (router.tsx:12:8)',
        },
        {
            name: 'ValidationError',
            message: 'Invalid prop type: expected string but received number',
            type: ErrorType.PROP_VALIDATION,
            severity: ErrorSeverity.LOW,
            component: 'Badge',
            stack: 'ValidationError: Invalid prop type\n    at validateProps (Badge.tsx:15:5)',
        },
    ];

    const componentOptions = [
        'Badge',
        'ConnectionStatusIndicator',
        'Header',
        'ErrorFallback',
        'TestComponent',
        'CustomComponent',
    ];

    const handleSimulateError = () => {
        if (!selectedError && !customMessage) {
            alert('Please select an error scenario or enter a custom message');
            return;
        }

        const errorToThrow = selectedError || {
            name: 'CustomError',
            message: customMessage || 'Custom simulated error',
            type: ErrorType.UNKNOWN,
            severity: ErrorSeverity.MEDIUM,
            component: targetComponent,
        };

        // Create a realistic error object
        const simulatedError = new Error(errorToThrow.message);
        simulatedError.name = errorToThrow.name;
        simulatedError.stack = errorToThrow.stack || `${errorToThrow.name}: ${errorToThrow.message}\n    at ${errorToThrow.component}.render (${errorToThrow.component}.tsx:1:1)`;

        // Add custom properties for error categorization
        (simulatedError as any).errorType = errorToThrow.type;
        (simulatedError as any).severity = errorToThrow.severity;
        (simulatedError as any).componentName = errorToThrow.component;

        console.warn('🧪 Simulating error:', simulatedError);

        // Set flag to throw error on next render
        setShouldThrow(true);
    };

    const handleClearError = () => {
        setShouldThrow(false);
        setSelectedError(null);
        setCustomMessage('');
    };

    const handleExportScenarios = () => {
        const exportData = {
            scenarios: errorScenarios,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'error-scenarios.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Throw error if flag is set (this will be caught by error boundary)
    if (shouldThrow && selectedError) {
        const error = new Error(selectedError.message);
        error.name = selectedError.name;
        error.stack = selectedError.stack;
        throw error;
    }

    if (shouldThrow && customMessage) {
        const error = new Error(customMessage);
        error.name = 'CustomError';
        throw error;
    }

    if (!isVisible) {
        return (
            <button
                onClick={onToggle}
                className="error-simulator-toggle"
                title="Open Error Simulator (Development Only)"
                type="button"
            >
                🧪 Error Simulator
            </button>
        );
    }

    return (
        <div className="error-simulator">
            <div className="error-simulator-header">
                <h3>🧪 Error Simulator</h3>
                <div className="simulator-controls">
                    <button
                        onClick={handleExportScenarios}
                        className="export-button"
                        type="button"
                        title="Export error scenarios"
                    >
                        📤 Export
                    </button>
                    <button
                        onClick={onToggle}
                        className="close-button"
                        type="button"
                        title="Close simulator"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="error-simulator-content">
                <div className="simulator-section">
                    <h4>Predefined Error Scenarios</h4>
                    <div className="error-scenarios">
                        {errorScenarios.map((scenario, index) => (
                            <div
                                key={index}
                                className={`error-scenario ${selectedError === scenario ? 'selected' : ''}`}
                                onClick={() => setSelectedError(scenario)}
                            >
                                <div className="scenario-header">
                                    <span className="scenario-name">{scenario.name}</span>
                                    <span className={`scenario-severity ${scenario.severity}`}>
                                        {scenario.severity}
                                    </span>
                                </div>
                                <div className="scenario-component">{scenario.component}</div>
                                <div className="scenario-message">{scenario.message}</div>
                                <div className="scenario-type">{scenario.type}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="simulator-section">
                    <h4>Custom Error</h4>
                    <div className="custom-error-form">
                        <div className="form-group">
                            <label htmlFor="target-component">Target Component:</label>
                            <select
                                id="target-component"
                                value={targetComponent}
                                onChange={(e) => setTargetComponent(e.target.value)}
                                className="form-select"
                            >
                                {componentOptions.map(component => (
                                    <option key={component} value={component}>
                                        {component}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="custom-message">Error Message:</label>
                            <textarea
                                id="custom-message"
                                value={customMessage}
                                onChange={(e) => setCustomMessage(e.target.value)}
                                placeholder="Enter custom error message..."
                                className="form-textarea"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <div className="simulator-actions">
                    <button
                        onClick={handleSimulateError}
                        className="simulate-button"
                        disabled={!selectedError && !customMessage.trim()}
                        type="button"
                    >
                        💥 Simulate Error
                    </button>

                    <button
                        onClick={handleClearError}
                        className="clear-button"
                        type="button"
                    >
                        🧹 Clear
                    </button>
                </div>

                <div className="simulator-info">
                    <h4>How to Use</h4>
                    <ul>
                        <li>Select a predefined error scenario or create a custom one</li>
                        <li>Click "Simulate Error" to trigger the error</li>
                        <li>The error will be caught by the nearest error boundary</li>
                        <li>Test different recovery strategies in the error fallback UI</li>
                        <li>Use this tool to verify error handling works correctly</li>
                    </ul>
                </div>

                <div className="simulator-warning">
                    ⚠️ This tool is for development only and will not appear in production builds.
                </div>
            </div>
        </div>
    );
};

export default ErrorSimulator;