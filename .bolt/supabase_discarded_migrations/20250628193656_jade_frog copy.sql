/*
  # AI Mapping Edge Function

  1. Function
    - Create ai-mapping edge function
  
  2. Purpose
    - AI-powered tag-column mapping
    - Smart data loading
*/

-- This migration is for documentation purposes only
-- The actual function code is in supabase/functions/ai-mapping/index.ts

/*
Edge Function: ai-mapping
Description: AI-powered tag-column mapping for document templates

Endpoints:
  - GET /functions/v1/ai-mapping/available-columns
    Returns available columns from ProofofDebitAPI table

  - POST /functions/v1/ai-mapping/suggest-mappings
    Suggests mappings between template tags and database columns
    
    Request:
    {
      "templateId": "uuid",
      "tags": [
        {
          "id": "uuid",
          "name": "tag_name",
          "display_name": "Tag Name"
        }
      ]
    }
    
    Response:
    {
      "data": [
        {
          "tag_id": "uuid",
          "tag_name": "tag_name",
          "display_name": "Tag Name",
          "column_name": "column_name",
          "column_type": "text",
          "confidence": 0.8,
          "is_manual": false,
          "sample_values": ["value1", "value2"]
        }
      ]
    }

  - POST /functions/v1/ai-mapping/save-mappings
    Saves mappings between template tags and database columns
    
    Request:
    {
      "templateId": "uuid",
      "templateVersion": 1,
      "mappings": [
        {
          "tag_name": "tag_name",
          "column_name": "column_name",
          "confidence": 0.8,
          "is_manual": false
        }
      ]
    }
    
    Response:
    {
      "success": true,
      "message": "Saved 5 mappings for template uuid version 1"
    }

  - POST /functions/v1/ai-mapping/load-mapped-data
    Loads data from ProofofDebitAPI using saved mappings
    
    Request:
    {
      "templateId": "uuid",
      "templateVersion": 1
    }
    
    Response:
    {
      "data": {
        "tag_name1": ["value1", "value2"],
        "tag_name2": ["value3", "value4"]
      },
      "customerNumbers": ["100001", "100002"],
      "recordCount": 2
    }
*/