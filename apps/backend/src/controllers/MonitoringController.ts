import { Request, Response } from 'express';
import { PasswordRecoveryMonitor } from '../services/monitoring/PasswordRecoveryMonitor';
import { HealthMonitor } from '../utils/monitoring';
import { logger } from '../utils/logger';

export class MonitoringController {
  private passwordRecoveryMonitor: PasswordRecoveryMonitor;
  private healthMonitor: HealthMonitor;

  constructor() {
    this.passwordRecoveryMonitor = PasswordRecoveryMonitor.getInstance();
    this.healthMonitor = HealthMonitor.getInstance();
  }

  /**
   * Get password recovery metrics
   */
  getPasswordRecoveryMetrics = async (req: Request, res: Response) => {
    try {
      const report = this.passwordRecoveryMonitor.generateReport();
      
      res.json({
        success: true,
        data: {
          metrics: report.metrics,
          successRates: report.successRates,
          alerts: report.alerts,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get password recovery metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve password recovery metrics',
      });
    }
  };

  /**
   * Get password recovery events
   */
  getPasswordRecoveryEvents = async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = this.passwordRecoveryMonitor.getRecentEvents(limit);
      
      res.json({
        success: true,
        data: {
          events,
          count: events.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get password recovery events', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve password recovery events',
      });
    }
  };

  /**
   * Get password recovery security events
   */
  getPasswordRecoverySecurityEvents = async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = this.passwordRecoveryMonitor.getSecurityEvents(limit);
      
      res.json({
        success: true,
        data: {
          events,
          count: events.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get password recovery security events', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve password recovery security events',
      });
    }
  };

  /**
   * Get comprehensive password recovery monitoring report
   */
  getPasswordRecoveryReport = async (req: Request, res: Response) => {
    try {
      const report = this.passwordRecoveryMonitor.generateReport();
      
      res.json({
        success: true,
        data: {
          ...report,
          timestamp: new Date().toISOString(),
          reportGenerated: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to generate password recovery report', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate password recovery report',
      });
    }
  };

  /**
   * Reset password recovery metrics (admin only)
   */
  resetPasswordRecoveryMetrics = async (req: Request, res: Response) => {
    try {
      // In a real application, you would check for admin permissions here
      if (!req.user || !this.isAdmin(req.user)) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
      }

      this.passwordRecoveryMonitor.resetMetrics();
      
      logger.info('Password recovery metrics reset by admin', {
        adminUserId: req.user.id,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Password recovery metrics have been reset',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to reset password recovery metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to reset password recovery metrics',
      });
    }
  };

  /**
   * Get system health including password recovery status
   */
  getSystemHealth = async (req: Request, res: Response) => {
    try {
      const healthStatus = await this.healthMonitor.getHealthStatus();
      const passwordRecoveryMetrics = this.passwordRecoveryMonitor.getMetrics();
      const successRates = this.passwordRecoveryMonitor.getSuccessRates();

      // Add password recovery health to system health
      const passwordRecoveryHealth = {
        status: this.determinePasswordRecoveryHealth(successRates),
        metrics: passwordRecoveryMetrics,
        successRates,
        lastCheck: new Date().toISOString(),
      };

      res.json({
        ...healthStatus,
        services: {
          ...healthStatus.services,
          passwordRecovery: passwordRecoveryHealth,
        },
      });
    } catch (error) {
      logger.error('Failed to get system health', { error: error.message });
      res.status(500).json({
        status: 'unhealthy',
        error: 'Failed to retrieve system health',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Get password recovery statistics for dashboards
   */
  getPasswordRecoveryStats = async (req: Request, res: Response) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const metrics = this.passwordRecoveryMonitor.getMetrics();
      const successRates = this.passwordRecoveryMonitor.getSuccessRates();
      const recentEvents = this.passwordRecoveryMonitor.getRecentEvents(100);

      // Calculate time-based statistics
      const now = new Date();
      const timeRangeMs = this.parseTimeRange(timeRange);
      const cutoffTime = new Date(now.getTime() - timeRangeMs);

      const recentEventsInRange = recentEvents.filter(event => 
        event.timestamp >= cutoffTime
      );

      const stats = {
        totalRequests: metrics.requestsTotal,
        successfulRequests: metrics.requestsSuccessful,
        failedRequests: metrics.requestsFailed,
        emailsSent: metrics.emailsSent,
        emailsFailed: metrics.emailsFailed,
        tokensGenerated: metrics.tokensGenerated,
        tokensUsed: metrics.tokensUsed,
        rateLimitHits: metrics.rateLimitHits,
        securityViolations: metrics.securityViolations,
        successRates,
        recentActivity: {
          timeRange,
          eventsCount: recentEventsInRange.length,
          requestsInRange: recentEventsInRange.filter(e => e.type === 'request').length,
          passwordResetsInRange: recentEventsInRange.filter(e => e.type === 'password_reset' && e.success).length,
          rateLimitHitsInRange: recentEventsInRange.filter(e => e.type === 'rate_limit').length,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get password recovery statistics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve password recovery statistics',
      });
    }
  };

  /**
   * Check if user is admin (placeholder implementation)
   */
  private isAdmin(user: any): boolean {
    // In a real application, implement proper admin role checking
    return user.role === 'admin' || user.isAdmin === true;
  }

  /**
   * Determine password recovery service health based on success rates
   */
  private determinePasswordRecoveryHealth(successRates: any): 'healthy' | 'degraded' | 'unhealthy' {
    const { requestSuccessRate, emailDeliveryRate, overallSuccessRate } = successRates;

    if (requestSuccessRate < 0.5 || emailDeliveryRate < 0.5 || overallSuccessRate < 0.3) {
      return 'unhealthy';
    }

    if (requestSuccessRate < 0.8 || emailDeliveryRate < 0.8 || overallSuccessRate < 0.6) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Parse time range string to milliseconds
   */
  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([hdm])$/);
    if (!match) {
      return 24 * 60 * 60 * 1000; // Default to 24 hours
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }
}