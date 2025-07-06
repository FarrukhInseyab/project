/*
  # Initial Data Setup

  1. Default Categories
    - Creates default template categories for new users
  2. Sample Templates
    - Adds sample templates for demonstration
  3. Sample ProofofDebitAPI Data
    - Adds test data for the ProofofDebitAPI table
*/

-- Insert sample data into ProofofDebitAPI
INSERT INTO "ProofofDebitAPI" (referenceno, date, time, bank, customername, nationalid, customerno, personalfinanceno, accountno, "Status")
VALUES
  ('REF001', '2025-06-01', '09:30:00', 'First National Bank', 'John Smith', 8801015000080, 1001, 5001, 'ACC001', 'New'),
  ('REF002', '2025-06-02', '10:15:00', 'City Bank', 'Jane Doe', 9202025000081, 1002, 5002, 'ACC002', 'New'),
  ('REF003', '2025-06-03', '11:45:00', 'Metro Credit Union', 'Robert Johnson', 7703035000082, 1003, 5003, 'ACC003', 'New'),
  ('REF004', '2025-06-04', '14:20:00', 'First National Bank', 'Sarah Williams', 8504045000083, 1004, 5004, 'ACC004', 'New'),
  ('REF005', '2025-06-05', '16:00:00', 'City Bank', 'Michael Brown', 9005055000084, 1005, 5005, 'ACC005', 'New'),
  ('REF006', '2025-06-06', '09:00:00', 'Metro Credit Union', 'Emily Davis', 8806065000085, 1006, 5006, 'ACC006', 'Current'),
  ('REF007', '2025-06-07', '10:30:00', 'First National Bank', 'David Miller', 7707075000086, 1007, 5007, 'ACC007', 'Current'),
  ('REF008', '2025-06-08', '13:15:00', 'City Bank', 'Jennifer Wilson', 9108085000087, 1008, 5008, 'ACC008', 'Processed'),
  ('REF009', '2025-06-09', '15:45:00', 'Metro Credit Union', 'Thomas Moore', 8509095000088, 1009, 5009, 'ACC009', 'Processed'),
  ('REF010', '2025-06-10', '17:30:00', 'First National Bank', 'Lisa Taylor', 7610105000089, 1010, 5010, 'ACC010', 'Error')
ON CONFLICT (customerno) DO NOTHING;

-- Create a function to create default categories for new users
CREATE OR REPLACE FUNCTION create_default_categories_for_user(user_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert default categories if they don't exist
  INSERT INTO template_categories (user_id, name, description, color, icon, sort_order)
  VALUES
    (user_id, 'Financial', 'Financial and banking documents', '#3B82F6', 'dollar-sign', 1),
    (user_id, 'Legal', 'Legal documents and contracts', '#10B981', 'scale', 2),
    (user_id, 'HR', 'Human resources documents', '#8B5CF6', 'users', 3),
    (user_id, 'Marketing', 'Marketing and sales documents', '#F59E0B', 'megaphone', 4)
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to create default categories for new users
CREATE OR REPLACE FUNCTION create_default_categories_on_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_categories_for_user(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_insert_create_categories ON profiles;
CREATE TRIGGER on_profile_insert_create_categories
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_categories_on_profile_insert();

-- Run for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT user_id FROM profiles LOOP
    PERFORM create_default_categories_for_user(user_record.user_id);
  END LOOP;
END;
$$;