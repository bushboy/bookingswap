/**
 * Password Recovery Monitoring Usage Examples
 * 
 * This file demonstrates how to integrate and use the password recovery monitoring system.
 */

import { PasswordRecoveryMonitor } from '../services/monitoring/PasswordRecoveryMonitor';
import { PasswordResetRateLimit } from '../middleware/passwordResetRateLimit';
import { MonitoringController } from '../controllers/MonitoringController';
import { Router } from 'express';

// Example 1: Basic monitoring setup
export function setupPasswordRecoveryMonitoring() {
  const monitor = PasswordRecoveryMonitor.getInstance();
  
  // The monitor is automatically integrated into:
  // - AuthService (for password reset operations)
  // - EmailService (for email delivery tracking)
  // - Rate limiting middleware (for security events)
  
  console.log('Password recovery monitoring initialized');
  return monitor;
}

// Example 2: Setting up rate limiting with monitoring
export function setupRateLimitingWithMonitoring() {
  const rateLimiter = new PasswordResetRateLimit({
    emailLimit: 3,        // 3 requests per email per hour
    ipLimit: 10,          // 10 requests per IP per hour
    windowMs: 60 * 60 * 1000, // 1 hour window
  });

  // The rate limiter automatically logs events to the monitor
  return rateLimiter.middleware();
}

// Example 3: Setting up monitoring API routes
export function setupMonitoringRoutes(): Router {
  const router = Router();
  const monitoringController = new MonitoringController();

  // Public health endpoint (basic metrics)
  router.get('/health/password-recovery', monitoringController.getPasswordRecoveryMetrics);

  // Admin-only detailed monitoring endpoints
  router.get('/admin/monitoring/password-recovery/metrics', monitoringController.getPasswordRecoveryMetrics);
  router.get('/admin/monitoring/password-recovery/events', monitoringController.getPasswordRecoveryEvents);
  router.get('/admin/monitoring/password-recovery/security', monitoringController.getPasswordRecoverySecurityEvents);
  router.get('/admin/monitoring/password-recovery/report', monitoringController.getPasswordRecoveryReport);
  router.get('/admin/monitoring/password-recovery/stats', monitoringController.getPasswordRecoveryStats);
  
  // Admin-only reset endpoint
  router.post('/admin/monitoring/password-recovery/reset', monitoringController.resetPasswordRecoveryMetrics);

  return router;
}

// Example 4: Custom monitoring integration
export function customMonitoringExample() {
  const monitor = PasswordRecoveryMonitor.getInstance();

  // Example: Log a custom security event
  monitor.logSecurityEvent({
    type: 'suspicious_activity',
    severity: 'high',
    userId: 'user-123',
    ip: '192.168.1.100',
    userAgent: 'Suspicious Bot/1.0',
    details: {
      reason: 'multiple_failed_attempts',
      attemptCount: 15,
      timeWindow: '5 minutes',
      patterns: ['rapid_requests', 'invalid_tokens'],
    },
  });

  // Example: Get current metrics for dashboard
  const metrics = monitor.getMetrics();
  console.log('Current password recovery metrics:', {
    totalRequests: metrics.requestsTotal,
    successRate: metrics.requestsTotal > 0 
      ? (metrics.requestsSuccessful / metrics.requestsTotal * 100).toFixed(1) + '%'
      : '0%',
    emailDeliveryRate: (metrics.emailsSent + metrics.emailsFailed) > 0
      ? (metrics.emailsSent / (metrics.emailsSent + metrics.emailsFailed) * 100).toFixed(1) + '%'
      : '0%',
    securityViolations: metrics.securityViolations,
  });

  // Example: Get recent security events for alerting
  const securityEvents = monitor.getSecurityEvents(10);
  const criticalEvents = securityEvents.filter(event => event.severity === 'critical');
  
  if (criticalEvents.length > 0) {
    console.warn('Critical security events detected:', criticalEvents);
    // Here you would typically send alerts to your monitoring system
  }
}

// Example 5: Monitoring dashboard data
export function getDashboardData() {
  const monitor = PasswordRecoveryMonitor.getInstance();
  const report = monitor.generateReport();

  return {
    // Key metrics for dashboard cards
    summary: {
      totalRequests: report.metrics.requestsTotal,
      successfulRequests: report.metrics.requestsSuccessful,
      failedRequests: report.metrics.requestsFailed,
      successRate: report.successRates.requestSuccessRate,
      emailDeliveryRate: report.successRates.emailDeliveryRate,
      securityViolations: report.metrics.securityViolations,
    },

    // Chart data for trends
    recentActivity: report.recentEvents.slice(-50).map(event => ({
      timestamp: event.timestamp,
      type: event.type,
      success: event.success,
    })),

    // Alerts for notification system
    alerts: report.alerts,

    // Security events for security dashboard
    securityEvents: report.securityEvents.slice(-20),
  };
}

// Example 6: Automated alerting based on metrics
export function checkAlertsAndNotify() {
  const monitor = PasswordRecoveryMonitor.getInstance();
  const successRates = monitor.getSuccessRates();
  const metrics = monitor.getMetrics();

  const alerts = [];

  // Check for low success rates
  if (successRates.requestSuccessRate < 0.8) {
    alerts.push({
      type: 'performance',
      severity: 'warning',
      message: `Password reset success rate is low: ${(successRates.requestSuccessRate * 100).toFixed(1)}%`,
      threshold: '80%',
      current: `${(successRates.requestSuccessRate * 100).toFixed(1)}%`,
    });
  }

  // Check for email delivery issues
  if (successRates.emailDeliveryRate < 0.9) {
    alerts.push({
      type: 'email',
      severity: 'warning',
      message: `Email delivery rate is low: ${(successRates.emailDeliveryRate * 100).toFixed(1)}%`,
      threshold: '90%',
      current: `${(successRates.emailDeliveryRate * 100).toFixed(1)}%`,
    });
  }

  // Check for security violations
  if (metrics.securityViolations > 10) {
    alerts.push({
      type: 'security',
      severity: 'critical',
      message: `High number of security violations: ${metrics.securityViolations}`,
      threshold: '10',
      current: metrics.securityViolations.toString(),
    });
  }

  // Check for excessive rate limiting
  if (metrics.rateLimitHits > 20) {
    alerts.push({
      type: 'rate_limit',
      severity: 'warning',
      message: `High rate limit violations: ${metrics.rateLimitHits}`,
      threshold: '20',
      current: metrics.rateLimitHits.toString(),
    });
  }

  // Send alerts to monitoring system
  if (alerts.length > 0) {
    console.warn('Password recovery alerts:', alerts);
    // Here you would integrate with your alerting system (PagerDuty, Slack, etc.)
    sendAlertsToMonitoringSystem(alerts);
  }

  return alerts;
}

// Mock function for sending alerts
function sendAlertsToMonitoringSystem(alerts: any[]) {
  // Integration with monitoring systems like:
  // - PagerDuty
  // - Slack
  // - Email notifications
  // - Webhook endpoints
  console.log('Sending alerts to monitoring system:', alerts);
}

// Example 7: Performance monitoring integration
export function integrateWithPerformanceMonitoring() {
  const monitor = PasswordRecoveryMonitor.getInstance();
  
  // If you have a PerformanceMonitor instance, you can integrate it
  // monitor.setPerformanceMonitor(performanceMonitor);
  
  // This enables automatic performance metric recording for:
  // - Password reset request duration
  // - Email delivery duration
  // - Password reset completion duration
}

// Example 8: Scheduled monitoring tasks
export function setupScheduledMonitoring() {
  const monitor = PasswordRecoveryMonitor.getInstance();

  // Check alerts every 5 minutes
  setInterval(() => {
    checkAlertsAndNotify();
  }, 5 * 60 * 1000);

  // Generate and log daily report
  setInterval(() => {
    const report = monitor.generateReport();
    console.log('Daily password recovery report:', {
      date: new Date().toISOString().split('T')[0],
      summary: {
        totalRequests: report.metrics.requestsTotal,
        successRate: `${(report.successRates.requestSuccessRate * 100).toFixed(1)}%`,
        emailDeliveryRate: `${(report.successRates.emailDeliveryRate * 100).toFixed(1)}%`,
        securityViolations: report.metrics.securityViolations,
        alerts: report.alerts.length,
      },
    });
  }, 24 * 60 * 60 * 1000); // Daily

  // Clean up old events weekly (optional - the monitor has built-in limits)
  setInterval(() => {
    console.log('Weekly monitoring cleanup - metrics are automatically managed');
    // The monitor automatically limits event history, but you could implement
    // additional cleanup logic here if needed
  }, 7 * 24 * 60 * 60 * 1000); // Weekly
}

// Example usage in your application
export function initializePasswordRecoveryMonitoring() {
  console.log('Initializing password recovery monitoring system...');
  
  // 1. Setup basic monitoring
  const monitor = setupPasswordRecoveryMonitoring();
  
  // 2. Setup rate limiting with monitoring
  const rateLimitMiddleware = setupRateLimitingWithMonitoring();
  
  // 3. Setup monitoring routes
  const monitoringRoutes = setupMonitoringRoutes();
  
  // 4. Setup scheduled monitoring tasks
  setupScheduledMonitoring();
  
  // 5. Integrate with performance monitoring
  integrateWithPerformanceMonitoring();
  
  console.log('Password recovery monitoring system initialized successfully');
  
  return {
    monitor,
    rateLimitMiddleware,
    monitoringRoutes,
  };
}