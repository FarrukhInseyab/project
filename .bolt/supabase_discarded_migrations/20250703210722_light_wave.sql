/*
  # Update regex pattern for tag extraction

  1. Changes
    - Updates the regex pattern used for extracting tags from documents
    - Improves the pattern to better handle special characters and edge cases
  
  2. Affected Components
    - Document API function
    - Convert to PDF function
    - Document utilities
*/

-- This migration doesn't require database changes, but documents the regex pattern update
-- that was made in the application code:
-- 
-- Old pattern: /£[^£]*£/g
-- New pattern: /£([^£]+)£/g
--
-- The new pattern uses capturing groups for better extraction and is more robust
-- when handling special characters within tags.
--
-- This change affects:
-- 1. document-api function
-- 2. convert-to-pdf function
-- 3. documentUtils.ts in the frontend code
--
-- No actual SQL changes are needed for this migration.