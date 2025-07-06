/*
  # Storage Buckets Configuration

  1. Storage Buckets
    - document-templates: For storing original document templates
    - generated-documents: For storing generated documents
  2. Storage Policies
    - Secure access controls for each bucket
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
  ('document-templates', 'Document Templates', false, false, 52428800, -- 50MB limit
    ARRAY[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.oasis.opendocument.text'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  avif_autodetection = EXCLUDED.avif_autodetection,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
  ('generated-documents', 'Generated Documents', false, false, 104857600, -- 100MB limit
    ARRAY[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.oasis.opendocument.text',
      'application/pdf',
      'text/plain'
    ]
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  avif_autodetection = EXCLUDED.avif_autodetection,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for document-templates bucket
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

-- Storage policies for generated-documents bucket
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