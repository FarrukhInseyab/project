/*
  # PDF Conversion Preferences

  1. Enhancements
    - Add user preferences for PDF conversion method
    - Support both CloudConvert and OnlyOffice for PDF generation
    - Implement method selection in the UI

  2. Benefits
    - User choice for PDF conversion method
    - Flexibility for different environments
    - Fallback mechanisms for reliability
*/

-- This migration is for documentation purposes only as the changes are in the application code

-- The following improvements have been made to PDF conversion:

-- 1. User preferences:
--    - Added pdf_conversion_method to user preferences
--    - Options: 'cloudconvert' or 'onlyoffice'
--    - UI for selecting preferred method

-- 2. Integration in conversion functions:
--    - Check user preferences before conversion
--    - Try preferred method first
--    - Fall back to alternative method if preferred fails

-- 3. Edge function support:
--    - Updated convert-to-pdf function to respect user preferences
--    - Added OnlyOffice conversion to document-api function

-- No database changes are required for this migration.