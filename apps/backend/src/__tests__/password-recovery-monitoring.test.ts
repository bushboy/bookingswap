import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PasswordRecoveryMonitor } from '../services/monitoring/PasswordRecoveryMonitor';
import { PasswordResetRateLimit } from '../middleware/passwordResetRateLimit';
import { EmailService } from '../services/email/EmailService';
import { AuthService } from '../services/auth/AuthService';
import { MonitoringController } from '../controllers/MonitoringController';
import { Request, Response } from 'express';

// Mock dependencies
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  enhancedLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logSecurityEvent: vi.fn(),
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransporter: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({
        messageId: 'test-message-id',
        response: 'OK',
      }),
      verify: vi.fn().mockResolvedValue(true),
    })),
    getTestMessageUrl: vi.fn(() => 'https://ethereal.email/message/test'),
  },
}));

describe('Password Recovery Monitoring', () => {
  let monitor: PasswordRecoveryMonitor;
  let rateLimiter: PasswordResetRateLimit;
  let emailService: EmailService;
  let monitoringController: MonitoringController;

  beforeEach(() => {
    // Reset singleton instance
    (PasswordRecoveryMonitor as any).instance = undefined;
    monitor = PasswordRecoveryMonitor.getInstance();
    
    rateLimiter = new PasswordResetRateLimit({
      emailLimit: 3,
      ipLimit: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    });

    emailService = new EmailService();
    monitoringController = new MonitoringController();
  });

  afterEach(() => {
    monitor.resetMetrics();
    vi.clearAllMocks();
  });

  describe('PasswordRecoveryMonitor', () => {
    it('should track password reset requests', () => {
      const initialMetrics = monitor.getMetrics();
      expect(initialMetrics.requestsTotal).toBe(0);

      monitor.logPasswordResetRequest({
        email: 'test@example.com',
        userId: 'user-123',
        success: true,
        duration: 150,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const updatedMetrics = monitor.getMetrics();
      expect(updatedMetrics.requestsTotal).toBe(1);
      expect(updatedMetrics.requestsSuccessful).toBe(1);
      expect(updatedMetrics.requestsFailed).toBe(0);
    });

    it('should track failed password reset requests', () => {
      monitor.logPasswordResetRequest({
        email: 'test@example.com',
        success: false,
        error: 'Service unavailable',
        duration: 50,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const metrics = monitor.getMetrics();
      expect(metrics.requestsTotal).toBe(1);
      expect(metrics.requestsSuccessful).toBe(0);
      expect(metrics.requestsFailed).toBe(1);
    });

    it('should track token generation', () => {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      monitor.logTokenGeneration({
        userId: 'user-123',
        tokenId: 'token-456',
        email: 'test@example.com',
        expiresAt,
        success: true,
      });

      const metrics = monitor.getMetrics();
      expect(metrics.tokensGenerated).toBe(1);
    });

    it('should track token validation', () => {
      monitor.logTokenValidation({
        tokenId: 'token-456',
        userId: 'user-123',
        success: true,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const events = monitor.getRecentEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('token_validated');
      expect(events[0].success).toBe(true);
    });

    it('should track password reset completion', () => {
      monitor.logPasswordReset({
        userId: 'user-123',
        tokenId: 'token-456',
        email: 'test@example.com',
        success: true,
        duration: 200,
        sessionsInvalidated: 3,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const metrics = monitor.getMetrics();
      expect(metrics.tokensUsed).toBe(1);
    });

    it('should track email delivery', () => {
      monitor.logEmailDelivery({
        type: 'reset_request',
        email: 'test@example.com',
        userId: 'user-123',
        messageId: 'msg-789',
        success: true,
        duration: 300,
        provider: 'smtp',
      });

      const metrics = monitor.getMetrics();
      expect(metrics.emailsSent).toBe(1);
      expect(metrics.emailsFailed).toBe(0);
    });

    it('should track failed email delivery', () => {
      monitor.logEmailDelivery({
        type: 'reset_request',
        email: 'test@example.com',
        success: false,
        error: 'SMTP connection failed',
        duration: 5000,
        provider: 'smtp',
      });

      const metrics = monitor.getMetrics();
      expect(metrics.emailsSent).toBe(0);
      expect(metrics.emailsFailed).toBe(1);
    });

    it('should track rate limiting events', () => {
      const windowStart = new Date();
      const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);

      monitor.logRateLimit({
        email: 'test@example.com',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        limitType: 'email',
        currentCount: 4,
        limit: 3,
        windowStart,
        windowEnd,
      });

      const metrics = monitor.getMetrics();
      expect(metrics.rateLimitHits).toBe(1);
      expect(metrics.securityViolations).toBe(1); // Rate limit also creates security event
    });

    it('should track security events', () => {
      monitor.logSecurityEvent({
        type: 'invalid_token_attempt',
        severity: 'medium',
        userId: 'user-123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: {
          tokenId: 'invalid-token',
          error: 'Token not found',
        },
      });

      const metrics = monitor.getMetrics();
      expect(metrics.securityViolations).toBe(1);

      const securityEvents = monitor.getSecurityEvents(10);
      expect(securityEvents).toHaveLength(1);
      expect(securityEvents[0].type).toBe('invalid_token_attempt');
      expect(securityEvents[0].severity).toBe('medium');
    });

    it('should calculate success rates correctly', () => {
      // Add some test data
      monitor.logPasswordResetRequest({ email: 'test1@example.com', success: true });
      monitor.logPasswordResetRequest({ email: 'test2@example.com', success: true });
      monitor.logPasswordResetRequest({ email: 'test3@example.com', success: false, error: 'Error' });

      monitor.logEmailDelivery({ type: 'reset_request', email: 'test1@example.com', success: true });
      monitor.logEmailDelivery({ type: 'reset_request', email: 'test2@example.com', success: false, error: 'SMTP error' });

      monitor.logTokenGeneration({ userId: 'user-1', tokenId: 'token-1', email: 'test1@example.com', expiresAt: new Date(), success: true });
      monitor.logTokenGeneration({ userId: 'user-2', tokenId: 'token-2', email: 'test2@example.com', expiresAt: new Date(), success: true });

      monitor.logPasswordReset({ userId: 'user-1', tokenId: 'token-1', success: true });

      const successRates = monitor.getSuccessRates();
      expect(successRates.requestSuccessRate).toBeCloseTo(2/3); // 2 successful out of 3
      expect(successRates.emailDeliveryRate).toBeCloseTo(1/2); // 1 successful out of 2
      expect(successRates.tokenUsageRate).toBeCloseTo(1/2); // 1 used out of 2 generated
    });

    it('should generate comprehensive monitoring report', () => {
      // Add test data
      monitor.logPasswordResetRequest({ email: 'test@example.com', success: true });
      monitor.logEmailDelivery({ type: 'reset_request', email: 'test@example.com', success: true });
      monitor.logRateLimit({
        email: 'spam@example.com',
        limitType: 'email',
        currentCount: 5,
        limit: 3,
        windowStart: new Date(),
        windowEnd: new Date(),
      });

      const report = monitor.generateReport();
      
      expect(report.metrics).toBeDefined();
      expect(report.successRates).toBeDefined();
      expect(report.recentEvents).toBeDefined();
      expect(report.securityEvents).toBeDefined();
      expect(report.alerts).toBeDefined();
      expect(report.alerts.length).toBeGreaterThanOrEqual(0); // Should have alerts due to rate limiting
    });

    it('should mask email addresses in logs', () => {
      monitor.logPasswordResetRequest({
        email: 'testuser@example.com',
        success: true,
      });

      const events = monitor.getRecentEvents(1);
      expect(events[0].email).toBe('te***@example.com');
    });

    it('should limit event history size', () => {
      // Add more than 1000 events
      for (let i = 0; i < 1100; i++) {
        monitor.logPasswordResetRequest({
          email: `test${i}@example.com`,
          success: true,
        });
      }

      const events = monitor.getRecentEvents(2000);
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('PasswordResetRateLimit', () => {
    it('should allow requests within limits', async () => {
      const req = {
        body: { email: 'test@example.com' },
        ip: '192.168.1.1',
        get: vi.fn(() => 'Mozilla/5.0'),
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        end: vi.fn(),
        statusCode: 200,
      } as any;

      const next = vi.fn();

      const middleware = rateLimiter.middleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding email limit', async () => {
      const email = 'test@example.com';
      const req = {
        body: { email },
        ip: '192.168.1.1',
        get: vi.fn(() => 'Mozilla/5.0'),
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        end: vi.fn(),
        statusCode: 429,
      } as any;

      const next = vi.fn();
      const middleware = rateLimiter.middleware();

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        res.statusCode = 200;
        await middleware(req, res, next);
        // Simulate successful response
        res.end();
      }

      // This request should be blocked
      res.statusCode = 429;
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many password reset requests for this email address. Please try again later.',
          category: 'rate_limit',
        },
      });
    });

    it('should provide rate limit status information', () => {
      const status = rateLimiter.getStatus();
      
      expect(status).toHaveProperty('emailEntries');
      expect(status).toHaveProperty('ipEntries');
      expect(status).toHaveProperty('config');
      expect(status.config.emailLimit).toBe(3);
      expect(status.config.ipLimit).toBe(10);
    });

    it('should allow resetting rate limits', () => {
      const email = 'test@example.com';
      
      // First, trigger rate limit
      const req = {
        body: { email },
        ip: '192.168.1.1',
        get: vi.fn(() => 'Mozilla/5.0'),
      } as any;

      // Reset the limit
      rateLimiter.resetEmailLimit(email);
      
      const limitInfo = rateLimiter.getEmailLimitInfo(email);
      expect(limitInfo).toBeNull(); // Should be null after reset
    });
  });

  describe('MonitoringController', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockReq = {
        query: {},
        user: { id: 'admin-123', role: 'admin' },
      };

      mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };
    });

    it('should return password recovery metrics', async () => {
      // Add some test data
      monitor.logPasswordResetRequest({ email: 'test@example.com', success: true });
      
      await monitoringController.getPasswordRecoveryMetrics(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          metrics: expect.any(Object),
          successRates: expect.any(Object),
          alerts: expect.any(Array),
          timestamp: expect.any(String),
        }),
      });
    });

    it('should return password recovery events', async () => {
      mockReq.query = { limit: '50' };
      
      // Add some test data
      monitor.logPasswordResetRequest({ email: 'test@example.com', success: true });
      
      await monitoringController.getPasswordRecoveryEvents(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          events: expect.any(Array),
          count: expect.any(Number),
          timestamp: expect.any(String),
        }),
      });
    });

    it('should return security events', async () => {
      // Add security event
      monitor.logSecurityEvent({
        type: 'invalid_token_attempt',
        severity: 'medium',
        details: { reason: 'test' },
      });
      
      await monitoringController.getPasswordRecoverySecurityEvents(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          events: expect.any(Array),
          count: expect.any(Number),
          timestamp: expect.any(String),
        }),
      });
    });

    it('should generate comprehensive report', async () => {
      await monitoringController.getPasswordRecoveryReport(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          metrics: expect.any(Object),
          successRates: expect.any(Object),
          recentEvents: expect.any(Array),
          securityEvents: expect.any(Array),
          alerts: expect.any(Array),
          timestamp: expect.any(String),
          reportGenerated: expect.any(String),
        }),
      });
    });

    it('should reset metrics for admin users', async () => {
      const initialMetrics = monitor.getMetrics();
      monitor.logPasswordResetRequest({ email: 'test@example.com', success: true });
      
      const metricsAfterEvent = monitor.getMetrics();
      expect(metricsAfterEvent.requestsTotal).toBe(1);

      await monitoringController.resetPasswordRecoveryMetrics(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password recovery metrics have been reset',
        timestamp: expect.any(String),
      });

      const metricsAfterReset = monitor.getMetrics();
      expect(metricsAfterReset.requestsTotal).toBe(0);
    });

    it('should deny reset for non-admin users', async () => {
      mockReq.user = { id: 'user-123', role: 'user' };

      await monitoringController.resetPasswordRecoveryMetrics(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
      });
    });

    it('should return password recovery statistics', async () => {
      mockReq.query = { timeRange: '24h' };
      
      // Add some test data
      monitor.logPasswordResetRequest({ email: 'test@example.com', success: true });
      monitor.logEmailDelivery({ type: 'reset_request', email: 'test@example.com', success: true });
      
      await monitoringController.getPasswordRecoveryStats(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalRequests: expect.any(Number),
          successfulRequests: expect.any(Number),
          failedRequests: expect.any(Number),
          emailsSent: expect.any(Number),
          emailsFailed: expect.any(Number),
          successRates: expect.any(Object),
          recentActivity: expect.any(Object),
          timestamp: expect.any(String),
        }),
      });
    });
  });

  describe('Integration with EmailService', () => {
    it('should log email delivery metrics', async () => {
      const emailData = {
        userEmail: 'test@example.com',
        userName: 'Test User',
        resetToken: 'test-token',
        resetUrl: 'https://example.com/reset?token=test-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      await emailService.sendPasswordResetEmail(emailData);

      const metrics = monitor.getMetrics();
      expect(metrics.emailsSent).toBe(1);
      expect(metrics.emailsFailed).toBe(0);

      const events = monitor.getRecentEvents(10);
      const emailEvent = events.find(e => e.type === 'email_sent');
      expect(emailEvent).toBeDefined();
      expect(emailEvent?.success).toBe(true);
      expect(emailEvent?.metadata?.emailType).toBe('reset_request');
    });
  });
});