/*
  # Edge Functions Documentation

  This migration documents the edge functions that need to be deployed separately.
  The actual function code is stored in the supabase/functions directory.

  1. Edge Functions
    - `ai-mapping` - AI-powered tag-column mapping
    - `document-api` - Document generation and management API
    - `convert-to-pdf` - PDF conversion service
*/

-- This is a documentation-only migration to track edge functions
-- The actual functions are deployed separately via the Supabase CLI or dashboard

/*
Function: ai-mapping
Description: AI-powered tag-column mapping for intelligent data integration
Endpoints:
  - GET /functions/v1/ai-mapping/available-columns
    Returns available columns from ProofofDebitAPI table
  
  - POST /functions/v1/ai-mapping/suggest-mappings
    Suggests mappings between template tags and database columns
    
  - POST /functions/v1/ai-mapping/save-mappings
    Saves mappings to the database
    
  - POST /functions/v1/ai-mapping/load-mapped-data
    Loads data using saved mappings
*/

/*
Function: document-api
Description: API for document generation and management
Endpoints:
  - POST /functions/v1/document-api/generate-document
    Generates a document based on template and customer data
    
  - GET /functions/v1/document-api/customer-data
    Retrieves customer data from ProofofDebitAPI
    
  - GET /functions/v1/document-api/templates
    Lists available templates
*/

/*
Function: convert-to-pdf
Description: Service for converting DOCX files to PDF using CloudConvert
Endpoints:
  - POST /functions/v1/convert-to-pdf
    Converts a DOCX file to PDF
*/

-- Note: The actual function code should be deployed separately
-- This migration serves as documentation for the required functions