/*
  # Sample Data for Document AI Studio

  This migration adds sample data to the Document AI Studio application:
  
  1. Template Categories
     - Common categories for document organization
  
  2. ProofofDebitAPI Sample Data
     - Sample records with different statuses for testing
*/

-- Insert sample template categories
INSERT INTO template_categories (id, user_id, name, description, color, icon, sort_order)
VALUES
  -- These will only be inserted for the user who runs the migration
  (gen_random_uuid(), auth.uid(), 'Contracts', 'Legal agreements and contracts', '#3B82F6', 'file-text', 1),
  (gen_random_uuid(), auth.uid(), 'Invoices', 'Billing and payment documents', '#10B981', 'credit-card', 2),
  (gen_random_uuid(), auth.uid(), 'Reports', 'Business and financial reports', '#8B5CF6', 'bar-chart-2', 3),
  (gen_random_uuid(), auth.uid(), 'Letters', 'Formal correspondence', '#F59E0B', 'mail', 4),
  (gen_random_uuid(), auth.uid(), 'HR Documents', 'Human resources paperwork', '#EC4899', 'users', 5)
ON CONFLICT DO NOTHING;

-- Insert sample ProofofDebitAPI data
INSERT INTO "ProofofDebitAPI" (referenceno, date, time, bank, customername, nationalid, customerno, personalfinanceno, accountno, "Status")
VALUES
  ('REF001', '2025-01-15', '09:30:00', 'First National Bank', 'John Smith', 8801015000080, 10001, 50001, 'ACC10001', 'New'),
  ('REF002', '2025-01-16', '10:15:00', 'City Bank', 'Sarah Johnson', 9202025000081, 10002, 50002, 'ACC10002', 'New'),
  ('REF003', '2025-01-17', '11:45:00', 'Metro Credit Union', 'Michael Brown', 8703035000082, 10003, 50003, 'ACC10003', 'New'),
  ('REF004', '2025-01-18', '14:20:00', 'First National Bank', 'Emily Davis', 9104045000083, 10004, 50004, 'ACC10004', 'Current'),
  ('REF005', '2025-01-19', '15:30:00', 'City Bank', 'David Wilson', 8605055000084, 10005, 50005, 'ACC10005', 'Current'),
  ('REF006', '2025-01-20', '16:45:00', 'Metro Credit Union', 'Jennifer Taylor', 9706065000085, 10006, 50006, 'ACC10006', 'Processed'),
  ('REF007', '2025-01-21', '09:15:00', 'First National Bank', 'Robert Anderson', 8807075000086, 10007, 50007, 'ACC10007', 'Processed'),
  ('REF008', '2025-01-22', '10:30:00', 'City Bank', 'Lisa Thomas', 9908085000087, 10008, 50008, 'ACC10008', 'Error'),
  ('REF009', '2025-01-23', '11:45:00', 'Metro Credit Union', 'James Martinez', 8809095000088, 10009, 50009, 'ACC10009', 'New'),
  ('REF010', '2025-01-24', '13:00:00', 'First National Bank', 'Patricia Robinson', 9710105000089, 10010, 50010, 'ACC10010', 'New')
ON CONFLICT (customerno) DO UPDATE SET
  "Status" = EXCLUDED."Status",
  customername = EXCLUDED.customername,
  date = EXCLUDED.date;