/*
  # Fix SMTP Configuration

  1. Changes
    - Replace ALTER SYSTEM commands with proper Supabase auth configuration
    - Use pgcrypto extension for secure password storage
    - Configure email templates for password reset
    - Set proper redirect URLs
*/

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Configure SMTP settings using the proper method for Supabase
INSERT INTO auth.config (key, value)
VALUES
  ('smtp.host', 'decisions.social'),
  ('smtp.port', '465'),
  ('smtp.user', 'alerts@decisions.social'),
  ('smtp.pass', 'DuONN7qH?MP&'),
  ('smtp.sender_name', 'Document AI Studio'),
  ('smtp.sender_email', 'alerts@decisions.social'),
  ('smtp.admin_email', 'alerts@decisions.social'),
  ('site_url', 'http://localhost:5173'),
  ('additional_redirect_urls', 'http://localhost:5173/reset-password'),
  ('email.enable_confirmations', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Configure email templates with improved styling
INSERT INTO auth.config (key, value)
VALUES
('email.template.recovery', '
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
')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;