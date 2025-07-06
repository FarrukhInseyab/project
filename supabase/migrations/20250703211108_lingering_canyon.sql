/*
  # Edge Functions Configuration

  1. Edge Functions
    - Document API for external integrations
    - AI Mapping for intelligent tag-column mapping
    - Convert to PDF for document conversion

  2. Security
    - Configure proper permissions
*/

-- This migration is for documentation purposes only
-- Edge functions are deployed separately via the Supabase CLI or dashboard

-- The following edge functions are available:

-- 1. document-api
--    Endpoints:
--    - POST /generate-document - Generate document from template and customer data
--    - GET /customer-data - Get customer data by customer number
--    - GET /templates - List available templates
--    - POST /generate - Generate document from template and JSON data

-- 2. ai-mapping
--    Endpoints:
--    - GET /available-columns - Get available columns from ProofofDebitAPI
--    - POST /suggest-mappings - Suggest mappings between tags and columns
--    - POST /save-mappings - Save mappings to database
--    - POST /load-mapped-data - Load data using mappings

-- 3. convert-to-pdf
--    Endpoints:
--    - POST / - Convert DOCX to PDF using CloudConvert or OnlyOffice
--    - GET / - Get API info

-- Note: Edge functions are deployed separately and not part of the database migrations
-- They can be found in the supabase/functions directory