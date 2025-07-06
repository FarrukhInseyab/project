/*
  # Document AI Studio Complete Schema

  1. New Tables
    - `profiles` - User profiles and preferences
    - `document_templates` - Reusable document templates
    - `template_tags` - Tags associated with templates
    - `template_categories` - Template organization
    - `document_generations` - History of generated documents
    - `data_mappings` - AI-powered mapping suggestions
    - `user_activity` - Activity tracking and analytics
    - `template_sharing` - Template collaboration
    - `template_versions` - Version history for templates
    - `ProofofDebitAPI` - External API integration

  2. Functions
    - `update_updated_at_column` - Updates timestamp on record changes
    - `update_template_search_vector` - Updates search vector for templates
    - `create_initial_template_version` - Creates initial version when template is created

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create extension for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create search vector update function
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
        TRUE,
        NEW.user_id,
        jsonb_build_object('is_initial', true)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create template_categories table
CREATE TABLE IF NOT EXISTS template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6'::text,
    icon TEXT DEFAULT 'folder'::text,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX template_categories_user_id_name_key ON template_categories(user_id, name);
CREATE TRIGGER update_template_categories_updated_at BEFORE UPDATE ON template_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

-- Create document_templates table
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_document_templates_user_id ON document_templates(user_id);
CREATE INDEX idx_document_templates_category_id ON document_templates(category_id);
CREATE INDEX idx_document_templates_name ON document_templates USING gin (name gin_trgm_ops);
CREATE INDEX idx_document_templates_search ON document_templates USING gin (search_vector);
CREATE INDEX idx_document_templates_storage_path ON document_templates(storage_path) WHERE storage_path IS NOT NULL;

CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_template_search_vector_trigger BEFORE INSERT OR UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION update_template_search_vector();
CREATE TRIGGER create_initial_version_trigger AFTER INSERT ON document_templates FOR EACH ROW EXECUTE FUNCTION create_initial_template_version();

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Create template_versions table
CREATE TABLE IF NOT EXISTS template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX template_versions_template_id_version_number_key ON template_versions(template_id, version_number);
CREATE INDEX idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX idx_template_versions_version_number ON template_versions(template_id, version_number);
CREATE INDEX idx_template_versions_current ON template_versions(template_id, is_current) WHERE (is_current = true);
CREATE INDEX idx_template_versions_created_at ON template_versions(created_at DESC);
CREATE INDEX template_versions_template_id_excl ON template_versions(template_id) WHERE (is_current = true);
ALTER TABLE template_versions ADD CONSTRAINT template_versions_template_id_excl EXCLUDE USING btree (template_id WITH =) WHERE ((is_current = true));

ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

-- Create template_tags table
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
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX template_tags_template_id_name_key ON template_tags(template_id, name);
CREATE INDEX idx_template_tags_template_id ON template_tags(template_id);
CREATE INDEX idx_template_tags_name ON template_tags(name);

CREATE TRIGGER update_template_tags_updated_at BEFORE UPDATE ON template_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE template_tags ENABLE ROW LEVEL SECURITY;

-- Create data_mappings table
CREATE TABLE IF NOT EXISTS data_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
    template_version INTEGER DEFAULT 1
);

CREATE UNIQUE INDEX data_mappings_template_version_unique ON data_mappings(template_id, template_version, tag_name, data_key);
CREATE INDEX idx_data_mappings_template_id ON data_mappings(template_id);
CREATE INDEX idx_data_mappings_template_version ON data_mappings(template_id, template_version);

CREATE TRIGGER update_data_mappings_updated_at BEFORE UPDATE ON data_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE data_mappings ENABLE ROW LEVEL SECURITY;

-- Create document_generations table
CREATE TABLE IF NOT EXISTS document_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_document_generations_user_id ON document_generations(user_id);
CREATE INDEX idx_document_generations_template_id ON document_generations(template_id);
CREATE INDEX idx_document_generations_created_at ON document_generations(created_at DESC);
CREATE INDEX idx_document_generations_storage_path ON document_generations(storage_path) WHERE (storage_path IS NOT NULL);

ALTER TABLE document_generations ENABLE ROW LEVEL SECURITY;

-- Create user_activity table
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type = ANY (ARRAY['template_created'::text, 'template_updated'::text, 'template_deleted'::text, 'template_used'::text, 'document_generated'::text, 'data_imported'::text, 'tag_created'::text, 'tag_updated'::text, 'category_created'::text, 'login'::text, 'export_data'::text])),
    resource_type TEXT CHECK (resource_type = ANY (ARRAY['template'::text, 'document'::text, 'tag'::text, 'category'::text, 'user'::text])),
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Create template_sharing table
CREATE TABLE IF NOT EXISTS template_sharing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with_email TEXT,
    permission_level TEXT DEFAULT 'view'::text CHECK (permission_level = ANY (ARRAY['view'::text, 'edit'::text, 'admin'::text])),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX template_sharing_template_id_shared_with_id_key ON template_sharing(template_id, shared_with_id);
CREATE UNIQUE INDEX template_sharing_template_id_shared_with_email_key ON template_sharing(template_id, shared_with_email);
CREATE INDEX idx_template_sharing_template_id ON template_sharing(template_id);
CREATE INDEX idx_template_sharing_shared_with ON template_sharing(shared_with_id);

CREATE TRIGGER update_template_sharing_updated_at BEFORE UPDATE ON template_sharing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE template_sharing ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE "ProofofDebitAPI" ENABLE ROW LEVEL SECURITY;

-- Create helper functions for template version management
CREATE OR REPLACE FUNCTION template_version_has_mappings(p_template_id UUID, p_version INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    mapping_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mapping_count
    FROM data_mappings
    WHERE template_id = p_template_id AND template_version = p_version;
    
    RETURN mapping_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_template_version_mappings(p_template_id UUID, p_version INTEGER)
RETURNS SETOF data_mappings AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM data_mappings
    WHERE template_id = p_template_id AND template_version = p_version;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION debug_template_mappings(p_template_id UUID)
RETURNS TABLE (
    template_id UUID,
    template_version INTEGER,
    mapping_count INTEGER,
    mappings JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dm.template_id,
        dm.template_version,
        COUNT(*)::INTEGER AS mapping_count,
        jsonb_agg(jsonb_build_object(
            'id', dm.id,
            'tag_name', dm.tag_name,
            'data_key', dm.data_key,
            'confidence', dm.mapping_confidence,
            'is_manual', dm.is_manual
        )) AS mappings
    FROM data_mappings dm
    WHERE dm.template_id = p_template_id
    GROUP BY dm.template_id, dm.template_version;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_template_version_history(p_template_id UUID)
RETURNS TABLE (
    version_id UUID,
    version_number INTEGER,
    is_current BOOLEAN,
    original_filename TEXT,
    file_size BIGINT,
    version_notes TEXT,
    created_by_user_id UUID,
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
        tv.created_by_user_id,
        p.email AS created_by_email,
        tv.created_at,
        tv.metadata
    FROM template_versions tv
    LEFT JOIN profiles p ON tv.created_by_user_id = p.user_id
    WHERE tv.template_id = p_template_id
    ORDER BY tv.version_number DESC;
END;
$$ LANGUAGE plpgsql;

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
    v_next_version INTEGER;
    v_version_id UUID;
    v_current_file_size BIGINT;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    -- Get the next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM template_versions
    WHERE template_id = p_template_id;
    
    -- Get current file size for comparison
    SELECT file_size INTO v_current_file_size
    FROM template_versions
    WHERE template_id = p_template_id AND is_current = true;
    
    -- Set all existing versions to not current
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
        created_by_user_id,
        metadata
    )
    SELECT
        p_template_id,
        user_id,
        v_next_version,
        name,
        description,
        p_original_filename,
        p_document_content,
        p_document_html,
        p_file_size,
        p_storage_path,
        true,
        p_version_notes,
        v_user_id,
        jsonb_build_object(
            'previous_version', current_version,
            'file_size_change', p_file_size - v_current_file_size
        )
    FROM document_templates
    WHERE id = p_template_id
    RETURNING id INTO v_version_id;
    
    -- Update template with new version info
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

CREATE OR REPLACE FUNCTION rollback_template_version(
    p_template_id UUID,
    p_version_number INTEGER,
    p_rollback_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_version_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    -- Verify version exists and is not already current
    IF NOT EXISTS (
        SELECT 1 FROM template_versions 
        WHERE template_id = p_template_id AND version_number = p_version_number
    ) THEN
        RAISE EXCEPTION 'Version % does not exist for template %', p_version_number, p_template_id;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM template_versions 
        WHERE template_id = p_template_id AND version_number = p_version_number AND is_current = true
    ) THEN
        RAISE EXCEPTION 'Version % is already the current version', p_version_number;
    END IF;
    
    -- Set all versions to not current
    UPDATE template_versions
    SET is_current = false
    WHERE template_id = p_template_id;
    
    -- Set the specified version to current
    UPDATE template_versions
    SET 
        is_current = true,
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{is_rollback}',
            'true'::jsonb
        )
    WHERE template_id = p_template_id AND version_number = p_version_number
    RETURNING id INTO v_version_id;
    
    -- Update template with rollback version info
    UPDATE document_templates
    SET 
        document_content = (SELECT document_content FROM template_versions WHERE template_id = p_template_id AND version_number = p_version_number),
        document_html = (SELECT document_html FROM template_versions WHERE template_id = p_template_id AND version_number = p_version_number),
        original_filename = (SELECT original_filename FROM template_versions WHERE template_id = p_template_id AND version_number = p_version_number),
        file_size = (SELECT file_size FROM template_versions WHERE template_id = p_template_id AND version_number = p_version_number),
        storage_path = (SELECT storage_path FROM template_versions WHERE template_id = p_template_id AND version_number = p_version_number),
        current_version = p_version_number,
        updated_at = now(),
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{rollback_info}',
            jsonb_build_object(
                'rollback_to_version', p_version_number,
                'rollback_date', now(),
                'rollback_by', v_user_id,
                'rollback_notes', p_rollback_notes
            )
        )
    WHERE id = p_template_id;
    
    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Create RLS policies

-- Profiles policies
CREATE POLICY "Users can insert own profile during signup" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Template categories policies
CREATE POLICY "Users can manage own categories" ON template_categories
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Document templates policies
CREATE POLICY "Users can manage own templates" ON document_templates
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view public templates" ON document_templates
    FOR SELECT TO authenticated
    USING (is_public = true);

CREATE POLICY "Users can view shared templates" ON document_templates
    FOR SELECT TO authenticated
    USING (id IN (
        SELECT template_id FROM template_sharing
        WHERE shared_with_id = auth.uid()
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    ));

-- Template versions policies
CREATE POLICY "Users can create versions for own templates" ON template_versions
    FOR INSERT TO authenticated
    WITH CHECK ((user_id = auth.uid()) AND (created_by_user_id = auth.uid()));

CREATE POLICY "Users can delete versions of own templates" ON template_versions
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update versions of own templates" ON template_versions
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can view versions of own templates" ON template_versions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Template tags policies
CREATE POLICY "Users can manage tags for own templates" ON template_tags
    FOR ALL TO authenticated
    USING (template_id IN (
        SELECT id FROM document_templates
        WHERE user_id = auth.uid()
    ))
    WITH CHECK (template_id IN (
        SELECT id FROM document_templates
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can view tags for accessible templates" ON template_tags
    FOR SELECT TO authenticated
    USING (template_id IN (
        SELECT id FROM document_templates
        WHERE user_id = auth.uid()
        OR is_public = true
        OR id IN (
            SELECT template_id FROM template_sharing
            WHERE shared_with_id = auth.uid()
            AND is_active = true
            AND (expires_at IS NULL OR expires_at > now())
        )
    ));

-- Data mappings policies
CREATE POLICY "Users can manage own mappings" ON data_mappings
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Document generations policies
CREATE POLICY "Users can manage own generations" ON document_generations
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- User activity policies
CREATE POLICY "System can insert activity" ON user_activity
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own activity" ON user_activity
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Template sharing policies
CREATE POLICY "Users can manage sharing for own templates" ON template_sharing
    FOR ALL TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view templates shared with them" ON template_sharing
    FOR SELECT TO authenticated
    USING (auth.uid() = shared_with_id);

-- ProofofDebitAPI policies
CREATE POLICY "Allow authenticated users to read current records" ON "ProofofDebitAPI"
    FOR SELECT TO authenticated
    USING ("Status" = 'Current'::text);

CREATE POLICY "Allow authenticated users to read new records" ON "ProofofDebitAPI"
    FOR SELECT TO authenticated
    USING ("Status" = 'New'::text);

CREATE POLICY "Allow authenticated users to read processed records" ON "ProofofDebitAPI"
    FOR SELECT TO authenticated
    USING ("Status" = ANY (ARRAY['Processed'::text, 'Error'::text]));

CREATE POLICY "Allow authenticated users to update record status" ON "ProofofDebitAPI"
    FOR UPDATE TO authenticated
    USING ("Status" = 'New'::text)
    WITH CHECK ("Status" = ANY (ARRAY['New'::text, 'Current'::text, 'Processed'::text, 'Error'::text]));

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('document-templates', 'Document Templates', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('generated-documents', 'Generated Documents', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can manage their own template files" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'document-templates' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'document-templates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can manage their own generated documents" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'generated-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'generated-documents' AND (storage.foldername(name))[1] = auth.uid()::text);