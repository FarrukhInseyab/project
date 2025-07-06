/*
  # Auth Configuration

  1. Auth Settings
    - Email authentication configuration
    - User management triggers
*/

-- Create auth trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role text := 'authenticated';
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, company)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'company'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Set up email auth settings (these would normally be configured in the Supabase dashboard)
COMMENT ON SCHEMA auth IS '
Auth configuration:
- Email auth enabled: true
- Email confirmations: false (disabled for easier testing)
- Allow signups: true
- Secure email change: true
- JWT expiry: 3600 (1 hour)
- Minimum password length: 6
';