import { Twilio } from 'twilio';
import { SMSNotificationData, NotificationDeliveryResult } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export class SMSService {
  private client: Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';

    if (!accountSid || !authToken) {
      logger.warn('Twilio credentials not configured, SMS service disabled');
      throw new Error('Twilio credentials not configured');
    }

    this.client = new Twilio(accountSid, authToken);
  }

  async sendSMS(data: SMSNotificationData): Promise<NotificationDeliveryResult> {
    try {
      logger.info('Sending SMS notification', { to: data.to });

      const message = await this.client.messages.create({
        body: data.message,
        from: this.fromNumber,
        to: data.to,
      });

      logger.info('SMS sent successfully', { 
        messageId: message.sid, 
        to: data.to,
        status: message.status 
      });

      return {
        success: true,
        messageId: message.sid,
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send SMS', { error, to: data.to });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveredAt: new Date(),
      };
    }
  }

  async getMessageStatus(messageId: string): Promise<string> {
    try {
      const message = await this.client.messages(messageId).fetch();
      return message.status;
    } catch (error) {
      logger.error('Failed to get SMS status', { error, messageId });
      return 'unknown';
    }
  }
}