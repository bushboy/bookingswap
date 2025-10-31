import * as nodemailer from 'nodemailer';
import { EmailNotificationData, NotificationDeliveryResult } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(data: EmailNotificationData): Promise<NotificationDeliveryResult> {
    try {
      logger.info('Sending email notification', { to: data.to, subject: data.subject });

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@bookingswap.com',
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', { 
        messageId: result.messageId, 
        to: data.to 
      });

      return {
        success: true,
        messageId: result.messageId,
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send email', { error, to: data.to });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveredAt: new Date(),
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed', { error });
      return false;
    }
  }
}