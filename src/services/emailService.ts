import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a transporter with SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: parseInt(process.env.SMTP_PORT || '587') === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify SMTP connection
const verifyConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
    return false;
  }
};

// Send a simple text email
const sendTextEmail = async (
  to: string,
  subject: string,
  text: string
): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
    });
    console.log('✅ Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return false;
  }
};

// Send an HTML email
const sendHtmlEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text: text || 'Please view this email in an HTML-compatible email client.',
      html,
    });
    console.log('✅ HTML email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send HTML email:', error);
    return false;
  }
};

// Send an email with attachments
const sendEmailWithAttachments = async (
  to: string,
  subject: string,
  html: string,
  attachments: Array<{
    filename: string;
    content?: Buffer;
    path?: string;
    contentType?: string;
  }>
): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log('✅ Email with attachments sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email with attachments:', error);
    return false;
  }
};

// Send a password reset email
const sendPasswordResetEmail = async (
  to: string,
  resetLink: string
): Promise<boolean> => {
  const subject = 'Reset Your Password';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
      <style>
        body { 
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          padding: 20px;
          background-color: #f9f9f9;
        }
        h2 {
          color: #3b82f6;
          margin-top: 0;
        }
        .button {
          display: inline-block;
          background-color: #3b82f6;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Reset Your Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <p><a href="${resetLink}" class="button">Reset Password</a></p>
        <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        <p>This link will expire in 24 hours.</p>
        <div class="footer">
          <p>Document AI Studio - Secure Document Processing</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendHtmlEmail(to, subject, html);
};

// Send a welcome email
const sendWelcomeEmail = async (
  to: string,
  name: string
): Promise<boolean> => {
  const subject = 'Welcome to Document AI Studio';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Document AI Studio</title>
      <style>
        body { 
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .container {
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          padding: 20px;
          background-color: #f9f9f9;
        }
        h2 {
          color: #3b82f6;
          margin-top: 0;
        }
        .button {
          display: inline-block;
          background-color: #3b82f6;
          color: white;
          text-decoration: none;
          padding: 10px 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .features {
          margin: 20px 0;
        }
        .feature {
          margin-bottom: 10px;
        }
        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Welcome to Document AI Studio!</h2>
        <p>Hello ${name},</p>
        <p>Thank you for joining Document AI Studio. We're excited to have you on board!</p>
        
        <div class="features">
          <p><strong>Here's what you can do with our platform:</strong></p>
          <div class="feature">✅ AI-powered document tag extraction</div>
          <div class="feature">✅ Smart data mapping and population</div>
          <div class="feature">✅ Template library and reusable workflows</div>
        </div>
        
        <p><a href="http://localhost:5173" class="button">Get Started Now</a></p>
        
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        
        <div class="footer">
          <p>Document AI Studio - Secure Document Processing</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendHtmlEmail(to, subject, html);
};

export const EmailService = {
  verifyConnection,
  sendTextEmail,
  sendHtmlEmail,
  sendEmailWithAttachments,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};