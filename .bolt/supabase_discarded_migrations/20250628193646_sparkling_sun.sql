/*
  # Sample Data

  1. Sample Records
    - Add sample ProofofDebitAPI records
    - Create default template categories
  
  2. Purpose
    - Provide initial data for testing
    - Demonstrate data structure
*/

-- Insert sample ProofofDebitAPI records
INSERT INTO "ProofofDebitAPI" (referenceno, date, time, bank, customername, nationalid, customerno, personalfinanceno, accountno, "Status")
VALUES
  ('REF001', '2025-06-15', '09:30:00', 'First National Bank', 'John Smith', 8801015000080, 100001, 500001, 'ACC123456', 'New'),
  ('REF002', '2025-06-16', '10:15:00', 'City Bank', 'Sarah Johnson', 9203025000081, 100002, 500002, 'ACC234567', 'New'),
  ('REF003', '2025-06-17', '11:45:00', 'Metro Credit Union', 'Michael Brown', 8504035000082, 100003, 500003, 'ACC345678', 'New'),
  ('REF004', '2025-06-18', '14:30:00', 'Global Finance', 'Emily Davis', 9105045000083, 100004, 500004, 'ACC456789', 'Current'),
  ('REF005', '2025-06-19', '16:00:00', 'United Bank', 'Robert Wilson', 8706055000084, 100005, 500005, 'ACC567890', 'Current'),
  ('REF006', '2025-06-20', '09:00:00', 'First National Bank', 'Jennifer Lee', 9307065000085, 100006, 500006, 'ACC678901', 'Processed'),
  ('REF007', '2025-06-21', '11:30:00', 'City Bank', 'David Martinez', 8808075000086, 100007, 500007, 'ACC789012', 'Processed'),
  ('REF008', '2025-06-22', '13:45:00', 'Metro Credit Union', 'Lisa Anderson', 9109085000087, 100008, 500008, 'ACC890123', 'Error'),
  ('REF009', '2025-06-23', '15:15:00', 'Global Finance', 'James Taylor', 8710095000088, 100009, 500009, 'ACC901234', 'New'),
  ('REF010', '2025-06-24', '10:00:00', 'United Bank', 'Patricia White', 9211105000089, 100010, 500010, 'ACC012345', 'New')
ON CONFLICT (customerno) DO NOTHING;

-- Note: Default template categories will be created by the application when users create their first category
-- This ensures each user has their own categories with proper user_id references