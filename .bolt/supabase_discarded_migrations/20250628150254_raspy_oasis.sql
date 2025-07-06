/*
  # Sample Data for Document AI Studio

  This migration adds sample data to the system for testing and demonstration purposes:
  
  1. Sample Categories
    - Common document categories like Contracts, Invoices, Reports
  
  2. Sample Templates
    - Basic templates with tags for demonstration
  
  3. Sample ProofofDebitAPI Records
    - Test records with Status = 'New' for integration testing
*/

-- Sample template categories
INSERT INTO template_categories (user_id, name, description, color, icon, sort_order)
SELECT 
  auth.uid(),
  category_name,
  category_description,
  category_color,
  category_icon,
  sort_order
FROM (
  VALUES
    ('Contracts', 'Legal agreements and contracts', '#3B82F6', 'file-text', 1),
    ('Invoices', 'Billing and payment documents', '#10B981', 'credit-card', 2),
    ('Reports', 'Business and financial reports', '#8B5CF6', 'bar-chart-2', 3),
    ('Letters', 'Formal correspondence', '#F59E0B', 'mail', 4),
    ('HR Documents', 'Human resources forms', '#EC4899', 'users', 5)
) AS t(category_name, category_description, category_color, category_icon, sort_order)
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid())
ON CONFLICT (user_id, name) DO NOTHING;

-- Sample ProofofDebitAPI records
INSERT INTO "ProofofDebitAPI" (referenceno, date, time, bank, customername, nationalid, customerno, personalfinanceno, accountno, "Status")
VALUES
  ('REF001', '2025-01-15', '09:30:00', 'First National Bank', 'John Smith', 8801015000080, 10001, 50001, 'ACC10001', 'New'),
  ('REF002', '2025-01-16', '10:15:00', 'City Bank', 'Sarah Johnson', 9202025000081, 10002, 50002, 'ACC10002', 'New'),
  ('REF003', '2025-01-17', '11:45:00', 'Global Trust', 'Michael Brown', 8703035000082, 10003, 50003, 'ACC10003', 'New'),
  ('REF004', '2025-01-18', '14:20:00', 'First National Bank', 'Emily Davis', 9104045000083, 10004, 50004, 'ACC10004', 'New'),
  ('REF005', '2025-01-19', '16:00:00', 'City Bank', 'Robert Wilson', 8605055000084, 10005, 50005, 'ACC10005', 'New'),
  ('REF006', '2025-01-20', '09:00:00', 'Global Trust', 'Jennifer Lee', 9706065000085, 10006, 50006, 'ACC10006', 'Current'),
  ('REF007', '2025-01-21', '10:30:00', 'First National Bank', 'David Miller', 8807075000086, 10007, 50007, 'ACC10007', 'Current'),
  ('REF008', '2025-01-22', '13:15:00', 'City Bank', 'Lisa Taylor', 9908085000087, 10008, 50008, 'ACC10008', 'Processed'),
  ('REF009', '2025-01-23', '15:45:00', 'Global Trust', 'James Anderson', 8809095000088, 10009, 50009, 'ACC10009', 'Processed'),
  ('REF010', '2025-01-24', '17:30:00', 'First National Bank', 'Patricia Martinez', 9710105000089, 10010, 50010, 'ACC10010', 'Error')
ON CONFLICT (customerno) DO NOTHING;