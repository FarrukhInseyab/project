import { supabase } from '../lib/supabase';

// Email templates
// Email templates
interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  /**
   * Send an email using Supabase Edge Function
   * This approach avoids using nodemailer directly in the browser
   */
  static async sendEmail(
    to: string | string[],
    subject: string,
    text: string,
    html?: string
  ) {
    try {
      // Get current user for authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call the Supabase Edge Function for sending emails
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: Array.isArray(to) ? to : [to],
          subject,
          text,
          html: html || text
        }
      });

      if (error) {
        console.error('Error sending email:', error);
        throw error;
      }

      console.log('Email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Failed to send email:', error);
      // Don't throw - email failures shouldn't break the app
      return false;
    }
  }

  /**
   * Send a template-based notification
   */
  static async sendTemplateEmail(
    to: string | string[],
    templateName: string,
    data: Record<string, any>,
    options?: { cc?: string[]; bcc?: string[] }
  ) {
    try {
      // Get template content based on template name
      const template = this.getEmailTemplate(templateName, data);
      
      return this.sendEmail(
        to,
        template.subject,
        template.text,
        template.html,
        options
      );
    } catch (error) {
      console.error('Failed to send template email:', error);
      return false;
    }
  }

  /**
   * Get email template content
   */
  private static getEmailTemplate(templateName: string, data: Record<string, any>): EmailTemplate {
    switch (templateName) {
      case 'welcome':
        return {
          subject: 'Welcome to Document AI Studio',
          text: `Hello ${data.name},\n\nWelcome to Document AI Studio! We're excited to have you on board.\n\nBest regards,\nThe Document AI Studio Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Welcome to Document AI Studio</h2>
              <p>Hello ${data.name},</p>
              <p>Welcome to Document AI Studio! We're excited to have you on board.</p>
              <p>Best regards,<br>The Document AI Studio Team</p>
            </div>
          `
        };
      
      case 'document_generated':
        return {
          subject: 'Your Document Has Been Generated',
          text: `Hello,\n\nYour document "${data.documentName}" has been successfully generated.\n\nBest regards,\nThe Document AI Studio Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Document Generated</h2>
              <p>Hello,</p>
              <p>Your document "${data.documentName}" has been successfully generated.</p>
              <p>Best regards,<br>The Document AI Studio Team</p>
            </div>
          `
        };
      
      case 'password_reset':
        return {
          subject: 'Password Reset Request',
          text: `Hello ${data.name || 'there'},\n\nWe received a request to reset your password. Please use the following link to reset your password: ${data.resetLink}\n\nIf you didn't request this, please ignore this email.\n\nThis link will expire in 24 hours.\n\nBest regards,\nThe Document AI Studio Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Password Reset Request</h2>
              <p>Hello ${data.name || 'there'},</p>
              <p>We received a request to reset your password. Please use the following link to reset your password:</p>
              <p><a href="${data.resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
              <p>If you didn't request this, please ignore this email.</p>
              <p>This link will expire in 24 hours.</p>
              <p>Best regards,<br>The Document AI Studio Team</p>
            </div>
          `
        };
      
      case 'password_updated':
        return {
          subject: 'Your Password Has Been Updated',
          text: `Hello ${data.name || 'there'},\n\nYour password for Document AI Studio has been successfully updated.\n\nIf you did not make this change, please contact support immediately.\n\nBest regards,\nThe Document AI Studio Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Password Updated</h2>
              <p>Hello ${data.name || 'there'},</p>
              <p>Your password for Document AI Studio has been successfully updated.</p>
              <p>If you did not make this change, please contact support immediately.</p>
              <p>Best regards,<br>The Document AI Studio Team</p>
            </div>
          `
        };
      
      default:
        throw new Error(`Email template "${templateName}" not found`);
    }
  }

  /**
   * Send a password reset email
   */
  static async sendPasswordResetEmail(email: string, resetLink: string) {
    try {
      // Get user name from email (before @)
      const name = email.split('@')[0];
      
      return this.sendTemplateEmail(
        email,
        'password_reset',
        { resetLink, name }
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return false;
    }
  }

  /**
   * Send a password updated confirmation email
   */
  static async sendPasswordUpdatedEmail(email: string) {
    try {
      // Get user name from email (before @)
      const name = email.split('@')[0];
      
      return this.sendTemplateEmail(
        email,
        'password_updated',
        { name }
      );
    } catch (error) {
      console.error('Failed to send password updated email:', error);
      return false;
    }
  }
}