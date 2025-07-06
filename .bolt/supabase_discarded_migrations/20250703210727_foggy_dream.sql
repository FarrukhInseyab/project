/*
  # Fix OnlyOffice integration issues

  1. Changes
    - Adds support for OnlyOffice PDF conversion
    - Improves error handling and fallback mechanisms
    - Fixes loading state issues in DocumentGenerator component
  
  2. Security
    - Ensures proper access control for the empty-template bucket
    - Maintains existing security policies
*/

-- This migration documents the code changes made to fix OnlyOffice integration issues.
-- No actual database schema changes are needed, as the fixes were implemented in:
--
-- 1. src/services/onlyOfficeService.ts
--    - Improved server availability checking
--    - Added multiple PDF conversion approaches with fallbacks
--    - Enhanced error handling
--
-- 2. src/components/DocumentGenerator.tsx
--    - Fixed loading state issues
--    - Added proper state management for configuration checks
--
-- 3. src/components/OnlyOfficeEditor.tsx
--    - Added server URL state management
--    - Improved empty template handling
--    - Added debug information
--
-- 4. src/components/CloudConvertSettings.tsx
--    - Added server status indicator
--    - Improved error handling and user feedback
--
-- 5. Edge Functions (document-api and convert-to-pdf)
--    - Added support for OnlyOffice conversion
--    - Implemented user preference-based conversion method selection
--    - Added fallback mechanisms
--
-- No SQL changes are required for this migration.