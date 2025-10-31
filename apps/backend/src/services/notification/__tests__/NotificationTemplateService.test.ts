import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationTemplateService } from '../NotificationTemplateService';

describe('NotificationTemplateService', () => {
  let templateService: NotificationTemplateService;

  beforeEach(() => {
    templateService = new NotificationTemplateService();
  });

  describe('getTemplate', () => {
    it('should return email template for swap proposal', () => {
      // Act
      const template = templateService.getTemplate('swap_proposal', 'email');

      // Assert
      expect(template).toBeDefined();
      expect(template?.type).toBe('swap_proposal');
      expect(template?.channel).toBe('email');
      expect(template?.subject).toContain('New Swap Proposal');
      expect(template?.template).toContain('{{recipientName}}');
    });

    it('should return SMS template for swap proposal', () => {
      // Act
      const template = templateService.getTemplate('swap_proposal', 'sms');

      // Assert
      expect(template).toBeDefined();
      expect(template?.type).toBe('swap_proposal');
      expect(template?.channel).toBe('sms');
      expect(template?.template).toContain('{{targetBookingTitle}}');
    });

    it('should return undefined for non-existent template', () => {
      // Act
      const template = templateService.getTemplate('non_existent' as any, 'email');

      // Assert
      expect(template).toBeUndefined();
    });
  });

  describe('renderTemplate', () => {
    it('should render email template with data', () => {
      // Arrange
      const template = templateService.getTemplate('swap_proposal', 'email')!;
      const data = {
        recipientName: 'John Doe',
        targetBookingTitle: 'Luxury Hotel Suite',
        sourceBookingTitle: 'Beach Resort',
        sourceBookingLocation: 'Miami, FL',
        sourceBookingDates: 'Jan 1-3, 2024',
        sourceBookingValue: '300',
        targetBookingLocation: 'New York, NY',
        targetBookingDates: 'Jan 5-7, 2024',
        targetBookingValue: '400',
        expiresAt: 'Jan 10, 2024',
        dashboardUrl: 'https://app.bookingswap.com/dashboard',
      };

      // Act
      const rendered = templateService.renderTemplate(template, data);

      // Assert
      expect(rendered.subject).toContain('Luxury Hotel Suite');
      expect(rendered.content).toContain('John Doe');
      expect(rendered.content).toContain('Beach Resort');
      expect(rendered.content).toContain('Miami, FL');
      expect(rendered.content).toContain('https://app.bookingswap.com/dashboard');
    });

    it('should render SMS template with data', () => {
      // Arrange
      const template = templateService.getTemplate('swap_proposal', 'sms')!;
      const data = {
        targetBookingTitle: 'Concert Tickets',
        sourceBookingTitle: 'Hotel Booking',
        sourceBookingLocation: 'Los Angeles, CA',
        dashboardUrl: 'https://app.bookingswap.com/dashboard',
      };

      // Act
      const rendered = templateService.renderTemplate(template, data);

      // Assert
      expect(rendered.content).toContain('Concert Tickets');
      expect(rendered.content).toContain('Hotel Booking');
      expect(rendered.content).toContain('Los Angeles, CA');
      expect(rendered.content).toContain('https://app.bookingswap.com/dashboard');
    });

    it('should handle conditional blocks', () => {
      // Arrange
      const template = templateService.getTemplate('swap_proposal', 'email')!;
      const dataWithPayment = {
        recipientName: 'John Doe',
        additionalPayment: '50',
        targetBookingTitle: 'Hotel',
        sourceBookingTitle: 'Resort',
        sourceBookingLocation: 'Miami',
        sourceBookingDates: 'Jan 1-3',
        sourceBookingValue: '300',
        targetBookingLocation: 'NYC',
        targetBookingDates: 'Jan 5-7',
        targetBookingValue: '400',
        expiresAt: 'Jan 10',
        dashboardUrl: 'https://example.com',
      };

      const dataWithoutPayment = {
        ...dataWithPayment,
        additionalPayment: undefined,
      };

      // Act
      const renderedWithPayment = templateService.renderTemplate(template, dataWithPayment);
      const renderedWithoutPayment = templateService.renderTemplate(template, dataWithoutPayment);

      // Assert
      expect(renderedWithPayment.content).toContain('Additional Payment: $50');
      expect(renderedWithoutPayment.content).not.toContain('Additional Payment');
    });

    it('should handle loop blocks', () => {
      // Arrange
      const template = templateService.getTemplate('swap_proposal', 'email')!;
      const data = {
        recipientName: 'John Doe',
        conditions: ['No smoking', 'No pets', 'Check-in after 3 PM'],
        targetBookingTitle: 'Hotel',
        sourceBookingTitle: 'Resort',
        sourceBookingLocation: 'Miami',
        sourceBookingDates: 'Jan 1-3',
        sourceBookingValue: '300',
        targetBookingLocation: 'NYC',
        targetBookingDates: 'Jan 5-7',
        targetBookingValue: '400',
        expiresAt: 'Jan 10',
        dashboardUrl: 'https://example.com',
      };

      // Act
      const rendered = templateService.renderTemplate(template, data);

      // Assert
      expect(rendered.content).toContain('No smoking');
      expect(rendered.content).toContain('No pets');
      expect(rendered.content).toContain('Check-in after 3 PM');
    });
  });

  describe('template coverage', () => {
    const notificationTypes = [
      'swap_proposal',
      'swap_accepted',
      'swap_rejected',
      'swap_expired',
      'swap_cancelled',
    ];

    const channels = ['email', 'sms'];

    notificationTypes.forEach(type => {
      channels.forEach(channel => {
        it(`should have template for ${type} - ${channel}`, () => {
          const template = templateService.getTemplate(type as any, channel as any);
          expect(template).toBeDefined();
          expect(template?.type).toBe(type);
          expect(template?.channel).toBe(channel);
        });
      });
    });
  });
});