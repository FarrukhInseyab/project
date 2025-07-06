/*
  # Create empty template bucket and upload template

  1. New Storage Bucket
    - Creates a new storage bucket called 'empty-template' for storing the empty DOCX template
    - Sets appropriate RLS policies for the bucket
  
  2. Security
    - Enables public access for authenticated users to read the empty template
    - Restricts write access to service role only
*/

-- Create the empty-template bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('empty-template', 'empty-template', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read from the empty-template bucket
CREATE POLICY "Allow authenticated users to read empty template" ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'empty-template');

-- Create policy to allow only service role to insert into the empty-template bucket
CREATE POLICY "Allow service role to insert into empty-template bucket" ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'empty-template');

-- Create policy to allow only service role to update objects in the empty-template bucket
CREATE POLICY "Allow service role to update objects in empty-template bucket" ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'empty-template');

-- Create policy to allow only service role to delete objects from the empty-template bucket
CREATE POLICY "Allow service role to delete from empty-template bucket" ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'empty-template');

-- Create a function to check if the empty template exists
CREATE OR REPLACE FUNCTION public.check_empty_template_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'empty-template' AND name = 'emptytemplate.docx'
  ) INTO template_exists;
  
  RETURN template_exists;
END;
$$;

-- Create a function to help with template version management
CREATE OR REPLACE FUNCTION public.template_version_has_mappings(p_template_id uuid, p_version integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_mappings boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM data_mappings
    WHERE template_id = p_template_id AND template_version = p_version
  ) INTO has_mappings;
  
  RETURN has_mappings;
END;
$$;

-- Create a function to get template version mappings
CREATE OR REPLACE FUNCTION public.get_template_version_mappings(p_template_id uuid, p_version integer)
RETURNS SETOF data_mappings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM data_mappings
  WHERE template_id = p_template_id AND template_version = p_version;
END;
$$;

-- Create a function to debug template mappings
CREATE OR REPLACE FUNCTION public.debug_template_mappings(p_template_id uuid)
RETURNS TABLE (
  template_id uuid,
  template_version integer,
  tag_name text,
  data_key text,
  mapping_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.template_id,
    dm.template_version,
    dm.tag_name,
    dm.data_key,
    COUNT(*) as mapping_count
  FROM data_mappings dm
  WHERE dm.template_id = p_template_id
  GROUP BY dm.template_id, dm.template_version, dm.tag_name, dm.data_key
  ORDER BY dm.template_version DESC, dm.tag_name;
END;
$$;