/**
 * Performance monitoring component for development and debugging
 * 
 * This component provides real-time performance metrics and optimization
 * insights for the separated booking and swap interfaces.
 * 
 * Requirements addressed:
 * - 6.1: Intuitive navigation between booking editing and swap creation
 * - 6.2: Logical next steps after completing booking edits
 * - 6.3: Clear navigation back to booking management
 * - 6.4: Proper browser navigation handling
 * - 6.5: Deep linking support
 * - 6.6: Bookmark functionality
 * - 6.7: Appropriate URLs for sharing
 * - 6.8: Efficient navigation patterns for frequent context switching
 */

import React, { useState, useEffect } from 'react';
import { tokens } from '@/design-system/tokens';
import { usePerformanceReport, useMemoryMonitoring, useCacheOptimization } from '@/hooks/usePerformanceOptimizations';
import { stateOptimizations } from '@/store/optimizations/stateOptimizations';

interface PerformanceMonitorProps {
  isVisible: boolean;
  onToggle: () => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isVisible,
  onToggle,
}) => {
  const { report, isGenerating, generateReport } = usePerformanceReport();
  const { memoryUsage, isMemoryPressure } = useMemoryMonitoring();
  const { cacheStats, optimizeCache } = useCacheOptimization();
  const [stateStats, setStateStats] = useState(stateOptimizations.stateUpdateMonitor.getUpdateStats());

  useEffect(() => {
    if (isVisible) {
      // Update state stats when monitor is visible
      const interval = setInterval(() => {
        setStateStats(stateOptimizations.stateUpdateMonitor.getUpdateStats());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          bottom: tokens.spacing[4],
          right: tokens.spacing[4],
          padding: tokens.spacing[2],
          backgroundColor: tokens.colors.primary[600],
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          fontSize: tokens.typography.fontSize.lg,
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: `0 4px 12px ${tokens.colors.primary[600]}40`,
        }}
        title="Open Performance Monitor"
      >
        📊
      </button>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number) => {
    return (value * 100).toFixed(1) + '%';
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: tokens.spacing[4],
        right: tokens.spacing[4],
        width: '400px',
        maxHeight: '80vh',
        backgroundColor: 'white',
        border: `1px solid ${tokens.colors.neutral[300]}`,
        borderRadius: tokens.borderRadius.lg,
        boxShadow: `0 8px 32px ${tokens.colors.neutral[900]}20`,
        zIndex: 1000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: tokens.spacing[4],
          backgroundColor: tokens.colors.primary[600],
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{
          margin: 0,
          fontSize: tokens.typography.fontSize.lg,
          fontWeight: tokens.typography.fontWeight.semibold,
        }}>
          Performance Monitor
        </h3>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: tokens.typography.fontSize.xl,
            cursor: 'pointer',
            padding: tokens.spacing[1],
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: tokens.spacing[4],
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.spacing[4],
        }}
      >
        {/* Memory Usage */}
        <div>
          <h4 style={{
            margin: 0,
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: isMemoryPressure ? tokens.colors.error[600] : tokens.colors.neutral[900],
          }}>
            Memory Usage {isMemoryPressure && '⚠️'}
          </h4>
          {memoryUsage ? (
            <div style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              display: 'flex',
              flexDirection: 'column',
              gap: tokens.spacing[1],
            }}>
              <div>Used: {formatBytes(memoryUsage.usedJSHeapSize)}</div>
              <div>Total: {formatBytes(memoryUsage.totalJSHeapSize)}</div>
              <div>Limit: {formatBytes(memoryUsage.jsHeapSizeLimit)}</div>
              <div>Usage: {formatPercentage(memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit)}</div>
            </div>
          ) : (
            <div style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.neutral[500] }}>
              Memory info not available
            </div>
          )}
        </div>

        {/* Cache Statistics */}
        <div>
          <h4 style={{
            margin: 0,
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
          }}>
            Cache Statistics
          </h4>
          <div style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.spacing[1],
          }}>
            <div>Booking Data: {cacheStats.bookingData.size} items (Hit rate: {formatPercentage(cacheStats.bookingData.hitRate)})</div>
            <div>Swap Preferences: {cacheStats.swapPreferences.size} items (Hit rate: {formatPercentage(cacheStats.swapPreferences.hitRate)})</div>
            <div>Navigation State: {cacheStats.navigationState.size} items (Hit rate: {formatPercentage(cacheStats.navigationState.hitRate)})</div>
          </div>
          <button
            onClick={optimizeCache}
            style={{
              marginTop: tokens.spacing[2],
              padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
              backgroundColor: tokens.colors.primary[600],
              color: 'white',
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.sm,
              cursor: 'pointer',
            }}
          >
            Optimize Cache
          </button>
        </div>

        {/* State Update Statistics */}
        <div>
          <h4 style={{
            margin: 0,
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
          }}>
            State Updates
          </h4>
          <div style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[600],
            maxHeight: '120px',
            overflow: 'auto',
          }}>
            {Object.entries(stateStats).length > 0 ? (
              Object.entries(stateStats)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([action, count]) => (
                  <div key={action} style={{ marginBottom: tokens.spacing[1] }}>
                    {action}: {count}
                  </div>
                ))
            ) : (
              <div style={{ color: tokens.colors.neutral[500] }}>No state updates recorded</div>
            )}
          </div>
          <button
            onClick={() => {
              stateOptimizations.stateUpdateMonitor.reset();
              setStateStats({});
            }}
            style={{
              marginTop: tokens.spacing[2],
              padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
              backgroundColor: tokens.colors.neutral[600],
              color: 'white',
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.sm,
              cursor: 'pointer',
            }}
          >
            Reset Stats
          </button>
        </div>

        {/* Performance Report */}
        <div>
          <h4 style={{
            margin: 0,
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.neutral[900],
          }}>
            Performance Report
          </h4>
          <button
            onClick={generateReport}
            disabled={isGenerating}
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
              backgroundColor: isGenerating ? tokens.colors.neutral[400] : tokens.colors.success[600],
              color: 'white',
              border: 'none',
              borderRadius: tokens.borderRadius.md,
              fontSize: tokens.typography.fontSize.sm,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              marginBottom: tokens.spacing[2],
            }}
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
          
          {report && (
            <div style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[600],
              maxHeight: '200px',
              overflow: 'auto',
              backgroundColor: tokens.colors.neutral[50],
              padding: tokens.spacing[3],
              borderRadius: tokens.borderRadius.md,
            }}>
              <div><strong>Generated:</strong> {new Date(report.timestamp).toLocaleTimeString()}</div>
              <div><strong>Bundle Sizes:</strong></div>
              <ul style={{ margin: `${tokens.spacing[1]} 0`, paddingLeft: tokens.spacing[4] }}>
                {Object.entries(report.bundleSizes).map(([component, size]) => (
                  <li key={component}>{component}: {formatBytes(size)}</li>
                ))}
              </ul>
              <div><strong>Component Metrics:</strong></div>
              <ul style={{ margin: `${tokens.spacing[1]} 0`, paddingLeft: tokens.spacing[4] }}>
                {Object.entries(report.componentMetrics).map(([component, metrics]) => (
                  <li key={component}>
                    {component}: {metrics.length} loads
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Development-only wrapper
export const PerformanceMonitorWrapper: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <PerformanceMonitor
      isVisible={isVisible}
      onToggle={() => setIsVisible(!isVisible)}
    />
  );
};