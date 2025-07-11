-- Configure SMTP settings for Supabase Auth
-- This migration uses a different approach that doesn't require superuser privileges

-- Create a function to update auth settings that works with limited permissions
CREATE OR REPLACE FUNCTION update_auth_settings()
RETURNS void AS $$
BEGIN
  -- Create a temporary table to store our settings
  CREATE TEMP TABLE temp_auth_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  
  -- Insert our SMTP settings
  INSERT INTO temp_auth_settings (key, value)
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
    ('email.enable_confirmations', 'false'),
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
');

  -- Try to update settings in auth.config if the table exists
  BEGIN
    -- Check if auth.config table exists
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'auth' 
      AND table_name = 'config'
    ) THEN
      -- Update settings in auth.config
      INSERT INTO auth.config (key, value)
      SELECT key, value FROM temp_auth_settings
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
      
      RAISE NOTICE 'Updated settings in auth.config table';
    ELSE
      RAISE NOTICE 'auth.config table does not exist, using alternative method';
      
      -- Use set_config as fallback (works in some environments)
      PERFORM set_config('auth.' || key, value, false)
      FROM temp_auth_settings;
      
      RAISE NOTICE 'Applied settings using set_config';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating auth settings: %', SQLERRM;
    -- Continue execution even if there's an error
  END;
  
  -- Clean up
  DROP TABLE temp_auth_settings;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT update_auth_settings();

-- Drop the function when done
DROP FUNCTION update_auth_settings();

-- Note: This migration attempts to configure SMTP settings using multiple approaches
-- to maximize compatibility with different Supabase environments.
-- If you're still having issues, you may need to configure these settings manually
-- through the Supabase dashboard or API.