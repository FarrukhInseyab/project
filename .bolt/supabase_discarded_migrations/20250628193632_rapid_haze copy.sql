/*
  # Edge Functions Setup

  1. Edge Functions
    - `ai-mapping` - AI-powered tag-column mapping
    - `document-api` - API for document generation
    - `convert-to-pdf` - PDF conversion service
  
  2. Configuration
    - Set up function permissions
    - Configure environment variables
*/

-- This migration is for documentation purposes only
-- Edge functions are deployed separately via the Supabase CLI or dashboard
-- The SQL below is a placeholder to document the edge functions

/*
Edge Function: ai-mapping
Description: AI-powered tag-column mapping for document templates
Endpoints:
  - GET /functions/v1/ai-mapping/available-columns
  - POST /functions/v1/ai-mapping/suggest-mappings
  - POST /functions/v1/ai-mapping/save-mappings
  - POST /functions/v1/ai-mapping/load-mapped-data
*/

/*
Edge Function: document-api
Description: API for document generation and management
Endpoints:
  - POST /functions/v1/document-api/generate-document
  - GET /functions/v1/document-api/customer-data
  - GET /functions/v1/document-api/templates
*/

/*
Edge Function: convert-to-pdf
Description: Service for converting DOCX documents to PDF
Endpoints:
  - POST /functions/v1/convert-to-pdf
  - GET /functions/v1/convert-to-pdf
*/

-- Required environment variables for edge functions:
-- SUPABASE_URL: The URL of your Supabase project
-- SUPABASE_ANON_KEY: The anonymous key for your Supabase project
-- SUPABASE_SERVICE_ROLE_KEY: The service role key for your Supabase project
-- CLOUDCONVERT_API_KEY: API key for CloudConvert PDF conversion service