/*
  # Remove X-Frame-Options header for OnlyOffice compatibility

  1. Changes
    - Removes X-Frame-Options: SAMEORIGIN header from various configuration files
    - Enables embedding of the application in iframes for OnlyOffice integration
  
  2. Security
    - This change is necessary for OnlyOffice integration to work properly
    - The application will now be embeddable in iframes from any origin
    - Other security headers remain in place
*/

-- This migration documents the removal of X-Frame-Options header from:
--
-- 1. netlify.toml
-- 2. public/_headers
-- 3. vite.config.ts
--
-- This change is necessary to allow the application to be embedded in iframes
-- for OnlyOffice integration to work properly.
--
-- No actual database schema changes are needed for this migration.