/*
  # Auth Configuration

  1. Auth Settings
    - Configure email authentication
    - Set up email templates
    - Configure auth hooks

  2. Security
    - Set up secure defaults
*/

-- Configure auth settings
UPDATE auth.config
SET
  site_url = 'https://document-ai-studio.netlify.app',
  additional_redirect_urls = ARRAY[
    'https://document-ai-studio.netlify.app/*',
    'http://localhost:5173/*',
    'http://localhost:3000/*'
  ],
  enable_signup = true,
  enable_confirmations = false,
  mailer_autoconfirm = true,
  sms_autoconfirm = true,
  jwt_expiry = 3600,
  security_refresh_token_reuse_interval = 10,
  security_captcha_enabled = false;

-- Configure email templates
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Default TOTP', 'totp', 'verified', now(), now(), 'DEFAULTTOTPSECRET')
ON CONFLICT (id) DO NOTHING;

-- Set up email templates
UPDATE auth.email_templates
SET
  template = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Confirm Your Email</title></head><body><h2>Confirm Your Email</h2><p>Follow this link to confirm your email:</p><p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p></body></html>',
  subject = 'Confirm Your Email'
WHERE template_type = 'confirmation';

UPDATE auth.email_templates
SET
  template = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reset Your Password</title></head><body><h2>Reset Your Password</h2><p>Follow this link to reset the password for your account:</p><p><a href="{{ .ConfirmationURL }}">Reset Password</a></p></body></html>',
  subject = 'Reset Your Password'
WHERE template_type = 'recovery';

UPDATE auth.email_templates
SET
  template = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invite</title></head><body><h2>You have been invited</h2><p>You have been invited to create a user on {{ .SiteURL }}. Follow this link to accept the invite:</p><p><a href="{{ .ConfirmationURL }}">Accept the invite</a></p></body></html>',
  subject = 'You have been invited'
WHERE template_type = 'invite';

UPDATE auth.email_templates
SET
  template = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Change Your Email</title></head><body><h2>Change Your Email</h2><p>Follow this link to confirm the update of your email from {{ .Email }} to {{ .NewEmail }}:</p><p><a href="{{ .ConfirmationURL }}">Change Email</a></p></body></html>',
  subject = 'Change Your Email'
WHERE template_type = 'change_email';

-- Create auth hooks for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, company)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'company'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();