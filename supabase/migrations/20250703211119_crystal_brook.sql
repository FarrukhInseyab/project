/*
  # Remove X-Frame-Options Header

  1. Changes
    - Remove the X-Frame-Options header from the application
    - Update security headers in Netlify configuration

  2. Benefits
    - Allows OnlyOffice editor to be embedded in iframes
    - Fixes integration issues with OnlyOffice
*/

-- This migration is for documentation purposes only as the changes are in the application code

-- The X-Frame-Options header has been removed from:
-- - netlify.toml
-- - public/_headers
-- - vite.config.ts

-- This change allows the OnlyOffice editor to be embedded in iframes, which is
-- necessary for the editor to function properly.

-- No database changes are required for this migration.