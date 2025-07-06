/*
  # Storage Buckets Configuration

  1. New Buckets
    - `document-templates` - For storing original document templates
    - `generated-documents` - For storing generated documents
    - `empty-template` - For storing empty template files for OnlyOffice

  2. Security
    - Configure RLS policies for each bucket
    - Set up appropriate access controls
*/

-- Create document-templates bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('document-templates', 'document-templates', false, false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Create generated-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('generated-documents', 'generated-documents', false, false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'text/plain'])
ON CONFLICT (id) DO NOTHING;

-- Create empty-template bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('empty-template', 'empty-template', true, false, 1048576, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for document-templates bucket
CREATE POLICY "Users can upload their own templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'document-templates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own templates"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'document-templates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own templates"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'document-templates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own templates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'document-templates' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Set up RLS policies for generated-documents bucket
CREATE POLICY "Users can upload their own generated documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'generated-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own generated documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'generated-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own generated documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'generated-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own generated documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'generated-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Set up RLS policies for empty-template bucket
CREATE POLICY "Everyone can read empty templates"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'empty-template');

CREATE POLICY "Service role can manage empty templates"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'empty-template')
WITH CHECK (bucket_id = 'empty-template');

-- Create empty template file in the empty-template bucket
-- This will be done via the application or manually in the Supabase dashboard