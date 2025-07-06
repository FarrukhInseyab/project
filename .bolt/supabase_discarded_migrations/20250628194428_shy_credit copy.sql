/*
  # Initial Schema Setup

  1. New Tables
    - `users` - Auth users table
    - `profiles` - User profiles with preferences
    - `document_templates` - Document templates with content and metadata
    - `template_versions` - Version history for templates
    - `template_tags` - Tags extracted from templates
    - `template_categories` - Categories for organizing templates
    - `data_mappings` - AI-powered mappings between tags and data sources
    - `document_generations` - Record of generated documents
    - `template_sharing` - Sharing templates between users
    - `user_activity` - User activity tracking
    - `ProofofDebitAPI` - External API integration table

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
    - Create utility functions for timestamps and search
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

-- Create users table (if not exists - managed by Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company TEXT,
  role TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT profiles_user_id_key UNIQUE (user_id),
  CONSTRAINT profiles_subscription_tier_check CHECK (subscription_tier IN ('free', 'pro', 'enterprise'))
);

-- Create template_categories table
CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT template_categories_user_id_name_key UNIQUE (user_id, name)
);

-- Create document_templates table
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES template_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  original_filename TEXT NOT NULL,
  document_content TEXT NOT NULL,
  document_html TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT 'docx',
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

-- Create template_versions table
CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT template_versions_template_id_version_number_key UNIQUE (template_id, version_number),
  CONSTRAINT template_versions_template_id_excl EXCLUDE USING btree (template_id WITH =) WHERE (is_current = true)
);

-- Create template_tags table
CREATE TABLE IF NOT EXISTS template_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  expected_value TEXT,
  data_type TEXT DEFAULT 'text',
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  validation_rules JSONB DEFAULT '{}'::jsonb,
  position_start INTEGER,
  position_end INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT template_tags_template_id_name_key UNIQUE (template_id, name),
  CONSTRAINT template_tags_data_type_check CHECK (data_type IN ('text', 'number', 'date', 'email', 'phone', 'url', 'boolean'))
);

-- Create data_mappings table
CREATE TABLE IF NOT EXISTS data_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  CONSTRAINT data_mappings_template_version_unique UNIQUE (template_id, template_version, tag_name, data_key)
);

-- Create document_generations table
CREATE TABLE IF NOT EXISTS document_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES document_templates(id) ON DELETE CASCADE,
  generation_type TEXT DEFAULT 'single',
  documents_count INTEGER DEFAULT 1,
  input_data JSONB NOT NULL,
  output_filenames TEXT[] DEFAULT '{}'::text[],
  file_urls TEXT[] DEFAULT '{}'::text[],
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  processing_time_ms INTEGER,
  file_size_total BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  storage_path TEXT,
  CONSTRAINT document_generations_generation_type_check CHECK (generation_type IN ('single', 'batch')),
  CONSTRAINT document_generations_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create template_sharing table
CREATE TABLE IF NOT EXISTS template_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_with_email TEXT,
  permission_level TEXT DEFAULT 'view',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT template_sharing_template_id_shared_with_id_key UNIQUE (template_id, shared_with_id),
  CONSTRAINT template_sharing_template_id_shared_with_email_key UNIQUE (template_id, shared_with_email),
  CONSTRAINT template_sharing_permission_level_check CHECK (permission_level IN ('view', 'edit', 'admin'))
);

-- Create user_activity table
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_activity_activity_type_check CHECK (activity_type IN (
    'template_created', 'template_updated', 'template_deleted', 'template_used',
    'document_generated', 'data_imported', 'tag_created', 'tag_updated',
    'category_created', 'login', 'export_data'
  )),
  CONSTRAINT user_activity_resource_type_check CHECK (resource_type IN (
    'template', 'document', 'tag', 'category', 'user'
  ))
);

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

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_categories_updated_at
BEFORE UPDATE ON template_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_templates_updated_at
BEFORE UPDATE ON document_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_tags_updated_at
BEFORE UPDATE ON template_tags
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_mappings_updated_at
BEFORE UPDATE ON data_mappings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_sharing_updated_at
BEFORE UPDATE ON template_sharing
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update template search vector
CREATE OR REPLACE FUNCTION update_template_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.original_filename, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector updates
CREATE TRIGGER update_template_search_vector_trigger
BEFORE INSERT OR UPDATE ON document_templates
FOR EACH ROW EXECUTE FUNCTION update_template_search_vector();

-- Create function to create initial template version
CREATE OR REPLACE FUNCTION create_initial_template_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO template_versions (
    template_id, user_id, version_number, name, description, 
    original_filename, document_content, document_html, 
    file_size, storage_path, is_current, created_by_user_id, 
    metadata
  ) VALUES (
    NEW.id, NEW.user_id, 1, NEW.name, NEW.description,
    NEW.original_filename, NEW.document_content, NEW.document_html,
    NEW.file_size, NEW.storage_path, true, NEW.user_id,
    jsonb_build_object('is_initial', true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for initial version creation
CREATE TRIGGER create_initial_version_trigger
AFTER INSERT ON document_templates
FOR EACH ROW EXECUTE FUNCTION create_initial_template_version();

-- Create function to check if template version has mappings
CREATE OR REPLACE FUNCTION template_version_has_mappings(p_template_id UUID, p_version INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  mapping_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mapping_count
  FROM data_mappings
  WHERE template_id = p_template_id
  AND template_version = p_version;
  
  RETURN mapping_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Create function to get template version mappings
CREATE OR REPLACE FUNCTION get_template_version_mappings(p_template_id UUID, p_version INTEGER)
RETURNS SETOF data_mappings AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM data_mappings
  WHERE template_id = p_template_id
  AND template_version = p_version;
END;
$$ LANGUAGE plpgsql;

-- Create function to debug template mappings
CREATE OR REPLACE FUNCTION debug_template_mappings(p_template_id UUID)
RETURNS TABLE (
  template_id UUID,
  template_version INTEGER,
  mapping_count INTEGER,
  tag_names TEXT[],
  data_keys TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.template_id,
    dm.template_version,
    COUNT(*)::INTEGER AS mapping_count,
    array_agg(DISTINCT dm.tag_name) AS tag_names,
    array_agg(DISTINCT dm.data_key) AS data_keys
  FROM data_mappings dm
  WHERE dm.template_id = p_template_id
  GROUP BY dm.template_id, dm.template_version;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE document_templates
  SET 
    usage_count = usage_count + 1,
    last_used_at = now()
  WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to create template version
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
  -- Get template info
  SELECT user_id, name, description, current_version + 1, total_versions + 1
  INTO v_user_id, v_template_name, v_template_description, v_next_version, v_next_version
  FROM document_templates
  WHERE id = p_template_id;
  
  -- Update current version to not current
  UPDATE template_versions
  SET is_current = false
  WHERE template_id = p_template_id AND is_current = true;
  
  -- Create new version
  INSERT INTO template_versions (
    template_id, user_id, version_number, name, description, 
    original_filename, document_content, document_html, 
    file_size, storage_path, is_current, version_notes, created_by_user_id
  ) VALUES (
    p_template_id, v_user_id, v_next_version, v_template_name, v_template_description,
    p_original_filename, p_document_content, p_document_html,
    p_file_size, p_storage_path, true, p_version_notes, auth.uid()
  )
  RETURNING id INTO v_version_id;
  
  -- Update template with new version info
  UPDATE document_templates
  SET 
    current_version = v_next_version,
    total_versions = v_next_version,
    document_content = p_document_content,
    document_html = p_document_html,
    original_filename = p_original_filename,
    file_size = p_file_size,
    storage_path = p_storage_path,
    updated_at = now()
  WHERE id = p_template_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to rollback template version
CREATE OR REPLACE FUNCTION rollback_template_version(
  p_template_id UUID,
  p_version_number INTEGER,
  p_rollback_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_version_id UUID;
  v_current_version INTEGER;
  v_document_content TEXT;
  v_document_html TEXT;
  v_original_filename TEXT;
  v_file_size BIGINT;
  v_storage_path TEXT;
BEGIN
  -- Get current version
  SELECT current_version
  INTO v_current_version
  FROM document_templates
  WHERE id = p_template_id;
  
  -- Get version data
  SELECT id, document_content, document_html, original_filename, file_size, storage_path
  INTO v_version_id, v_document_content, v_document_html, v_original_filename, v_file_size, v_storage_path
  FROM template_versions
  WHERE template_id = p_template_id AND version_number = p_version_number;
  
  -- Update current version to not current
  UPDATE template_versions
  SET is_current = false
  WHERE template_id = p_template_id AND is_current = true;
  
  -- Set rollback version to current
  UPDATE template_versions
  SET 
    is_current = true,
    metadata = jsonb_build_object('is_rollback', true, 'rollback_from_version', v_current_version, 'rollback_notes', p_rollback_notes)
  WHERE id = v_version_id;
  
  -- Update template with rollback version info
  UPDATE document_templates
  SET 
    current_version = p_version_number,
    document_content = v_document_content,
    document_html = v_document_html,
    original_filename = v_original_filename,
    file_size = v_file_size,
    storage_path = v_storage_path,
    updated_at = now()
  WHERE id = p_template_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get template version history
CREATE OR REPLACE FUNCTION get_template_version_history(p_template_id UUID)
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
    tv.id AS version_id,
    tv.version_number,
    tv.is_current,
    tv.original_filename,
    tv.file_size,
    tv.version_notes,
    p.email AS created_by_email,
    tv.created_at,
    tv.metadata
  FROM template_versions tv
  LEFT JOIN profiles p ON tv.created_by_user_id = p.user_id
  WHERE tv.template_id = p_template_id
  ORDER BY tv.version_number DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProofofDebitAPI" ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

CREATE INDEX idx_template_categories_user_id ON template_categories(user_id);

CREATE INDEX idx_document_templates_user_id ON document_templates(user_id);
CREATE INDEX idx_document_templates_category_id ON document_templates(category_id);
CREATE INDEX idx_document_templates_name ON document_templates USING gin (name gin_trgm_ops);
CREATE INDEX idx_document_templates_search ON document_templates USING gin (search_vector);
CREATE INDEX idx_document_templates_storage_path ON document_templates(storage_path) WHERE storage_path IS NOT NULL;

CREATE INDEX idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX idx_template_versions_version_number ON template_versions(template_id, version_number);
CREATE INDEX idx_template_versions_current ON template_versions(template_id, is_current) WHERE is_current = true;
CREATE INDEX idx_template_versions_created_at ON template_versions(created_at DESC);

CREATE INDEX idx_template_tags_template_id ON template_tags(template_id);
CREATE INDEX idx_template_tags_name ON template_tags(name);

CREATE INDEX idx_data_mappings_template_id ON data_mappings(template_id);
CREATE INDEX idx_data_mappings_template_version ON data_mappings(template_id, template_version);

CREATE INDEX idx_document_generations_user_id ON document_generations(user_id);
CREATE INDEX idx_document_generations_template_id ON document_generations(template_id);
CREATE INDEX idx_document_generations_created_at ON document_generations(created_at DESC);
CREATE INDEX idx_document_generations_storage_path ON document_generations(storage_path) WHERE storage_path IS NOT NULL;

CREATE INDEX idx_template_sharing_template_id ON template_sharing(template_id);
CREATE INDEX idx_template_sharing_shared_with ON template_sharing(shared_with_id);

CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);

-- Create RLS policies for profiles
CREATE POLICY "Users can insert own profile during signup" 
  ON profiles FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- Create RLS policies for template_categories
CREATE POLICY "Users can manage own categories" 
  ON template_categories FOR ALL TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for document_templates
CREATE POLICY "Users can manage own templates" 
  ON document_templates FOR ALL TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view public templates" 
  ON document_templates FOR SELECT TO authenticated 
  USING (is_public = true);

CREATE POLICY "Users can view shared templates" 
  ON document_templates FOR SELECT TO authenticated 
  USING (
    id IN (
      SELECT template_id FROM template_sharing
      WHERE shared_with_id = auth.uid()
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- Create RLS policies for template_versions
CREATE POLICY "Users can create versions for own templates" 
  ON template_versions FOR INSERT TO authenticated 
  WITH CHECK (
    user_id = auth.uid() AND created_by_user_id = auth.uid()
  );

CREATE POLICY "Users can delete versions of own templates" 
  ON template_versions FOR DELETE TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update versions of own templates" 
  ON template_versions FOR UPDATE TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Users can view versions of own templates" 
  ON template_versions FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- Create RLS policies for template_tags
CREATE POLICY "Users can manage tags for own templates" 
  ON template_tags FOR ALL TO authenticated 
  USING (
    template_id IN (
      SELECT id FROM document_templates
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    template_id IN (
      SELECT id FROM document_templates
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view tags for accessible templates" 
  ON template_tags FOR SELECT TO authenticated 
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

-- Create RLS policies for data_mappings
CREATE POLICY "Users can manage own mappings" 
  ON data_mappings FOR ALL TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for document_generations
CREATE POLICY "Users can manage own generations" 
  ON document_generations FOR ALL TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for template_sharing
CREATE POLICY "Users can manage sharing for own templates" 
  ON template_sharing FOR ALL TO authenticated 
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view templates shared with them" 
  ON template_sharing FOR SELECT TO authenticated 
  USING (auth.uid() = shared_with_id);

-- Create RLS policies for user_activity
CREATE POLICY "System can insert activity" 
  ON user_activity FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own activity" 
  ON user_activity FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- Create RLS policies for ProofofDebitAPI
CREATE POLICY "Allow authenticated users to read current records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" = 'Current');

CREATE POLICY "Allow authenticated users to read new records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" = 'New');

CREATE POLICY "Allow authenticated users to read processed records" 
  ON "ProofofDebitAPI" FOR SELECT TO authenticated 
  USING ("Status" IN ('Processed', 'Error'));

CREATE POLICY "Allow authenticated users to update record status" 
  ON "ProofofDebitAPI" FOR UPDATE TO authenticated 
  USING ("Status" = 'New')
  WITH CHECK ("Status" IN ('New', 'Current', 'Processed', 'Error'));