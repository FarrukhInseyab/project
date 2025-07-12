import express from 'express';
import cors from 'cors';
import { EmailService } from '../services/emailService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Verify SMTP connection on startup
(async () => {
  const isConnected = await EmailService.verifyConnection();
  if (!isConnected) {
    console.warn('⚠️ SMTP connection failed. Email functionality may not work properly.');
    console.warn('⚠️ Please check your SMTP configuration in the .env file.');
  }
})();

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Email service is running',
    endpoints: [
      { method: 'POST', path: '/api/email/send', description: 'Send a text email' },
      { method: 'POST', path: '/api/email/send-html', description: 'Send an HTML email' },
      { method: 'POST', path: '/api/email/password-reset', description: 'Send a password reset email' },
      { method: 'POST', path: '/api/email/welcome', description: 'Send a welcome email' },
    ]
  });
});

// Send a text email
app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    
    // Validate required fields
    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, subject, text'
      });
    }
    
    const success = await EmailService.sendTextEmail(to, subject, text);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Email sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send email'
      });
    }
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send an HTML email
app.post('/api/email/send-html', async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;
    
    // Validate required fields
    if (!to || !subject || !html) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, subject, html'
      });
    }
    
    const success = await EmailService.sendHtmlEmail(to, subject, html, text);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'HTML email sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send HTML email'
      });
    }
  } catch (error) {
    console.error('Error sending HTML email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send a password reset email
app.post('/api/email/password-reset', async (req, res) => {
  try {
    const { to, resetLink } = req.body;
    
    // Validate required fields
    if (!to || !resetLink) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, resetLink'
      });
    }
    
    const success = await EmailService.sendPasswordResetEmail(to, resetLink);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send password reset email'
      });
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send a welcome email
app.post('/api/email/welcome', async (req, res) => {
  try {
    const { to, name } = req.body;
    
    // Validate required fields
    if (!to || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to, name'
      });
    }
    
    const success = await EmailService.sendWelcomeEmail(to, name);
    
    if (success) {
      res.status(200).json({
        success: true,
        message: 'Welcome email sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send welcome email'
      });
    }
  } catch (error) {
    console.error('Error sending welcome email:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`✅ Email server running at http://localhost:${port}`);
});

export default app;