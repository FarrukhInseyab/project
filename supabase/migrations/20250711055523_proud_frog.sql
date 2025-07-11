/*
  # SMTP Configuration for Password Reset Emails

  1. New Configuration
    - Sets up SMTP configuration for Supabase Auth
    - Configures email templates for password recovery
    - Uses the provided SMTP credentials for decisions.social

  2. Security
    - Ensures secure email delivery for password reset links
    - Configures proper email templates with branding
*/

-- Set up SMTP configuration for Supabase Auth
SELECT set_config('auth.smtp.host', 'decisions.social', false);
SELECT set_config('auth.smtp.port', '465', false);
SELECT set_config('auth.smtp.user', 'alerts@decisions.social', false);
SELECT set_config('auth.smtp.pass', 'DuONN7qH?MP&', false);
SELECT set_config('auth.smtp.sender_name', 'Document AI Studio', false);
SELECT set_config('auth.smtp.sender_email', 'alerts@decisions.social', false);
SELECT set_config('auth.smtp.admin_email', 'alerts@decisions.social', false);

-- Configure email templates
SELECT set_config('auth.email.template.magic_link', '
<h2>Magic Link Login</h2>
<p>Click the link below to log in:</p>
<p><a href="{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=magiclink&redirect_to={{ .RedirectTo }}">Log In</a></p>
', false);

SELECT set_config('auth.email.template.invite', '
<h2>You''ve been invited</h2>
<p>You have been invited to create a user on {{ .SiteURL }}. Follow this link to accept the invite:</p>
<p><a href="{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=invite&redirect_to={{ .RedirectTo }}">Accept the invite</a></p>
', false);

SELECT set_config('auth.email.template.confirmation', '
<h2>Confirm Your Signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=signup&redirect_to={{ .RedirectTo }}">Confirm your email</a></p>
', false);

SELECT set_config('auth.email.template.recovery', '
<h2>Reset Your Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=recovery&redirect_to={{ .RedirectTo }}">Reset password</a></p>
', false);

SELECT set_config('auth.email.template.email_change', '
<h2>Confirm Email Change</h2>
<p>Follow this link to confirm your new email:</p>
<p><a href="{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=email_change&redirect_to={{ .RedirectTo }}">Change email</a></p>
', false);

-- Enable email confirmations (optional, set to false if you want to skip email verification)
SELECT set_config('auth.email.enable_confirmations', 'false', false);

-- Set site URL for email links
SELECT set_config('auth.site_url', 'http://localhost:5173', false);

-- Set redirect URL after password reset
SELECT set_config('auth.additional_redirect_urls', 'http://localhost:5173/reset-password', false);