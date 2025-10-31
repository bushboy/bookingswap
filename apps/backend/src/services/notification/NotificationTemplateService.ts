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

    // Swap Completion Notification Templates - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5

    // Swap Completion Success Templates
    this.addTemplate({
      type: 'swap_completion_success',
      channel: 'email',
      subject: '🎉 Swap Completed Successfully - {{#if isBookingExchange}}Booking Exchange{{else}}Cash Payment{{/if}}',
      template: '<h2>🎉 Congratulations! Your Swap Has Been Completed Successfully!</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>{{#if (eq role "proposer")}}Your {{#if isBookingExchange}}booking exchange{{else}}cash offer{{/if}} proposal has been accepted and completed!{{else}}You have successfully completed a {{#if isBookingExchange}}booking exchange{{else}}cash payment{{/if}}!{{/if}}</p>' +

        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">' +
        '<h3>✅ Completion Summary</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '<p><strong>Completion Type:</strong> {{#if isBookingExchange}}Booking Exchange{{else}}Cash Payment{{/if}}</p>' +
        '<p><strong>Completed At:</strong> {{completionTimestamp}}</p>' +
        '<p><strong>Swaps Completed:</strong> {{totalSwapsCompleted}}</p>' +
        '<p><strong>Bookings Updated:</strong> {{totalBookingsUpdated}}</p>' +
        '{{#if ownershipTransfersCount}}<p><strong>Ownership Transfers:</strong> {{ownershipTransfersCount}}</p>{{/if}}' +
        '{{#if hasBlockchainRecord}}<p><strong>Blockchain Record:</strong> ✅ Created</p>{{/if}}' +
        '</div>' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🏨 {{#if (eq role "proposer")}}Your Offer{{else}}Source Booking{{/if}}</h3>' +
        '<ul style="list-style: none; padding: 0;">' +
        '<li><strong>📍 Location:</strong> {{sourceSwapDetails.location}}</li>' +
        '<li><strong>📅 Dates:</strong> {{sourceSwapDetails.dates}}</li>' +
        '<li><strong>🏠 Type:</strong> {{sourceSwapDetails.accommodationType}}</li>' +
        '<li><strong>👥 Guests:</strong> {{sourceSwapDetails.guests}}</li>' +
        '<li><strong>💰 Value:</strong> ${{sourceSwapDetails.value}}</li>' +
        '</ul>' +
        '</div>' +

        '{{#if targetSwapDetails}}' +
        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🎯 {{#if (eq role "proposer")}}Their Booking{{else}}Target Booking{{/if}}</h3>' +
        '<ul style="list-style: none; padding: 0;">' +
        '<li><strong>📍 Location:</strong> {{targetSwapDetails.location}}</li>' +
        '<li><strong>📅 Dates:</strong> {{targetSwapDetails.dates}}</li>' +
        '<li><strong>🏠 Type:</strong> {{targetSwapDetails.accommodationType}}</li>' +
        '<li><strong>👥 Guests:</strong> {{targetSwapDetails.guests}}</li>' +
        '<li><strong>💰 Value:</strong> ${{targetSwapDetails.value}}</li>' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '{{#if cashOffer}}' +
        '<div style="background-color: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>💰 Cash Payment Details</h3>' +
        '<p><strong>Amount:</strong> {{cashOffer.amount}} {{cashOffer.currency}}</p>' +
        '<p><strong>Status:</strong> {{#if (eq role "proposer")}}Payment Sent{{else}}Payment Received{{/if}}</p>' +
        '</div>' +
        '{{/if}}' +

        '{{#if blockchainTransaction}}' +
        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🔗 Blockchain Record</h3>' +
        '<p><strong>Transaction ID:</strong> {{blockchainTransaction.transactionId}}</p>' +
        '{{#if blockchainTransaction.consensusTimestamp}}<p><strong>Consensus Time:</strong> {{blockchainTransaction.consensusTimestamp}}</p>{{/if}}' +
        '<p>Your swap completion has been permanently recorded on the blockchain for security and transparency.</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ What Happens Next</h3>' +
        '<ul>' +
        '{{#if isBookingExchange}}' +
        '<li>Both bookings have been updated with new ownership information</li>' +
        '<li>You will receive separate notifications about ownership transfers</li>' +
        '<li>Contact details will be shared for coordination</li>' +
        '{{else}}' +
        '<li>Your booking status has been updated to "swapped"</li>' +
        '<li>Payment processing is complete</li>' +
        '{{/if}}' +
        '<li>You can view all details in your dashboard</li>' +
        '<li>Rate your swap experience (optional)</li>' +
        '</ul>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Complete Details</a>' +
        '</div>' +

        '<p>{{#if (eq role "proposer")}}Thank you for using our platform! We hope you enjoy your new booking arrangement.{{else}}Congratulations on completing your swap! We hope you enjoy your new arrangement.{{/if}}</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'proposalId', 'completionType', 'isBookingExchange', 'isCashPayment', 'completionTimestamp', 'totalSwapsCompleted', 'totalBookingsUpdated', 'ownershipTransfersCount', 'hasBlockchainRecord', 'role', 'sourceSwapDetails', 'targetSwapDetails', 'cashOffer', 'blockchainTransaction', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_completion_success',
      channel: 'sms',
      template: '🎉 Swap completed! {{#if isBookingExchange}}Booking exchange{{else}}Cash payment{{/if}} successful. {{totalSwapsCompleted}} swap(s), {{totalBookingsUpdated}} booking(s) updated. {{#if cashOffer}}{{cashOffer.amount}} {{cashOffer.currency}} {{#if (eq role "proposer")}}sent{{else}}received{{/if}}. {{/if}}Details: {{dashboardUrl}}',
      variables: ['isBookingExchange', 'totalSwapsCompleted', 'totalBookingsUpdated', 'cashOffer', 'role', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_completion_success',
      channel: 'in_app',
      template: '🎉 {{#if isBookingExchange}}Booking exchange{{else}}Cash payment{{/if}} completed! {{totalSwapsCompleted}} swap(s), {{totalBookingsUpdated}} booking(s) updated{{#if cashOffer}} ({{cashOffer.amount}} {{cashOffer.currency}}){{/if}}',
      variables: ['isBookingExchange', 'totalSwapsCompleted', 'totalBookingsUpdated', 'cashOffer']
    });

    // Booking Ownership Transferred Templates
    this.addTemplate({
      type: 'booking_ownership_transferred',
      channel: 'email',
      subject: '🔄 Booking Ownership {{#if (eq role "new_owner")}}Transferred to You{{else}}Transferred{{/if}} - {{bookingDetails.title}}',
      template: '<h2>🔄 Booking Ownership Transfer {{#if (eq role "new_owner")}}Complete - You Are Now the Owner!{{else}}Complete{{/if}}</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>{{#if (eq role "new_owner")}}Great news! Ownership of a booking has been transferred to you as part of your successful booking exchange.{{else}}The ownership of your booking has been successfully transferred as part of your booking exchange.{{/if}}</p>' +

        '<div style="background-color: {{#if (eq role "new_owner")}}#d4edda{{else}}#e3f2fd{{/if}}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid {{#if (eq role "new_owner")}}#28a745{{else}}#2196f3{{/if}};">' +
        '<h3>🏨 {{#if (eq role "new_owner")}}Your New{{/if}} Booking Details</h3>' +
        '<ul style="list-style: none; padding: 0;">' +
        '<li><strong>📋 Title:</strong> {{bookingDetails.title}}</li>' +
        '<li><strong>📍 Location:</strong> {{bookingDetails.location}}</li>' +
        '<li><strong>📅 Dates:</strong> {{bookingDetails.dates}}</li>' +
        '<li><strong>🏠 Type:</strong> {{bookingDetails.accommodationType}}</li>' +
        '<li><strong>👥 Guests:</strong> {{bookingDetails.guests}}</li>' +
        '<li><strong>💰 Value:</strong> ${{bookingDetails.value}}</li>' +
        '</ul>' +
        '</div>' +

        '<div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🤝 Exchange Partner</h3>' +
        '<p><strong>Name:</strong> {{exchangePartnerDetails.name}}</p>' +
        '<p><strong>Their Booking:</strong> {{exchangePartnerDetails.bookingTitle}}</p>' +
        '<p><strong>Location:</strong> {{exchangePartnerDetails.bookingLocation}}</p>' +
        '<p><strong>Dates:</strong> {{exchangePartnerDetails.bookingDates}}</p>' +
        '</div>' +

        '<div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>📋 Transfer Details</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '<p><strong>Transfer Date:</strong> {{transferredAt}}</p>' +
        '<p><strong>{{#if (eq role "new_owner")}}Previous Owner{{else}}New Owner{{/if}}:</strong> {{#if (eq role "new_owner")}}{{previousOwnerId}}{{else}}{{newOwnerId}}{{/if}}</p>' +
        '</div>' +

        '{{#if (eq role "new_owner")}}' +
        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ What You Need to Do</h3>' +
        '<ul>' +
        '<li>Review your new booking details in your dashboard</li>' +
        '<li>Contact the accommodation provider if needed</li>' +
        '<li>Coordinate with {{exchangePartnerDetails.name}} for any handover details</li>' +
        '<li>Update your travel plans accordingly</li>' +
        '<li>Ensure you have all necessary booking confirmations</li>' +
        '</ul>' +
        '</div>' +
        '{{else}}' +
        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>✅ Transfer Complete</h3>' +
        '<ul>' +
        '<li>{{exchangePartnerDetails.name}} is now the owner of this booking</li>' +
        '<li>You have received ownership of their booking in return</li>' +
        '<li>All booking confirmations have been updated</li>' +
        '<li>You can coordinate any handover details if needed</li>' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: {{#if (eq role "new_owner")}}#28a745{{else}}#007bff{{/if}}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">{{#if (eq role "new_owner")}}View Your New Booking{{else}}View Dashboard{{/if}}</a>' +
        '</div>' +

        '<p>{{#if (eq role "new_owner")}}Congratulations on your new booking! Enjoy your upcoming trip.{{else}}Thank you for completing the exchange. We hope you enjoy your new booking arrangement.{{/if}}</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'role', 'bookingDetails', 'exchangePartnerDetails', 'proposalId', 'transferredAt', 'previousOwnerId', 'newOwnerId', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'booking_ownership_transferred',
      channel: 'sms',
      template: '🔄 Booking ownership {{#if (eq role "new_owner")}}transferred to you{{else}}transferred{{/if}}: {{bookingDetails.title}} ({{bookingDetails.location}}) {{#if (eq role "new_owner")}}from{{else}}to{{/if}} {{exchangePartnerDetails.name}}. View: {{dashboardUrl}}',
      variables: ['role', 'bookingDetails', 'exchangePartnerDetails', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'booking_ownership_transferred',
      channel: 'in_app',
      template: '🔄 {{#if (eq role "new_owner")}}You now own{{else}}Ownership transferred:{{/if}} {{bookingDetails.title}} {{#if (eq role "new_owner")}}(from {{exchangePartnerDetails.name}}){{else}}(to {{exchangePartnerDetails.name}}){{/if}}',
      variables: ['role', 'bookingDetails', 'exchangePartnerDetails']
    });

    // Completion Validation Warning Templates
    this.addTemplate({
      type: 'completion_validation_warning',
      channel: 'email',
      subject: '⚠️ {{#if requiresManualReview}}Completion Validation Issues{{else}}Minor Completion Warnings{{/if}} - Proposal {{proposalId}}',
      template: '<h2>⚠️ {{#if requiresManualReview}}Completion Validation Issues Detected{{else}}Minor Completion Validation Warnings{{/if}}</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>{{#if requiresManualReview}}We detected some validation issues with your swap completion that require attention.{{else}}Your swap completion was successful, but we detected some minor validation warnings.{{/if}}</p>' +

        '<div style="background-color: {{#if requiresManualReview}}#f8d7da{{else}}#fff3cd{{/if}}; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid {{#if requiresManualReview}}#dc3545{{else}}#ffc107{{/if}};">' +
        '<h3>{{#if requiresManualReview}}🚨 Issues Detected{{else}}⚠️ Warnings Detected{{/if}}</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '<p><strong>Validation Errors:</strong> {{errorCount}}</p>' +
        '<p><strong>Validation Warnings:</strong> {{warningCount}}</p>' +
        '<p><strong>Inconsistent Entities:</strong> {{inconsistentEntityCount}}</p>' +
        '{{#if requiresManualReview}}<p><strong>Status:</strong> Requires Manual Review</p>{{else}}<p><strong>Status:</strong> Completed with Warnings</p>{{/if}}' +
        '</div>' +

        '{{#if validationErrors}}' +
        '<div style="background-color: #f8d7da; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>❌ Validation Errors</h3>' +
        '<ul>' +
        '{{#each validationErrors}}<li>{{this}}</li>{{/each}}' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '{{#if validationWarnings}}' +
        '<div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⚠️ Validation Warnings</h3>' +
        '<ul>' +
        '{{#each validationWarnings}}<li>{{this}}</li>{{/each}}' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '{{#if correctionAttempts}}' +
        '<div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🔧 Automatic Correction Attempts</h3>' +
        '<p><strong>Total Attempts:</strong> {{correctionAttemptCount}}</p>' +
        '<p><strong>Successful Corrections:</strong> {{successfulCorrections}}</p>' +
        '<ul>' +
        '{{#each correctionAttempts}}' +
        '<li>{{entityType}} {{entityId}}: {{#if correctionApplied}}✅ Fixed{{else}}❌ Failed{{#if correctionError}} - {{correctionError}}{{/if}}{{/if}}</li>' +
        '{{/each}}' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '{{#if requiresManualReview}}' +
        '<div style="background-color: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🛠️ Next Steps Required</h3>' +
        '<ul>' +
        '<li>Our support team has been notified of these issues</li>' +
        '<li>We will review and resolve the validation problems</li>' +
        '<li>You will be contacted if any action is needed from your side</li>' +
        '<li>Your swap completion status will be updated once resolved</li>' +
        '</ul>' +
        '</div>' +
        '{{else}}' +
        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>✅ Completion Status</h3>' +
        '<p>Despite the warnings, your swap completion was successful. The warnings are minor and do not affect the validity of your swap.</p>' +
        '</div>' +
        '{{/if}}' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: {{#if requiresManualReview}}#dc3545{{else}}#ffc107{{/if}}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Details</a>' +
        '{{#if requiresManualReview}}' +
        '<a href="/support" style="background-color: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-left: 10px;">Contact Support</a>' +
        '{{/if}}' +
        '</div>' +

        '<p>{{#if requiresManualReview}}We apologize for any inconvenience and will resolve these issues promptly.{{else}}Thank you for your patience. Your swap is complete and valid.{{/if}}</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'proposalId', 'requiresManualReview', 'errorCount', 'warningCount', 'inconsistentEntityCount', 'validationErrors', 'validationWarnings', 'correctionAttempts', 'correctionAttemptCount', 'successfulCorrections', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'completion_validation_warning',
      channel: 'sms',
      template: '⚠️ {{#if requiresManualReview}}Completion issues detected{{else}}Minor completion warnings{{/if}} for proposal {{proposalId}}. {{errorCount}} error(s), {{warningCount}} warning(s). {{#if requiresManualReview}}Support will contact you.{{else}}Swap completed successfully.{{/if}} Details: {{dashboardUrl}}',
      variables: ['requiresManualReview', 'proposalId', 'errorCount', 'warningCount', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'completion_validation_warning',
      channel: 'in_app',
      template: '⚠️ {{#if requiresManualReview}}Completion validation issues{{else}}Minor completion warnings{{/if}}: {{errorCount}} error(s), {{warningCount}} warning(s){{#if requiresManualReview}} - manual review required{{/if}}',
      variables: ['requiresManualReview', 'errorCount', 'warningCount']
    });

    // Swap Completion Failed Templates
    this.addTemplate({
      type: 'swap_completion_failed',
      channel: 'email',
      subject: '❌ Swap Completion Failed - Proposal {{proposalId}}',
      template: '<h2>❌ Swap Completion Failed</h2>' +
        '<p>Hello {{recipientName}},</p>' +
        '<p>We encountered an issue while processing your swap completion. {{#if rollbackSuccessful}}All changes have been safely rolled back.{{else}}Some changes may require manual intervention.{{/if}}</p>' +

        '<div style="background-color: #f8d7da; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #dc3545;">' +
        '<h3>❌ Failure Details</h3>' +
        '<p><strong>Proposal ID:</strong> {{proposalId}}</p>' +
        '<p><strong>Error Message:</strong> {{errorMessage}}</p>' +
        '{{#if errorCode}}<p><strong>Error Code:</strong> {{errorCode}}</p>{{/if}}' +
        '<p><strong>Rollback Status:</strong> {{#if rollbackSuccessful}}✅ Successful{{else}}❌ Failed{{/if}}</p>' +
        '{{#if affectedEntities}}<p><strong>Affected Entities:</strong> {{affectedEntityCount}}</p>{{/if}}' +
        '</div>' +

        '{{#if affectedEntities}}' +
        '<div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>📋 Affected Components</h3>' +
        '<ul>' +
        '{{#each affectedEntities}}<li>{{this}}</li>{{/each}}' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '{{#if rollbackSuccessful}}' +
        '<div style="background-color: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>✅ System Recovery</h3>' +
        '<p>All changes have been successfully rolled back. Your bookings and swaps are in their original state before the completion attempt.</p>' +
        '<ul>' +
        '<li>No data has been lost or corrupted</li>' +
        '<li>Your proposal remains in its previous state</li>' +
        '<li>You can retry the completion process</li>' +
        '<li>All related entities have been restored</li>' +
        '</ul>' +
        '</div>' +
        '{{else}}' +
        '<div style="background-color: #f8d7da; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>🚨 Manual Intervention Required</h3>' +
        '<p>The rollback process was unsuccessful. Our support team has been automatically notified and will resolve this issue promptly.</p>' +
        '<ul>' +
        '<li>Do not attempt to retry the completion</li>' +
        '<li>Our team will contact you within 24 hours</li>' +
        '<li>Your data integrity is our top priority</li>' +
        '<li>We will provide updates on the resolution progress</li>' +
        '</ul>' +
        '</div>' +
        '{{/if}}' +

        '<div style="background-color: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">' +
        '<h3>⏰ What Happens Next</h3>' +
        '<ul>' +
        '{{#if rollbackSuccessful}}' +
        '<li>You can review the error details and try again</li>' +
        '<li>Check if any information needs to be updated</li>' +
        '<li>Contact support if the issue persists</li>' +
        '{{else}}' +
        '<li>Our support team will investigate the issue</li>' +
        '<li>We will contact you with updates and next steps</li>' +
        '<li>Do not make any changes to related bookings</li>' +
        '{{/if}}' +
        '<li>Monitor your dashboard for status updates</li>' +
        '</ul>' +
        '</div>' +

        '<div style="text-align: center; margin: 30px 0;">' +
        '<a href="{{dashboardUrl}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Dashboard</a>' +
        '{{#if rollbackSuccessful}}' +
        '<a href="{{dashboardUrl}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-left: 10px;">Retry Completion</a>' +
        '{{/if}}' +
        '{{#if requiresManualIntervention}}' +
        '<a href="/support" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-left: 10px;">Contact Support</a>' +
        '{{/if}}' +
        '</div>' +

        '<p>{{#if rollbackSuccessful}}We apologize for the inconvenience. Please try again or contact support if you continue to experience issues.{{else}}We sincerely apologize for this issue and are working to resolve it as quickly as possible.{{/if}}</p>' +
        '<p>Best regards,<br>The Booking Swap Team</p>',
      variables: ['recipientName', 'proposalId', 'errorMessage', 'errorCode', 'rollbackSuccessful', 'requiresManualIntervention', 'affectedEntities', 'affectedEntityCount', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_completion_failed',
      channel: 'sms',
      template: '❌ Swap completion failed for proposal {{proposalId}}. {{#if rollbackSuccessful}}Changes rolled back successfully. You can retry.{{else}}Manual intervention required. Support will contact you.{{/if}} Error: {{errorMessage}}. Dashboard: {{dashboardUrl}}',
      variables: ['proposalId', 'rollbackSuccessful', 'errorMessage', 'dashboardUrl']
    });

    this.addTemplate({
      type: 'swap_completion_failed',
      channel: 'in_app',
      template: '❌ Completion failed: {{errorMessage}}{{#if rollbackSuccessful}} - changes rolled back, you can retry{{else}} - support will contact you{{/if}}',
      variables: ['errorMessage', 'rollbackSuccessful']
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