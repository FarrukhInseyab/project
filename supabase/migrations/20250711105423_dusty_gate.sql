-- Configure SMTP settings for Supabase Auth
-- This migration uses the correct approach for local Supabase instances

-- First, let's set up the SMTP configuration using the set_config function
-- This is the recommended way for local development environments
SELECT set_config('auth.smtp.host', 'decisions.social', false);
SELECT set_config('auth.smtp.port', '465', false);
SELECT set_config('auth.smtp.user', 'alerts@decisions.social', false);
SELECT set_config('auth.smtp.pass', 'DuONN7qH?MP&', false);
SELECT set_config('auth.smtp.sender_name', 'Document AI Studio', false);
SELECT set_config('auth.smtp.sender_email', 'alerts@decisions.social', false);
SELECT set_config('auth.smtp.admin_email', 'alerts@decisions.social', false);

-- Configure email templates with improved styling
SELECT set_config('auth.email.template.recovery', '
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
', false);

-- Enable or disable email confirmations (set to false to skip email verification)
SELECT set_config('auth.email.enable_confirmations', 'false', false);

-- Set site URL for email links
SELECT set_config('auth.site_url', 'http://localhost:5173', false);

-- Set redirect URL after password reset
SELECT set_config('auth.additional_redirect_urls', 'http://localhost:5173/reset-password', false);

-- Reload the configuration to apply changes
SELECT pg_reload_conf();