/*
  # Sample Data Setup

  1. Sample Data
    - ProofofDebitAPI sample records for testing
*/

-- Insert sample data into ProofofDebitAPI
INSERT INTO "ProofofDebitAPI" (referenceno, date, time, bank, customername, nationalid, customerno, personalfinanceno, accountno, "Status")
VALUES
  ('REF001', '2024-06-15', '09:30:00', 'First National Bank', 'John Smith', 8801015678123, 100001, 5001, 'ACC123456', 'New'),
  ('REF002', '2024-06-16', '10:15:00', 'City Bank', 'Sarah Johnson', 9203025432123, 100002, 5002, 'ACC234567', 'New'),
  ('REF003', '2024-06-17', '11:45:00', 'Metro Credit Union', 'Michael Brown', 8505075123456, 100003, 5003, 'ACC345678', 'New'),
  ('REF004', '2024-06-18', '14:20:00', 'First National Bank', 'Emily Davis', 9107085432123, 100004, 5004, 'ACC456789', 'New'),
  ('REF005', '2024-06-19', '16:00:00', 'Global Bank', 'Robert Wilson', 8609095123456, 100005, 5005, 'ACC567890', 'New'),
  ('REF006', '2024-06-20', '09:00:00', 'City Bank', 'Jennifer Lee', 9211105432123, 100006, 5006, 'ACC678901', 'Current'),
  ('REF007', '2024-06-21', '10:30:00', 'Metro Credit Union', 'David Martinez', 8701015123456, 100007, 5007, 'ACC789012', 'Current'),
  ('REF008', '2024-06-22', '13:15:00', 'Global Bank', 'Lisa Anderson', 9303025432123, 100008, 5008, 'ACC890123', 'Current'),
  ('REF009', '2024-06-23', '15:45:00', 'First National Bank', 'James Taylor', 8805075123456, 100009, 5009, 'ACC901234', 'Processed'),
  ('REF010', '2024-06-24', '17:30:00', 'City Bank', 'Patricia White', 9107085432123, 100010, 5010, 'ACC012345', 'Processed')
ON CONFLICT (customerno) DO NOTHING;