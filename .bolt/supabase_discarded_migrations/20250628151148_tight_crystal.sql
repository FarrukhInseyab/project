/*
  # Document AI Studio - Sample Data

  This migration adds sample data to the Document AI Studio application,
  including template categories and ProofofDebitAPI records.

  1. Sample Data
    - Template categories (Contracts, Invoices, Reports, etc.)
    - ProofofDebitAPI records with different statuses
*/

-- Sample template categories
INSERT INTO template_categories (name, description, color, icon, user_id)
SELECT 
  category_name,
  category_description,
  category_color,
  category_icon,
  auth.uid()
FROM (
  VALUES
    ('Contracts', 'Legal agreements and contracts', '#3B82F6', 'file-text', NULL),
    ('Invoices', 'Billing and payment documents', '#10B981', 'credit-card', NULL),
    ('Reports', 'Business and financial reports', '#8B5CF6', 'bar-chart-2', NULL),
    ('Letters', 'Formal correspondence', '#F59E0B', 'mail', NULL),
    ('HR Documents', 'Human resources forms and templates', '#EC4899', 'users', NULL)
) AS t(category_name, category_description, category_color, category_icon, user_id)
WHERE NOT EXISTS (
  SELECT 1 FROM template_categories 
  WHERE user_id = auth.uid() AND name = t.category_name
)
AND auth.uid() IS NOT NULL;

-- Sample ProofofDebitAPI records
INSERT INTO "ProofofDebitAPI" (customerno, referenceno, date, time, bank, customername, nationalid, personalfinanceno, accountno, "Status")
VALUES
  (1001, 'REF-001', '2025-01-15', '09:30:00', 'First National Bank', 'John Smith', 8801015000080, 12345, 'ACC-001-XYZ', 'New'),
  (1002, 'REF-002', '2025-01-16', '10:15:00', 'City Bank', 'Sarah Johnson', 7502023000081, 23456, 'ACC-002-XYZ', 'New'),
  (1003, 'REF-003', '2025-01-17', '11:45:00', 'Global Trust', 'Michael Brown', 6903034000082, 34567, 'ACC-003-XYZ', 'New'),
  (1004, 'REF-004', '2025-01-18', '14:20:00', 'First National Bank', 'Emily Davis', 9204045000083, 45678, 'ACC-004-XYZ', 'Current'),
  (1005, 'REF-005', '2025-01-19', '15:30:00', 'City Bank', 'Robert Wilson', 8505056000084, 56789, 'ACC-005-XYZ', 'Current'),
  (1006, 'REF-006', '2025-01-20', '16:45:00', 'Global Trust', 'Jennifer Lee', 7806067000085, 67890, 'ACC-006-XYZ', 'Processed'),
  (1007, 'REF-007', '2025-01-21', '09:15:00', 'First National Bank', 'David Miller', 6907078000086, 78901, 'ACC-007-XYZ', 'Processed'),
  (1008, 'REF-008', '2025-01-22', '10:30:00', 'City Bank', 'Lisa Anderson', 9108089000087, 89012, 'ACC-008-XYZ', 'Error'),
  (1009, 'REF-009', '2025-01-23', '11:45:00', 'Global Trust', 'James Taylor', 8209090000088, 90123, 'ACC-009-XYZ', 'New'),
  (1010, 'REF-010', '2025-01-24', '14:00:00', 'First National Bank', 'Patricia Martinez', 7310101000089, 12345, 'ACC-010-XYZ', 'New')
ON CONFLICT (customerno) DO NOTHING;