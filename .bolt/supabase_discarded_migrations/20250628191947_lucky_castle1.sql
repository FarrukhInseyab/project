/*
  # Sample Data for Document AI Studio

  1. Template Categories
    - Sample categories for organizing templates
  
  2. ProofofDebitAPI Sample Data
    - Sample records with different statuses for testing
*/

-- Insert sample template categories
INSERT INTO template_categories (name, description, color, icon, user_id)
SELECT 
    category_name,
    category_description,
    category_color,
    category_icon,
    auth.uid()
FROM (
    VALUES
        ('Contracts', 'Legal agreements and contracts', '#3B82F6', 'file-text'),
        ('Invoices', 'Billing and payment documents', '#10B981', 'credit-card'),
        ('Reports', 'Business and financial reports', '#8B5CF6', 'bar-chart-2'),
        ('Letters', 'Formal correspondence', '#F59E0B', 'mail'),
        ('Forms', 'Applications and data collection', '#EC4899', 'clipboard')
) AS sample_categories(category_name, category_description, category_color, category_icon)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT DO NOTHING;

-- Insert sample ProofofDebitAPI data
INSERT INTO "ProofofDebitAPI" (referenceno, date, time, bank, customername, nationalid, customerno, personalfinanceno, accountno, "Status")
VALUES
    ('REF001', '2025-01-15', '09:30:00', 'First National Bank', 'John Smith', 8801015678123, 100001, 5001, 'ACC123456', 'New'),
    ('REF002', '2025-01-16', '10:15:00', 'City Bank', 'Sarah Johnson', 9203025432123, 100002, 5002, 'ACC234567', 'New'),
    ('REF003', '2025-01-17', '11:45:00', 'Global Trust', 'Michael Brown', 8505075123456, 100003, 5003, 'ACC345678', 'New'),
    ('REF004', '2025-01-18', '14:30:00', 'First National Bank', 'Emily Davis', 9107085432123, 100004, 5004, 'ACC456789', 'Current'),
    ('REF005', '2025-01-19', '16:00:00', 'City Bank', 'Robert Wilson', 8609095123456, 100005, 5005, 'ACC567890', 'Current'),
    ('REF006', '2025-01-20', '09:00:00', 'Global Trust', 'Jennifer Lee', 9211105432123, 100006, 5006, 'ACC678901', 'Processed'),
    ('REF007', '2025-01-21', '10:30:00', 'First National Bank', 'David Miller', 8701015123456, 100007, 5007, 'ACC789012', 'Processed'),
    ('REF008', '2025-01-22', '13:15:00', 'City Bank', 'Lisa Taylor', 9303025432123, 100008, 5008, 'ACC890123', 'Error'),
    ('REF009', '2025-01-23', '15:45:00', 'Global Trust', 'James Anderson', 8805075123456, 100009, 5009, 'ACC901234', 'New'),
    ('REF010', '2025-01-24', '11:00:00', 'First National Bank', 'Patricia Thomas', 9107085432123, 100010, 5010, 'ACC012345', 'New')
ON CONFLICT (customerno) DO NOTHING;