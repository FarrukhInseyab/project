/*
  # Storage Buckets Setup

  1. New Buckets
    - `document-templates` - For storing original document templates
    - `generated-documents` - For storing generated documents

  2. Security
    - Enable RLS on both buckets
    - Add appropriate policies for each bucket
*/

-- Create document-templates bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'document-templates',
  'document-templates',
  false,
  false,
  52428800, -- 50MB limit
  '{application/vnd.openxmlformats-officedocument.wordprocessingml.document}'
)
ON CONFLICT (id) DO NOTHING;

-- Create generated-documents bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'generated-documents',
  'generated-documents',
  false,
  false,
  104857600, -- 100MB limit
  '{application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf}'
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for document-templates bucket
CREATE POLICY "Users can upload templates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own templates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own templates"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own templates"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'document-templates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create RLS policies for generated-documents bucket
CREATE POLICY "Users can upload generated documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generated-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own generated documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'generated-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own generated documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'generated-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own generated documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'generated-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );