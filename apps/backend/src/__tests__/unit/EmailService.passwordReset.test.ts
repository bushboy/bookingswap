import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService, PasswordResetEmailData, PasswordResetConfirmationEmailData } from '../../services/email/EmailService';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransporter: vi.fn(),
    getTestMessageUrl: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EmailService - Password Reset Functionality', () => {
  let emailService: EmailService;
  let mockTransporter: any;
  let mockSendMail: Mock;

  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    mockSendMail = vi.fn();
    mockTransporter = {
      sendMail: mockSendMail,
    };

    (nodemailer.createTransporter as Mock).mockReturnValue(mockTransporter);
    (nodemailer.getTestMessageUrl as Mock).mockReturnValue('https://ethereal.email/message/test');

    emailService = new EmailService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sendPasswordResetEmail', () => {
    const mockResetData: PasswordResetEmailData = {
      userEmail: 'test@example.com',
      userName: 'Test User',
      resetToken: 'secure-reset-token-123',
      resetUrl: 'https://app.example.com/reset-password?token=secure-reset-token-123',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    };

    it('should send password reset email successfully', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      // Act
      await emailService.sendPasswordResetEmail(mockResetData);

      // Assert
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Booking Swap Platform" <noreply@bookingswap.com>',
        to: mockResetData.userEmail,
        subject: 'Reset Your Password - Booking Swap Platform',
        html: expect.stringContaining('Reset Your Password'),
        text: expect.stringContaining('Reset Your Password'),
      });
    });

    it('should include reset URL in email content', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetEmail(mockResetData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(mockResetData.resetUrl);
      expect(callArgs.text).toContain(mockResetData.resetUrl);
    });

    it('should include user name in email content', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetEmail(mockResetData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Hello Test User!');
      expect(callArgs.text).toContain('Hello Test User!');
    });

    it('should include expiration time in email content', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetEmail(mockResetData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('minutes');
      expect(callArgs.text).toContain('minutes');
    });

    it('should handle missing user name gracefully', async () => {
      // Arrange
      const dataWithoutName = { ...mockResetData, userName: '' };
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetEmail(dataWithoutName);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Hello there!');
      expect(callArgs.text).toContain('Hello there!');
    });

    it('should use custom SMTP configuration in production', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'smtp-user';
      process.env.SMTP_PASS = 'smtp-pass';
      process.env.SMTP_FROM_EMAIL = 'custom@example.com';
      process.env.SMTP_FROM_NAME = 'Custom Platform';

      // Recreate service to pick up new env vars
      emailService = new EmailService();

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetEmail(mockResetData);

      // Assert
      expect(nodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: true,
        auth: {
          user: 'smtp-user',
          pass: 'smtp-pass',
        },
      });

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.from).toBe('"Custom Platform" <custom@example.com>');
    });

    it('should use Ethereal Email in development', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      
      // Recreate service to pick up new env vars
      emailService = new EmailService();

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetEmail(mockResetData);

      // Assert
      expect(nodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass',
        },
      });
    });

    it('should throw error when email sending fails', async () => {
      // Arrange
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      // Act & Assert
      await expect(
        emailService.sendPasswordResetEmail(mockResetData)
      ).rejects.toThrow('Failed to send email');
    });

    it('should log preview URL in development', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockInfo = {
        messageId: 'test-message-id',
        response: '250 OK',
      };
      
      mockSendMail.mockResolvedValue(mockInfo);
      (nodemailer.getTestMessageUrl as Mock).mockReturnValue('https://ethereal.email/message/test');

      // Act
      await emailService.sendPasswordResetEmail(mockResetData);

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Email sent (development)',
        expect.objectContaining({
          messageId: 'test-message-id',
          previewUrl: 'https://ethereal.email/message/test',
          to: mockResetData.userEmail,
          subject: 'Reset Your Password - Booking Swap Platform',
        })
      );
    });
  });

  describe('sendPasswordResetConfirmationEmail', () => {
    const mockConfirmationData: PasswordResetConfirmationEmailData = {
      userEmail: 'test@example.com',
      userName: 'Test User',
      resetTime: new Date('2024-01-01T12:00:00Z'),
    };

    it('should send password reset confirmation email successfully', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      // Act
      await emailService.sendPasswordResetConfirmationEmail(mockConfirmationData);

      // Assert
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Booking Swap Platform" <noreply@bookingswap.com>',
        to: mockConfirmationData.userEmail,
        subject: 'Password Reset Confirmation - Booking Swap Platform',
        html: expect.stringContaining('Password Reset Successful'),
        text: expect.stringContaining('Password Reset Successful'),
      });
    });

    it('should include user name in confirmation email', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetConfirmationEmail(mockConfirmationData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('Hello Test User!');
      expect(callArgs.text).toContain('Hello Test User!');
    });

    it('should include formatted reset time in confirmation email', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetConfirmationEmail(mockConfirmationData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('January 1, 2024');
      expect(callArgs.text).toContain('January 1, 2024');
    });

    it('should include security warnings in confirmation email', async () => {
      // Arrange
      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendPasswordResetConfirmationEmail(mockConfirmationData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('If you did not make this change');
      expect(callArgs.text).toContain('If you did not make this change');
      expect(callArgs.html).toContain('all existing sessions have been invalidated');
      expect(callArgs.text).toContain('all existing sessions have been invalidated');
    });

    it('should throw error when confirmation email sending fails', async () => {
      // Arrange
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      // Act & Assert
      await expect(
        emailService.sendPasswordResetConfirmationEmail(mockConfirmationData)
      ).rejects.toThrow('Failed to send email');
    });
  });

  describe('sendEmail (generic method)', () => {
    it('should send generic email successfully', async () => {
      // Arrange
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
        text: 'Test Text',
      };

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      // Act
      await emailService.sendEmail(emailOptions);

      // Assert
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Booking Swap Platform" <noreply@bookingswap.com>',
        to: emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: emailOptions.text,
      });
    });

    it('should handle missing text content', async () => {
      // Arrange
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
      };

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id',
      });

      // Act
      await emailService.sendEmail(emailOptions);

      // Assert
      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Booking Swap Platform" <noreply@bookingswap.com>',
        to: emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: undefined,
      });
    });

    it('should throw error when generic email sending fails', async () => {
      // Arrange
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test HTML</h1>',
      };

      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      // Act & Assert
      await expect(emailService.sendEmail(emailOptions)).rejects.toThrow('Failed to send email');
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection is successful', async () => {
      // Arrange
      mockTransporter.verify = vi.fn().mockResolvedValue(true);

      // Act
      const result = await emailService.verifyConnection();

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should return false when connection fails', async () => {
      // Arrange
      mockTransporter.verify = vi.fn().mockRejectedValue(new Error('Connection failed'));

      // Act
      const result = await emailService.verifyConnection();

      // Assert
      expect(result).toBe(false);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });
  });

  describe('HTML template generation', () => {
    it('should generate valid HTML for password reset email', async () => {
      // Arrange
      const mockData: PasswordResetEmailData = {
        userEmail: 'test@example.com',
        userName: 'Test User',
        resetToken: 'token-123',
        resetUrl: 'https://app.example.com/reset?token=token-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockSendMail.mockResolvedValue({ messageId: 'test' });

      // Act
      await emailService.sendPasswordResetEmail(mockData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      const html = callArgs.html;
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('Reset Your Password');
      expect(html).toContain(mockData.resetUrl);
      expect(html).toContain('Test User');
    });

    it('should generate valid HTML for confirmation email', async () => {
      // Arrange
      const mockData: PasswordResetConfirmationEmailData = {
        userEmail: 'test@example.com',
        userName: 'Test User',
        resetTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockSendMail.mockResolvedValue({ messageId: 'test' });

      // Act
      await emailService.sendPasswordResetConfirmationEmail(mockData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      const html = callArgs.html;
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('Password Reset Successful');
      expect(html).toContain('Test User');
      expect(html).toContain('January 1, 2024');
    });
  });

  describe('Text template generation', () => {
    it('should generate plain text for password reset email', async () => {
      // Arrange
      const mockData: PasswordResetEmailData = {
        userEmail: 'test@example.com',
        userName: 'Test User',
        resetToken: 'token-123',
        resetUrl: 'https://app.example.com/reset?token=token-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockSendMail.mockResolvedValue({ messageId: 'test' });

      // Act
      await emailService.sendPasswordResetEmail(mockData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      const text = callArgs.text;
      
      expect(text).toContain('Reset Your Password');
      expect(text).toContain(mockData.resetUrl);
      expect(text).toContain('Test User');
      expect(text).not.toContain('<html>');
      expect(text).not.toContain('<div>');
    });

    it('should generate plain text for confirmation email', async () => {
      // Arrange
      const mockData: PasswordResetConfirmationEmailData = {
        userEmail: 'test@example.com',
        userName: 'Test User',
        resetTime: new Date('2024-01-01T12:00:00Z'),
      };

      mockSendMail.mockResolvedValue({ messageId: 'test' });

      // Act
      await emailService.sendPasswordResetConfirmationEmail(mockData);

      // Assert
      const callArgs = mockSendMail.mock.calls[0][0];
      const text = callArgs.text;
      
      expect(text).toContain('Password Reset Successful');
      expect(text).toContain('Test User');
      expect(text).toContain('January 1, 2024');
      expect(text).not.toContain('<html>');
      expect(text).not.toContain('<div>');
    });
  });
});