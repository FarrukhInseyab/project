/*
  # Fix Regex Pattern for Tag Extraction

  1. Changes
    - Update the regex pattern used for tag extraction to be more robust
    - Improve handling of special characters in tags

  2. Benefits
    - More reliable tag extraction
    - Better handling of complex documents
*/

-- This migration is for documentation purposes only as the changes are in the application code

-- The regex pattern for extracting tags has been updated from:
-- /£[^£]*£/g
-- to:
-- /£([^£]+)£/g

-- This change improves the extraction of tags with special characters and ensures
-- that the capture group only contains the tag content, not the £ symbols.

-- The updated pattern is used in the following files:
-- - src/utils/documentUtils.ts
-- - supabase/functions/document-api/index.ts
-- - supabase/functions/convert-to-pdf/index.ts

-- No database changes are required for this migration.