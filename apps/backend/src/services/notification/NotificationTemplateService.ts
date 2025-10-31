import {
  NotificationType,
  NotificationChannel,
  NotificationTemplate,
  NotificationData
} from '@booking-swap/shared';

export class NotificationTemplateService {
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Swap Proposal Templates
    this.addTemplate({
      type: 'swap_proposal',
      channel: 'email',
      subject: 'New Swap Proposal for Your {{targetBookingTitle}}',
      template: '<h2>New Swap Proposal Received!</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Someone wants to swap their booking for your <strong>{{targetBookingTitle}}</strong>.</p>' +
        '<h3>Their Booking:</h3>' +
        '<ul>' +
        '<li><strong>Title:</strong> {{sourceBookingTitle}}</li>' +
        '<li><strong>Location:</strong> {{sourceBookingLocation}}</li>' +
        '<li><strong>Dates:</strong> {{sourceBookingDates}}</li>' +
        '<li><strong>Value:</strong> ${{sourceBookingValue}}</li>' +
        '</ul>' +
        '<h3>Your Booking:</h3>' +
        '<ul>' +
        '<li><strong>Title:</strong> {{targetBookingTitle}}</li>' +
        '<li><strong>Location:</strong> {{targetBookingLocation}}</li>' +
        '<li><strong>Dates:</strong> {{targetBookingDates}}</li>' +
        '<li><strong>Value:</strong> ${{targetBookingValue}}</li>' +
        '</ul>' +
        '{{#if additionalPayment}}<p><strong>Additional Payment:</strong> ${{additionalPayment}}</p>{{/if}}' +
        '{{#if conditions}}<h3>Conditions:</h3><ul>{{#each conditions}}<li>{{this}}</li>{{/each}}</ul>{{/if}}' +
        '<p><strong>Proposal expires:</strong> {{expiresAt}}</p>' +
        '<p><a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Proposal</a></p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'targetBookingTitle', 'sourceBookingTitle', 'sourceBookingLocation', 'sourceBookingDates', 'sourceBookingValue', 'targetBookingLocation', 'targetBookingDates', 'targetBookingValue', 'additionalPayment', 'conditions', 'expiresAt', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_proposal',
      channel: 'sms',
      template: 'New swap proposal for your {{targetBookingTitle}}! Someone wants to trade their {{sourceBookingTitle}} ({{sourceBookingLocation}}) for your booking. Check your dashboard to review: {{dashboardUrl}}',
      variables: ['targetBookingTitle', 'sourceBookingTitle', 'sourceBookingLocation', 'dashboardUrl']
    });

    // Swap Accepted Templates
    this.addTemplate({
      type: 'swap_accepted',
      channel: 'email',
      subject: 'Your Swap Proposal Has Been Accepted!',
      template: '<h2>Great News! Your Swap Proposal Has Been Accepted!</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Your swap proposal has been accepted. The swap between your <strong>{{sourceBookingTitle}}</strong> and <strong>{{targetBookingTitle}}</strong> will be processed shortly.</p>' +
        '<h3>Swap Details:</h3>' +
        '<ul>' +
        '<li><strong>Your Booking:</strong> {{sourceBookingTitle}} ({{sourceBookingLocation}})</li>' +
        '<li><strong>Their Booking:</strong> {{targetBookingTitle}} ({{targetBookingLocation}})</li>' +
        '<li><strong>Swap ID:</strong> {{swapId}}</li>' +
        '</ul>' +
        '<p>You will receive another notification once the blockchain transaction is complete.</p>' +
        '<p><a href="{{swapUrl}}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Swap Details</a></p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'sourceBookingTitle', 'targetBookingTitle', 'sourceBookingLocation', 'targetBookingLocation', 'swapId', 'swapUrl']
    });

    this.addTemplate({
      type: 'swap_accepted',
      channel: 'sms',
      template: 'Great news! Your swap proposal for {{targetBookingTitle}} has been accepted. Your {{sourceBookingTitle}} swap is being processed. View details: {{swapUrl}}',
      variables: ['targetBookingTitle', 'sourceBookingTitle', 'swapUrl']
    });

    // Swap Rejected Templates
    this.addTemplate({
      type: 'swap_rejected',
      channel: 'email',
      subject: 'Swap Proposal Update',
      template: '<h2>Swap Proposal Update</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Your swap proposal for <strong>{{targetBookingTitle}}</strong> has been declined.</p>' +
        '<p>Your booking <strong>{{sourceBookingTitle}}</strong> is now available again and can be used for other swap proposals.</p>' +
        '<p><a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Browse Other Bookings</a></p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'targetBookingTitle', 'sourceBookingTitle', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_rejected',
      channel: 'sms',
      template: 'Your swap proposal for {{targetBookingTitle}} was declined. Your {{sourceBookingTitle}} is available again. Browse more: {{dashboardUrl}}',
      variables: ['targetBookingTitle', 'sourceBookingTitle', 'dashboardUrl']
    });

    // Swap Expired Templates
    this.addTemplate({
      type: 'swap_expired',
      channel: 'email',
      subject: 'Swap Proposal Expired',
      template: '<h2>Swap Proposal Expired</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>{{#if isProposer}}Your swap proposal (ID: {{swapId}}) has expired and been automatically cancelled.{{else}}A swap proposal (ID: {{swapId}}) for your booking has expired.{{/if}}</p>' +
        '<p>Your booking is now available again for new swap proposals.</p>' +
        '<p><a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'swapId', 'isProposer', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_expired',
      channel: 'sms',
      template: 'Swap proposal {{swapId}} has expired. Your booking is available again. View dashboard: {{dashboardUrl}}',
      variables: ['swapId', 'dashboardUrl']
    });

    // Swap Cancelled Templates
    this.addTemplate({
      type: 'swap_cancelled',
      channel: 'email',
      subject: 'Swap Proposal Cancelled',
      template: '<h2>Swap Proposal Cancelled</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>A swap proposal (ID: {{swapId}}) has been cancelled by the proposer.</p>' +
        '<p>Your booking is now available again for new swap proposals.</p>' +
        '<p><a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a></p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'swapId', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_cancelled',
      channel: 'sms',
      template: 'Swap proposal {{swapId}} was cancelled. Your booking is available again. View dashboard: {{dashboardUrl}}',
      variables: ['swapId', 'dashboardUrl']
    });

    // In-app notification templates (simple text versions)
    this.addTemplate({
      type: 'swap_proposal',
      channel: 'in_app',
      template: 'New swap proposal for your {{targetBookingTitle}}',
      variables: ['targetBookingTitle']
    });

    this.addTemplate({
      type: 'swap_accepted',
      channel: 'in_app',
      template: 'Your swap proposal for {{targetBookingTitle}} has been accepted!',
      variables: ['targetBookingTitle']
    });

    this.addTemplate({
      type: 'swap_rejected',
      channel: 'in_app',
      template: 'Your swap proposal for {{targetBookingTitle}} was declined',
      variables: ['targetBookingTitle']
    });

    this.addTemplate({
      type: 'swap_expired',
      channel: 'in_app',
      template: 'Swap proposal {{swapId}} has expired',
      variables: ['swapId']
    });

    this.addTemplate({
      type: 'swap_cancelled',
      channel: 'in_app',
      template: 'Swap proposal {{swapId}} was cancelled',
      variables: ['swapId']
    });

    // Browse Proposal Templates
    this.addTemplate({
      type: 'browse_proposal_received',
      channel: 'email',
      subject: 'New Swap Proposal from Browse Page - {{sourceSwapDetails.title}}',
      template: '<h2>New Swap Proposal Received!</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Someone found your <strong>{{targetSwapDetails.title}}</strong> while browsing and wants to propose a swap!</p>' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🏨 Their Booking Offer:</h3>' +
        '<ul style="list-style: none; padding: 0;">' +
        '<li><strong>📍 Location:</strong> {{sourceSwapDetails.location}}</li>' +
        '<li><strong>📅 Dates:</strong> {{sourceSwapDetails.dates}}</li>' +
        '<li><strong>🏠 Type:</strong> {{sourceSwapDetails.accommodationType}}</li>' +
        '<li><strong>👥 Guests:</strong> {{sourceSwapDetails.guests}}</li>' +
        '<li><strong>💰 Value:</strong> ${{sourceSwapDetails.value}}</li>' +
        '</ul>' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🎯 Your Booking:</h3>' +
        '<ul style="list-style: none; padding: 0;">' +
        '<li><strong>📍 Location:</strong> {{targetSwapDetails.location}}</li>' +
        '<li><strong>📅 Dates:</strong> {{targetSwapDetails.dates}}</li>' +
        '<li><strong>🏠 Type:</strong> {{targetSwapDetails.accommodationType}}</li>' +
        '<li><strong>👥 Guests:</strong> {{targetSwapDetails.guests}}</li>' +
        '<li><strong>💰 Value:</strong> ${{targetSwapDetails.value}}</li>' +
        '</ul>' +
        '</div>' +

        '{{#if compatibilityAnalysis}}' +
        '<div style="background-color: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>📊 Compatibility Analysis:</h3>' +
        '<p><strong>Overall Match:</strong> {{compatibilityAnalysis.overallScore}}%</p>' +
        '<ul>' +
        '<li>Location Compatibility: {{compatibilityAnalysis.locationScore}}%</li>' +
        '<li>Date Compatibility: {{compatibilityAnalysis.dateScore}}%</li>' +
        '<li>Value Compatibility: {{compatibilityAnalysis.valueScore}}%</li>' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '{{#if message}}' +
        '<div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💬 Personal Message:</h3>' +
        '<p style="font-style: italic;">"{{message}}"</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Proposal</a>' +
        '</div>' +

        '<p style="color: #666; font-size: 14px;">This proposal was initiated from the browse page, showing genuine interest in your booking!</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'sourceSwapDetails', 'targetSwapDetails', 'compatibilityAnalysis', 'message', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_received',
      channel: 'sms',
      template: 'New swap proposal! Someone wants to trade their {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}}) for your {{targetSwapDetails.title}}. {{#if compatibilityAnalysis}}{{compatibilityAnalysis.overallScore}}% match!{{/if}} Review: {{dashboardUrl}}',
      variables: ['sourceSwapDetails', 'targetSwapDetails', 'compatibilityAnalysis', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_received',
      channel: 'in_app',
      template: 'New browse proposal for {{targetSwapDetails.title}} from {{sourceSwapDetails.location}}{{#if compatibilityAnalysis}} ({{compatibilityAnalysis.overallScore}}% match){{/if}}',
      variables: ['targetSwapDetails', 'sourceSwapDetails', 'compatibilityAnalysis']
    });

    // Browse Proposal Confirmed Templates
    this.addTemplate({
      type: 'browse_proposal_confirmed',
      channel: 'email',
      subject: 'Proposal Submitted Successfully - {{targetSwapDetails.title}}',
      template: '<h2>✅ Your Swap Proposal Has Been Submitted!</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Great news! Your swap proposal has been successfully submitted and is now being reviewed.</p>' +

        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">' +
        '<h3>📋 Proposal Summary:</h3>' +
        '<p><strong>Your Offer:</strong> {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}})</p>' +
        '<p><strong>Requested Swap:</strong> {{targetSwapDetails.title}} ({{targetSwapDetails.location}})</p>' +
        '<p><strong>Status:</strong> {{status}}</p>' +
        '</div>' +

        '{{#if compatibilityAnalysis}}' +
        '<div style="background-color: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>📊 Your Compatibility Score: {{compatibilityAnalysis.overallScore}}%</h3>' +
        '<p>This indicates how well your bookings match based on location, dates, value, and other factors.</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ What Happens Next:</h3>' +
        '<ul>' +
        '{{#each nextSteps}}<li>{{this}}</li>{{/each}}' +
        '</ul>' +
        '<p><strong>Estimated Response Time:</strong> {{estimatedResponseTime}}</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Track Your Proposal</a>' +
        '</div>' +

        '<p>We\'ll notify you as soon as the swap owner responds to your proposal.</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'sourceSwapDetails', 'targetSwapDetails', 'status', 'compatibilityAnalysis', 'nextSteps', 'estimatedResponseTime', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_confirmed',
      channel: 'sms',
      template: 'Proposal submitted! Your {{sourceSwapDetails.title}} proposal for {{targetSwapDetails.title}} is under review. Track status: {{dashboardUrl}}',
      variables: ['sourceSwapDetails', 'targetSwapDetails', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_confirmed',
      channel: 'in_app',
      template: 'Proposal submitted for {{targetSwapDetails.title}} - now under review',
      variables: ['targetSwapDetails']
    });

    // Browse Proposal Status Update Templates
    this.addTemplate({
      type: 'browse_proposal_status_update',
      channel: 'email',
      subject: 'Proposal Update: {{targetSwapDetails.title}} - {{status}}',
      template: '<h2>📬 Proposal Status Update</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Your swap proposal status has been updated:</p>' +

        '<div style="background-color: {{#if actionRequired}}#fff3cd{{else}}#f8f9fa{{/if}}; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>Status: {{status}}</h3>' +
        '<p>{{statusMessage}}</p>' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>📋 Proposal Details:</h3>' +
        '<p><strong>Your Offer:</strong> {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}})</p>' +
        '<p><strong>Requested Swap:</strong> {{targetSwapDetails.title}} ({{targetSwapDetails.location}})</p>' +
        '</div>' +

        '{{#if actionRequired}}' +
        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #17a2b8;">' +
        '<h3>⚡ Action Required</h3>' +
        '<p>Your proposal has been accepted! Please check your dashboard for next steps.</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Details</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'status', 'statusMessage', 'sourceSwapDetails', 'targetSwapDetails', 'actionRequired', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_status_update',
      channel: 'sms',
      template: 'Proposal update: {{targetSwapDetails.title}} - {{status}}. {{statusMessage}} Details: {{dashboardUrl}}',
      variables: ['targetSwapDetails', 'status', 'statusMessage', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_status_update',
      channel: 'in_app',
      template: 'Proposal {{status}}: {{targetSwapDetails.title}}',
      variables: ['status', 'targetSwapDetails']
    });

    // Browse Proposal Reminder Templates
    this.addTemplate({
      type: 'browse_proposal_reminder',
      channel: 'email',
      subject: '⏰ Reminder: Swap Proposal Awaiting Your Review - {{targetSwapTitle}}',
      template: '<h2>⏰ Proposal Reminder{{#if isUrgent}} - Urgent{{/if}}</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>{{#if isUrgent}}This is an urgent reminder that{{else}}You have{{/if}} a swap proposal waiting for your review:</p>' +

        '<div style="background-color: {{#if isUrgent}}#f8d7da{{else}}#fff3cd{{/if}}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid {{#if isUrgent}}#dc3545{{else}}#ffc107{{/if}};">' +
        '<h3>📋 Pending Proposal:</h3>' +
        '<p><strong>Their Offer:</strong> {{sourceSwapTitle}}</p>' +
        '<p><strong>Your Booking:</strong> {{targetSwapTitle}}</p>' +
        '<p><strong>Time Remaining:</strong> {{hoursRemaining}} hours</p>' +
        '{{#if expirationWarning}}<p style="color: #dc3545; font-weight: bold;">⚠️ {{expirationWarning}}</p>{{/if}}' +
        '</div>' +

        '{{#if isUrgent}}' +
        '<div style="background-color: #f8d7da; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🚨 Final Notice</h3>' +
        '<p>This proposal will expire in {{hoursRemaining}} hours. Please review and respond to avoid missing this opportunity.</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: {{#if isUrgent}}#dc3545{{else}}#ffc107{{/if}}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Now</a>' +
        '</div>' +

        '<p>Don\'t miss out on this swap opportunity!</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'sourceSwapTitle', 'targetSwapTitle', 'hoursRemaining', 'isUrgent', 'expirationWarning', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_reminder',
      channel: 'sms',
      template: '{{#if isUrgent}}URGENT: {{/if}}Swap proposal reminder! {{sourceSwapTitle}} for your {{targetSwapTitle}} expires in {{hoursRemaining}}h. Review: {{dashboardUrl}}',
      variables: ['isUrgent', 'sourceSwapTitle', 'targetSwapTitle', 'hoursRemaining', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'browse_proposal_reminder',
      channel: 'in_app',
      template: '{{#if isUrgent}}⚠️ Urgent: {{/if}}Proposal for {{targetSwapTitle}} expires in {{hoursRemaining}}h',
      variables: ['isUrgent', 'targetSwapTitle', 'hoursRemaining']
    });

    // Targeting Notification Templates

    // Targeting Received Templates
    this.addTemplate({
      type: 'targeting_received',
      channel: 'email',
      subject: 'Someone Wants to Target Your {{targetSwapDetails.title}}!',
      template: '<h2>🎯 New Targeting Request Received!</h2>' +
        '<p>Hello {{targetSwapDetails.ownerName}},</p>' +
        '<p>Great news! Someone has targeted your <strong>{{targetSwapDetails.title}}</strong> with their swap proposal.</p>' +

        '<div style="background-color: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">' +
        '<h3>🏨 Their Swap Offer:</h3>' +
        '<ul style="list-style: none; padding: 0;">' +
        '<li><strong>📍 Location:</strong> {{sourceSwapDetails.location}}</li>' +
        '<li><strong>📅 Dates:</strong> {{sourceSwapDetails.dates}}</li>' +
        '<li><strong>🏠 Type:</strong> {{sourceSwapDetails.accommodationType}}</li>' +
        '<li><strong>👥 Guests:</strong> {{sourceSwapDetails.guests}}</li>' +
        '<li><strong>💰 Value:</strong> ${{sourceSwapDetails.value}}</li>' +
        '<li><strong>👤 Owner:</strong> {{sourceSwapDetails.ownerName}}</li>' +
        '</ul>' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🎯 Your Targeted Swap:</h3>' +
        '<ul style="list-style: none; padding: 0;">' +
        '<li><strong>📍 Location:</strong> {{targetSwapDetails.location}}</li>' +
        '<li><strong>📅 Dates:</strong> {{targetSwapDetails.dates}}</li>' +
        '<li><strong>🏠 Type:</strong> {{targetSwapDetails.accommodationType}}</li>' +
        '<li><strong>👥 Guests:</strong> {{targetSwapDetails.guests}}</li>' +
        '<li><strong>💰 Value:</strong> ${{targetSwapDetails.value}}</li>' +
        '</ul>' +
        '</div>' +

        '{{#if message}}' +
        '<div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💬 Personal Message:</h3>' +
        '<p style="font-style: italic;">"{{message}}"</p>' +
        '</div>' +
        '{{/if}}' +

        '{{#if auctionInfo}}' +
        '{{#if auctionInfo.isAuctionMode}}' +
        '<div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🏆 Auction Mode Active</h3>' +
        '<p>Your swap is in auction mode. Current proposals: {{auctionInfo.currentProposalCount}}</p>' +
        '<p>Auction ends: {{auctionInfo.endDate}}</p>' +
        '</div>' +
        '{{else}}' +
        '<div style="background-color: #d1ecf1; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⚡ One-for-One Mode</h3>' +
        '<p>This is a direct targeting request. You can accept or decline this proposal.</p>' +
        '</div>' +
        '{{/if}}' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Targeting Request</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['targetSwapDetails', 'sourceSwapDetails', 'message', 'auctionInfo', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'targeting_received',
      channel: 'sms',
      template: 'New targeting! {{sourceSwapDetails.ownerName}} wants to swap their {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}}) for your {{targetSwapDetails.title}}. Review: {{dashboardUrl}}',
      variables: ['sourceSwapDetails', 'targetSwapDetails', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'targeting_received',
      channel: 'in_app',
      template: '🎯 {{sourceSwapDetails.ownerName}} targeted your {{targetSwapDetails.title}}',
      variables: ['sourceSwapDetails', 'targetSwapDetails']
    });

    // Targeting Accepted Templates
    this.addTemplate({
      type: 'targeting_accepted',
      channel: 'email',
      subject: '🎉 Your Targeting Request Was Accepted!',
      template: '<h2>🎉 Fantastic News! Your Targeting Request Was Accepted!</h2>' +
        '<p>Hello {{sourceSwapDetails.ownerName}},</p>' +
        '<p>Great news! Your targeting request for <strong>{{targetSwapDetails.title}}</strong> has been accepted!</p>' +

        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">' +
        '<h3>✅ Swap Match Confirmed</h3>' +
        '<p><strong>Your Swap:</strong> {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}})</p>' +
        '<p><strong>Their Swap:</strong> {{targetSwapDetails.title}} ({{targetSwapDetails.location}})</p>' +
        '<p><strong>Status:</strong> Accepted and Processing</p>' +
        '</div>' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ What Happens Next:</h3>' +
        '<ul>' +
        '<li>Both bookings will be processed for the swap</li>' +
        '<li>You\'ll receive confirmation once the blockchain transaction is complete</li>' +
        '<li>Contact details will be shared for coordination</li>' +
        '<li>Payment processing (if applicable) will begin</li>' +
        '</ul>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{swapUrl}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Swap Details</a>' +
        '</div>' +

        '<p>Congratulations on your successful swap match!</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['sourceSwapDetails', 'targetSwapDetails', 'swapUrl']
    });

    this.addTemplate({
      type: 'targeting_accepted',
      channel: 'sms',
      template: '🎉 Great news! Your targeting request for {{targetSwapDetails.title}} was accepted! Your {{sourceSwapDetails.title}} swap is being processed. Details: {{swapUrl}}',
      variables: ['targetSwapDetails', 'sourceSwapDetails', 'swapUrl']
    });

    this.addTemplate({
      type: 'targeting_accepted',
      channel: 'in_app',
      template: '🎉 Targeting accepted! Your {{sourceSwapDetails.title}} ↔ {{targetSwapDetails.title}}',
      variables: ['sourceSwapDetails', 'targetSwapDetails']
    });

    // Targeting Rejected Templates
    this.addTemplate({
      type: 'targeting_rejected',
      channel: 'email',
      subject: 'Targeting Request Update - {{targetSwapDetails.title}}',
      template: '<h2>📬 Targeting Request Update</h2>' +
        '<p>Hello {{sourceSwapDetails.ownerName}},</p>' +
        '<p>Your targeting request for <strong>{{targetSwapDetails.title}}</strong> has been declined.</p>' +

        '<div style="background-color: #f8d7da; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #dc3545;">' +
        '<h3>❌ Request Declined</h3>' +
        '<p><strong>Your Swap:</strong> {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}})</p>' +
        '<p><strong>Targeted Swap:</strong> {{targetSwapDetails.title}} ({{targetSwapDetails.location}})</p>' +
        '{{#if reason}}<p><strong>Reason:</strong> {{reason}}</p>{{/if}}' +
        '</div>' +

        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🔄 Your Swap is Available Again</h3>' +
        '<p>Your <strong>{{sourceSwapDetails.title}}</strong> is now available for new targeting requests.</p>' +
        '<p>You can browse other swaps and target new opportunities right away!</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{browseUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Browse Other Swaps</a>' +
        '</div>' +

        '<p>Don\'t give up - there are many other great swap opportunities waiting!</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['sourceSwapDetails', 'targetSwapDetails', 'reason', 'browseUrl']
    });

    this.addTemplate({
      type: 'targeting_rejected',
      channel: 'sms',
      template: 'Your targeting request for {{targetSwapDetails.title}} was declined. Your {{sourceSwapDetails.title}} is available again. Browse more: {{browseUrl}}',
      variables: ['targetSwapDetails', 'sourceSwapDetails', 'browseUrl']
    });

    this.addTemplate({
      type: 'targeting_rejected',
      channel: 'in_app',
      template: '❌ Targeting declined: {{targetSwapDetails.title}}',
      variables: ['targetSwapDetails']
    });

    // Targeting Cancelled Templates
    this.addTemplate({
      type: 'targeting_cancelled',
      channel: 'email',
      subject: 'Targeting Request Cancelled - {{targetSwapDetails.title}}',
      template: '<h2>🚫 Targeting Request Cancelled</h2>' +
        '<p>Hello {{targetSwapDetails.ownerName}},</p>' +
        '<p>A targeting request for your <strong>{{targetSwapDetails.title}}</strong> has been cancelled by the requester.</p>' +

        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">' +
        '<h3>📋 Cancelled Request Details</h3>' +
        '<p><strong>Their Swap:</strong> {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}})</p>' +
        '<p><strong>Your Swap:</strong> {{targetSwapDetails.title}} ({{targetSwapDetails.location}})</p>' +
        '<p><strong>Cancelled by:</strong> {{sourceSwapDetails.ownerName}}</p>' +
        '</div>' +

        '<div style="background-color: #d1ecf1; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>✨ Your Swap Remains Available</h3>' +
        '<p>Your swap is still available for new targeting requests and proposals.</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Dashboard</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['targetSwapDetails', 'sourceSwapDetails', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'targeting_cancelled',
      channel: 'sms',
      template: 'Targeting request for your {{targetSwapDetails.title}} was cancelled by {{sourceSwapDetails.ownerName}}. Your swap remains available.',
      variables: ['targetSwapDetails', 'sourceSwapDetails']
    });

    this.addTemplate({
      type: 'targeting_cancelled',
      channel: 'in_app',
      template: '🚫 Targeting cancelled: {{sourceSwapDetails.ownerName}} cancelled their request',
      variables: ['sourceSwapDetails']
    });

    // Retargeting Occurred Templates
    this.addTemplate({
      type: 'retargeting_occurred',
      channel: 'email',
      subject: 'Targeting Update - Request Redirected',
      template: '<h2>🔄 Targeting Request Redirected</h2>' +
        '<p>Hello {{targetSwapDetails.ownerName}},</p>' +
        '<p>A user who was targeting your <strong>{{previousTargetTitle}}</strong> has redirected their targeting request to a different swap.</p>' +

        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">' +
        '<h3>📋 Retargeting Details</h3>' +
        '<p><strong>Their Swap:</strong> {{sourceSwapTitle}}</p>' +
        '<p><strong>Previously Targeted:</strong> {{previousTargetTitle}}</p>' +
        '<p><strong>Now Targeting:</strong> {{newTargetTitle}}</p>' +
        '</div>' +

        '<div style="background-color: #d1ecf1; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>✨ Your Swap Status</h3>' +
        '<p>Your swap is now available for new targeting requests.</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Dashboard</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['targetSwapDetails', 'sourceSwapTitle', 'previousTargetTitle', 'newTargetTitle', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'retargeting_occurred',
      channel: 'sms',
      template: 'Targeting update: A user retargeted from your {{previousTargetTitle}} to {{newTargetTitle}}. Your swap is available again.',
      variables: ['previousTargetTitle', 'newTargetTitle']
    });

    this.addTemplate({
      type: 'retargeting_occurred',
      channel: 'in_app',
      template: '🔄 Retargeting: User switched from your swap to {{newTargetTitle}}',
      variables: ['newTargetTitle']
    });

    // Targeting Removed Templates
    this.addTemplate({
      type: 'targeting_removed',
      channel: 'email',
      subject: 'Targeting Request Removed - {{targetSwapDetails.title}}',
      template: '<h2>🗑️ Targeting Request Removed</h2>' +
        '<p>Hello {{targetSwapDetails.ownerName}},</p>' +
        '<p>A targeting request for your <strong>{{targetSwapDetails.title}}</strong> has been removed.</p>' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #6c757d;">' +
        '<h3>📋 Removed Request Details</h3>' +
        '<p><strong>Their Swap:</strong> {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}})</p>' +
        '<p><strong>Your Swap:</strong> {{targetSwapDetails.title}} ({{targetSwapDetails.location}})</p>' +
        '</div>' +

        '<div style="background-color: #d1ecf1; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>✨ Your Swap Status</h3>' +
        '<p>Your swap remains available for new targeting requests and proposals.</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Dashboard</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['targetSwapDetails', 'sourceSwapDetails', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'targeting_removed',
      channel: 'sms',
      template: 'Targeting request for your {{targetSwapDetails.title}} was removed. Your swap remains available.',
      variables: ['targetSwapDetails']
    });

    this.addTemplate({
      type: 'targeting_removed',
      channel: 'in_app',
      template: '🗑️ Targeting removed from your {{targetSwapDetails.title}}',
      variables: ['targetSwapDetails']
    });

    // Auction Targeting Update Templates
    this.addTemplate({
      type: 'auction_targeting_update',
      channel: 'email',
      subject: 'Auction Update - {{targetSwapTitle}} ({{updateType}})',
      template: '<h2>🏆 Auction Targeting Update</h2>' +
        '<p>Hello {{sourceSwapTitle}},</p>' +
        '<p>There\'s an update on the auction you\'re targeting: <strong>{{targetSwapTitle}}</strong></p>' +

        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">' +
        '<h3>📋 Auction Status</h3>' +
        '<p><strong>Update Type:</strong> {{updateType}}</p>' +
        '<p><strong>Your Targeting Swap:</strong> {{sourceSwapTitle}}</p>' +
        '<p><strong>Target Auction:</strong> {{targetSwapTitle}}</p>' +
        '<p><strong>Current Proposals:</strong> {{auctionInfo.currentProposalCount}}</p>' +
        '<p><strong>Time Remaining:</strong> {{auctionInfo.timeRemaining}}</p>' +
        '</div>' +

        '{{#if auctionInfo.isEnding}}' +
        '<div style="background-color: #f8d7da; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ Auction Ending Soon!</h3>' +
        '<p>This auction ends on {{auctionInfo.endDate}}. Make sure your targeting is still active!</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #ffc107; color: black; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Auction</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['sourceSwapTitle', 'targetSwapTitle', 'updateType', 'auctionInfo', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'auction_targeting_update',
      channel: 'sms',
      template: 'Auction update: {{targetSwapTitle}} - {{updateType}}. {{auctionInfo.currentProposalCount}} proposals, {{auctionInfo.timeRemaining}} left. View: {{dashboardUrl}}',
      variables: ['targetSwapTitle', 'updateType', 'auctionInfo', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'auction_targeting_update',
      channel: 'in_app',
      template: '🏆 Auction update: {{targetSwapTitle}} - {{updateType}}',
      variables: ['targetSwapTitle', 'updateType']
    });

    // Auction Targeting Ended Templates
    this.addTemplate({
      type: 'auction_targeting_ended',
      channel: 'email',
      subject: 'Auction Ended - {{targetSwapTitle}}',
      template: '<h2>🏁 Auction Has Ended</h2>' +
        '<p>Hello {{sourceSwapTitle}},</p>' +
        '<p>The auction you were targeting has ended: <strong>{{targetSwapTitle}}</strong></p>' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #6c757d;">' +
        '<h3>📋 Final Auction Results</h3>' +
        '<p><strong>Your Targeting Swap:</strong> {{sourceSwapTitle}}</p>' +
        '<p><strong>Ended Auction:</strong> {{targetSwapTitle}}</p>' +
        '<p><strong>Final Proposal Count:</strong> {{auctionInfo.currentProposalCount}}</p>' +
        '<p><strong>Auction End Date:</strong> {{auctionInfo.endDate}}</p>' +
        '</div>' +

        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🔄 Your Swap is Available Again</h3>' +
        '<p>Your <strong>{{sourceSwapTitle}}</strong> is now available for new targeting requests.</p>' +
        '<p>You can browse other swaps and target new opportunities!</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{browseUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Browse Other Swaps</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['sourceSwapTitle', 'targetSwapTitle', 'auctionInfo', 'browseUrl']
    });

    this.addTemplate({
      type: 'auction_targeting_ended',
      channel: 'sms',
      template: 'Auction ended: {{targetSwapTitle}}. Your {{sourceSwapTitle}} is available again. Browse more: {{browseUrl}}',
      variables: ['targetSwapTitle', 'sourceSwapTitle', 'browseUrl']
    });

    this.addTemplate({
      type: 'auction_targeting_ended',
      channel: 'in_app',
      template: '🏁 Auction ended: {{targetSwapTitle}} - your swap is available again',
      variables: ['targetSwapTitle']
    });

    // Proposal from Targeting Templates
    this.addTemplate({
      type: 'proposal_from_targeting',
      channel: 'email',
      subject: 'Proposal Created from Targeting - {{targetSwapDetails.title}}',
      template: '<h2>📝 Proposal Created from Your Targeting</h2>' +
        '<p>Hello {{sourceSwapDetails.ownerName}},</p>' +
        '<p>Your targeting request has been converted into a formal proposal for <strong>{{targetSwapDetails.title}}</strong>.</p>' +

        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">' +
        '<h3>✅ Proposal Details</h3>' +
        '<p><strong>Your Swap:</strong> {{sourceSwapDetails.title}} ({{sourceSwapDetails.location}})</p>' +
        '<p><strong>Target Swap:</strong> {{targetSwapDetails.title}} ({{targetSwapDetails.location}})</p>' +
        '<p><strong>Proposal Status:</strong> {{proposalInfo.status}}</p>' +
        '<p><strong>Created:</strong> {{proposalInfo.createdAt}}</p>' +
        '</div>' +

        '{{#if proposalInfo.message}}' +
        '<div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💬 Proposal Message</h3>' +
        '<p style="font-style: italic;">"{{proposalInfo.message}}"</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ What Happens Next</h3>' +
        '<ul>' +
        '<li>The swap owner will review your proposal</li>' +
        '<li>You\'ll be notified of their decision</li>' +
        '<li>If accepted, the swap process will begin</li>' +
        '</ul>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{proposalUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Proposal</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['sourceSwapDetails', 'targetSwapDetails', 'proposalInfo', 'proposalUrl']
    });

    this.addTemplate({
      type: 'proposal_from_targeting',
      channel: 'sms',
      template: 'Proposal created! Your targeting of {{targetSwapDetails.title}} is now a formal proposal. Status: {{proposalInfo.status}}. View: {{proposalUrl}}',
      variables: ['targetSwapDetails', 'proposalInfo', 'proposalUrl']
    });

    this.addTemplate({
      type: 'proposal_from_targeting',
      channel: 'in_app',
      template: '📝 Proposal created from targeting: {{targetSwapDetails.title}}',
      variables: ['targetSwapDetails']
    });

    // Targeting Restriction Warning Templates
    this.addTemplate({
      type: 'targeting_restriction_warning',
      channel: 'email',
      subject: 'Targeting Restriction - {{targetSwapTitle}}',
      template: '<h2>⚠️ Targeting Restriction Notice</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>We wanted to inform you about a targeting restriction for <strong>{{targetSwapTitle}}</strong>.</p>' +

        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">' +
        '<h3>🚫 Restriction Details</h3>' +
        '<p><strong>Your Swap:</strong> {{sourceSwapTitle}}</p>' +
        '<p><strong>Target Swap:</strong> {{targetSwapTitle}}</p>' +
        '<p><strong>Restriction Type:</strong> {{restrictionType}}</p>' +
        '<p><strong>Message:</strong> {{message}}</p>' +
        '</div>' +

        '{{#if suggestedActions}}' +
        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💡 Suggested Actions</h3>' +
        '<ul>' +
        '{{#each suggestedActions}}<li>{{this}}</li>{{/each}}' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{browseUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Browse Other Swaps</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'sourceSwapTitle', 'targetSwapTitle', 'restrictionType', 'message', 'suggestedActions', 'browseUrl']
    });

    this.addTemplate({
      type: 'targeting_restriction_warning',
      channel: 'sms',
      template: 'Targeting restriction: Cannot target {{targetSwapTitle}} - {{restrictionType}}. {{message}}',
      variables: ['targetSwapTitle', 'restrictionType', 'message']
    });

    this.addTemplate({
      type: 'targeting_restriction_warning',
      channel: 'in_app',
      template: '⚠️ Cannot target {{targetSwapTitle}}: {{restrictionType}}',
      variables: ['targetSwapTitle', 'restrictionType']
    });

    // Targeting Eligibility Changed Templates
    this.addTemplate({
      type: 'targeting_eligibility_changed',
      channel: 'email',
      subject: 'Targeting Eligibility Update - {{targetSwapTitle}}',
      template: '<h2>🔄 Targeting Eligibility Changed</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>The targeting eligibility for <strong>{{targetSwapTitle}}</strong> has changed.</p>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196f3;">' +
        '<h3>📋 Eligibility Update</h3>' +
        '<p><strong>Target Swap:</strong> {{targetSwapTitle}}</p>' +
        '<p><strong>Previous Status:</strong> {{previousStatus}}</p>' +
        '<p><strong>New Status:</strong> {{newStatus}}</p>' +
        '<p><strong>Reason:</strong> {{reason}}</p>' +
        '</div>' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💡 What This Means</h3>' +
        '<p>{{#if canStillTarget}}You can still target this swap with your current targeting request.{{else}}Your targeting request may be affected by this change.{{/if}}</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Check Your Targeting</a>' +
        '</div>' +

        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'targetSwapTitle', 'previousStatus', 'newStatus', 'reason', 'canStillTarget', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'targeting_eligibility_changed',
      channel: 'sms',
      template: 'Targeting eligibility changed: {{targetSwapTitle}} - {{newStatus}}. {{reason}}',
      variables: ['targetSwapTitle', 'newStatus', 'reason']
    });

    this.addTemplate({
      type: 'targeting_eligibility_changed',
      channel: 'in_app',
      template: '🔄 Eligibility changed: {{targetSwapTitle}} - {{newStatus}}',
      variables: ['targetSwapTitle', 'newStatus']
    });

    // Proposal Response Templates - Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

    // Proposal Accepted Templates
    this.addTemplate({
      type: 'proposal_accepted',
      channel: 'email',
      subject: '🎉 Your Proposal Has Been Accepted!',
      template: '<h2>🎉 Fantastic News! Your Proposal Has Been Accepted!</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Great news! Your {{proposalType}} proposal has been accepted!</p>' +

        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">' +
        '<h3>✅ Proposal Details</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '<p><strong>Type:</strong> {{#if (eq proposalType "booking")}}Booking Exchange{{else}}Cash Offer{{/if}}</p>' +
        '<p><strong>Status:</strong> Accepted</p>' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🏨 Swap Details</h3>' +
        '<p><strong>Your Booking:</strong> {{sourceSwapTitle}} ({{sourceSwapLocation}})</p>' +
        '<p><strong>Dates:</strong> {{sourceSwapDates}}</p>' +
        '{{#if targetSwapTitle}}' +
        '<p><strong>Their Booking:</strong> {{targetSwapTitle}} ({{targetSwapLocation}})</p>' +
        '<p><strong>Dates:</strong> {{targetSwapDates}}</p>' +
        '{{/if}}' +
        '</div>' +

        '{{#if cashAmount}}' +
        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💰 Payment Details</h3>' +
        '<p><strong>Amount:</strong> {{cashAmount}} {{cashCurrency}}</p>' +
        '{{#if escrowRequired}}<p><strong>Escrow:</strong> Funds will be released from escrow</p>{{/if}}' +
        '</div>' +
        '{{/if}}' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ What Happens Next</h3>' +
        '<ul>' +
        '<li>{{#if role}}You will receive{{else}}The proposer will receive{{/if}} confirmation once blockchain recording is complete</li>' +
        '{{#if cashAmount}}<li>Payment processing will begin immediately</li>{{/if}}' +
        '<li>Contact details will be shared for coordination</li>' +
        '<li>You can track progress in your dashboard</li>' +
        '</ul>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Details</a>' +
        '</div>' +

        '<p>Congratulations on your successful proposal!</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'proposalId', 'proposalType', 'sourceSwapTitle', 'sourceSwapLocation', 'sourceSwapDates', 'targetSwapTitle', 'targetSwapLocation', 'targetSwapDates', 'cashAmount', 'cashCurrency', 'escrowRequired', 'role', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_accepted',
      channel: 'sms',
      template: '🎉 Great news! Your {{proposalType}} proposal for {{#if targetSwapTitle}}{{targetSwapTitle}}{{else}}{{sourceSwapTitle}}{{/if}} has been accepted! {{#if cashAmount}}Payment: {{cashAmount}} {{cashCurrency}}. {{/if}}Details: {{dashboardUrl}}',
      variables: ['proposalType', 'targetSwapTitle', 'sourceSwapTitle', 'cashAmount', 'cashCurrency', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_accepted',
      channel: 'in_app',
      template: '🎉 Proposal accepted! {{#if targetSwapTitle}}{{targetSwapTitle}}{{else}}{{sourceSwapTitle}}{{/if}}{{#if cashAmount}} ({{cashAmount}} {{cashCurrency}}){{/if}}',
      variables: ['targetSwapTitle', 'sourceSwapTitle', 'cashAmount', 'cashCurrency']
    });

    // Proposal Rejected Templates
    this.addTemplate({
      type: 'proposal_rejected',
      channel: 'email',
      subject: 'Proposal Update - {{#if targetSwapTitle}}{{targetSwapTitle}}{{else}}{{sourceSwapTitle}}{{/if}}',
      template: '<h2>📬 Proposal Update</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>{{#if role}}You have declined{{else}}Your{{/if}} the {{proposalType}} proposal{{#if targetSwapTitle}} for {{targetSwapTitle}}{{/if}}.</p>' +

        '<div style="background-color: #f8d7da; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #dc3545;">' +
        '<h3>❌ Proposal Details</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '<p><strong>Type:</strong> {{#if (eq proposalType "booking")}}Booking Exchange{{else}}Cash Offer{{/if}}</p>' +
        '<p><strong>Status:</strong> Declined</p>' +
        '{{#if rejectionReason}}<p><strong>Reason:</strong> {{rejectionReason}}</p>{{/if}}' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🏨 Swap Details</h3>' +
        '<p><strong>{{#if role}}Their{{else}}Your{{/if}} Booking:</strong> {{sourceSwapTitle}} ({{sourceSwapLocation}})</p>' +
        '<p><strong>Dates:</strong> {{sourceSwapDates}}</p>' +
        '{{#if targetSwapTitle}}' +
        '<p><strong>{{#if role}}Your{{else}}Their{{/if}} Booking:</strong> {{targetSwapTitle}} ({{targetSwapLocation}})</p>' +
        '<p><strong>Dates:</strong> {{targetSwapDates}}</p>' +
        '{{/if}}' +
        '</div>' +

        '{{#if cashAmount}}' +
        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💰 Cash Offer Details</h3>' +
        '<p><strong>Amount:</strong> {{cashAmount}} {{cashCurrency}}</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🔄 Your {{#if role}}Booking{{else}}Swap{{/if}} is Available Again</h3>' +
        '<p>{{#if role}}Your booking remains available for new proposals.{{else}}Your swap is now available for new targeting and proposals.{{/if}}</p>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">{{#if role}}View Dashboard{{else}}Browse Other Swaps{{/if}}</a>' +
        '</div>' +

        '<p>{{#if role}}Thank you for your response.{{else}}Don\'t give up - there are many other great opportunities waiting!{{/if}}</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'proposalId', 'proposalType', 'sourceSwapTitle', 'sourceSwapLocation', 'sourceSwapDates', 'targetSwapTitle', 'targetSwapLocation', 'targetSwapDates', 'cashAmount', 'cashCurrency', 'rejectionReason', 'hasReason', 'role', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_rejected',
      channel: 'sms',
      template: '{{#if role}}You declined{{else}}Your proposal for{{/if}} {{#if targetSwapTitle}}{{targetSwapTitle}}{{else}}{{sourceSwapTitle}}{{/if}} {{#if role}}proposal{{else}}was declined{{/if}}. {{#if rejectionReason}}Reason: {{rejectionReason}}. {{/if}}{{#if role}}Dashboard{{else}}Browse more{{/if}}: {{dashboardUrl}}',
      variables: ['role', 'targetSwapTitle', 'sourceSwapTitle', 'rejectionReason', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_rejected',
      channel: 'in_app',
      template: '❌ Proposal {{#if role}}declined{{else}}rejected{{/if}}: {{#if targetSwapTitle}}{{targetSwapTitle}}{{else}}{{sourceSwapTitle}}{{/if}}{{#if rejectionReason}} - {{rejectionReason}}{{/if}}',
      variables: ['role', 'targetSwapTitle', 'sourceSwapTitle', 'rejectionReason']
    });

    // Proposal Payment Completed Templates
    this.addTemplate({
      type: 'proposal_payment_completed',
      channel: 'email',
      subject: '💰 Payment Completed - {{amount}} {{currency}}',
      template: '<h2>💰 Payment Successfully Completed!</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>Great news! The payment for your accepted proposal has been successfully processed.</p>' +

        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">' +
        '<h3>✅ Payment Details</h3>' +
        '<p><strong>Transaction ID:</strong> {{transactionId}}</p>' +
        '<p><strong>Amount:</strong> {{amount}} {{currency}}</p>' +
        '<p><strong>Status:</strong> Completed</p>' +
        '<p><strong>{{#if (eq role "recipient")}}Received{{else}}Sent{{/if}} on:</strong> {{timestamp}}</p>' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>📋 Related Proposal</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '{{#if swapId}}<p><strong>Swap ID:</strong> {{swapId}}</p>{{/if}}' +
        '</div>' +

        '{{#if (eq role "recipient")}}' +
        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💡 What This Means</h3>' +
        '<p>The funds have been successfully transferred to your account. You can now coordinate with the other party to complete your swap arrangement.</p>' +
        '</div>' +
        '{{else}}' +
        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💡 What This Means</h3>' +
        '<p>Your payment has been successfully sent. The recipient has been notified and you can now coordinate to complete your swap arrangement.</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Transaction</a>' +
        '</div>' +

        '<p>Thank you for using our secure payment system!</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'transactionId', 'amount', 'currency', 'role', 'proposalId', 'swapId', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_payment_completed',
      channel: 'sms',
      template: '💰 Payment {{#if (eq role "recipient")}}received{{else}}sent{{/if}}: {{amount}} {{currency}} for proposal {{proposalId}}. Transaction: {{transactionId}}. Details: {{dashboardUrl}}',
      variables: ['role', 'amount', 'currency', 'proposalId', 'transactionId', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_payment_completed',
      channel: 'in_app',
      template: '💰 Payment {{#if (eq role "recipient")}}received{{else}}completed{{/if}}: {{amount}} {{currency}}',
      variables: ['role', 'amount', 'currency']
    });

    // Proposal Payment Failed Templates
    this.addTemplate({
      type: 'proposal_payment_failed',
      channel: 'email',
      subject: '⚠️ Payment Failed - {{amount}} {{currency}}',
      template: '<h2>⚠️ Payment Processing Failed</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>We encountered an issue processing the payment for your proposal. Please review the details below.</p>' +

        '<div style="background-color: #f8d7da; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #dc3545;">' +
        '<h3>❌ Payment Details</h3>' +
        '<p><strong>Transaction ID:</strong> {{transactionId}}</p>' +
        '<p><strong>Amount:</strong> {{amount}} {{currency}}</p>' +
        '<p><strong>Status:</strong> Failed</p>' +
        '{{#if errorMessage}}<p><strong>Error:</strong> {{errorMessage}}</p>{{/if}}' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>📋 Related Proposal</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '{{#if swapId}}<p><strong>Swap ID:</strong> {{swapId}}</p>{{/if}}' +
        '</div>' +

        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🔄 Next Steps</h3>' +
        '<ul>' +
        '<li>{{#if (eq role "payer")}}Please check your payment method and try again{{else}}The payer has been notified to resolve the payment issue{{/if}}</li>' +
        '<li>Your proposal status has been reverted to allow retry</li>' +
        '<li>Contact support if you need assistance</li>' +
        '</ul>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">{{#if (eq role "payer")}}Retry Payment{{else}}View Details{{/if}}</a>' +
        '</div>' +

        '<p>We apologize for the inconvenience. Our team is here to help resolve this quickly.</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'transactionId', 'amount', 'currency', 'role', 'proposalId', 'swapId', 'errorMessage', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_payment_failed',
      channel: 'sms',
      template: '⚠️ Payment failed: {{amount}} {{currency}} for proposal {{proposalId}}. {{#if errorMessage}}Error: {{errorMessage}}. {{/if}}{{#if (eq role "payer")}}Retry{{else}}Details{{/if}}: {{dashboardUrl}}',
      variables: ['amount', 'currency', 'proposalId', 'errorMessage', 'role', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'proposal_payment_failed',
      channel: 'in_app',
      template: '⚠️ Payment failed: {{amount}} {{currency}}{{#if errorMessage}} - {{errorMessage}}{{/if}}',
      variables: ['amount', 'currency', 'errorMessage']
    });
  }

  private addTemplate(template: NotificationTemplate): void {
    const key = `${template.type}_${template.channel}`;
    this.templates.set(key, template);
  }

  getTemplate(type: NotificationType, channel: NotificationChannel): NotificationTemplate | undefined {
    const key = `${type}_${channel}`;
    return this.templates.get(key);
  }

  renderTemplate(template: NotificationTemplate, data: NotificationData): { subject?: string; content: string } {
    let content = template.template;
    let subject = template.subject;

    // Simple template rendering (replace {{variable}} with data values)
    for (const variable of template.variables) {
      const value = data[variable];
      if (value !== undefined) {
        const regex = new RegExp(`{{${variable}}}`, 'g');
        content = content.replace(regex, String(value));
        if (subject) {
          subject = subject.replace(regex, String(value));
        }
      }
    }

    // Handle conditional blocks (simple implementation)
    content = this.handleConditionals(content, data);
    if (subject) {
      subject = this.handleConditionals(subject, data);
    }

    // Handle loops (simple implementation)
    content = this.handleLoops(content, data);

    return { subject, content };
  }

  private handleConditionals(template: string, data: NotificationData): string {
    // Handle {{#if variable}} ... {{/if}} blocks
    const ifRegex = /{{#if\s+(\w+)}}(.*?){{\/if}}/gs;
    return template.replace(ifRegex, (match, variable, content) => {
      return data[variable] ? content : '';
    });
  }

  private handleLoops(template: string, data: NotificationData): string {
    // Handle {{#each array}} ... {{/each}} blocks
    const eachRegex = /{{#each\s+(\w+)}}(.*?){{\/each}}/gs;
    return template.replace(eachRegex, (match, variable, content) => {
      const array = data[variable];
      if (Array.isArray(array)) {
        return array.map(item => content.replace(/{{this}}/g, String(item))).join('');
      }
      return '';
    });
  }
}