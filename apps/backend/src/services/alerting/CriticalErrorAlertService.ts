export interface CriticalAlert {
    type: 'ROLLBACK_FAILURE' | 'DATA_CORRUPTION' | 'SYSTEM_FAILURE' | 'SECURITY_BREACH';
    title: string;
    message: string;
    details: Record<string, any>;
    severity: 'high' | 'critical';
    requiresImmedateAction: boolean;
    timestamp: string;
    alertId?: string;
}

export interface AlertChannel {
    name: string;
    type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
    config: Record<string, any>;
    enabled: boolean;
}

export interface AlertDeliveryResult {
    channel: string;
    success: boolean;
    error?: string;
    deliveredAt?: string;
}

export interface RollbackFailureAlert extends CriticalAlert {
    type: 'ROLLBACK_FAILURE';
    details: {
        transactionId: string;
        swapId: string;
        proposalId?: string | null;
        failedStep: string;
        completedSteps: number;
        errorMessage: string;
        userId?: string;
        scenario?: string;
    };
}

/**
 * Critical Error Alert Service
 * 
 * Handles sending critical alerts to administrators for issues that require
 * immediate attention, particularly rollback failures and data integrity issues.
 */
export class CriticalErrorAlertService {
    private logger: any;
    private channels: AlertChannel[];
    private alertHistory: Map<string, CriticalAlert> = new Map();

    constructor(logger: any, channels: AlertChannel[] = []) {
        this.logger = logger;
        this.channels = channels;
    }

    /**
     * Send critical alert for rollback failures
     */
    async sendRollbackFailureAlert(
        transactionId: string,
        swapId: string,
        proposalId: string | null,
        failedStep: string,
        completedSteps: any[],
        error: Error,
        additionalContext?: Record<string, any>
    ): Promise<AlertDeliveryResult[]> {
        const alert: RollbackFailureAlert = {
            type: 'ROLLBACK_FAILURE',
            title: 'Critical: Swap Offer Rollback Failed',
            message: `Rollback failed for swap offer submission. Manual intervention required immediately.`,
            details: {
                transactionId,
                swapId,
                proposalId,
                failedStep,
                completedSteps: completedSteps.length,
                errorMessage: error.message,
                ...additionalContext
            },
            severity: 'critical',
            requiresImmedateAction: true,
            timestamp: new Date().toISOString(),
            alertId: this.generateAlertId('ROLLBACK_FAILURE', transactionId)
        };

        return this.sendCriticalAlert(alert);
    }

    /**
     * Send generic critical alert
     */
    async sendCriticalAlert(alert: CriticalAlert): Promise<AlertDeliveryResult[]> {
        // Generate alert ID if not provided
        if (!alert.alertId) {
            alert.alertId = this.generateAlertId(alert.type, alert.timestamp);
        }

        // Store in alert history
        this.alertHistory.set(alert.alertId, alert);

        // Log the critical alert
        this.logger.critical('Sending critical alert', {
            alertId: alert.alertId,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            details: alert.details,
            timestamp: alert.timestamp
        });

        // Send to all enabled channels
        const deliveryResults: AlertDeliveryResult[] = [];
        const enabledChannels = this.channels.filter(channel => channel.enabled);

        if (enabledChannels.length === 0) {
            this.logger.warn('No alert channels configured - critical alert not delivered', {
                alertId: alert.alertId,
                type: alert.type
            });
            return [];
        }

        for (const channel of enabledChannels) {
            try {
                const result = await this.sendToChannel(alert, channel);
                deliveryResults.push(result);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const failureResult: AlertDeliveryResult = {
                    channel: channel.name,
                    success: false,
                    error: errorMessage
                };
                deliveryResults.push(failureResult);

                this.logger.error('Failed to send critical alert to channel', {
                    alertId: alert.alertId,
                    channel: channel.name,
                    error: errorMessage
                });
            }
        }

        // Log delivery summary
        const successfulDeliveries = deliveryResults.filter(r => r.success).length;
        const failedDeliveries = deliveryResults.filter(r => !r.success).length;

        this.logger.info('Critical alert delivery completed', {
            alertId: alert.alertId,
            totalChannels: enabledChannels.length,
            successful: successfulDeliveries,
            failed: failedDeliveries,
            deliveryResults
        });

        return deliveryResults;
    }

    /**
     * Send alert to specific channel
     */
    private async sendToChannel(alert: CriticalAlert, channel: AlertChannel): Promise<AlertDeliveryResult> {
        const startTime = Date.now();

        try {
            switch (channel.type) {
                case 'email':
                    await this.sendEmailAlert(alert, channel);
                    break;
                case 'slack':
                    await this.sendSlackAlert(alert, channel);
                    break;
                case 'webhook':
                    await this.sendWebhookAlert(alert, channel);
                    break;
                case 'sms':
                    await this.sendSMSAlert(alert, channel);
                    break;
                case 'pagerduty':
                    await this.sendPagerDutyAlert(alert, channel);
                    break;
                default:
                    throw new Error(`Unsupported alert channel type: ${channel.type}`);
            }

            return {
                channel: channel.name,
                success: true,
                deliveredAt: new Date().toISOString()
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to send to ${channel.name}: ${errorMessage}`);
        }
    }

    /**
     * Send email alert
     */
    private async sendEmailAlert(alert: CriticalAlert, channel: AlertChannel): Promise<void> {
        // Mock implementation - replace with actual email service
        this.logger.info('Sending email alert', {
            alertId: alert.alertId,
            channel: channel.name,
            recipients: channel.config.recipients,
            subject: alert.title
        });

        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Send Slack alert
     */
    private async sendSlackAlert(alert: CriticalAlert, channel: AlertChannel): Promise<void> {
        const slackMessage = this.formatSlackMessage(alert);

        this.logger.info('Sending Slack alert', {
            alertId: alert.alertId,
            channel: channel.name,
            webhook: channel.config.webhookUrl ? 'configured' : 'missing',
            messageLength: slackMessage.length
        });

        // Mock implementation - replace with actual Slack API call
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Send webhook alert
     */
    private async sendWebhookAlert(alert: CriticalAlert, channel: AlertChannel): Promise<void> {
        this.logger.info('Sending webhook alert', {
            alertId: alert.alertId,
            channel: channel.name,
            url: channel.config.url,
            method: channel.config.method || 'POST'
        });

        // Mock implementation - replace with actual HTTP request
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Send SMS alert
     */
    private async sendSMSAlert(alert: CriticalAlert, channel: AlertChannel): Promise<void> {
        const smsMessage = this.formatSMSMessage(alert);

        this.logger.info('Sending SMS alert', {
            alertId: alert.alertId,
            channel: channel.name,
            recipients: channel.config.phoneNumbers?.length || 0,
            messageLength: smsMessage.length
        });

        // Mock implementation - replace with actual SMS service
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Send PagerDuty alert
     */
    private async sendPagerDutyAlert(alert: CriticalAlert, channel: AlertChannel): Promise<void> {
        this.logger.info('Sending PagerDuty alert', {
            alertId: alert.alertId,
            channel: channel.name,
            integrationKey: channel.config.integrationKey ? 'configured' : 'missing',
            severity: alert.severity
        });

        // Mock implementation - replace with actual PagerDuty API call
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Format alert for Slack
     */
    private formatSlackMessage(alert: CriticalAlert): string {
        const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
        let message = `${emoji} *${alert.title}*\n\n${alert.message}\n\n`;

        if (alert.type === 'ROLLBACK_FAILURE') {
            const details = alert.details as RollbackFailureAlert['details'];
            message += `*Transaction ID:* ${details.transactionId}\n`;
            message += `*Swap ID:* ${details.swapId}\n`;
            if (details.proposalId) {
                message += `*Proposal ID:* ${details.proposalId}\n`;
            }
            message += `*Failed Step:* ${details.failedStep}\n`;
            message += `*Completed Steps:* ${details.completedSteps}\n`;
            message += `*Error:* ${details.errorMessage}\n`;
        }

        message += `\n*Alert ID:* ${alert.alertId}`;
        message += `\n*Timestamp:* ${alert.timestamp}`;

        if (alert.requiresImmedateAction) {
            message += `\n\n⚡ *IMMEDIATE ACTION REQUIRED*`;
        }

        return message;
    }

    /**
     * Format alert for SMS
     */
    private formatSMSMessage(alert: CriticalAlert): string {
        let message = `CRITICAL: ${alert.title}\n`;

        if (alert.type === 'ROLLBACK_FAILURE') {
            const details = alert.details as RollbackFailureAlert['details'];
            message += `Transaction: ${details.transactionId}\n`;
            message += `Swap: ${details.swapId}\n`;
            message += `Failed: ${details.failedStep}\n`;
        }

        message += `Alert: ${alert.alertId}`;

        // Keep SMS under 160 characters if possible
        if (message.length > 160) {
            message = message.substring(0, 157) + '...';
        }

        return message;
    }

    /**
     * Generate unique alert ID
     */
    private generateAlertId(type: string, identifier: string): string {
        const timestamp = Date.now();
        const hash = this.simpleHash(`${type}-${identifier}-${timestamp}`);
        return `${type.toLowerCase()}-${hash}`;
    }

    /**
     * Simple hash function for alert IDs
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit: number = 50): CriticalAlert[] {
        const alerts = Array.from(this.alertHistory.values());
        return alerts
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    /**
     * Get alert by ID
     */
    getAlert(alertId: string): CriticalAlert | undefined {
        return this.alertHistory.get(alertId);
    }

    /**
     * Add alert channel
     */
    addChannel(channel: AlertChannel): void {
        this.channels.push(channel);
        this.logger.info('Alert channel added', {
            name: channel.name,
            type: channel.type,
            enabled: channel.enabled
        });
    }

    /**
     * Remove alert channel
     */
    removeChannel(channelName: string): boolean {
        const index = this.channels.findIndex(c => c.name === channelName);
        if (index >= 0) {
            this.channels.splice(index, 1);
            this.logger.info('Alert channel removed', { name: channelName });
            return true;
        }
        return false;
    }

    /**
     * Enable/disable alert channel
     */
    setChannelEnabled(channelName: string, enabled: boolean): boolean {
        const channel = this.channels.find(c => c.name === channelName);
        if (channel) {
            channel.enabled = enabled;
            this.logger.info('Alert channel status changed', {
                name: channelName,
                enabled
            });
            return true;
        }
        return false;
    }
}