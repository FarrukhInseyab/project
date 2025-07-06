/*
  # Sample Data for Testing

  1. Content
    - Sample ProofofDebitAPI records
    - Sample user for testing

  2. Purpose
    - Provide test data for development
    - Demonstrate application functionality
*/

-- Insert sample data into ProofofDebitAPI
INSERT INTO "ProofofDebitAPI" (referenceno, date, time, bank, customername, nationalid, customerno, personalfinanceno, accountno, "Status")
VALUES
  ('REF001', '2025-01-15', '09:30:00', 'First National Bank', 'John Smith', 1234567890123, 1001, 5001, 'ACCT001', 'New'),
  ('REF002', '2025-01-16', '10:15:00', 'City Bank', 'Jane Doe', 2345678901234, 1002, 5002, 'ACCT002', 'New'),
  ('REF003', '2025-01-17', '11:00:00', 'Global Trust', 'Robert Johnson', 3456789012345, 1003, 5003, 'ACCT003', 'New'),
  ('REF004', '2025-01-18', '13:45:00', 'First National Bank', 'Sarah Williams', 4567890123456, 1004, 5004, 'ACCT004', 'New'),
  ('REF005', '2025-01-19', '14:30:00', 'City Bank', 'Michael Brown', 5678901234567, 1005, 5005, 'ACCT005', 'New'),
  ('REF006', '2025-01-20', '15:15:00', 'Global Trust', 'Emily Davis', 6789012345678, 1006, 5006, 'ACCT006', 'Current'),
  ('REF007', '2025-01-21', '16:00:00', 'First National Bank', 'David Miller', 7890123456789, 1007, 5007, 'ACCT007', 'Current'),
  ('REF008', '2025-01-22', '09:00:00', 'City Bank', 'Jennifer Wilson', 8901234567890, 1008, 5008, 'ACCT008', 'Current'),
  ('REF009', '2025-01-23', '10:30:00', 'Global Trust', 'James Taylor', 9012345678901, 1009, 5009, 'ACCT009', 'Processed'),
  ('REF010', '2025-01-24', '11:45:00', 'First National Bank', 'Linda Anderson', 1234567890124, 1010, 5010, 'ACCT010', 'Processed')
ON CONFLICT (customerno) DO NOTHING;

-- Note: We don't create sample users directly as that would require handling passwords securely
-- Users should be created through the auth API or Supabase dashboard