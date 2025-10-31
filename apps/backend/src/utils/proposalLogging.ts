import { logger } from './logger';
import { 
  CreateProposalFromBrowseRequest,
  ValidationResult,
  CompatibilityAnalysis
} from '@booking-swap/shared';

export interface ProposalLogContext {
  userId: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  sourceSwapId?: string;
  targetSwapId?: string;
  operation: string;
  timestamp: string;
}

export interface ProposalMetrics {
  validationDuration: number;
  compatibilityScore?: number;
  eligibilityChecks: Record<string, boolean>;
  errorCount: number;
  warningCount: number;
}

/**
 * Comprehensive logging service for proposal operations
 */
export class ProposalLoggingService {
  /**
   * Log proposal creation attempt
   */
  static logProposalAttempt(
    request: CreateProposalFromBrowseRequest,
    context: Partial<ProposalLogContext>
  ): void {
    logger.info('Proposal creation attempted', {
      event: 'proposal_attempt',
      proposal: {
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        proposerId: request.proposerId,
        hasMessage: !!request.message,
        messageLength: request.message?.length || 0,
        conditionsCount: request.conditions.length,
        agreedToTerms: request.agreedToTerms,
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'create_proposal_from_browse'
      }
    });
  }

  /**
   * Log proposal validation results
   */
  static logValidationResult(
    request: CreateProposalFromBrowseRequest,
    validationResult: ValidationResult,
    metrics: ProposalMetrics,
    context: Partial<ProposalLogContext>
  ): void {
    const logLevel = validationResult.isValid ? 'info' : 'warn';
    
    logger[logLevel]('Proposal validation completed', {
      event: 'proposal_validation',
      validation: {
        isValid: validationResult.isValid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        eligibilityChecks: validationResult.eligibilityChecks,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      },
      metrics: {
        validationDuration: metrics.validationDuration,
        compatibilityScore: metrics.compatibilityScore,
      },
      proposal: {
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        proposerId: request.proposerId,
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'validate_proposal'
      }
    });
  }

  /**
   * Log proposal creation success
   */
  static logProposalSuccess(
    request: CreateProposalFromBrowseRequest,
    proposalId: string,
    blockchainTxId?: string,
    context: Partial<ProposalLogContext>
  ): void {
    logger.info('Proposal created successfully', {
      event: 'proposal_created',
      proposal: {
        id: proposalId,
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        proposerId: request.proposerId,
        blockchainTxId,
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'create_proposal_success'
      }
    });
  }

  /**
   * Log proposal creation failure
   */
  static logProposalFailure(
    request: CreateProposalFromBrowseRequest,
    error: Error,
    context: Partial<ProposalLogContext>
  ): void {
    logger.error('Proposal creation failed', {
      event: 'proposal_failed',
      error: {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        category: (error as any).category,
        stack: error.stack,
      },
      proposal: {
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        proposerId: request.proposerId,
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'create_proposal_failure'
      }
    });
  }

  /**
   * Log rate limiting events
   */
  static logRateLimitEvent(
    userId: string,
    limitType: string,
    currentCount: number,
    limit: number,
    timeWindow: string,
    context: Partial<ProposalLogContext>
  ): void {
    logger.warn('Rate limit triggered', {
      event: 'rate_limit_triggered',
      rateLimit: {
        userId,
        limitType,
        currentCount,
        limit,
        timeWindow,
        utilizationPercent: Math.round((currentCount / limit) * 100),
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'rate_limit_check'
      }
    });
  }

  /**
   * Log compatibility analysis results
   */
  static logCompatibilityAnalysis(
    sourceSwapId: string,
    targetSwapId: string,
    compatibility: CompatibilityAnalysis,
    analysisTime: number,
    context: Partial<ProposalLogContext>
  ): void {
    logger.info('Compatibility analysis completed', {
      event: 'compatibility_analysis',
      compatibility: {
        overallScore: compatibility.overallScore,
        factors: Object.entries(compatibility.factors).reduce((acc, [key, factor]) => {
          acc[key] = {
            score: factor.score,
            status: factor.status,
            weight: factor.weight
          };
          return acc;
        }, {} as Record<string, any>),
        recommendationCount: compatibility.recommendations.length,
        issueCount: compatibility.potentialIssues.length,
      },
      swaps: {
        sourceSwapId,
        targetSwapId,
      },
      metrics: {
        analysisTime,
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'compatibility_analysis'
      }
    });
  }

  /**
   * Log user behavior patterns for fraud detection
   */
  static logUserBehaviorPattern(
    userId: string,
    pattern: {
      proposalCount24h: number;
      proposalCountWeek: number;
      uniqueTargetUsers: number;
      averageMessageLength: number;
      conditionsUsagePattern: string[];
      suspiciousActivity: boolean;
    },
    context: Partial<ProposalLogContext>
  ): void {
    const logLevel = pattern.suspiciousActivity ? 'warn' : 'info';
    
    logger[logLevel]('User behavior pattern analyzed', {
      event: 'user_behavior_analysis',
      userId,
      pattern,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'behavior_analysis'
      }
    });
  }

  /**
   * Log system performance metrics
   */
  static logPerformanceMetrics(
    operation: string,
    metrics: {
      duration: number;
      memoryUsage?: number;
      dbQueries?: number;
      cacheHits?: number;
      cacheMisses?: number;
    },
    context: Partial<ProposalLogContext>
  ): void {
    logger.info('Performance metrics recorded', {
      event: 'performance_metrics',
      operation,
      metrics,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
      }
    });
  }

  /**
   * Log security events
   */
  static logSecurityEvent(
    eventType: 'suspicious_proposal' | 'rate_limit_abuse' | 'invalid_access' | 'content_violation',
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: Partial<ProposalLogContext>
  ): void {
    logger.warn('Security event detected', {
      event: 'security_event',
      security: {
        eventType,
        severity,
        details,
        requiresAction: severity === 'high' || severity === 'critical',
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'security_monitoring'
      }
    });
  }

  /**
   * Log business intelligence data
   */
  static logBusinessIntelligence(
    eventType: 'proposal_trend' | 'compatibility_insight' | 'user_engagement',
    data: Record<string, any>,
    context: Partial<ProposalLogContext>
  ): void {
    logger.info('Business intelligence data collected', {
      event: 'business_intelligence',
      bi: {
        eventType,
        data,
      },
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        operation: 'business_intelligence'
      }
    });
  }
}

/**
 * Performance monitoring decorator for proposal methods
 */
export function monitorProposalPerformance(operation: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const startMemory = process.memoryUsage().heapUsed;

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        const memoryUsed = process.memoryUsage().heapUsed - startMemory;

        ProposalLoggingService.logPerformanceMetrics(operation, {
          duration,
          memoryUsage: memoryUsed,
        }, {
          operation: `${target.constructor.name}.${propertyName}`,
          timestamp: new Date().toISOString()
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        ProposalLoggingService.logPerformanceMetrics(`${operation}_failed`, {
          duration,
        }, {
          operation: `${target.constructor.name}.${propertyName}`,
          timestamp: new Date().toISOString()
        });

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Audit trail for proposal operations
 */
export class ProposalAuditTrail {
  private static auditLog: Array<{
    timestamp: string;
    userId: string;
    operation: string;
    details: Record<string, any>;
    result: 'success' | 'failure';
    error?: string;
  }> = [];

  static recordOperation(
    userId: string,
    operation: string,
    details: Record<string, any>,
    result: 'success' | 'failure',
    error?: string
  ): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      userId,
      operation,
      details,
      result,
      error,
    };

    this.auditLog.push(auditEntry);

    // Log to persistent storage
    logger.info('Audit trail entry', {
      event: 'audit_trail',
      audit: auditEntry
    });

    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  static getAuditTrail(userId: string, limit: number = 50): Array<any> {
    return this.auditLog
      .filter(entry => entry.userId === userId)
      .slice(-limit)
      .reverse();
  }

  static getSystemAuditTrail(limit: number = 100): Array<any> {
    return this.auditLog
      .slice(-limit)
      .reverse();
  }
}

/**
 * Real-time monitoring alerts
 */
export class ProposalMonitoringAlerts {
  private static readonly ALERT_THRESHOLDS = {
    HIGH_ERROR_RATE: 0.1, // 10% error rate
    HIGH_VALIDATION_FAILURES: 0.2, // 20% validation failure rate
    SUSPICIOUS_USER_ACTIVITY: 10, // 10 proposals per hour
    LOW_COMPATIBILITY_TREND: 0.3, // 30% of proposals with <50% compatibility
  };

  private static metrics = {
    totalProposals: 0,
    failedProposals: 0,
    validationFailures: 0,
    lowCompatibilityProposals: 0,
    userActivity: new Map<string, number>(),
  };

  static recordProposalMetric(
    type: 'attempt' | 'success' | 'failure' | 'validation_failure' | 'low_compatibility',
    userId?: string
  ): void {
    switch (type) {
      case 'attempt':
        this.metrics.totalProposals++;
        if (userId) {
          const current = this.metrics.userActivity.get(userId) || 0;
          this.metrics.userActivity.set(userId, current + 1);
        }
        break;
      case 'failure':
        this.metrics.failedProposals++;
        break;
      case 'validation_failure':
        this.metrics.validationFailures++;
        break;
      case 'low_compatibility':
        this.metrics.lowCompatibilityProposals++;
        break;
    }

    this.checkAlertThresholds();
  }

  private static checkAlertThresholds(): void {
    const errorRate = this.metrics.failedProposals / Math.max(this.metrics.totalProposals, 1);
    const validationFailureRate = this.metrics.validationFailures / Math.max(this.metrics.totalProposals, 1);
    const lowCompatibilityRate = this.metrics.lowCompatibilityProposals / Math.max(this.metrics.totalProposals, 1);

    if (errorRate > this.ALERT_THRESHOLDS.HIGH_ERROR_RATE) {
      ProposalLoggingService.logSecurityEvent(
        'rate_limit_abuse',
        { errorRate, threshold: this.ALERT_THRESHOLDS.HIGH_ERROR_RATE },
        'high',
        { operation: 'monitoring_alert' }
      );
    }

    if (validationFailureRate > this.ALERT_THRESHOLDS.HIGH_VALIDATION_FAILURES) {
      ProposalLoggingService.logSecurityEvent(
        'content_violation',
        { validationFailureRate, threshold: this.ALERT_THRESHOLDS.HIGH_VALIDATION_FAILURES },
        'medium',
        { operation: 'monitoring_alert' }
      );
    }

    if (lowCompatibilityRate > this.ALERT_THRESHOLDS.LOW_COMPATIBILITY_TREND) {
      ProposalLoggingService.logBusinessIntelligence(
        'compatibility_insight',
        { lowCompatibilityRate, threshold: this.ALERT_THRESHOLDS.LOW_COMPATIBILITY_TREND },
        { operation: 'monitoring_alert' }
      );
    }

    // Check for suspicious user activity
    this.metrics.userActivity.forEach((count, userId) => {
      if (count > this.ALERT_THRESHOLDS.SUSPICIOUS_USER_ACTIVITY) {
        ProposalLoggingService.logSecurityEvent(
          'suspicious_proposal',
          { userId, proposalCount: count, threshold: this.ALERT_THRESHOLDS.SUSPICIOUS_USER_ACTIVITY },
          'medium',
          { operation: 'monitoring_alert', userId }
        );
      }
    });
  }

  static resetMetrics(): void {
    this.metrics = {
      totalProposals: 0,
      failedProposals: 0,
      validationFailures: 0,
      lowCompatibilityProposals: 0,
      userActivity: new Map(),
    };
  }

  static getMetrics(): typeof ProposalMonitoringAlerts.metrics {
    return { ...this.metrics };
  }
}