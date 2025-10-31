import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '../EmailService';
import nodemailer from 'nodemailer';

// Mock nodemailer
vi.mock('nodemailer');

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockTransporter = {
      sendMail: vi.fn(),
      verify: vi.fn(),
    };

    vi.mocked(nodemailer.createTransporter).mockReturnValue(mockTransporter);
    
    emailService = new EmailService();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      };

      const mockResult = {
        messageId: 'test-message-id',
        accepted: ['test@example.com'],
        rejected: [],
      };

      mockTransporter.sendMail.mockResolvedValue(mockResult);

      // Act
      const result = await emailService.sendEmail(emailData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.deliveredAt).toBeInstanceOf(Date);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: process.env.FROM_EMAIL || 'noreply@bookingswap.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      });
    });

    it('should handle email sending failure', async () => {
      // Arrange
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
      };

      const mockError = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      // Act
      const result = await emailService.sendEmail(emailData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });
  });

  describe('verifyConnection', () => {
    it('should verify connection successfully', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      // Act
      const result = await emailService.verifyConnection();

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should handle connection verification failure', async () => {
      // Arrange
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      // Act
      const result = await emailService.verifyConnection();

      // Assert
      expect(result).toBe(false);
    });
  });
});