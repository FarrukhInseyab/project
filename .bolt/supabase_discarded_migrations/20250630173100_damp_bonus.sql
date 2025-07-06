/*
  # RLS Fix for ProofofDebitAPI

  1. Security
    - Drop and recreate RLS policies for ProofofDebitAPI table
    - Ensure proper access to the table for document generation
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read current records" ON "ProofofDebitAPI";
DROP POLICY IF EXISTS "Allow authenticated users to read new records" ON "ProofofDebitAPI";
DROP POLICY IF EXISTS "Allow authenticated users to read processed records" ON "ProofofDebitAPI";
DROP POLICY IF EXISTS "Allow authenticated users to update record status" ON "ProofofDebitAPI";

-- Create improved RLS policies for ProofofDebitAPI
CREATE POLICY "Allow authenticated users to read current records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" = 'Current');

CREATE POLICY "Allow authenticated users to read new records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" = 'New');

CREATE POLICY "Allow authenticated users to read processed records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" IN ('Processed', 'Error'));

CREATE POLICY "Allow authenticated users to update record status" 
  ON "ProofofDebitAPI" FOR UPDATE TO authenticated 
  USING ("Status" = 'New')
  WITH CHECK ("Status" IN ('New', 'Current', 'Processed', 'Error'));