-- Configure SMTP settings for Supabase Auth
-- This migration sets up the SMTP configuration for password reset emails

-- Set SMTP server configuration
ALTER SYSTEM SET auth.smtp.host = 'decisions.social';
ALTER SYSTEM SET auth.smtp.port = '465';
ALTER SYSTEM SET auth.smtp.user = 'alerts@decisions.social';
ALTER SYSTEM SET auth.smtp.pass = 'DuONN7qH?MP&';
ALTER SYSTEM SET auth.smtp.sender_name = 'Document AI Studio';
ALTER SYSTEM SET auth.smtp.sender_email = 'alerts@decisions.social';
ALTER SYSTEM SET auth.smtp.admin_email = 'alerts@decisions.social';

-- Configure email templates with improved styling
ALTER SYSTEM SET auth.email.template.recovery = '
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
    <p>We received a request to reset your password for Document AI Studio. Click the button below to set a new password:</p>
    <p><a href="{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=recovery&redirect_to={{ .RedirectTo }}" class="button">Reset Password</a></p>
    <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
    <p>This link will expire in 24 hours.</p>
    <div class="footer">
      <p>Document AI Studio - Secure Document Processing</p>
    </div>
  </div>
</body>
</html>
';

-- Enable or disable email confirmations (set to false to skip email verification)
ALTER SYSTEM SET auth.email.enable_confirmations = 'false';

-- Set site URL for email links
ALTER SYSTEM SET auth.site_url = 'http://localhost:5173';

-- Set redirect URL after password reset
ALTER SYSTEM SET auth.additional_redirect_urls = 'http://localhost:5173/reset-password';

-- Reload the configuration to apply changes
SELECT pg_reload_conf();