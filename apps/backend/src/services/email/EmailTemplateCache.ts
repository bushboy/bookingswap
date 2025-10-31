import { logger } from '../../utils/logger';
import { RedisService } from '../../database/cache/RedisService';

export interface EmailTemplate {
  html: string;
  text: string;
  subject: string;
  lastModified: Date;
}

export interface TemplateVariables {
  [key: string]: string | number | Date;
}

export interface EmailTemplateConfig {
  enableCaching: boolean;
  cacheTTL: number; // seconds
  enablePrecompilation: boolean;
  enableMinification: boolean;
}

export class EmailTemplateCache {
  private redis: RedisService | null = null;
  private memoryCache: Map<string, EmailTemplate> = new Map();
  private compiledTemplates: Map<string, Function> = new Map();
  private config: EmailTemplateConfig;

  constructor(config: EmailTemplateConfig, redis?: RedisService) {
    this.config = {
      enableCaching: true,
      cacheTTL: 3600, // 1 hour default
      enablePrecompilation: true,
      enableMinification: true,
      ...config,
    };
    this.redis = redis || null;
  }

  /**
   * Get optimized password reset email template
   */
  async getPasswordResetTemplate(variables: {
    userName: string;
    resetUrl: string;
    expiresAt: Date;
  }): Promise<EmailTemplate> {
    const templateKey = 'password_reset';
    const cacheKey = `email_template:${templateKey}`;

    try {
      // Try cache first if enabled
      if (this.config.enableCaching) {
        const cached = await this.getCachedTemplate(cacheKey);
        if (cached) {
          return this.renderTemplate(cached, variables);
        }
      }

      // Generate template
      const template = await this.generatePasswordResetTemplate();
      
      // Cache the template
      if (this.config.enableCaching) {
        await this.setCachedTemplate(cacheKey, template);
      }

      return this.renderTemplate(template, variables);
    } catch (error) {
      logger.error('Failed to get password reset template', { error });
      // Return fallback template
      return this.getFallbackPasswordResetTemplate(variables);
    }
  }

  /**
   * Get optimized password reset confirmation template
   */
  async getPasswordResetConfirmationTemplate(variables: {
    userName: string;
    resetTime: Date;
  }): Promise<EmailTemplate> {
    const templateKey = 'password_reset_confirmation';
    const cacheKey = `email_template:${templateKey}`;

    try {
      if (this.config.enableCaching) {
        const cached = await this.getCachedTemplate(cacheKey);
        if (cached) {
          return this.renderTemplate(cached, variables);
        }
      }

      const template = await this.generatePasswordResetConfirmationTemplate();
      
      if (this.config.enableCaching) {
        await this.setCachedTemplate(cacheKey, template);
      }

      return this.renderTemplate(template, variables);
    } catch (error) {
      logger.error('Failed to get password reset confirmation template', { error });
      return this.getFallbackPasswordResetConfirmationTemplate(variables);
    }
  }

  /**
   * Precompile and cache frequently used templates
   */
  async precompileTemplates(): Promise<void> {
    const templates = [
      'password_reset',
      'password_reset_confirmation',
    ];

    const precompilePromises = templates.map(async (templateKey) => {
      try {
        const cacheKey = `email_template:${templateKey}`;
        let template: EmailTemplate;

        switch (templateKey) {
          case 'password_reset':
            template = await this.generatePasswordResetTemplate();
            break;
          case 'password_reset_confirmation':
            template = await this.generatePasswordResetConfirmationTemplate();
            break;
          default:
            return;
        }

        // Cache the template
        await this.setCachedTemplate(cacheKey, template);

        // Precompile if enabled
        if (this.config.enablePrecompilation) {
          this.precompileTemplate(templateKey, template);
        }

        logger.info('Template precompiled and cached', { templateKey });
      } catch (error) {
        logger.error('Failed to precompile template', { error, templateKey });
      }
    });

    await Promise.allSettled(precompilePromises);
    logger.info('Template precompilation completed');
  }

  /**
   * Generate optimized password reset template
   */
  private async generatePasswordResetTemplate(): Promise<EmailTemplate> {
    const html = this.minifyHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
          .container{max-width:600px;margin:0 auto;padding:20px}
          .header{background:#2563eb;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}
          .content{padding:30px 20px;background:#f9fafb;border-radius:0 0 8px 8px}
          .button{display:inline-block;background:#2563eb;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;margin:20px 0;font-weight:bold}
          .footer{padding:20px;text-align:center;color:#666;font-size:14px}
          .warning{background:#fef3cd;border:1px solid #fecaca;padding:15px;border-radius:5px;margin:20px 0}
          .url-box{word-break:break-all;background:#f3f4f6;padding:10px;border-radius:3px;font-family:monospace;font-size:12px}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <p>We received a request to reset your password for your Booking Swap Platform account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align:center;">
              <a href="{{resetUrl}}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <div class="url-box">{{resetUrl}}</div>
            <div class="warning">
              <strong>Important:</strong>
              <ul>
                <li>This link will expire in {{expiresInMinutes}} minutes</li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>For security, this link can only be used once</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>This email was sent by Booking Swap Platform</p>
            <p>If you didn't request this password reset, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `);

    const text = `
Reset Your Password - Booking Swap Platform

Hello {{userName}}!

We received a request to reset your password for your Booking Swap Platform account.

To reset your password, please visit the following link:
{{resetUrl}}

IMPORTANT:
- This link will expire in {{expiresInMinutes}} minutes
- If you didn't request this password reset, please ignore this email
- For security, this link can only be used once

If you're having trouble accessing the link, copy and paste it into your web browser.

If you didn't request this password reset, please contact our support team.

---
Booking Swap Platform
    `.trim();

    return {
      html,
      text,
      subject: 'Reset Your Password - Booking Swap Platform',
      lastModified: new Date(),
    };
  }

  /**
   * Generate optimized password reset confirmation template
   */
  private async generatePasswordResetConfirmationTemplate(): Promise<EmailTemplate> {
    const html = this.minifyHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Confirmation</title>
        <style>
          body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
          .container{max-width:600px;margin:0 auto;padding:20px}
          .header{background:#2563eb;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}
          .content{padding:30px 20px;background:#f9fafb;border-radius:0 0 8px 8px}
          .footer{padding:20px;text-align:center;color:#666;font-size:14px}
          .success{background:#d1fae5;border:1px solid:#10b981;padding:15px;border-radius:5px;margin:20px 0}
          .warning{background:#fef3cd;border:1px solid:#f59e0b;padding:15px;border-radius:5px;margin:20px 0}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Successful</h1>
          </div>
          <div class="content">
            <h2>Hello {{userName}}!</h2>
            <div class="success">
              <strong>Your password has been successfully reset.</strong>
            </div>
            <p>This email confirms that your password was changed on {{resetTimeFormatted}}.</p>
            <div class="warning">
              <strong>If you did not make this change:</strong>
              <ul>
                <li>Your account may have been compromised</li>
                <li>Please contact our support team immediately</li>
                <li>Consider enabling two-factor authentication for additional security</li>
              </ul>
            </div>
            <p>For your security, all existing sessions have been invalidated. You will need to log in again with your new password.</p>
          </div>
          <div class="footer">
            <p>This email was sent by Booking Swap Platform</p>
            <p>If you need assistance, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `);

    const text = `
Password Reset Successful - Booking Swap Platform

Hello {{userName}}!

Your password has been successfully reset.

This email confirms that your password was changed on {{resetTimeFormatted}}.

IMPORTANT - If you did not make this change:
- Your account may have been compromised
- Please contact our support team immediately
- Consider enabling two-factor authentication for additional security

For your security, all existing sessions have been invalidated. You will need to log in again with your new password.

If you have any questions or concerns, please don't hesitate to contact our support team.

---
Booking Swap Platform
    `.trim();

    return {
      html,
      text,
      subject: 'Password Reset Confirmation - Booking Swap Platform',
      lastModified: new Date(),
    };
  }

  /**
   * Render template with variables
   */
  private renderTemplate(template: EmailTemplate, variables: TemplateVariables): EmailTemplate {
    const rendered = {
      html: this.replaceVariables(template.html, variables),
      text: this.replaceVariables(template.text, variables),
      subject: this.replaceVariables(template.subject, variables),
      lastModified: template.lastModified,
    };

    return rendered;
  }

  /**
   * Replace template variables with actual values
   */
  private replaceVariables(content: string, variables: TemplateVariables): string {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      let replacement: string;

      if (value instanceof Date) {
        replacement = value.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        });
      } else {
        replacement = String(value);
      }

      result = result.replace(new RegExp(placeholder, 'g'), replacement);
    }

    // Handle special variables
    if (variables.expiresAt instanceof Date) {
      const expiresInMinutes = Math.floor((variables.expiresAt.getTime() - Date.now()) / (1000 * 60));
      result = result.replace(/{{expiresInMinutes}}/g, String(Math.max(0, expiresInMinutes)));
    }

    if (variables.resetTime instanceof Date) {
      const resetTimeFormatted = variables.resetTime.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
      result = result.replace(/{{resetTimeFormatted}}/g, resetTimeFormatted);
    }

    return result;
  }

  /**
   * Get cached template
   */
  private async getCachedTemplate(cacheKey: string): Promise<EmailTemplate | null> {
    try {
      // Try memory cache first
      const memoryTemplate = this.memoryCache.get(cacheKey);
      if (memoryTemplate) {
        return memoryTemplate;
      }

      // Try Redis cache
      if (this.redis) {
        const redisTemplate = await this.redis.get<EmailTemplate>(cacheKey);
        if (redisTemplate) {
          // Update memory cache
          this.memoryCache.set(cacheKey, redisTemplate);
          return redisTemplate;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get cached template', { error, cacheKey });
      return null;
    }
  }

  /**
   * Set cached template
   */
  private async setCachedTemplate(cacheKey: string, template: EmailTemplate): Promise<void> {
    try {
      // Update memory cache
      this.memoryCache.set(cacheKey, template);

      // Update Redis cache
      if (this.redis) {
        await this.redis.set(cacheKey, template, this.config.cacheTTL);
      }
    } catch (error) {
      logger.error('Failed to set cached template', { error, cacheKey });
    }
  }

  /**
   * Precompile template for faster rendering
   */
  private precompileTemplate(templateKey: string, template: EmailTemplate): void {
    if (!this.config.enablePrecompilation) {
      return;
    }

    try {
      // Simple template compilation - replace with more sophisticated solution if needed
      const compiledHtml = this.createTemplateFunction(template.html);
      const compiledText = this.createTemplateFunction(template.text);
      const compiledSubject = this.createTemplateFunction(template.subject);

      this.compiledTemplates.set(`${templateKey}_html`, compiledHtml);
      this.compiledTemplates.set(`${templateKey}_text`, compiledText);
      this.compiledTemplates.set(`${templateKey}_subject`, compiledSubject);
    } catch (error) {
      logger.error('Failed to precompile template', { error, templateKey });
    }
  }

  /**
   * Create template function for faster variable replacement
   */
  private createTemplateFunction(template: string): Function {
    // Simple template function - could be enhanced with more sophisticated templating
    return (variables: TemplateVariables) => {
      return this.replaceVariables(template, variables);
    };
  }

  /**
   * Minify HTML content
   */
  private minifyHtml(html: string): string {
    if (!this.config.enableMinification) {
      return html;
    }

    return html
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/>\s+</g, '><') // Remove spaces between tags
      .replace(/\s+>/g, '>') // Remove spaces before closing tags
      .replace(/<\s+/g, '<') // Remove spaces after opening tags
      .trim();
  }

  /**
   * Fallback password reset template
   */
  private getFallbackPasswordResetTemplate(variables: {
    userName: string;
    resetUrl: string;
    expiresAt: Date;
  }): EmailTemplate {
    const expiresInMinutes = Math.floor((variables.expiresAt.getTime() - Date.now()) / (1000 * 60));

    return {
      html: `
        <h1>Reset Your Password</h1>
        <p>Hello ${variables.userName}!</p>
        <p>Click <a href="${variables.resetUrl}">here</a> to reset your password.</p>
        <p>This link expires in ${Math.max(0, expiresInMinutes)} minutes.</p>
      `,
      text: `
        Reset Your Password
        
        Hello ${variables.userName}!
        
        Visit this link to reset your password: ${variables.resetUrl}
        
        This link expires in ${Math.max(0, expiresInMinutes)} minutes.
      `,
      subject: 'Reset Your Password',
      lastModified: new Date(),
    };
  }

  /**
   * Fallback password reset confirmation template
   */
  private getFallbackPasswordResetConfirmationTemplate(variables: {
    userName: string;
    resetTime: Date;
  }): EmailTemplate {
    const resetTimeFormatted = variables.resetTime.toLocaleString();

    return {
      html: `
        <h1>Password Reset Successful</h1>
        <p>Hello ${variables.userName}!</p>
        <p>Your password was successfully reset on ${resetTimeFormatted}.</p>
      `,
      text: `
        Password Reset Successful
        
        Hello ${variables.userName}!
        
        Your password was successfully reset on ${resetTimeFormatted}.
      `,
      subject: 'Password Reset Confirmation',
      lastModified: new Date(),
    };
  }

  /**
   * Clear template cache
   */
  async clearCache(): Promise<void> {
    try {
      this.memoryCache.clear();
      this.compiledTemplates.clear();

      if (this.redis) {
        await this.redis.flushPattern('email_template:*');
      }

      logger.info('Email template cache cleared');
    } catch (error) {
      logger.error('Failed to clear template cache', { error });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryCacheSize: number;
    compiledTemplatesSize: number;
    redisConnected: boolean;
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      compiledTemplatesSize: this.compiledTemplates.size,
      redisConnected: this.redis ? true : false,
    };
  }
}