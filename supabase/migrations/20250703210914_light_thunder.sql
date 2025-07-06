/*
  # Initial Database Schema

  1. Core Tables
    - `users` - Auth users table
    - `profiles` - User profiles with preferences
    - `template_categories` - Categories for organizing templates
    - `document_templates` - Document templates
    - `template_tags` - Tags for document templates
    - `template_versions` - Version history for templates
    - `template_sharing` - Template sharing between users
    - `data_mappings` - Mappings between tags and data sources
    - `document_generations` - Document generation history
    - `user_activity` - User activity tracking
    - `ProofofDebitAPI` - External API integration

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
    - Create helper functions for version management

  3. Triggers
    - Add triggers for updating timestamps
    - Add triggers for template versioning
    - Add triggers for search vector updates
*/

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create extension for full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create updated_at column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create users table (profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company TEXT,
  role TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free'::text CHECK (subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create template categories table
CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6'::text,
  icon TEXT DEFAULT 'folder'::text,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS on template_categories
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

-- Create template_categories trigger for updated_at
CREATE TRIGGER update_template_categories_updated_at
BEFORE UPDATE ON template_categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create document templates table
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID REFERENCES template_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  original_filename TEXT NOT NULL,
  document_content TEXT NOT NULL,
  document_html TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT 'docx'::text,
  version INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  preview_image_url TEXT,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  storage_path TEXT,
  current_version INTEGER DEFAULT 1,
  total_versions INTEGER DEFAULT 1
);

-- Enable RLS on document_templates
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Create document_templates trigger for updated_at
CREATE TRIGGER update_document_templates_updated_at
BEFORE UPDATE ON document_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create template tags table
CREATE TABLE IF NOT EXISTS template_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  expected_value TEXT,
  data_type TEXT DEFAULT 'text'::text CHECK (data_type = ANY (ARRAY['text'::text, 'number'::text, 'date'::text, 'email'::text, 'phone'::text, 'url'::text, 'boolean'::text])),
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  position_start INTEGER,
  position_end INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, name)
);

-- Enable RLS on template_tags
ALTER TABLE template_tags ENABLE ROW LEVEL SECURITY;

-- Create template_tags trigger for updated_at
CREATE TRIGGER update_template_tags_updated_at
BEFORE UPDATE ON template_tags
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create template versions table
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  original_filename TEXT NOT NULL,
  document_content TEXT NOT NULL,
  document_html TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  storage_path TEXT,
  is_current BOOLEAN DEFAULT false,
  version_notes TEXT,
  created_by_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, version_number),
  EXCLUDE USING btree (template_id WITH =) WHERE (is_current = true)
);

-- Enable RLS on template_versions
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

-- Create template sharing table
CREATE TABLE IF NOT EXISTS template_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  shared_with_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  shared_with_email TEXT,
  permission_level TEXT DEFAULT 'view'::text CHECK (permission_level = ANY (ARRAY['view'::text, 'edit'::text, 'admin'::text])),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, shared_with_id),
  UNIQUE(template_id, shared_with_email)
);

-- Enable RLS on template_sharing
ALTER TABLE template_sharing ENABLE ROW LEVEL SECURITY;

-- Create template_sharing trigger for updated_at
CREATE TRIGGER update_template_sharing_updated_at
BEFORE UPDATE ON template_sharing
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create data mappings table
CREATE TABLE IF NOT EXISTS data_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  data_key TEXT NOT NULL,
  mapping_confidence NUMERIC(3,2) DEFAULT 0.0,
  is_manual BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  template_version INTEGER DEFAULT 1,
  UNIQUE(template_id, template_version, tag_name, data_key)
);

-- Enable RLS on data_mappings
ALTER TABLE data_mappings ENABLE ROW LEVEL SECURITY;

-- Create data_mappings trigger for updated_at
CREATE TRIGGER update_data_mappings_updated_at
BEFORE UPDATE ON data_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create document generations table
CREATE TABLE IF NOT EXISTS document_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  template_id UUID REFERENCES document_templates(id) ON DELETE CASCADE,
  generation_type TEXT DEFAULT 'single'::text CHECK (generation_type = ANY (ARRAY['single'::text, 'batch'::text])),
  documents_count INTEGER DEFAULT 1,
  input_data JSONB NOT NULL,
  output_filenames TEXT[] DEFAULT '{}'::text[],
  file_urls TEXT[] DEFAULT '{}'::text[],
  status TEXT DEFAULT 'completed'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  error_message TEXT,
  processing_time_ms INTEGER,
  file_size_total BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  storage_path TEXT
);

-- Enable RLS on document_generations
ALTER TABLE document_generations ENABLE ROW LEVEL SECURITY;

-- Create user activity table
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type = ANY (ARRAY['template_created'::text, 'template_updated'::text, 'template_deleted'::text, 'template_used'::text, 'document_generated'::text, 'data_imported'::text, 'tag_created'::text, 'tag_updated'::text, 'category_created'::text, 'login'::text, 'export_data'::text])),
  resource_type TEXT CHECK (resource_type = ANY (ARRAY['template'::text, 'document'::text, 'tag'::text, 'category'::text, 'user'::text])),
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_activity
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Create ProofofDebitAPI table
CREATE TABLE IF NOT EXISTS "ProofofDebitAPI" (
  referenceno TEXT,
  date TEXT,
  time TEXT,
  bank TEXT,
  customername TEXT,
  nationalid BIGINT,
  customerno BIGINT PRIMARY KEY,
  personalfinanceno BIGINT,
  accountno TEXT,
  "Status" TEXT
);

-- Enable RLS on ProofofDebitAPI
ALTER TABLE "ProofofDebitAPI" ENABLE ROW LEVEL SECURITY;

-- Create search vector update function
CREATE OR REPLACE FUNCTION update_template_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create template search vector trigger
CREATE TRIGGER update_template_search_vector_trigger
BEFORE INSERT OR UPDATE ON document_templates
FOR EACH ROW
EXECUTE FUNCTION update_template_search_vector();

-- Create initial template version function
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
    1,
    NEW.name,
    NEW.description,
    NEW.original_filename,
    NEW.document_content,
    NEW.document_html,
    NEW.file_size,
    NEW.storage_path,
    true,
    NEW.user_id,
    jsonb_build_object('is_initial', true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create initial version trigger
CREATE TRIGGER create_initial_version_trigger
AFTER INSERT ON document_templates
FOR EACH ROW
EXECUTE FUNCTION create_initial_template_version();

-- Create template version management functions
CREATE OR REPLACE FUNCTION create_template_version(
  p_template_id UUID,
  p_original_filename TEXT,
  p_document_content TEXT,
  p_document_html TEXT,
  p_file_size BIGINT,
  p_storage_path TEXT,
  p_version_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_template_name TEXT;
  v_template_description TEXT;
  v_next_version INTEGER;
  v_version_id UUID;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  -- Get template info
  SELECT name, description, current_version + 1
  INTO v_template_name, v_template_description, v_next_version
  FROM document_templates
  WHERE id = p_template_id;
  
  -- Set current version to false for all versions
  UPDATE template_versions
  SET is_current = false
  WHERE template_id = p_template_id;
  
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
    created_by_user_id
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
    true,
    p_version_notes,
    v_user_id
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
    total_versions = total_versions + 1,
    updated_at = now()
  WHERE id = p_template_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create rollback function
CREATE OR REPLACE FUNCTION rollback_template_version(
  p_template_id UUID,
  p_version_number INTEGER,
  p_rollback_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_version_id UUID;
  v_document_content TEXT;
  v_document_html TEXT;
  v_original_filename TEXT;
  v_file_size BIGINT;
  v_storage_path TEXT;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  -- Get version data
  SELECT 
    id, document_content, document_html, original_filename, file_size, storage_path
  INTO 
    v_version_id, v_document_content, v_document_html, v_original_filename, v_file_size, v_storage_path
  FROM template_versions
  WHERE template_id = p_template_id AND version_number = p_version_number;
  
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Version not found';
  END IF;
  
  -- Set current version to false for all versions
  UPDATE template_versions
  SET is_current = false
  WHERE template_id = p_template_id;
  
  -- Set the rollback version as current
  UPDATE template_versions
  SET 
    is_current = true,
    metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
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
    updated_at = now()
  WHERE id = p_template_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create version history function
CREATE OR REPLACE FUNCTION get_template_version_history(
  p_template_id UUID
)
RETURNS TABLE (
  version_id UUID,
  version_number INTEGER,
  is_current BOOLEAN,
  original_filename TEXT,
  file_size BIGINT,
  version_notes TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB
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
    p.email as created_by_email,
    tv.created_at,
    tv.metadata
  FROM template_versions tv
  LEFT JOIN profiles p ON tv.created_by_user_id = p.user_id
  WHERE tv.template_id = p_template_id
  ORDER BY tv.version_number DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create template mappings functions
CREATE OR REPLACE FUNCTION template_version_has_mappings(
  p_template_id UUID,
  p_version INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  -- Check if mappings exist
  SELECT COUNT(*)
  INTO v_count
  FROM data_mappings
  WHERE 
    template_id = p_template_id AND 
    template_version = p_version AND
    user_id = v_user_id;
    
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_template_version_mappings(
  p_template_id UUID,
  p_version INTEGER
)
RETURNS TABLE (
  id UUID,
  tag_name TEXT,
  data_key TEXT,
  mapping_confidence NUMERIC(3,2),
  is_manual BOOLEAN,
  is_verified BOOLEAN,
  usage_count INTEGER
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  RETURN QUERY
  SELECT 
    dm.id,
    dm.tag_name,
    dm.data_key,
    dm.mapping_confidence,
    dm.is_manual,
    dm.is_verified,
    dm.usage_count
  FROM data_mappings dm
  WHERE 
    dm.template_id = p_template_id AND 
    dm.template_version = p_version AND
    dm.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION debug_template_mappings(
  p_template_id UUID
)
RETURNS TABLE (
  id UUID,
  template_id UUID,
  template_version INTEGER,
  tag_name TEXT,
  data_key TEXT,
  user_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.id,
    dm.template_id,
    dm.template_version,
    dm.tag_name,
    dm.data_key,
    dm.user_id
  FROM data_mappings dm
  WHERE dm.template_id = p_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create increment template usage function
CREATE OR REPLACE FUNCTION increment_template_usage(
  template_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE document_templates
  SET 
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies

-- Profiles policies
CREATE POLICY "Users can insert own profile during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (uid() = user_id);

CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (uid() = user_id);

-- Template categories policies
CREATE POLICY "Users can manage own categories"
  ON template_categories
  FOR ALL
  TO authenticated
  USING (uid() = user_id)
  WITH CHECK (uid() = user_id);

-- Document templates policies
CREATE POLICY "Users can manage own templates"
  ON document_templates
  FOR ALL
  TO authenticated
  USING (uid() = user_id)
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can view public templates"
  ON document_templates
  FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can view shared templates"
  ON document_templates
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT template_id 
      FROM template_sharing 
      WHERE 
        shared_with_id = uid() AND 
        is_active = true AND 
        (expires_at IS NULL OR expires_at > now())
    )
  );

-- Template tags policies
CREATE POLICY "Users can manage tags for own templates"
  ON template_tags
  FOR ALL
  TO authenticated
  USING (
    template_id IN (
      SELECT id 
      FROM document_templates 
      WHERE user_id = uid()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id 
      FROM document_templates 
      WHERE user_id = uid()
    )
  );

CREATE POLICY "Users can view tags for accessible templates"
  ON template_tags
  FOR SELECT
  TO authenticated
  USING (
    template_id IN (
      SELECT id 
      FROM document_templates 
      WHERE 
        user_id = uid() OR 
        is_public = true OR 
        id IN (
          SELECT template_id 
          FROM template_sharing 
          WHERE 
            shared_with_id = uid() AND 
            is_active = true AND 
            (expires_at IS NULL OR expires_at > now())
        )
    )
  );

-- Template versions policies
CREATE POLICY "Users can create versions for own templates"
  ON template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = uid()) AND 
    (created_by_user_id = uid())
  );

CREATE POLICY "Users can delete versions of own templates"
  ON template_versions
  FOR DELETE
  TO authenticated
  USING (user_id = uid());

CREATE POLICY "Users can update versions of own templates"
  ON template_versions
  FOR UPDATE
  TO authenticated
  USING (user_id = uid());

CREATE POLICY "Users can view versions of own templates"
  ON template_versions
  FOR SELECT
  TO authenticated
  USING (user_id = uid());

-- Template sharing policies
CREATE POLICY "Users can manage sharing for own templates"
  ON template_sharing
  FOR ALL
  TO authenticated
  USING (uid() = owner_id)
  WITH CHECK (uid() = owner_id);

CREATE POLICY "Users can view templates shared with them"
  ON template_sharing
  FOR SELECT
  TO authenticated
  USING (uid() = shared_with_id);

-- Data mappings policies
CREATE POLICY "Users can manage own mappings"
  ON data_mappings
  FOR ALL
  TO authenticated
  USING (uid() = user_id)
  WITH CHECK (uid() = user_id);

-- Document generations policies
CREATE POLICY "Users can manage own generations"
  ON document_generations
  FOR ALL
  TO authenticated
  USING (uid() = user_id)
  WITH CHECK (uid() = user_id);

-- User activity policies
CREATE POLICY "System can insert activity"
  ON user_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (uid() = user_id);

CREATE POLICY "Users can view own activity"
  ON user_activity
  FOR SELECT
  TO authenticated
  USING (uid() = user_id);

-- ProofofDebitAPI policies
CREATE POLICY "Allow authenticated users to read current records"
  ON "ProofofDebitAPI"
  FOR SELECT
  TO authenticated
  USING ("Status" = 'Current'::text);

CREATE POLICY "Allow authenticated users to read new records"
  ON "ProofofDebitAPI"
  FOR SELECT
  TO authenticated
  USING ("Status" = 'New'::text);

CREATE POLICY "Allow authenticated users to read processed records"
  ON "ProofofDebitAPI"
  FOR SELECT
  TO authenticated
  USING ("Status" = ANY (ARRAY['Processed'::text, 'Error'::text]));

CREATE POLICY "Allow authenticated users to update record status"
  ON "ProofofDebitAPI"
  FOR UPDATE
  TO authenticated
  USING ("Status" = 'New'::text)
  WITH CHECK ("Status" = ANY (ARRAY['New'::text, 'Current'::text, 'Processed'::text, 'Error'::text]));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_templates_user_id ON document_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_category_id ON document_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_name ON document_templates USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_templates_search ON document_templates USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_document_templates_storage_path ON document_templates(storage_path) WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_template_tags_template_id ON template_tags(template_id);
CREATE INDEX IF NOT EXISTS idx_template_tags_name ON template_tags(name);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_version_number ON template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_template_versions_current ON template_versions(template_id, is_current) WHERE (is_current = true);
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON template_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_sharing_template_id ON template_sharing(template_id);
CREATE INDEX IF NOT EXISTS idx_template_sharing_shared_with ON template_sharing(shared_with_id);

CREATE INDEX IF NOT EXISTS idx_data_mappings_template_id ON data_mappings(template_id);
CREATE INDEX IF NOT EXISTS idx_data_mappings_template_version ON data_mappings(template_id, template_version);

CREATE INDEX IF NOT EXISTS idx_document_generations_user_id ON document_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_template_id ON document_generations(template_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_created_at ON document_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_generations_storage_path ON document_generations(storage_path) WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);