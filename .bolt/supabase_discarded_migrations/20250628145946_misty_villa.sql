/*
  # Complete Document AI Studio System Migration

  This migration script sets up the entire Document AI Studio system including:
  
  1. Database Schema
    - User profiles and preferences
    - Document templates with versioning
    - Template tags and categories
    - Data mappings for AI-powered tag extraction
    - Document generations tracking
    - User activity logging
    - Template sharing and collaboration
    - ProofofDebitAPI integration
  
  2. Security
    - Row Level Security (RLS) policies for all tables
    - User isolation and data protection
    - Secure file access controls
    - Permission-based sharing
  
  3. Storage
    - Document templates bucket
    - Generated documents bucket
    - Proper access policies
  
  4. Functions
    - Template versioning and management
    - Data mapping and AI suggestions
    - Activity tracking
    - Performance optimization
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- TABLES
-- =============================================

-- User profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  company text,
  role text,
  preferences jsonb DEFAULT '{}',
  subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Template categories table
CREATE TABLE IF NOT EXISTS template_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'folder',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Document templates table
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES template_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  original_filename text NOT NULL,
  document_content text NOT NULL,
  document_html text NOT NULL,
  file_size bigint DEFAULT 0,
  file_type text DEFAULT 'docx',
  version integer DEFAULT 1,
  is_default boolean DEFAULT false,
  is_public boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  preview_image_url text,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  metadata jsonb DEFAULT '{}',
  search_vector tsvector,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  storage_path text,
  current_version integer DEFAULT 1,
  total_versions integer DEFAULT 1
);

-- Template versions table
CREATE TABLE IF NOT EXISTS template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES document_templates(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  name text NOT NULL,
  description text,
  original_filename text NOT NULL,
  document_content text NOT NULL,
  document_html text NOT NULL,
  file_size bigint DEFAULT 0,
  storage_path text,
  is_current boolean DEFAULT false,
  version_notes text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  
  -- Ensure only one current version per template
  UNIQUE(template_id, version_number),
  -- Ensure only one current version is marked as current
  EXCLUDE (template_id WITH =) WHERE (is_current = true)
);

-- Template tags table
CREATE TABLE IF NOT EXISTS template_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES document_templates(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  display_name text NOT NULL,
  description text,
  expected_value text,
  data_type text DEFAULT 'text' CHECK (data_type IN ('text', 'number', 'date', 'email', 'phone', 'url', 'boolean')),
  is_required boolean DEFAULT false,
  default_value text,
  validation_rules jsonb DEFAULT '{}',
  position_start integer,
  position_end integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(template_id, name)
);

-- Document generations table (history of generated documents)
CREATE TABLE IF NOT EXISTS document_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES document_templates(id) ON DELETE CASCADE,
  generation_type text DEFAULT 'single' CHECK (generation_type IN ('single', 'batch')),
  documents_count integer DEFAULT 1,
  input_data jsonb NOT NULL,
  output_filenames text[] DEFAULT '{}',
  file_urls text[] DEFAULT '{}',
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  processing_time_ms integer,
  file_size_total bigint DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  storage_path text
);

-- Data mappings table (for AI-powered mapping suggestions)
CREATE TABLE IF NOT EXISTS data_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES document_templates(id) ON DELETE CASCADE NOT NULL,
  tag_name text NOT NULL,
  data_key text NOT NULL,
  mapping_confidence decimal(3,2) DEFAULT 0.0,
  is_manual boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  template_version integer DEFAULT 1,
  CONSTRAINT data_mappings_template_version_unique UNIQUE (template_id, template_version, tag_name, data_key)
);

-- User activity table (for analytics and tracking)
CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN (
    'template_created', 'template_updated', 'template_deleted', 'template_used',
    'document_generated', 'data_imported', 'tag_created', 'tag_updated',
    'category_created', 'login', 'export_data'
  )),
  resource_type text CHECK (resource_type IN ('template', 'document', 'tag', 'category', 'user')),
  resource_id uuid,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Template sharing table (for collaboration)
CREATE TABLE IF NOT EXISTS template_sharing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES document_templates(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_with_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email text,
  permission_level text DEFAULT 'view' CHECK (permission_level IN ('view', 'edit', 'admin')),
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  access_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(template_id, shared_with_id),
  UNIQUE(template_id, shared_with_email)
);

-- ProofofDebitAPI table (for external data integration)
CREATE TABLE IF NOT EXISTS "ProofofDebitAPI" (
  referenceno text,
  date text,
  time text,
  bank text,
  customername text,
  nationalid bigint,
  customerno bigint PRIMARY KEY,
  personalfinanceno bigint,
  accountno text,
  "Status" text
);

-- =============================================
-- INDEXES
-- =============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Document templates indexes
CREATE INDEX IF NOT EXISTS idx_document_templates_user_id ON document_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_category_id ON document_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_search ON document_templates USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_document_templates_name ON document_templates USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_templates_storage_path ON document_templates(storage_path) WHERE storage_path IS NOT NULL;

-- Template versions indexes
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_version_number ON template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_template_versions_current ON template_versions(template_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON template_versions(created_at DESC);

-- Template tags indexes
CREATE INDEX IF NOT EXISTS idx_template_tags_template_id ON template_tags(template_id);
CREATE INDEX IF NOT EXISTS idx_template_tags_name ON template_tags(name);

-- Document generations indexes
CREATE INDEX IF NOT EXISTS idx_document_generations_user_id ON document_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_template_id ON document_generations(template_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_created_at ON document_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_generations_storage_path ON document_generations(storage_path) WHERE storage_path IS NOT NULL;

-- Data mappings indexes
CREATE INDEX IF NOT EXISTS idx_data_mappings_template_id ON data_mappings(template_id);
CREATE INDEX IF NOT EXISTS idx_data_mappings_template_version ON data_mappings(template_id, template_version);

-- User activity indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

-- Template sharing indexes
CREATE INDEX IF NOT EXISTS idx_template_sharing_template_id ON template_sharing(template_id);
CREATE INDEX IF NOT EXISTS idx_template_sharing_shared_with ON template_sharing(shared_with_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update template search vector
CREATE OR REPLACE FUNCTION update_template_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.original_filename, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create initial template version
CREATE OR REPLACE FUNCTION create_initial_template_version()
RETURNS trigger AS $$
BEGIN
  -- Only create initial version for new templates
  IF TG_OP = 'INSERT' THEN
    INSERT INTO template_versions (
      template_id,
      user_id,
      version_number,
      name,
      description,
      original_filename,
      document_content,
      document_html,
      file_size,
      storage_path,
      is_current,
      version_notes,
      created_by_user_id,
      metadata
    ) VALUES (
      NEW.id,
      NEW.user_id,
      1,
      NEW.name,
      NEW.description,
      NEW.original_filename,
      NEW.document_content,
      NEW.document_html,
      NEW.file_size,
      NEW.storage_path,
      true,
      'Initial version',
      NEW.user_id,
      jsonb_build_object('is_initial', true)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.document_templates
  SET
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE
    id = template_id;
END;
$$;

-- Function to create a new template version
CREATE OR REPLACE FUNCTION create_template_version(
  p_template_id uuid,
  p_original_filename text,
  p_document_content text,
  p_document_html text,
  p_file_size bigint,
  p_storage_path text,
  p_version_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_template_record record;
  v_new_version_number integer;
  v_version_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get template info and verify ownership
  SELECT * INTO v_template_record
  FROM document_templates
  WHERE id = p_template_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  -- Calculate new version number
  v_new_version_number := COALESCE(v_template_record.total_versions, 0) + 1;

  -- Mark all existing versions as not current
  UPDATE template_versions
  SET is_current = false
  WHERE template_id = p_template_id;

  -- Create new version record
  INSERT INTO template_versions (
    template_id,
    user_id,
    version_number,
    name,
    description,
    original_filename,
    document_content,
    document_html,
    file_size,
    storage_path,
    is_current,
    version_notes,
    created_by_user_id,
    metadata
  ) VALUES (
    p_template_id,
    v_user_id,
    v_new_version_number,
    v_template_record.name,
    v_template_record.description,
    p_original_filename,
    p_document_content,
    p_document_html,
    p_file_size,
    p_storage_path,
    true,
    p_version_notes,
    v_user_id,
    jsonb_build_object(
      'previous_version', v_template_record.current_version,
      'file_size_change', p_file_size - COALESCE(v_template_record.file_size, 0),
      'updated_at', now()
    )
  ) RETURNING id INTO v_version_id;

  -- Update main template record
  UPDATE document_templates
  SET
    original_filename = p_original_filename,
    document_content = p_document_content,
    document_html = p_document_html,
    file_size = p_file_size,
    storage_path = p_storage_path,
    current_version = v_new_version_number,
    total_versions = v_new_version_number,
    updated_at = now()
  WHERE id = p_template_id;

  RETURN v_version_id;
END;
$$;

-- Function to rollback to a specific version
CREATE OR REPLACE FUNCTION rollback_template_version(
  p_template_id uuid,
  p_version_number integer,
  p_rollback_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_version_record record;
  v_template_record record;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get the version to rollback to
  SELECT tv.*, dt.user_id as template_owner_id
  INTO v_version_record
  FROM template_versions tv
  JOIN document_templates dt ON tv.template_id = dt.id
  WHERE tv.template_id = p_template_id 
    AND tv.version_number = p_version_number
    AND dt.user_id = v_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version not found or access denied';
  END IF;

  -- Get current template record
  SELECT * INTO v_template_record
  FROM document_templates
  WHERE id = p_template_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  -- Mark all versions as not current
  UPDATE template_versions
  SET is_current = false
  WHERE template_id = p_template_id;

  -- Mark the rollback target version as current
  UPDATE template_versions
  SET is_current = true,
      metadata = metadata || jsonb_build_object(
        'rollback_date', now(),
        'rollback_notes', p_rollback_notes,
        'rollback_by', v_user_id
      )
  WHERE template_id = p_template_id AND version_number = p_version_number;

  -- Update the main template record with the rollback version content
  UPDATE document_templates
  SET
    original_filename = v_version_record.original_filename,
    document_content = v_version_record.document_content,
    document_html = v_version_record.document_html,
    file_size = v_version_record.file_size,
    storage_path = v_version_record.storage_path,
    current_version = p_version_number,
    updated_at = now(),
    metadata = metadata || jsonb_build_object(
      'last_rollback', now(),
      'rollback_to_version', p_version_number,
      'rollback_notes', p_rollback_notes
    )
  WHERE id = p_template_id;

  -- Return the template ID (not a new version ID since we're not creating one)
  RETURN p_template_id;
END;
$$;

-- Function to get version history for a template
CREATE OR REPLACE FUNCTION get_template_version_history(p_template_id uuid)
RETURNS TABLE (
  version_id uuid,
  version_number integer,
  is_current boolean,
  original_filename text,
  file_size bigint,
  version_notes text,
  created_by_email text,
  created_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify template ownership
  IF NOT EXISTS (
    SELECT 1 FROM document_templates 
    WHERE id = p_template_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  -- Return version history
  RETURN QUERY
  SELECT 
    tv.id,
    tv.version_number,
    tv.is_current,
    tv.original_filename,
    tv.file_size,
    tv.version_notes,
    COALESCE(p.email, 'Unknown') as created_by_email,
    tv.created_at,
    tv.metadata
  FROM template_versions tv
  LEFT JOIN auth.users u ON tv.created_by_user_id = u.id
  LEFT JOIN profiles p ON u.id = p.user_id
  WHERE tv.template_id = p_template_id
  ORDER BY tv.version_number DESC;
END;
$$;

-- Function to check if a template version has mappings
CREATE OR REPLACE FUNCTION template_version_has_mappings(
  p_template_id uuid,
  p_version integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapping_count integer;
BEGIN
  SELECT COUNT(dm.id)
  INTO mapping_count
  FROM data_mappings dm
  WHERE dm.template_id = p_template_id 
    AND dm.template_version = p_version
    AND dm.user_id = auth.uid();
    
  RETURN mapping_count > 0;
END;
$$;

-- Function to get mappings for a specific template version
CREATE OR REPLACE FUNCTION get_template_version_mappings(
  p_template_id uuid,
  p_version integer
)
RETURNS TABLE (
  id uuid,
  template_id uuid,
  template_version integer,
  tag_name text,
  data_key text,
  mapping_confidence numeric,
  is_manual boolean,
  is_verified boolean,
  usage_count integer,
  last_used_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.id,
    dm.template_id,
    dm.template_version,
    dm.tag_name,
    dm.data_key,
    dm.mapping_confidence,
    dm.is_manual,
    dm.is_verified,
    dm.usage_count,
    dm.last_used_at,
    dm.created_at,
    dm.updated_at
  FROM data_mappings dm
  WHERE dm.template_id = p_template_id 
    AND dm.template_version = p_version
    AND dm.user_id = auth.uid();
END;
$$;

-- Function to debug template mappings
CREATE OR REPLACE FUNCTION debug_template_mappings(
  p_template_id uuid
)
RETURNS TABLE (
  id uuid,
  template_id uuid,
  template_version integer,
  tag_name text,
  data_key text,
  mapping_confidence numeric,
  is_manual boolean,
  is_verified boolean,
  usage_count integer,
  last_used_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.id,
    dm.template_id,
    dm.template_version,
    dm.tag_name,
    dm.data_key,
    dm.mapping_confidence,
    dm.is_manual,
    dm.is_verified,
    dm.usage_count,
    dm.last_used_at,
    dm.created_at,
    dm.updated_at
  FROM data_mappings dm
  WHERE dm.template_id = p_template_id 
    AND dm.user_id = auth.uid()
  ORDER BY dm.template_version DESC, dm.created_at DESC;
END;
$$;

-- Function to see all mappings for the current user
CREATE OR REPLACE FUNCTION debug_all_mappings()
RETURNS TABLE (
  user_id uuid,
  template_id uuid,
  template_name text,
  template_version integer,
  tag_name text,
  data_key text,
  mapping_confidence numeric,
  is_manual boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Return all mappings for the current user with template names
  RETURN QUERY
  SELECT 
    dm.user_id,
    dm.template_id,
    dt.name as template_name,
    dm.template_version,
    dm.tag_name,
    dm.data_key,
    dm.mapping_confidence,
    dm.is_manual,
    dm.created_at
  FROM data_mappings dm
  JOIN document_templates dt ON dm.template_id = dt.id
  WHERE dm.user_id = v_user_id
  ORDER BY dm.created_at DESC;
END;
$$;

-- Function to count mappings by template
CREATE OR REPLACE FUNCTION count_mappings_by_template()
RETURNS TABLE (
  template_id uuid,
  template_name text,
  version_1_count bigint,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Return mapping counts by template
  RETURN QUERY
  SELECT 
    dt.id as template_id,
    dt.name as template_name,
    COALESCE(v1.count, 0) as version_1_count,
    COALESCE(total.count, 0) as total_count
  FROM document_templates dt
  LEFT JOIN (
    SELECT dm1.template_id, COUNT(*) as count
    FROM data_mappings dm1
    WHERE dm1.user_id = v_user_id AND dm1.template_version = 1
    GROUP BY dm1.template_id
  ) v1 ON dt.id = v1.template_id
  LEFT JOIN (
    SELECT dm2.template_id, COUNT(*) as count
    FROM data_mappings dm2
    WHERE dm2.user_id = v_user_id
    GROUP BY dm2.template_id
  ) total ON dt.id = total.template_id
  WHERE dt.user_id = v_user_id
  ORDER BY dt.created_at DESC;
END;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Profiles updated_at trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Template categories updated_at trigger
CREATE TRIGGER update_template_categories_updated_at
  BEFORE UPDATE ON template_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Document templates updated_at trigger
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Document templates search vector trigger
CREATE TRIGGER update_template_search_vector_trigger
  BEFORE INSERT OR UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_template_search_vector();

-- Template tags updated_at trigger
CREATE TRIGGER update_template_tags_updated_at
  BEFORE UPDATE ON template_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data mappings updated_at trigger
CREATE TRIGGER update_data_mappings_updated_at
  BEFORE UPDATE ON data_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Template sharing updated_at trigger
CREATE TRIGGER update_template_sharing_updated_at
  BEFORE UPDATE ON template_sharing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create initial version trigger
CREATE TRIGGER create_initial_version_trigger
  AFTER INSERT ON document_templates
  FOR EACH ROW EXECUTE FUNCTION create_initial_template_version();

-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  (
    'document-templates', 
    'document-templates', 
    false, 
    52428800, -- 50MB limit
    ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
  ),
  (
    'generated-documents', 
    'generated-documents', 
    false, 
    52428800, -- 50MB limit
    ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf']
  )
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProofofDebitAPI" ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile during signup"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Template categories policies
CREATE POLICY "Users can manage own categories"
  ON template_categories FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Document templates policies
CREATE POLICY "Users can manage own templates"
  ON document_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view public templates"
  ON document_templates FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can view shared templates"
  ON document_templates FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT template_id FROM template_sharing 
      WHERE shared_with_id = auth.uid() 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- Template versions policies
CREATE POLICY "Users can view versions of own templates"
  ON template_versions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create versions for own templates"
  ON template_versions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND created_by_user_id = auth.uid());

CREATE POLICY "Users can update versions of own templates"
  ON template_versions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete versions of own templates"
  ON template_versions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Template tags policies
CREATE POLICY "Users can manage tags for own templates"
  ON template_tags FOR ALL
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM document_templates WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM document_templates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view tags for accessible templates"
  ON template_tags FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id FROM document_templates 
      WHERE user_id = auth.uid() 
      OR is_public = true
      OR id IN (
        SELECT template_id FROM template_sharing 
        WHERE shared_with_id = auth.uid() 
        AND is_active = true 
        AND (expires_at IS NULL OR expires_at > now())
      )
    )
  );

-- Document generations policies
CREATE POLICY "Users can manage own generations"
  ON document_generations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Data mappings policies
CREATE POLICY "Users can manage own mappings"
  ON data_mappings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User activity policies
CREATE POLICY "Users can view own activity"
  ON user_activity FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity"
  ON user_activity FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Template sharing policies
CREATE POLICY "Users can manage sharing for own templates"
  ON template_sharing FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view templates shared with them"
  ON template_sharing FOR SELECT
  TO authenticated
  USING (auth.uid() = shared_with_id);

-- ProofofDebitAPI policies
CREATE POLICY "Allow authenticated users to read new records"
  ON "ProofofDebitAPI"
  FOR SELECT
  TO authenticated
  USING ("Status" = 'New');

CREATE POLICY "Allow authenticated users to read current records"
  ON "ProofofDebitAPI"
  FOR SELECT
  TO authenticated
  USING ("Status" = 'Current');

CREATE POLICY "Allow authenticated users to read processed records"
  ON "ProofofDebitAPI"
  FOR SELECT
  TO authenticated
  USING ("Status" IN ('Processed', 'Error'));

CREATE POLICY "Allow authenticated users to update record status"
  ON "ProofofDebitAPI"
  FOR UPDATE
  TO authenticated
  USING ("Status" = 'New')
  WITH CHECK ("Status" IN ('New', 'Current', 'Processed', 'Error'));

-- =============================================
-- STORAGE POLICIES
-- =============================================

-- Storage policies for document-templates bucket
CREATE POLICY "Users can upload template files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'document-templates' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view template files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'document-templates' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update template files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'document-templates' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete template files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'document-templates' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policies for generated-documents bucket
CREATE POLICY "Users can upload generated files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view generated files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete generated files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-documents' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =============================================
-- PERMISSIONS
-- =============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_template_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_template_version(uuid, text, text, text, bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_template_version(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_template_version_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION template_version_has_mappings(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_template_version_mappings(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_template_mappings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_all_mappings() TO authenticated;
GRANT EXECUTE ON FUNCTION count_mappings_by_template() TO authenticated;