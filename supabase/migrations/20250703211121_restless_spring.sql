/*
  # Create Empty Template Bucket

  1. New Features
    - Add empty-template bucket for storing empty template files
    - Implement functions to access empty templates
    - Update OnlyOffice integration to use empty templates

  2. Benefits
    - More reliable document creation in OnlyOffice
    - Better fallback mechanisms for template creation
*/

-- This migration creates a storage bucket for empty templates
-- The bucket was already created in the storage_buckets.sql migration
-- This migration adds additional functionality for accessing empty templates

-- Create function to check if empty template exists
CREATE OR REPLACE FUNCTION check_empty_template_exists()
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM storage.objects 
    WHERE bucket_id = 'empty-template' AND name = 'emptytemplate.docx'
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get empty template URL
CREATE OR REPLACE FUNCTION get_empty_template_url()
RETURNS TEXT AS $$
DECLARE
  v_url TEXT;
BEGIN
  SELECT storage.create_signed_url('empty-template', 'emptytemplate.docx', 3600)
  INTO v_url;
  
  RETURN v_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update StorageService to include empty-template bucket
-- This is done in the application code, not in the database