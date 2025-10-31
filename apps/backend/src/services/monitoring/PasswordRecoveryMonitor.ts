import { enhancedLogger } from '../../utils/logger';
import { PerformanceMonitor } from './PerformanceMonitor';

export interface PasswordResetMetrics {
  requestsTotal: number;
  requestsSuccessful: number;
  requestsFailed: number;
  tokensGenerated: number;
  tokensUsed: number;
  tokensExpired: number;
  emailsSent: number;
  emailsFailed: number;
  rateLimitHits: number;
  securityViolations: number;
}

export interface PasswordResetEvent {
  type: 'request' | 'token_generated' | 'token_validated' | 'password_reset' | 'email_sent' | 'rate_limit' | 'security_violation';
  userId?: string;
  email?: string;
  tokenId?: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface SecurityEvent {
  type: 'rate_limit_exceeded' | 'invalid_token_attempt' | 'suspicious_activity' | 'email_enumeration_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export class PasswordRecoveryMonitor {
  private static instance: PasswordRecoveryMonitor;
  private metrics: PasswordResetMetrics;
  private events: PasswordResetEvent[] = [];
  private securityEvents: SecurityEvent[] = [];
  private performanceMonitor?: PerformanceMonitor;

  private constructor() {
    this.metrics = {
      requestsTotal: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      tokensGenerated: 0,
      tokensUsed: 0,
      tokensExpired: 0,
      emailsSent: 0,
      emailsFailed: 0,
      rateLimitHits: 0,
      securityViolations: 0,
    };
  }

  public static getInstance(): PasswordRecoveryMonitor {
    if (!PasswordRecoveryMonitor.instance) {
      PasswordRecoveryMonitor.instance = new PasswordRecoveryMonitor();
    }
    return PasswordRecoveryMonitor.instance;
  }

  /**
   * Set performance monitor for integration
   */
  setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Log password reset request
   */
  logPasswordResetRequest(data: {
    email: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    error?: string;
    duration?: number;
  }): void {
    const event: PasswordResetEvent = {
      type: 'request',
      userId: data.userId,
      email: this.maskEmail(data.email),
      ip: data.ip,
      userAgent: data.userAgent,
      success: data.success,
      error: data.error,
      timestamp: new Date(),
    };

    this.addEvent(event);
    this.updateMetrics('request', data.success);

    // Log structured event
    enhancedLogger.info('Password reset request', {
      category: 'password_recovery',
      event: 'request',
      success: data.success,
      email: this.maskEmail(data.email),
      userId: data.userId,
      ip: data.ip,
      userAgent: data.userAgent,
      error: data.error,
      duration: data.duration,
    });

    // Record performance metric
    if (data.duration && this.performanceMonitor) {
      this.performanceMonitor.recordMetric('password_reset_request_duration', data.duration, 'ms', {
        success: data.success,
        hasUser: !!data.userId,
      });
    }
  }

  /**
   * Log token generation
   */
  logTokenGeneration(data: {
    userId: string;
    tokenId: string;
    email: string;
    expiresAt: Date;
    success: boolean;
    error?: string;
  }): void {
    const event: PasswordResetEvent = {
      type: 'token_generated',
      userId: data.userId,
      email: this.maskEmail(data.email),
      tokenId: data.tokenId,
      success: data.success,
      error: data.error,
      metadata: {
        expiresAt: data.expiresAt.toISOString(),
      },
      timestamp: new Date(),
    };

    this.addEvent(event);
    this.updateMetrics('token_generated', data.success);

    enhancedLogger.info('Password reset token generated', {
      category: 'password_recovery',
      event: 'token_generated',
      success: data.success,
      userId: data.userId,
      tokenId: data.tokenId,
      email: this.maskEmail(data.email),
      expiresAt: data.expiresAt.toISOString(),
      error: data.error,
    });
  }

  /**
   * Log token validation
   */
  logTokenValidation(data: {
    tokenId?: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    error?: string;
    isExpired?: boolean;
    isUsed?: boolean;
  }): void {
    const event: PasswordResetEvent = {
      type: 'token_validated',
      userId: data.userId,
      tokenId: data.tokenId,
      ip: data.ip,
      userAgent: data.userAgent,
      success: data.success,
      error: data.error,
      metadata: {
        isExpired: data.isExpired,
        isUsed: data.isUsed,
      },
      timestamp: new Date(),
    };

    this.addEvent(event);

    enhancedLogger.info('Password reset token validation', {
      category: 'password_recovery',
      event: 'token_validation',
      success: data.success,
      userId: data.userId,
      tokenId: data.tokenId,
      ip: data.ip,
      userAgent: data.userAgent,
      error: data.error,
      isExpired: data.isExpired,
      isUsed: data.isUsed,
    });

    // Log security event for invalid token attempts
    if (!data.success && data.tokenId) {
      this.logSecurityEvent({
        type: 'invalid_token_attempt',
        severity: 'medium',
        userId: data.userId,
        ip: data.ip,
        userAgent: data.userAgent,
        details: {
          tokenId: data.tokenId,
          error: data.error,
          isExpired: data.isExpired,
          isUsed: data.isUsed,
        },
      });
    }
  }

  /**
   * Log password reset completion
   */
  logPasswordReset(data: {
    userId: string;
    tokenId: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    error?: string;
    duration?: number;
    sessionsInvalidated?: number;
  }): void {
    const event: PasswordResetEvent = {
      type: 'password_reset',
      userId: data.userId,
      email: data.email ? this.maskEmail(data.email) : undefined,
      tokenId: data.tokenId,
      ip: data.ip,
      userAgent: data.userAgent,
      success: data.success,
      error: data.error,
      metadata: {
        sessionsInvalidated: data.sessionsInvalidated,
      },
      timestamp: new Date(),
    };

    this.addEvent(event);
    this.updateMetrics('password_reset', data.success);

    enhancedLogger.info('Password reset completed', {
      category: 'password_recovery',
      event: 'password_reset',
      success: data.success,
      userId: data.userId,
      tokenId: data.tokenId,
      email: data.email ? this.maskEmail(data.email) : undefined,
      ip: data.ip,
      userAgent: data.userAgent,
      error: data.error,
      duration: data.duration,
      sessionsInvalidated: data.sessionsInvalidated,
    });

    // Record performance metric
    if (data.duration && this.performanceMonitor) {
      this.performanceMonitor.recordMetric('password_reset_completion_duration', data.duration, 'ms', {
        success: data.success,
        sessionsInvalidated: data.sessionsInvalidated,
      });
    }

    // Mark token as used in metrics
    if (data.success) {
      this.metrics.tokensUsed++;
    }
  }

  /**
   * Log email delivery status
   */
  logEmailDelivery(data: {
    type: 'reset_request' | 'reset_confirmation';
    email: string;
    userId?: string;
    messageId?: string;
    success: boolean;
    error?: string;
    duration?: number;
    provider?: string;
  }): void {
    const event: PasswordResetEvent = {
      type: 'email_sent',
      userId: data.userId,
      email: this.maskEmail(data.email),
      success: data.success,
      error: data.error,
      metadata: {
        emailType: data.type,
        messageId: data.messageId,
        provider: data.provider,
      },
      timestamp: new Date(),
    };

    this.addEvent(event);
    this.updateMetrics('email', data.success);

    enhancedLogger.info('Password reset email delivery', {
      category: 'password_recovery',
      event: 'email_delivery',
      emailType: data.type,
      success: data.success,
      email: this.maskEmail(data.email),
      userId: data.userId,
      messageId: data.messageId,
      error: data.error,
      duration: data.duration,
      provider: data.provider,
    });

    // Record performance metric
    if (data.duration && this.performanceMonitor) {
      this.performanceMonitor.recordMetric('email_delivery_duration', data.duration, 'ms', {
        success: data.success,
        emailType: data.type,
        provider: data.provider,
      });
    }
  }

  /**
   * Log rate limiting events
   */
  logRateLimit(data: {
    email?: string;
    ip?: string;
    userAgent?: string;
    limitType: 'email' | 'ip' | 'global';
    currentCount: number;
    limit: number;
    windowStart: Date;
    windowEnd: Date;
  }): void {
    const event: PasswordResetEvent = {
      type: 'rate_limit',
      email: data.email ? this.maskEmail(data.email) : undefined,
      ip: data.ip,
      userAgent: data.userAgent,
      success: false,
      metadata: {
        limitType: data.limitType,
        currentCount: data.currentCount,
        limit: data.limit,
        windowStart: data.windowStart.toISOString(),
        windowEnd: data.windowEnd.toISOString(),
      },
      timestamp: new Date(),
    };

    this.addEvent(event);
    this.metrics.rateLimitHits++;

    enhancedLogger.warn('Password reset rate limit exceeded', {
      category: 'password_recovery',
      event: 'rate_limit',
      limitType: data.limitType,
      email: data.email ? this.maskEmail(data.email) : undefined,
      ip: data.ip,
      userAgent: data.userAgent,
      currentCount: data.currentCount,
      limit: data.limit,
      windowStart: data.windowStart.toISOString(),
      windowEnd: data.windowEnd.toISOString(),
    });

    // Log as security event
    this.logSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: data.currentCount > data.limit * 2 ? 'high' : 'medium',
      email: data.email,
      ip: data.ip,
      userAgent: data.userAgent,
      details: {
        limitType: data.limitType,
        currentCount: data.currentCount,
        limit: data.limit,
        windowStart: data.windowStart.toISOString(),
        windowEnd: data.windowEnd.toISOString(),
      },
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(data: {
    type: SecurityEvent['type'];
    severity: SecurityEvent['severity'];
    userId?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    details: Record<string, any>;
  }): void {
    const securityEvent: SecurityEvent = {
      type: data.type,
      severity: data.severity,
      userId: data.userId,
      email: data.email ? this.maskEmail(data.email) : undefined,
      ip: data.ip,
      userAgent: data.userAgent,
      details: data.details,
      timestamp: new Date(),
    };

    this.securityEvents.push(securityEvent);
    this.metrics.securityViolations++;

    // Keep only last 1000 security events
    if (this.securityEvents.length > 1000) {
      this.securityEvents.shift();
    }

    enhancedLogger.logSecurityEvent(
      `Password recovery: ${data.type}`,
      data.severity,
      data.userId,
      data.ip,
      {
        category: 'password_recovery',
        eventType: data.type,
        email: data.email ? this.maskEmail(data.email) : undefined,
        userAgent: data.userAgent,
        ...data.details,
      }
    );
  }

  /**
   * Get current metrics
   */
  getMetrics(): PasswordResetMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): PasswordResetEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get security events
   */
  getSecurityEvents(limit: number = 50): SecurityEvent[] {
    return this.securityEvents.slice(-limit);
  }

  /**
   * Get success rate statistics
   */
  getSuccessRates(): {
    requestSuccessRate: number;
    emailDeliveryRate: number;
    tokenUsageRate: number;
    overallSuccessRate: number;
  } {
    const requestSuccessRate = this.metrics.requestsTotal > 0 
      ? this.metrics.requestsSuccessful / this.metrics.requestsTotal 
      : 0;

    const emailDeliveryRate = (this.metrics.emailsSent + this.metrics.emailsFailed) > 0
      ? this.metrics.emailsSent / (this.metrics.emailsSent + this.metrics.emailsFailed)
      : 0;

    const tokenUsageRate = this.metrics.tokensGenerated > 0
      ? this.metrics.tokensUsed / this.metrics.tokensGenerated
      : 0;

    const overallSuccessRate = this.metrics.requestsTotal > 0
      ? (this.metrics.requestsSuccessful * emailDeliveryRate * tokenUsageRate)
      : 0;

    return {
      requestSuccessRate,
      emailDeliveryRate,
      tokenUsageRate,
      overallSuccessRate,
    };
  }

  /**
   * Generate monitoring report
   */
  generateReport(): {
    metrics: PasswordResetMetrics;
    successRates: ReturnType<typeof this.getSuccessRates>;
    recentEvents: PasswordResetEvent[];
    securityEvents: SecurityEvent[];
    alerts: string[];
  } {
    const successRates = this.getSuccessRates();
    const alerts: string[] = [];

    // Generate alerts based on metrics
    if (successRates.requestSuccessRate < 0.8) {
      alerts.push(`Low password reset request success rate: ${(successRates.requestSuccessRate * 100).toFixed(1)}%`);
    }

    if (successRates.emailDeliveryRate < 0.9) {
      alerts.push(`Low email delivery rate: ${(successRates.emailDeliveryRate * 100).toFixed(1)}%`);
    }

    if (this.metrics.rateLimitHits > 10) {
      alerts.push(`High rate limit violations: ${this.metrics.rateLimitHits} hits`);
    }

    if (this.metrics.securityViolations > 5) {
      alerts.push(`Security violations detected: ${this.metrics.securityViolations} events`);
    }

    return {
      metrics: this.getMetrics(),
      successRates,
      recentEvents: this.getRecentEvents(50),
      securityEvents: this.getSecurityEvents(20),
      alerts,
    };
  }

  /**
   * Reset metrics (for testing or periodic resets)
   */
  resetMetrics(): void {
    this.metrics = {
      requestsTotal: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      tokensGenerated: 0,
      tokensUsed: 0,
      tokensExpired: 0,
      emailsSent: 0,
      emailsFailed: 0,
      rateLimitHits: 0,
      securityViolations: 0,
    };
    this.events = [];
    this.securityEvents = [];

    enhancedLogger.info('Password recovery metrics reset', {
      category: 'password_recovery',
      event: 'metrics_reset',
    });
  }

  /**
   * Add event to history
   */
  private addEvent(event: PasswordResetEvent): void {
    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events.shift();
    }
  }

  /**
   * Update metrics based on event type and success
   */
  private updateMetrics(eventType: string, success: boolean): void {
    switch (eventType) {
      case 'request':
        this.metrics.requestsTotal++;
        if (success) {
          this.metrics.requestsSuccessful++;
        } else {
          this.metrics.requestsFailed++;
        }
        break;
      case 'token_generated':
        if (success) {
          this.metrics.tokensGenerated++;
        }
        break;
      case 'password_reset':
        // Token usage is tracked in logPasswordReset method
        break;
      case 'email':
        if (success) {
          this.metrics.emailsSent++;
        } else {
          this.metrics.emailsFailed++;
        }
        break;
    }
  }

  /**
   * Mask email for privacy in logs
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    return `${localPart.substring(0, 2)}***@${domain}`;
  }
}