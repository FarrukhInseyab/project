

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_onlyoffice_availability"("p_server_url" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- This function is a placeholder since we can't make HTTP requests from PostgreSQL
  -- The actual check will be done in the client or edge function
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_onlyoffice_availability"("p_server_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_mappings_by_template"() RETURNS TABLE("template_id" "uuid", "template_name" "text", "version_1_count" bigint, "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."count_mappings_by_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_initial_template_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."create_initial_template_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_template_version"("p_template_id" "uuid", "p_original_filename" "text", "p_document_content" "text", "p_document_html" "text", "p_file_size" bigint, "p_storage_path" "text", "p_version_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."create_template_version"("p_template_id" "uuid", "p_original_filename" "text", "p_document_content" "text", "p_document_html" "text", "p_file_size" bigint, "p_storage_path" "text", "p_version_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_all_mappings"() RETURNS TABLE("user_id" "uuid", "template_id" "uuid", "template_name" "text", "template_version" integer, "tag_name" "text", "data_key" "text", "mapping_confidence" numeric, "is_manual" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."debug_all_mappings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_template_mappings"("p_template_id" "uuid") RETURNS TABLE("id" "uuid", "template_id" "uuid", "template_version" integer, "tag_name" "text", "data_key" "text", "mapping_confidence" numeric, "is_manual" boolean, "is_verified" boolean, "usage_count" integer, "last_used_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."debug_template_mappings"("p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_onlyoffice_server_url"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_server_url TEXT;
BEGIN
  -- Get the OnlyOffice server URL from user preferences
  SELECT preferences->>'onlyoffice_url' INTO v_server_url
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Return default URL if not set in preferences
  IF v_server_url IS NULL OR v_server_url = '' THEN
    RETURN 'https://onlyoffice.decisions.social';
  END IF;
  
  RETURN v_server_url;
END;
$$;


ALTER FUNCTION "public"."get_onlyoffice_server_url"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pdf_conversion_stats_v1"("p_days" integer DEFAULT 30) RETURNS TABLE("total_conversions" bigint, "successful_conversions" bigint, "failed_conversions" bigint, "success_rate" numeric, "avg_processing_time" numeric, "by_conversion_method" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE success = true) AS successful,
      COUNT(*) FILTER (WHERE success = false) AS failed,
      CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE success = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0
      END AS success_rate,
      ROUND(AVG(processing_time_ms)::NUMERIC, 2) AS avg_time,
      jsonb_object_agg(
        conversion_method, 
        jsonb_build_object(
          'total', COUNT(*) FILTER (WHERE conversion_method = conversion_method),
          'successful', COUNT(*) FILTER (WHERE conversion_method = conversion_method AND success = true),
          'failed', COUNT(*) FILTER (WHERE conversion_method = conversion_method AND success = false),
          'success_rate', CASE 
            WHEN COUNT(*) FILTER (WHERE conversion_method = conversion_method) > 0 THEN 
              ROUND((COUNT(*) FILTER (WHERE conversion_method = conversion_method AND success = true)::NUMERIC / 
                    COUNT(*) FILTER (WHERE conversion_method = conversion_method)::NUMERIC) * 100, 2)
            ELSE 0
          END
        )
      ) AS by_method
    FROM pdf_conversion_logs
    WHERE 
      user_id = auth.uid() AND
      created_at >= (CURRENT_DATE - p_days * INTERVAL '1 day')
    GROUP BY user_id
  )
  SELECT
    total AS total_conversions,
    successful AS successful_conversions,
    failed AS failed_conversions,
    success_rate,
    avg_time AS avg_processing_time,
    by_method AS by_conversion_method
  FROM stats;
END;
$$;


ALTER FUNCTION "public"."get_pdf_conversion_stats_v1"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_templates"("p_user_id" "uuid") RETURNS TABLE("template_id" "uuid", "template_name" "text", "owner_id" "uuid", "owner_name" "text", "owner_email" "text", "permission_level" "text", "expires_at" timestamp with time zone, "is_active" boolean, "shared_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        dt.id as template_id,
        dt.name as template_name,
        p.user_id as owner_id,
        p.full_name as owner_name,
        p.email as owner_email,
        ts.permission_level,
        ts.expires_at,
        ts.is_active,
        ts.created_at as shared_at
    FROM template_sharing ts
    JOIN document_templates dt ON ts.template_id = dt.id
    JOIN profiles p ON dt.user_id = p.user_id
    WHERE ts.shared_with_id = p_user_id
    AND ts.is_active = true
    AND (ts.expires_at IS NULL OR ts.expires_at > now())
    ORDER BY ts.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_shared_templates"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_template_usage_stats"("p_template_id" "uuid") RETURNS TABLE("total_generations" bigint, "total_documents" bigint, "generations_by_month" "jsonb", "average_processing_time" numeric, "most_recent_generation" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_generations,
        SUM(documents_count) as total_documents,
        jsonb_object_agg(
            to_char(date_trunc('month', created_at), 'YYYY-MM'),
            COUNT(*)
        ) as generations_by_month,
        AVG(processing_time_ms)::numeric as average_processing_time,
        MAX(created_at) as most_recent_generation
    FROM document_generations
    WHERE template_id = p_template_id
    GROUP BY template_id;
END;
$$;


ALTER FUNCTION "public"."get_template_usage_stats"("p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_template_version_history"("p_template_id" "uuid") RETURNS TABLE("version_id" "uuid", "version_number" integer, "is_current" boolean, "original_filename" "text", "file_size" bigint, "version_notes" "text", "created_by_email" "text", "created_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_template_version_history"("p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_template_version_mappings"("p_template_id" "uuid", "p_version" integer) RETURNS TABLE("id" "uuid", "template_id" "uuid", "template_version" integer, "tag_name" "text", "data_key" "text", "mapping_confidence" numeric, "is_manual" boolean, "is_verified" boolean, "usage_count" integer, "last_used_at" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."get_template_version_mappings"("p_template_id" "uuid", "p_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_templates_shared_by_user"("p_user_id" "uuid") RETURNS TABLE("template_id" "uuid", "template_name" "text", "shared_with_id" "uuid", "shared_with_email" "text", "shared_with_name" "text", "permission_level" "text", "expires_at" timestamp with time zone, "is_active" boolean, "access_count" integer, "last_accessed_at" timestamp with time zone, "shared_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        dt.id as template_id,
        dt.name as template_name,
        ts.shared_with_id,
        COALESCE(ts.shared_with_email, p.email) as shared_with_email,
        p.full_name as shared_with_name,
        ts.permission_level,
        ts.expires_at,
        ts.is_active,
        ts.access_count,
        ts.last_accessed_at,
        ts.created_at as shared_at
    FROM template_sharing ts
    JOIN document_templates dt ON ts.template_id = dt.id
    LEFT JOIN profiles p ON ts.shared_with_id = p.user_id
    WHERE ts.owner_id = p_user_id
    ORDER BY ts.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_templates_shared_by_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("activity_date" "date", "activity_count" bigint, "activity_types" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc('day', created_at)::date as activity_date,
        COUNT(*) as activity_count,
        jsonb_object_agg(
            activity_type,
            COUNT(*)
        ) as activity_types
    FROM user_activity
    WHERE user_id = p_user_id
    AND created_at > now() - (p_days || ' days')::interval
    GROUP BY date_trunc('day', created_at)
    ORDER BY activity_date DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_template_stats"("p_user_id" "uuid") RETURNS TABLE("total_templates" bigint, "total_tags" bigint, "total_generations" bigint, "recent_templates" bigint, "templates_by_category" "jsonb", "tags_by_type" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH template_counts AS (
        SELECT
            COUNT(*) as total_templates,
            COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') as recent_templates,
            jsonb_object_agg(
                COALESCE(c.name, 'Uncategorized'),
                COUNT(*)
            ) FILTER (WHERE c.name IS NOT NULL OR c.id IS NULL) as templates_by_category
        FROM document_templates t
        LEFT JOIN template_categories c ON t.category_id = c.id
        WHERE t.user_id = p_user_id
        AND t.is_archived = false
    ),
    tag_counts AS (
        SELECT
            COUNT(*) as total_tags,
            jsonb_object_agg(
                COALESCE(data_type, 'text'),
                COUNT(*)
            ) as tags_by_type
        FROM template_tags tt
        JOIN document_templates dt ON tt.template_id = dt.id
        WHERE dt.user_id = p_user_id
    ),
    generation_counts AS (
        SELECT
            COUNT(*) as total_generations
        FROM document_generations
        WHERE user_id = p_user_id
    )
    SELECT
        tc.total_templates,
        tg.total_tags,
        gc.total_generations,
        tc.recent_templates,
        tc.templates_by_category,
        tg.tags_by_type
    FROM template_counts tc, tag_counts tg, generation_counts gc;
END;
$$;


ALTER FUNCTION "public"."get_user_template_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_template_usage"("template_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."increment_template_usage"("template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_pdf_conversion"("p_user_id" "uuid", "p_filename" "text", "p_server_url" "text", "p_success" boolean, "p_error_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert conversion log
  INSERT INTO user_activity (
    user_id,
    activity_type,
    resource_type,
    details
  ) VALUES (
    p_user_id,
    'pdf_conversion',
    'document',
    jsonb_build_object(
      'filename', p_filename,
      'server_url', p_server_url,
      'success', p_success,
      'error_message', p_error_message,
      'timestamp', now()
    )
  );
END;
$$;


ALTER FUNCTION "public"."log_pdf_conversion"("p_user_id" "uuid", "p_filename" "text", "p_server_url" "text", "p_success" boolean, "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_pdf_conversion_v1"("p_filename" "text", "p_server_url" "text", "p_conversion_method" "text", "p_success" boolean, "p_error_message" "text" DEFAULT NULL::"text", "p_processing_time_ms" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO pdf_conversion_logs (
    user_id,
    filename,
    server_url,
    conversion_method,
    success,
    error_message,
    processing_time_ms
  ) VALUES (
    auth.uid(),
    p_filename,
    p_server_url,
    p_conversion_method,
    p_success,
    p_error_message,
    p_processing_time_ms
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_pdf_conversion_v1"("p_filename" "text", "p_server_url" "text", "p_conversion_method" "text", "p_success" boolean, "p_error_message" "text", "p_processing_time_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rollback_template_version"("p_template_id" "uuid", "p_version_number" integer, "p_rollback_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."rollback_template_version"("p_template_id" "uuid", "p_version_number" integer, "p_rollback_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_templates"("p_user_id" "uuid", "p_search_term" "text" DEFAULT NULL::"text", "p_category_id" "uuid" DEFAULT NULL::"uuid", "p_has_tags" boolean DEFAULT NULL::boolean, "p_is_public" boolean DEFAULT NULL::boolean, "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "category_id" "uuid", "category_name" "text", "tags_count" bigint, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "is_public" boolean, "usage_count" integer, "current_version" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.description,
        t.category_id,
        c.name as category_name,
        COUNT(tt.id) as tags_count,
        t.created_at,
        t.updated_at,
        t.is_public,
        t.usage_count,
        t.current_version
    FROM document_templates t
    LEFT JOIN template_categories c ON t.category_id = c.id
    LEFT JOIN template_tags tt ON t.id = tt.template_id
    WHERE t.user_id = p_user_id
    AND t.is_archived = false
    AND (p_search_term IS NULL OR 
         t.search_vector @@ to_tsquery('english', p_search_term) OR
         t.name ILIKE '%' || p_search_term || '%' OR
         t.description ILIKE '%' || p_search_term || '%')
    AND (p_category_id IS NULL OR t.category_id = p_category_id)
    AND (p_is_public IS NULL OR t.is_public = p_is_public)
    GROUP BY t.id, c.name
    HAVING (p_has_tags IS NULL OR 
           (p_has_tags = true AND COUNT(tt.id) > 0) OR
           (p_has_tags = false AND COUNT(tt.id) = 0))
    ORDER BY t.updated_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."search_templates"("p_user_id" "uuid", "p_search_term" "text", "p_category_id" "uuid", "p_has_tags" boolean, "p_is_public" boolean, "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suggest_tag_mappings"("p_template_id" "uuid", "p_confidence_threshold" numeric DEFAULT 0.6) RETURNS TABLE("tag_name" "text", "data_key" "text", "confidence" numeric, "usage_count" integer, "is_verified" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH template_tags AS (
        SELECT name
        FROM template_tags
        WHERE template_id = p_template_id
    ),
    user_mappings AS (
        SELECT
            dm.tag_name,
            dm.data_key,
            dm.mapping_confidence as confidence,
            dm.usage_count,
            dm.is_verified
        FROM data_mappings dm
        JOIN document_templates dt ON dm.template_id = dt.id
        WHERE dt.user_id = (
            SELECT user_id FROM document_templates WHERE id = p_template_id
        )
        AND dm.mapping_confidence >= p_confidence_threshold
    )
    SELECT
        tt.name as tag_name,
        um.data_key,
        um.confidence,
        um.usage_count,
        um.is_verified
    FROM template_tags tt
    LEFT JOIN user_mappings um ON tt.name = um.tag_name
    WHERE um.data_key IS NOT NULL
    ORDER BY tt.name, um.confidence DESC, um.usage_count DESC;
END;
$$;


ALTER FUNCTION "public"."suggest_tag_mappings"("p_template_id" "uuid", "p_confidence_threshold" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."template_version_has_mappings"("p_template_id" "uuid", "p_version" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."template_version_has_mappings"("p_template_id" "uuid", "p_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_template_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.original_filename, '')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_template_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ProofofDebitAPI" (
    "referenceno" "text",
    "date" "text",
    "time" "text",
    "bank" "text",
    "customername" "text",
    "nationalid" bigint,
    "customerno" bigint NOT NULL,
    "personalfinanceno" bigint,
    "accountno" "text",
    "Status" "text"
);


ALTER TABLE "public"."ProofofDebitAPI" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "tag_name" "text" NOT NULL,
    "data_key" "text" NOT NULL,
    "mapping_confidence" numeric(3,2) DEFAULT 0.0,
    "is_manual" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "usage_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "template_version" integer DEFAULT 1
);


ALTER TABLE "public"."data_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "template_id" "uuid",
    "generation_type" "text" DEFAULT 'single'::"text",
    "documents_count" integer DEFAULT 1,
    "input_data" "jsonb" NOT NULL,
    "output_filenames" "text"[] DEFAULT '{}'::"text"[],
    "file_urls" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'completed'::"text",
    "error_message" "text",
    "processing_time_ms" integer,
    "file_size_total" bigint DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "storage_path" "text",
    CONSTRAINT "document_generations_generation_type_check" CHECK (("generation_type" = ANY (ARRAY['single'::"text", 'batch'::"text"]))),
    CONSTRAINT "document_generations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."document_generations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "original_filename" "text" NOT NULL,
    "document_content" "text" NOT NULL,
    "document_html" "text" NOT NULL,
    "file_size" bigint DEFAULT 0,
    "file_type" "text" DEFAULT 'docx'::"text",
    "version" integer DEFAULT 1,
    "is_default" boolean DEFAULT false,
    "is_public" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "preview_image_url" "text",
    "usage_count" integer DEFAULT 0,
    "last_used_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "search_vector" "tsvector",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "storage_path" "text",
    "current_version" integer DEFAULT 1,
    "total_versions" integer DEFAULT 1
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "company" "text",
    "role" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."preferences" IS 'User preferences including onlyoffice_url and pdf_conversion_method';



CREATE TABLE IF NOT EXISTS "public"."template_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#3B82F6'::"text",
    "icon" "text" DEFAULT 'folder'::"text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."template_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_sharing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "shared_with_id" "uuid",
    "shared_with_email" "text",
    "permission_level" "text" DEFAULT 'view'::"text",
    "is_active" boolean DEFAULT true,
    "expires_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "template_sharing_permission_level_check" CHECK (("permission_level" = ANY (ARRAY['view'::"text", 'edit'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."template_sharing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "expected_value" "text",
    "data_type" "text" DEFAULT 'text'::"text",
    "is_required" boolean DEFAULT false,
    "default_value" "text",
    "validation_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "position_start" integer,
    "position_end" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "template_tags_data_type_check" CHECK (("data_type" = ANY (ARRAY['text'::"text", 'number'::"text", 'date'::"text", 'email'::"text", 'phone'::"text", 'url'::"text", 'boolean'::"text"])))
);


ALTER TABLE "public"."template_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "original_filename" "text" NOT NULL,
    "document_content" "text" NOT NULL,
    "document_html" "text" NOT NULL,
    "file_size" bigint DEFAULT 0,
    "storage_path" "text",
    "is_current" boolean DEFAULT false,
    "version_notes" "text",
    "created_by_user_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."template_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_activity_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['template_created'::"text", 'template_updated'::"text", 'template_deleted'::"text", 'template_used'::"text", 'document_generated'::"text", 'data_imported'::"text", 'tag_created'::"text", 'tag_updated'::"text", 'category_created'::"text", 'login'::"text", 'export_data'::"text"]))),
    CONSTRAINT "user_activity_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['template'::"text", 'document'::"text", 'tag'::"text", 'category'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."user_activity" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ProofofDebitAPI"
    ADD CONSTRAINT "ProofofDebitAPI_pkey" PRIMARY KEY ("customerno");



ALTER TABLE ONLY "public"."data_mappings"
    ADD CONSTRAINT "data_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_mappings"
    ADD CONSTRAINT "data_mappings_template_version_unique" UNIQUE ("template_id", "template_version", "tag_name", "data_key");



ALTER TABLE ONLY "public"."document_generations"
    ADD CONSTRAINT "document_generations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."template_categories"
    ADD CONSTRAINT "template_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_categories"
    ADD CONSTRAINT "template_categories_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."template_sharing"
    ADD CONSTRAINT "template_sharing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_sharing"
    ADD CONSTRAINT "template_sharing_template_id_shared_with_email_key" UNIQUE ("template_id", "shared_with_email");



ALTER TABLE ONLY "public"."template_sharing"
    ADD CONSTRAINT "template_sharing_template_id_shared_with_id_key" UNIQUE ("template_id", "shared_with_id");



ALTER TABLE ONLY "public"."template_tags"
    ADD CONSTRAINT "template_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_tags"
    ADD CONSTRAINT "template_tags_template_id_name_key" UNIQUE ("template_id", "name");



ALTER TABLE ONLY "public"."template_versions"
    ADD CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_versions"
    ADD CONSTRAINT "template_versions_template_id_excl" EXCLUDE USING "btree" ("template_id" WITH =) WHERE (("is_current" = true));



ALTER TABLE ONLY "public"."template_versions"
    ADD CONSTRAINT "template_versions_template_id_version_number_key" UNIQUE ("template_id", "version_number");



ALTER TABLE ONLY "public"."user_activity"
    ADD CONSTRAINT "user_activity_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_data_mappings_template_id" ON "public"."data_mappings" USING "btree" ("template_id");



CREATE INDEX "idx_data_mappings_template_version" ON "public"."data_mappings" USING "btree" ("template_id", "template_version");



CREATE INDEX "idx_document_generations_created_at" ON "public"."document_generations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_document_generations_storage_path" ON "public"."document_generations" USING "btree" ("storage_path") WHERE ("storage_path" IS NOT NULL);



CREATE INDEX "idx_document_generations_template_id" ON "public"."document_generations" USING "btree" ("template_id");



CREATE INDEX "idx_document_generations_user_id" ON "public"."document_generations" USING "btree" ("user_id");



CREATE INDEX "idx_document_templates_category_id" ON "public"."document_templates" USING "btree" ("category_id");



CREATE INDEX "idx_document_templates_name" ON "public"."document_templates" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_document_templates_search" ON "public"."document_templates" USING "gin" ("search_vector");



CREATE INDEX "idx_document_templates_storage_path" ON "public"."document_templates" USING "btree" ("storage_path") WHERE ("storage_path" IS NOT NULL);



CREATE INDEX "idx_document_templates_user_id" ON "public"."document_templates" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_user_id" ON "public"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_template_sharing_shared_with" ON "public"."template_sharing" USING "btree" ("shared_with_id");



CREATE INDEX "idx_template_sharing_template_id" ON "public"."template_sharing" USING "btree" ("template_id");



CREATE INDEX "idx_template_tags_name" ON "public"."template_tags" USING "btree" ("name");



CREATE INDEX "idx_template_tags_template_id" ON "public"."template_tags" USING "btree" ("template_id");



CREATE INDEX "idx_template_versions_created_at" ON "public"."template_versions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_template_versions_current" ON "public"."template_versions" USING "btree" ("template_id", "is_current") WHERE ("is_current" = true);



CREATE INDEX "idx_template_versions_template_id" ON "public"."template_versions" USING "btree" ("template_id");



CREATE INDEX "idx_template_versions_version_number" ON "public"."template_versions" USING "btree" ("template_id", "version_number");



CREATE INDEX "idx_user_activity_created_at" ON "public"."user_activity" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_activity_user_id" ON "public"."user_activity" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "create_initial_version_trigger" AFTER INSERT ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."create_initial_template_version"();



CREATE OR REPLACE TRIGGER "update_data_mappings_updated_at" BEFORE UPDATE ON "public"."data_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_document_templates_updated_at" BEFORE UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_template_categories_updated_at" BEFORE UPDATE ON "public"."template_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_template_search_vector_trigger" BEFORE INSERT OR UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_template_search_vector"();



CREATE OR REPLACE TRIGGER "update_template_sharing_updated_at" BEFORE UPDATE ON "public"."template_sharing" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_template_tags_updated_at" BEFORE UPDATE ON "public"."template_tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."data_mappings"
    ADD CONSTRAINT "data_mappings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_mappings"
    ADD CONSTRAINT "data_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_generations"
    ADD CONSTRAINT "document_generations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_generations"
    ADD CONSTRAINT "document_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."template_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_categories"
    ADD CONSTRAINT "template_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_sharing"
    ADD CONSTRAINT "template_sharing_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_sharing"
    ADD CONSTRAINT "template_sharing_shared_with_id_fkey" FOREIGN KEY ("shared_with_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_sharing"
    ADD CONSTRAINT "template_sharing_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_tags"
    ADD CONSTRAINT "template_tags_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_versions"
    ADD CONSTRAINT "template_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_versions"
    ADD CONSTRAINT "template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_versions"
    ADD CONSTRAINT "template_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_activity"
    ADD CONSTRAINT "user_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated users to read current records" ON "public"."ProofofDebitAPI" FOR SELECT TO "authenticated" USING (("Status" = 'Current'::"text"));



CREATE POLICY "Allow authenticated users to read new records" ON "public"."ProofofDebitAPI" FOR SELECT TO "authenticated" USING (("Status" = 'New'::"text"));



CREATE POLICY "Allow authenticated users to read processed records" ON "public"."ProofofDebitAPI" FOR SELECT TO "authenticated" USING (("Status" = ANY (ARRAY['Processed'::"text", 'Error'::"text"])));



CREATE POLICY "Allow authenticated users to update record status" ON "public"."ProofofDebitAPI" FOR UPDATE TO "authenticated" USING (("Status" = 'New'::"text")) WITH CHECK (("Status" = ANY (ARRAY['New'::"text", 'Current'::"text", 'Processed'::"text", 'Error'::"text"])));



ALTER TABLE "public"."ProofofDebitAPI" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "System can insert activity" ON "public"."user_activity" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create versions for own templates" ON "public"."template_versions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("created_by_user_id" = "auth"."uid"())));



CREATE POLICY "Users can delete versions of own templates" ON "public"."template_versions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile during signup" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own categories" ON "public"."template_categories" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own generations" ON "public"."document_generations" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own mappings" ON "public"."data_mappings" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own templates" ON "public"."document_templates" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage sharing for own templates" ON "public"."template_sharing" TO "authenticated" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can manage tags for own templates" ON "public"."template_tags" TO "authenticated" USING (("template_id" IN ( SELECT "document_templates"."id"
   FROM "public"."document_templates"
  WHERE ("document_templates"."user_id" = "auth"."uid"())))) WITH CHECK (("template_id" IN ( SELECT "document_templates"."id"
   FROM "public"."document_templates"
  WHERE ("document_templates"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update versions of own templates" ON "public"."template_versions" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own activity" ON "public"."user_activity" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view public templates" ON "public"."document_templates" FOR SELECT TO "authenticated" USING (("is_public" = true));



CREATE POLICY "Users can view shared templates" ON "public"."document_templates" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "template_sharing"."template_id"
   FROM "public"."template_sharing"
  WHERE (("template_sharing"."shared_with_id" = "auth"."uid"()) AND ("template_sharing"."is_active" = true) AND (("template_sharing"."expires_at" IS NULL) OR ("template_sharing"."expires_at" > "now"()))))));



CREATE POLICY "Users can view tags for accessible templates" ON "public"."template_tags" FOR SELECT TO "authenticated" USING (("template_id" IN ( SELECT "document_templates"."id"
   FROM "public"."document_templates"
  WHERE (("document_templates"."user_id" = "auth"."uid"()) OR ("document_templates"."is_public" = true) OR ("document_templates"."id" IN ( SELECT "template_sharing"."template_id"
           FROM "public"."template_sharing"
          WHERE (("template_sharing"."shared_with_id" = "auth"."uid"()) AND ("template_sharing"."is_active" = true) AND (("template_sharing"."expires_at" IS NULL) OR ("template_sharing"."expires_at" > "now"())))))))));



CREATE POLICY "Users can view templates shared with them" ON "public"."template_sharing" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "shared_with_id"));



CREATE POLICY "Users can view versions of own templates" ON "public"."template_versions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."data_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_generations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_sharing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_activity" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_onlyoffice_availability"("p_server_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_onlyoffice_availability"("p_server_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_onlyoffice_availability"("p_server_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_mappings_by_template"() TO "anon";
GRANT ALL ON FUNCTION "public"."count_mappings_by_template"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_mappings_by_template"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_initial_template_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_initial_template_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_initial_template_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_template_version"("p_template_id" "uuid", "p_original_filename" "text", "p_document_content" "text", "p_document_html" "text", "p_file_size" bigint, "p_storage_path" "text", "p_version_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_template_version"("p_template_id" "uuid", "p_original_filename" "text", "p_document_content" "text", "p_document_html" "text", "p_file_size" bigint, "p_storage_path" "text", "p_version_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_template_version"("p_template_id" "uuid", "p_original_filename" "text", "p_document_content" "text", "p_document_html" "text", "p_file_size" bigint, "p_storage_path" "text", "p_version_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_all_mappings"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_all_mappings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_all_mappings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_template_mappings"("p_template_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_template_mappings"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_template_mappings"("p_template_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_onlyoffice_server_url"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_onlyoffice_server_url"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_onlyoffice_server_url"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pdf_conversion_stats_v1"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pdf_conversion_stats_v1"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pdf_conversion_stats_v1"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shared_templates"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shared_templates"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_templates"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_template_usage_stats"("p_template_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_template_usage_stats"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_template_usage_stats"("p_template_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_template_version_history"("p_template_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_template_version_history"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_template_version_history"("p_template_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_template_version_mappings"("p_template_id" "uuid", "p_version" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_template_version_mappings"("p_template_id" "uuid", "p_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_template_version_mappings"("p_template_id" "uuid", "p_version" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_templates_shared_by_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_templates_shared_by_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_templates_shared_by_user"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_template_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_template_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_template_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_template_usage"("template_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_template_usage"("template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_template_usage"("template_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_pdf_conversion"("p_user_id" "uuid", "p_filename" "text", "p_server_url" "text", "p_success" boolean, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_pdf_conversion"("p_user_id" "uuid", "p_filename" "text", "p_server_url" "text", "p_success" boolean, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pdf_conversion"("p_user_id" "uuid", "p_filename" "text", "p_server_url" "text", "p_success" boolean, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_pdf_conversion_v1"("p_filename" "text", "p_server_url" "text", "p_conversion_method" "text", "p_success" boolean, "p_error_message" "text", "p_processing_time_ms" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."log_pdf_conversion_v1"("p_filename" "text", "p_server_url" "text", "p_conversion_method" "text", "p_success" boolean, "p_error_message" "text", "p_processing_time_ms" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pdf_conversion_v1"("p_filename" "text", "p_server_url" "text", "p_conversion_method" "text", "p_success" boolean, "p_error_message" "text", "p_processing_time_ms" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rollback_template_version"("p_template_id" "uuid", "p_version_number" integer, "p_rollback_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rollback_template_version"("p_template_id" "uuid", "p_version_number" integer, "p_rollback_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rollback_template_version"("p_template_id" "uuid", "p_version_number" integer, "p_rollback_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_templates"("p_user_id" "uuid", "p_search_term" "text", "p_category_id" "uuid", "p_has_tags" boolean, "p_is_public" boolean, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_templates"("p_user_id" "uuid", "p_search_term" "text", "p_category_id" "uuid", "p_has_tags" boolean, "p_is_public" boolean, "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_templates"("p_user_id" "uuid", "p_search_term" "text", "p_category_id" "uuid", "p_has_tags" boolean, "p_is_public" boolean, "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."suggest_tag_mappings"("p_template_id" "uuid", "p_confidence_threshold" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."suggest_tag_mappings"("p_template_id" "uuid", "p_confidence_threshold" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."suggest_tag_mappings"("p_template_id" "uuid", "p_confidence_threshold" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."template_version_has_mappings"("p_template_id" "uuid", "p_version" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."template_version_has_mappings"("p_template_id" "uuid", "p_version" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."template_version_has_mappings"("p_template_id" "uuid", "p_version" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_template_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_template_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_template_search_vector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."ProofofDebitAPI" TO "anon";
GRANT ALL ON TABLE "public"."ProofofDebitAPI" TO "authenticated";
GRANT ALL ON TABLE "public"."ProofofDebitAPI" TO "service_role";



GRANT ALL ON TABLE "public"."data_mappings" TO "anon";
GRANT ALL ON TABLE "public"."data_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."data_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."document_generations" TO "anon";
GRANT ALL ON TABLE "public"."document_generations" TO "authenticated";
GRANT ALL ON TABLE "public"."document_generations" TO "service_role";



GRANT ALL ON TABLE "public"."document_templates" TO "anon";
GRANT ALL ON TABLE "public"."document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."document_templates" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."template_categories" TO "anon";
GRANT ALL ON TABLE "public"."template_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."template_categories" TO "service_role";



GRANT ALL ON TABLE "public"."template_sharing" TO "anon";
GRANT ALL ON TABLE "public"."template_sharing" TO "authenticated";
GRANT ALL ON TABLE "public"."template_sharing" TO "service_role";



GRANT ALL ON TABLE "public"."template_tags" TO "anon";
GRANT ALL ON TABLE "public"."template_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."template_tags" TO "service_role";



GRANT ALL ON TABLE "public"."template_versions" TO "anon";
GRANT ALL ON TABLE "public"."template_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."template_versions" TO "service_role";



GRANT ALL ON TABLE "public"."user_activity" TO "anon";
GRANT ALL ON TABLE "public"."user_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activity" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
