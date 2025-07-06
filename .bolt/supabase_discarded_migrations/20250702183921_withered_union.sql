/*
  # Complete Database Schema

  1. Extensions
    - Enables necessary PostgreSQL extensions
  2. Trigger Functions
    - Functions for updating timestamps, search vectors, and template management
  3. Tables
    - All application tables with proper relationships
  4. Indexes
    - Performance optimizations
  5. Triggers
    - Automated actions
  6. Row Level Security
    - Security policies for all tables
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- TRIGGER FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update template search vector
CREATE OR REPLACE FUNCTION update_template_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', 
    coalesce(NEW.name, '') || ' ' || 
    coalesce(NEW.description, '') || ' ' || 
    coalesce(NEW.original_filename, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create initial template version
CREATE OR REPLACE FUNCTION create_initial_template_version()
RETURNS TRIGGER AS $$
BEGIN
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
    created_by_user_id,
    metadata
  ) VALUES (
    NEW.id,
    NEW.user_id,
    1, -- Initial version is always 1
    NEW.name,
    NEW.description,
    NEW.original_filename,
    NEW.document_content,
    NEW.document_html,
    NEW.file_size,
    NEW.storage_path,
    TRUE, -- First version is current
    NEW.user_id,
    jsonb_build_object('is_initial', true)
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check if template version has mappings
CREATE OR REPLACE FUNCTION template_version_has_mappings(p_template_id uuid, p_version integer)
RETURNS boolean AS $$
DECLARE
  mapping_count integer;
BEGIN
  SELECT COUNT(*) INTO mapping_count
  FROM data_mappings
  WHERE template_id = p_template_id AND template_version = p_version;
  
  RETURN mapping_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get template version mappings
CREATE OR REPLACE FUNCTION get_template_version_mappings(p_template_id uuid, p_version integer)
RETURNS SETOF data_mappings AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM data_mappings
  WHERE template_id = p_template_id AND template_version = p_version;
END;
$$ LANGUAGE plpgsql;

-- Function to debug template mappings
CREATE OR REPLACE FUNCTION debug_template_mappings(p_template_id uuid)
RETURNS TABLE (
  template_id uuid,
  template_version integer,
  tag_name text,
  data_key text,
  mapping_count integer
) AS $$
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
$$ LANGUAGE plpgsql;

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
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_next_version integer;
  v_version_id uuid;
  v_template_name text;
  v_template_description text;
  v_email text;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  -- Get user email for tracking
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  
  -- Get template info
  SELECT name, description INTO v_template_name, v_template_description
  FROM document_templates
  WHERE id = p_template_id;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM template_versions
  WHERE template_id = p_template_id;
  
  -- Set all existing versions to not current
  UPDATE template_versions
  SET is_current = FALSE
  WHERE template_id = p_template_id AND is_current = TRUE;
  
  -- Create new version
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
    v_next_version,
    v_template_name,
    v_template_description,
    p_original_filename,
    p_document_content,
    p_document_html,
    p_file_size,
    p_storage_path,
    TRUE, -- New version is current
    p_version_notes,
    v_user_id,
    jsonb_build_object(
      'created_by_email', v_email,
      'file_size_change', p_file_size - (
        SELECT file_size FROM template_versions 
        WHERE template_id = p_template_id AND version_number = v_next_version - 1
        LIMIT 1
      )
    )
  )
  RETURNING id INTO v_version_id;
  
  -- Update template with new content and version info
  UPDATE document_templates
  SET 
    document_content = p_document_content,
    document_html = p_document_html,
    original_filename = p_original_filename,
    file_size = p_file_size,
    storage_path = p_storage_path,
    current_version = v_next_version,
    total_versions = v_next_version,
    updated_at = now()
  WHERE id = p_template_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rollback to a specific version
CREATE OR REPLACE FUNCTION rollback_template_version(
  p_template_id uuid,
  p_version_number integer,
  p_rollback_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_version_id uuid;
  v_document_content text;
  v_document_html text;
  v_original_filename text;
  v_file_size bigint;
  v_storage_path text;
  v_email text;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  -- Get user email for tracking
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  
  -- Get version data
  SELECT 
    id, document_content, document_html, original_filename, file_size, storage_path
  INTO 
    v_version_id, v_document_content, v_document_html, v_original_filename, v_file_size, v_storage_path
  FROM template_versions
  WHERE template_id = p_template_id AND version_number = p_version_number;
  
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Version % not found for template %', p_version_number, p_template_id;
  END IF;
  
  -- Set all versions to not current
  UPDATE template_versions
  SET is_current = FALSE
  WHERE template_id = p_template_id;
  
  -- Set the rollback version to current
  UPDATE template_versions
  SET 
    is_current = TRUE,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{is_rollback}',
      'true'::jsonb
    )
  WHERE id = v_version_id;
  
  -- Update template with rollback content
  UPDATE document_templates
  SET 
    document_content = v_document_content,
    document_html = v_document_html,
    original_filename = v_original_filename,
    file_size = v_file_size,
    storage_path = v_storage_path,
    current_version = p_version_number,
    updated_at = now(),
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{last_rollback}',
      jsonb_build_object(
        'from_version', (SELECT current_version FROM document_templates WHERE id = p_template_id),
        'to_version', p_version_number,
        'timestamp', now(),
        'user_id', v_user_id,
        'notes', p_rollback_notes
      )
    )
  WHERE id = p_template_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get template version history
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
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tv.id as version_id,
    tv.version_number,
    tv.is_current,
    tv.original_filename,
    tv.file_size,
    tv.version_notes,
    (SELECT email FROM auth.users WHERE id = tv.created_by_user_id) as created_by_email,
    tv.created_at,
    tv.metadata
  FROM template_versions tv
  WHERE tv.template_id = p_template_id
  ORDER BY tv.version_number DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE document_templates
  SET 
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TABLES
-- =============================================

-- Users table (profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  company text,
  role text,
  preferences jsonb DEFAULT '{}'::jsonb,
  subscription_tier text DEFAULT 'free'::text CHECK (subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Template categories
CREATE TABLE IF NOT EXISTS template_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6'::text,
  icon text DEFAULT 'folder'::text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Document templates
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES template_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  original_filename text NOT NULL,
  document_content text NOT NULL,
  document_html text NOT NULL,
  file_size bigint DEFAULT 0,
  file_type text DEFAULT 'docx'::text,
  version integer DEFAULT 1,
  is_default boolean DEFAULT false,
  is_public boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  preview_image_url text,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  search_vector tsvector,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  storage_path text,
  current_version integer DEFAULT 1,
  total_versions integer DEFAULT 1
);

-- Template versions
CREATE TABLE IF NOT EXISTS template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, version_number),
  EXCLUDE USING btree (template_id WITH =) WHERE (is_current = true)
);

-- Template tags
CREATE TABLE IF NOT EXISTS template_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  description text,
  expected_value text,
  data_type text DEFAULT 'text'::text CHECK (data_type = ANY (ARRAY['text'::text, 'number'::text, 'date'::text, 'email'::text, 'phone'::text, 'url'::text, 'boolean'::text])),
  is_required boolean DEFAULT false,
  default_value text,
  validation_rules jsonb DEFAULT '{}'::jsonb,
  position_start integer,
  position_end integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(template_id, name)
);

-- Template sharing
CREATE TABLE IF NOT EXISTS template_sharing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email text,
  permission_level text DEFAULT 'view'::text CHECK (permission_level = ANY (ARRAY['view'::text, 'edit'::text, 'admin'::text])),
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  access_count integer DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(template_id, shared_with_id),
  UNIQUE(template_id, shared_with_email)
);

-- Data mappings
CREATE TABLE IF NOT EXISTS data_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  data_key text NOT NULL,
  mapping_confidence numeric(3,2) DEFAULT 0.0,
  is_manual boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  template_version integer DEFAULT 1,
  UNIQUE(template_id, template_version, tag_name, data_key)
);

-- Document generations
CREATE TABLE IF NOT EXISTS document_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES document_templates(id) ON DELETE CASCADE,
  generation_type text DEFAULT 'single'::text CHECK (generation_type = ANY (ARRAY['single'::text, 'batch'::text])),
  documents_count integer DEFAULT 1,
  input_data jsonb NOT NULL,
  output_filenames text[] DEFAULT '{}'::text[],
  file_urls text[] DEFAULT '{}'::text[],
  status text DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  error_message text,
  processing_time_ms integer,
  file_size_total bigint DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  storage_path text
);

-- User activity
CREATE TABLE IF NOT EXISTS user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['template_created'::text, 'template_updated'::text, 'template_deleted'::text, 'template_used'::text, 'document_generated'::text, 'data_imported'::text, 'tag_created'::text, 'tag_updated'::text, 'category_created'::text, 'login'::text, 'export_data'::text])),
  resource_type text CHECK (resource_type = ANY (ARRAY['template'::text, 'document'::text, 'tag'::text, 'category'::text, 'user'::text])),
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- ProofofDebitAPI table
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

-- Template categories indexes
-- (Primary key is sufficient)

-- Document templates indexes
CREATE INDEX IF NOT EXISTS idx_document_templates_user_id ON document_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_category_id ON document_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_name ON document_templates USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_templates_search ON document_templates USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_document_templates_storage_path ON document_templates(storage_path) WHERE storage_path IS NOT NULL;

-- Template versions indexes
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_current ON template_versions(template_id, is_current) WHERE (is_current = true);
CREATE INDEX IF NOT EXISTS idx_template_versions_version_number ON template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON template_versions(created_at DESC);

-- Template tags indexes
CREATE INDEX IF NOT EXISTS idx_template_tags_template_id ON template_tags(template_id);
CREATE INDEX IF NOT EXISTS idx_template_tags_name ON template_tags(name);

-- Template sharing indexes
CREATE INDEX IF NOT EXISTS idx_template_sharing_template_id ON template_sharing(template_id);
CREATE INDEX IF NOT EXISTS idx_template_sharing_shared_with ON template_sharing(shared_with_id);

-- Data mappings indexes
CREATE INDEX IF NOT EXISTS idx_data_mappings_template_id ON data_mappings(template_id);
CREATE INDEX IF NOT EXISTS idx_data_mappings_template_version ON data_mappings(template_id, template_version);

-- Document generations indexes
CREATE INDEX IF NOT EXISTS idx_document_generations_user_id ON document_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_template_id ON document_generations(template_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_created_at ON document_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_generations_storage_path ON document_generations(storage_path) WHERE storage_path IS NOT NULL;

-- User activity indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

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

-- Document templates triggers
CREATE TRIGGER update_document_templates_updated_at
BEFORE UPDATE ON document_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_search_vector_trigger
BEFORE INSERT OR UPDATE ON document_templates
FOR EACH ROW EXECUTE FUNCTION update_template_search_vector();

CREATE TRIGGER create_initial_version_trigger
AFTER INSERT ON document_templates
FOR EACH ROW EXECUTE FUNCTION create_initial_template_version();

-- Template tags updated_at trigger
CREATE TRIGGER update_template_tags_updated_at
BEFORE UPDATE ON template_tags
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Template sharing updated_at trigger
CREATE TRIGGER update_template_sharing_updated_at
BEFORE UPDATE ON template_sharing
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data mappings updated_at trigger
CREATE TRIGGER update_data_mappings_updated_at
BEFORE UPDATE ON data_mappings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProofofDebitAPI" ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can insert own profile during signup" 
  ON profiles FOR INSERT TO authenticated 
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE TO authenticated 
  USING (uid() = user_id);

CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT TO authenticated 
  USING (uid() = user_id);

-- Template categories policies
CREATE POLICY "Users can manage own categories" 
  ON template_categories FOR ALL TO authenticated 
  USING (uid() = user_id) 
  WITH CHECK (uid() = user_id);

-- Document templates policies
CREATE POLICY "Users can manage own templates" 
  ON document_templates FOR ALL TO authenticated 
  USING (uid() = user_id) 
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can view public templates" 
  ON document_templates FOR SELECT TO authenticated 
  USING (is_public = true);

CREATE POLICY "Users can view shared templates" 
  ON document_templates FOR SELECT TO authenticated 
  USING (id IN (
    SELECT template_id FROM template_sharing 
    WHERE shared_with_id = uid() 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > now())
  ));

-- Template versions policies
CREATE POLICY "Users can create versions for own templates" 
  ON template_versions FOR INSERT TO authenticated 
  WITH CHECK (user_id = uid() AND created_by_user_id = uid());

CREATE POLICY "Users can delete versions of own templates" 
  ON template_versions FOR DELETE TO authenticated 
  USING (user_id = uid());

CREATE POLICY "Users can update versions of own templates" 
  ON template_versions FOR UPDATE TO authenticated 
  USING (user_id = uid());

CREATE POLICY "Users can view versions of own templates" 
  ON template_versions FOR SELECT TO authenticated 
  USING (user_id = uid());

-- Template tags policies
CREATE POLICY "Users can manage tags for own templates" 
  ON template_tags FOR ALL TO authenticated 
  USING (template_id IN (
    SELECT id FROM document_templates WHERE user_id = uid()
  )) 
  WITH CHECK (template_id IN (
    SELECT id FROM document_templates WHERE user_id = uid()
  ));

CREATE POLICY "Users can view tags for accessible templates" 
  ON template_tags FOR SELECT TO authenticated 
  USING (template_id IN (
    SELECT id FROM document_templates 
    WHERE user_id = uid() 
      OR is_public = true 
      OR id IN (
        SELECT template_id FROM template_sharing 
        WHERE shared_with_id = uid() 
          AND is_active = true 
          AND (expires_at IS NULL OR expires_at > now())
      )
  ));

-- Template sharing policies
CREATE POLICY "Users can manage sharing for own templates" 
  ON template_sharing FOR ALL TO authenticated 
  USING (uid() = owner_id) 
  WITH CHECK (uid() = owner_id);

CREATE POLICY "Users can view templates shared with them" 
  ON template_sharing FOR SELECT TO authenticated 
  USING (uid() = shared_with_id);

-- Data mappings policies
CREATE POLICY "Users can manage own mappings" 
  ON data_mappings FOR ALL TO authenticated 
  USING (uid() = user_id) 
  WITH CHECK (uid() = user_id);

-- Document generations policies
CREATE POLICY "Users can manage own generations" 
  ON document_generations FOR ALL TO authenticated 
  USING (uid() = user_id) 
  WITH CHECK (uid() = user_id);

-- User activity policies
CREATE POLICY "System can insert activity" 
  ON user_activity FOR INSERT TO authenticated 
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can view own activity" 
  ON user_activity FOR SELECT TO authenticated 
  USING (uid() = user_id);

-- ProofofDebitAPI policies
CREATE POLICY "Allow authenticated users to read current records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" = 'Current');

CREATE POLICY "Allow authenticated users to read new records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" = 'New');

CREATE POLICY "Allow authenticated users to read processed records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" = ANY (ARRAY['Processed', 'Error']));

CREATE POLICY "Allow authenticated users to update record status" 
  ON "ProofofDebitAPI" FOR UPDATE TO authenticated 
  USING ("Status" = 'New') 
  WITH CHECK ("Status" = ANY (ARRAY['New', 'Current', 'Processed', 'Error']));