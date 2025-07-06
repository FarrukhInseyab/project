/*
  # Authentication Hooks

  1. Functions
    - Create profile on user signup
    - Log user activity on login
  
  2. Triggers
    - Set up triggers for auth events
*/

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into private users table
  INSERT INTO users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at);
  
  -- Create user profile
  INSERT INTO profiles (user_id, email, full_name, avatar_url, company)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'company'
  );
  
  -- Log signup activity
  INSERT INTO user_activity (user_id, activity_type, resource_type, details)
  VALUES (
    NEW.id,
    'login',
    'user',
    jsonb_build_object('action', 'signup', 'method', NEW.raw_user_meta_data->>'provider')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to handle user login
CREATE OR REPLACE FUNCTION handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
  -- Log login activity
  INSERT INTO user_activity (user_id, activity_type, resource_type, details)
  VALUES (
    NEW.id,
    'login',
    'user',
    jsonb_build_object('action', 'login', 'method', NEW.raw_user_meta_data->>'provider')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user logins
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION handle_user_login();