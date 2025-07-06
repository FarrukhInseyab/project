/*
  # Document API Edge Function

  1. Function
    - Create document-api edge function
  
  2. Purpose
    - External API for document generation
    - Customer data retrieval
    - Template listing
*/

-- This migration is for documentation purposes only
-- The actual function code is in supabase/functions/document-api/index.ts

/*
Edge Function: document-api
Description: API for document generation and management

Endpoints:
  - POST /functions/v1/document-api/generate-document
    Generates a document based on a template and customer data
    
    Request:
    {
      "customerNo": "100001",
      "templateId": "uuid",
      "updateStatus": true,
      "outputFormat": "docx"
    }
    
    Response:
    Binary file download (DOCX or PDF)

  - GET /functions/v1/document-api/customer-data?customerNo=100001
    Retrieves customer data from the ProofofDebitAPI table
    
    Response:
    {
      "data": {
        "customerno": 100001,
        "customername": "John Smith",
        "accountno": "ACC123456",
        ...
      }
    }

  - GET /functions/v1/document-api/templates
    Retrieves all templates available to the authenticated user
    
    Response:
    {
      "data": [
        {
          "id": "uuid",
          "name": "Invoice Template",
          "description": "Standard invoice template",
          "original_filename": "invoice.docx",
          "updated_at": "2023-01-01T12:00:00Z"
        },
        ...
      ]
    }
*/