/*
  # RLS Policy Fix for ProofofDebitAPI

  1. Purpose
    - Fix RLS policies for ProofofDebitAPI table
    - Ensure proper access to all records
  
  2. Changes
    - Drop existing policies
    - Create new policies with proper access controls
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read current records" ON "ProofofDebitAPI";
DROP POLICY IF EXISTS "Allow authenticated users to read new records" ON "ProofofDebitAPI";
DROP POLICY IF EXISTS "Allow authenticated users to read processed records" ON "ProofofDebitAPI";
DROP POLICY IF EXISTS "Allow authenticated users to update record status" ON "ProofofDebitAPI";

-- Create new policies with proper access
CREATE POLICY "Allow authenticated users to read all records"
  ON "ProofofDebitAPI"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update any record"
  ON "ProofofDebitAPI"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);