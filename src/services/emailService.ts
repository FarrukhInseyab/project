import nodemailer from 'nodemailer';

// Email configuration
const SMTP_CONFIG = {
  host: 'decisions.social',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: 'alerts@decisions.social',
    pass: 'DuONN7qH?MP&'
  }
};

// Create transporter
const transporter = nodemailer.createTransport(SMTP_CONFIG);

export class EmailService {
  /**
   * Send an email
   * @param to Recipient email address
   * @param subject Email subject
   * @param text Plain text content
   * @param html HTML content (optional)
   * @returns Promise with the send result
   */
  static async sendEmail(
    to: string | string[],
    subject: string,
    text: string,
    html?: string
  ) {
    try {
      // Verify connection configuration
      await transporter.verify();
      
      // Send mail with defined transport object
      const info = await transporter.sendMail({
        from: '"Decisions Alerts" <alerts@decisions.social>',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html: html || text
      });
      
      console.log('Message sent: %s', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
        info
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send a template-based notification
   * @param to Recipient email address
   * @param templateName Template identifier
   * @param data Data to populate the template
   * @returns Promise with the send result
   */
  static async sendTemplateEmail(
    to: string | string[],
    templateName: string,
    data: Record<string, any>
  ) {
    // Get template content based on template name
    const template = this.getEmailTemplate(templateName, data);
    
    return this.sendEmail(
      to,
      template.subject,
      template.text,
      template.html
    );
  }

  /**
   * Get email template content
   * @param templateName Template identifier
   * @param data Data to populate the template
   * @returns Template content with subject, text and HTML
   */
  private static getEmailTemplate(templateName: string, data: Record<string, any>) {
    switch (templateName) {
      case 'welcome':
        return {
          subject: 'Welcome to Decisions',
          text: `Hello ${data.name},\n\nWelcome to Decisions! We're excited to have you on board.\n\nBest regards,\nThe Decisions Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Welcome to Decisions</h2>
              <p>Hello ${data.name},</p>
              <p>Welcome to Decisions! We're excited to have you on board.</p>
              <p>Best regards,<br>The Decisions Team</p>
            </div>
          `
        };
      
      case 'document_generated':
        return {
          subject: 'Your Document Has Been Generated',
          text: `Hello,\n\nYour document "${data.documentName}" has been successfully generated.\n\nBest regards,\nThe Decisions Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Document Generated</h2>
              <p>Hello,</p>
              <p>Your document "${data.documentName}" has been successfully generated.</p>
              <p>Best regards,<br>The Decisions Team</p>
            </div>
          `
        };
      
      case 'password_reset':
        return {
          subject: 'Password Reset Request',
          text: `Hello,\n\nWe received a request to reset your password. Please use the following link to reset your password: ${data.resetLink}\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe Decisions Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Password Reset Request</h2>
              <p>Hello,</p>
              <p>We received a request to reset your password. Please use the following link to reset your password:</p>
              <p><a href="${data.resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
              <p>If you didn't request this, please ignore this email.</p>
              <p>Best regards,<br>The Decisions Team</p>
            </div>
          `
        };
      
      default:
        throw new Error(`Email template "${templateName}" not found`);
    }
  }
}