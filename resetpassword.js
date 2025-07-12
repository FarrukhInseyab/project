/**
 * Reset Password Email Script
 * 
 * This script sends password reset emails using the configured SMTP settings.
 * Usage: node resetpassword.js <email>
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a transporter with SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'decisions.social',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'alerts@decisions.social',
    pass: process.env.SMTP_PASS || 'DuONN7qH?MP&'
  }
});

// Generate a reset token (in a real app, this would be stored in a database)
function generateResetToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Create reset password URL
function createResetUrl(token) {
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  return `${baseUrl}/reset-password?token=${token}`;
}

// HTML email template
function getHtmlTemplate(resetUrl, userName = 'there') {
  return `
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
    <p>Hello ${userName},</p>
    <p>We received a request to reset your password for Document AI Studio. Click the button below to set a new password:</p>
    <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
    <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
    <p>This link will expire in 24 hours.</p>
    <div class="footer">
      <p>Document AI Studio - Secure Document Processing</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Plain text email template
function getTextTemplate(resetUrl, userName = 'there') {
  return `
Hello ${userName},

We received a request to reset your password for Document AI Studio.
Please use the following link to reset your password:

${resetUrl}

If you did not request a password reset, please ignore this email or contact support if you have concerns.
This link will expire in 24 hours.

Best regards,
Document AI Studio - Secure Document Processing
  `;
}

// Send password reset email
async function sendPasswordResetEmail(email) {
  try {
    // Generate token and reset URL
    const token = generateResetToken();
    const resetUrl = createResetUrl(token);
    
    // Get user name from email (before @)
    const userName = email.split('@')[0];
    
    // Email content
    const mailOptions = {
      from: `"Document AI Studio" <${process.env.SMTP_FROM_EMAIL || 'alerts@decisions.social'}>`,
      to: email,
      subject: 'Reset Your Password - Document AI Studio',
      text: getTextTemplate(resetUrl, userName),
      html: getHtmlTemplate(resetUrl, userName)
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Password reset email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('🔗 Reset URL:', resetUrl);
    
    // Save token to a file (in a real app, this would be stored in a database)
    const tokensFile = path.join(__dirname, 'reset_tokens.json');
    let tokens = {};
    
    // Read existing tokens if file exists
    if (fs.existsSync(tokensFile)) {
      const fileContent = fs.readFileSync(tokensFile, 'utf8');
      tokens = JSON.parse(fileContent);
    }
    
    // Add new token with expiration time (24 hours from now)
    tokens[token] = {
      email,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    // Save tokens to file
    fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
}

// Verify SMTP connection
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
    return false;
  }
}

// Main function
async function main() {
  // Get email from command line arguments
  const email = process.argv[2];
  
  if (!email) {
    console.error('❌ Please provide an email address as an argument.');
    console.log('Usage: node resetpassword.js <email>');
    process.exit(1);
  }
  
  // Verify SMTP connection
  const isConnected = await verifyConnection();
  
  if (!isConnected) {
    console.error('❌ SMTP connection failed. Please check your configuration.');
    process.exit(1);
  }
  
  // Send password reset email
  const success = await sendPasswordResetEmail(email);
  
  if (success) {
    console.log('✅ Password reset email sent to:', email);
  } else {
    console.error('❌ Failed to send password reset email.');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});