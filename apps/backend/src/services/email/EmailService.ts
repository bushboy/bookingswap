import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';
import { PasswordRecoveryMonitor } from '../monitoring/PasswordRecoveryMonitor';
import { EmailTemplateCache } from './EmailTemplateCache';
import { RedisService } from '../../database/cache/RedisService';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface PasswordResetEmailData {
    userEmail: string;
    userName: string;
    resetToken: string;
    resetUrl: string;
    expiresAt: Date;
}

export interface PasswordResetConfirmationEmailData {
    userEmail: string;
    userName: string;
    resetTime: Date;
}

export class EmailService {
    private transporter: nodemailer.Transporter;
    private fromEmail: string;
    private fromName: string;
    private monitor: PasswordRecoveryMonitor;
    private templateCache: EmailTemplateCache;

    constructor(redis?: RedisService) {
        this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@bookingswap.com';
        this.fromName = process.env.SMTP_FROM_NAME || 'Booking Swap Platform';
        this.monitor = PasswordRecoveryMonitor.getInstance();
        
        // Initialize template cache with Redis if available
        this.templateCache = new EmailTemplateCache({
            enableCaching: true,
            cacheTTL: 3600, // 1 hour
            enablePrecompilation: true,
            enableMinification: process.env.NODE_ENV === 'production',
        }, redis);

        // Configure transporter based on environment
        if (process.env.NODE_ENV === 'production') {
            // Production SMTP configuration
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        } else {
            // Development: Use Ethereal Email for testing
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.ETHEREAL_USER || 'ethereal.user@ethereal.email',
                    pass: process.env.ETHEREAL_PASS || 'ethereal.pass',
                },
            });
        }

        // Precompile templates for better performance
        this.initializeTemplates();
    }

    /**
     * Initialize and precompile email templates
     */
    private async initializeTemplates(): Promise<void> {
        try {
            await this.templateCache.precompileTemplates();
            logger.info('Email templates precompiled successfully');
        } catch (error) {
            logger.warn('Failed to precompile email templates', { error: error instanceof Error ? error.message : String(error) });
        }
    }

    /**
     * Send a generic email
     */
    async sendEmail(options: EmailOptions): Promise<void> {
        const startTime = Date.now();
        
        try {
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            };

            const info = await this.transporter.sendMail(mailOptions);
            const duration = Date.now() - startTime;

            if (process.env.NODE_ENV !== 'production') {
                logger.info('Email sent (development)', {
                    messageId: info.messageId,
                    previewUrl: nodemailer.getTestMessageUrl(info),
                    to: options.to,
                    subject: options.subject,
                    duration,
                });
            } else {
                logger.info('Email sent', {
                    messageId: info.messageId,
                    to: options.to,
                    subject: options.subject,
                    duration,
                });
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            logger.error('Failed to send email', {
                error: errorMessage,
                to: options.to,
                subject: options.subject,
                duration,
            });
            throw new Error('Failed to send email');
        }
    }

    /**
     * Send password reset email - optimized with template caching
     */
    async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
        const startTime = Date.now();

        try {
            // Use optimized template cache
            const template = await this.templateCache.getPasswordResetTemplate({
                userName: data.userName,
                resetUrl: data.resetUrl,
                expiresAt: data.expiresAt,
            });

            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: data.userEmail,
                subject: template.subject,
                html: template.html,
                text: template.text,
            };

            const info = await this.transporter.sendMail(mailOptions);
            const duration = Date.now() - startTime;

            // Log successful email delivery
            this.monitor.logEmailDelivery({
                type: 'reset_request',
                email: data.userEmail,
                messageId: info.messageId,
                success: true,
                duration,
                provider: this.getProviderName(),
            });

            if (process.env.NODE_ENV !== 'production') {
                logger.info('Password reset email sent (development)', {
                    messageId: info.messageId,
                    previewUrl: nodemailer.getTestMessageUrl(info),
                    to: data.userEmail,
                    duration,
                });
            } else {
                logger.info('Password reset email sent', {
                    messageId: info.messageId,
                    to: data.userEmail,
                    duration,
                });
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Log failed email delivery
            this.monitor.logEmailDelivery({
                type: 'reset_request',
                email: data.userEmail,
                success: false,
                error: errorMessage,
                duration,
                provider: this.getProviderName(),
            });

            logger.error('Failed to send password reset email', {
                error: errorMessage,
                to: data.userEmail,
                duration,
            });
            
            throw new Error('Failed to send password reset email');
        }
    }

    /**
     * Generate HTML template for password reset email
     */
    private generatePasswordResetHtml(data: PasswordResetEmailData): string {
        const expiresInMinutes = Math.floor((data.expiresAt.getTime() - Date.now()) / (1000 * 60));

        return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .button { 
                display: inline-block; 
                background: #2563eb; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin: 20px 0;
            }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .warning { background: #fef3cd; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Reset Your Password</h1>
            </div>
            
            <div class="content">
                <h2>Hello ${data.userName || 'there'}!</h2>
                
                <p>We received a request to reset your password for your Booking Swap Platform account.</p>
                
                <p>Click the button below to reset your password:</p>
                
                <div style="text-align: center;">
                    <a href="${data.resetUrl}" class="button">Reset Password</a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 3px;">
                    ${data.resetUrl}
                </p>
                
                <div class="warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>This link will expire in ${expiresInMinutes} minutes</li>
                        <li>If you didn't request this password reset, please ignore this email</li>
                        <li>For security, this link can only be used once</li>
                    </ul>
                </div>
                
                <p>If you're having trouble with the button above, copy and paste the URL into your web browser.</p>
            </div>
            
            <div class="footer">
                <p>This email was sent by Booking Swap Platform</p>
                <p>If you didn't request this password reset, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>`;
    }

    /**
     * Generate plain text version for password reset email
     */
    private generatePasswordResetText(data: PasswordResetEmailData): string {
        const expiresInMinutes = Math.floor((data.expiresAt.getTime() - Date.now()) / (1000 * 60));

        return `
Reset Your Password - Booking Swap Platform

Hello ${data.userName || 'there'}!

We received a request to reset your password for your Booking Swap Platform account.

To reset your password, please visit the following link:
${data.resetUrl}

IMPORTANT:
- This link will expire in ${expiresInMinutes} minutes
- If you didn't request this password reset, please ignore this email
- For security, this link can only be used once

If you're having trouble accessing the link, copy and paste it into your web browser.

If you didn't request this password reset, please contact our support team.

---
Booking Swap Platform
`;
    }

    /**
     * Send password reset confirmation email - optimized with template caching
     */
    async sendPasswordResetConfirmationEmail(data: PasswordResetConfirmationEmailData): Promise<void> {
        const startTime = Date.now();

        try {
            // Use optimized template cache
            const template = await this.templateCache.getPasswordResetConfirmationTemplate({
                userName: data.userName,
                resetTime: data.resetTime,
            });

            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: data.userEmail,
                subject: template.subject,
                html: template.html,
                text: template.text,
            };

            const info = await this.transporter.sendMail(mailOptions);
            const duration = Date.now() - startTime;

            // Log successful email delivery
            this.monitor.logEmailDelivery({
                type: 'reset_confirmation',
                email: data.userEmail,
                messageId: info.messageId,
                success: true,
                duration,
                provider: this.getProviderName(),
            });

            if (process.env.NODE_ENV !== 'production') {
                logger.info('Password reset confirmation email sent (development)', {
                    messageId: info.messageId,
                    previewUrl: nodemailer.getTestMessageUrl(info),
                    to: data.userEmail,
                    duration,
                });
            } else {
                logger.info('Password reset confirmation email sent', {
                    messageId: info.messageId,
                    to: data.userEmail,
                    duration,
                });
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Log failed email delivery
            this.monitor.logEmailDelivery({
                type: 'reset_confirmation',
                email: data.userEmail,
                success: false,
                error: errorMessage,
                duration,
                provider: this.getProviderName(),
            });

            logger.error('Failed to send password reset confirmation email', {
                error: errorMessage,
                to: data.userEmail,
                duration,
            });
            
            throw new Error('Failed to send password reset confirmation email');
        }
    }

    /**
     * Generate HTML template for password reset confirmation email
     */
    private generatePasswordResetConfirmationHtml(data: PasswordResetConfirmationEmailData): string {
        const resetTimeFormatted = data.resetTime.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        });

        return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
            .success { background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fef3cd; border: 1px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Password Reset Successful</h1>
            </div>
            
            <div class="content">
                <h2>Hello ${data.userName}!</h2>
                
                <div class="success">
                    <strong>Your password has been successfully reset.</strong>
                </div>
                
                <p>This email confirms that your password was changed on ${resetTimeFormatted}.</p>
                
                <div class="warning">
                    <strong>If you did not make this change:</strong>
                    <ul>
                        <li>Your account may have been compromised</li>
                        <li>Please contact our support team immediately</li>
                        <li>Consider enabling two-factor authentication for additional security</li>
                    </ul>
                </div>
                
                <p>For your security, all existing sessions have been invalidated. You will need to log in again with your new password.</p>
                
                <p>If you have any questions or concerns, please don't hesitate to contact our support team.</p>
            </div>
            
            <div class="footer">
                <p>This email was sent by Booking Swap Platform</p>
                <p>If you need assistance, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>`;
    }

    /**
     * Generate plain text version for password reset confirmation email
     */
    private generatePasswordResetConfirmationText(data: PasswordResetConfirmationEmailData): string {
        const resetTimeFormatted = data.resetTime.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        });

        return `
Password Reset Successful - Booking Swap Platform

Hello ${data.userName}!

Your password has been successfully reset.

This email confirms that your password was changed on ${resetTimeFormatted}.

IMPORTANT - If you did not make this change:
- Your account may have been compromised
- Please contact our support team immediately
- Consider enabling two-factor authentication for additional security

For your security, all existing sessions have been invalidated. You will need to log in again with your new password.

If you have any questions or concerns, please don't hesitate to contact our support team.

---
Booking Swap Platform
`;
    }

    /**
     * Verify email service configuration
     */
    async verifyConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            logger.info('Email service connection verified');
            return true;
        } catch (error) {
            logger.error('Email service connection failed', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }

    /**
     * Get email provider name for monitoring
     */
    private getProviderName(): string {
        if (process.env.NODE_ENV === 'production') {
            return process.env.SMTP_HOST || 'smtp';
        }
        return 'ethereal';
    }

    /**
     * Get template cache statistics
     */
    getTemplateCacheStats(): any {
        return this.templateCache.getCacheStats();
    }

    /**
     * Clear template cache
     */
    async clearTemplateCache(): Promise<void> {
        await this.templateCache.clearCache();
    }

    /**
     * Precompile templates manually (for warming up cache)
     */
    async precompileTemplates(): Promise<void> {
        await this.templateCache.precompileTemplates();
    }
}