/*
  # Storage Buckets Setup

  1. New Buckets
    - `document-templates` - For storing original document templates
    - `generated-documents` - For storing generated documents
  
  2. Security
    - Set up RLS policies for buckets
    - Configure public access settings
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('document-templates', 'Document Templates', false, 52428800, '{application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword}'),
  ('generated-documents', 'Generated Documents', false, 104857600, '{application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/pdf}')
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for document-templates bucket
CREATE POLICY "Users can upload templates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own templates"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own templates"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own templates"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Set up RLS policies for generated-documents bucket
CREATE POLICY "Users can upload generated documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generated-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own generated documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own generated documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'generated-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );